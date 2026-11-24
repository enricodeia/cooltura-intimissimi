// The film's sound (V4): the music and the creators' own voices, mixed offline
// into one AudioBuffer that is a pure function of the cut, so the preview, the
// timeline and the MP4 hear exactly the same thing.
//
//   music   the original score (src/v4/score.js, cues from where the scenes start,
//           so it follows the cut) or a song from disk (any audio file: decoded,
//           levelled, its tempo and beats found by engine/beats.js, kept in this
//           browser so it is still there tomorrow)
//   voices  one window of a clip's original audio per protagonist video:
//           { key, at (film s), from, to (clip s), gain (dB) } (never two at once:
//           a later voice cuts the one before)
//   duck    under every voice the music goes down by `duck` dB (soft ramps)
//
// Browsers keep audio locked until the first click or key: the context is unlocked
// on the first gesture anywhere, and a play pressed before the mix is ready starts
// the sound as soon as it is. The engine asks clock() for the time while playing,
// so the picture follows what is heard.
//
// API for the UI: status ('idle' | 'rendering' | 'ready' | 'error'), muted, custom
// ({ name, offset, grid } or null), grid(), beatsIn(a, b, bars), waveform(cols),
// planOf(T, project).voices, loadTrack(file), restore(), setOffset(s), clearTrack(),
// setMuted(m), on(fn) → fn('status' | 'mix' | 'track' | 'mute').

const SR = 48000
const dbToGain = (db) => Math.pow(10, db / 20)
// optional modules (the studio runs without them)
const SCORE = import.meta.glob('../v4/score.js')
const BEATS = import.meta.glob('./beats.js')

// ------------------------------------------------------------------ a song kept in this browser (IndexedDB)

const DB = 'cooltura-intimissimi-audio'
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function idbGet(key) {
  const db = await idb()
  return new Promise((res) => {
    const q = db.transaction('kv').objectStore('kv').get(key)
    q.onsuccess = () => res(q.result ?? null)
    q.onerror = () => res(null)
  })
}
async function idbSet(key, value) {
  const db = await idb()
  return new Promise((res) => {
    const tx = db.transaction('kv', 'readwrite')
    value === null ? tx.objectStore('kv').delete(key) : tx.objectStore('kv').put(value, key)
    tx.oncomplete = () => res(true)
    tx.onerror = () => res(false)
  })
}

/**
 * The edges of a voice window moved onto the pauses of the clip's own sound: In to the deepest dip in the
 * 0.32 s before it (never later: a transcript tends to place a sentence's first word late), Out to the deepest
 * dip close to it (−0.12 / +0.03 s). The dips are 20 ms RMS levels, a little weighted by how far they move.
 */
export function snapVoice(buf, from, to) {
  const sr = buf.sampleRate
  const hop = Math.max(1, Math.round(sr * 0.01))
  if (!buf._env) {
    const n = Math.floor(buf.length / hop)
    const ch = []
    for (let c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c))
    const e = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i * hop - hop)
      const b = Math.min(buf.length, i * hop + hop)
      let sum = 0
      for (const d of ch) for (let j = a; j < b; j++) sum += d[j] * d[j]
      e[i] = 10 * Math.log10(sum / Math.max(1, (b - a) * ch.length) + 1e-12)
    }
    buf._env = e
  }
  const e = buf._env
  const best = (t, lo, hi, w) => {
    let bt = t
    let bc = Infinity
    for (let i = Math.max(0, Math.round((t + lo) * 100)); i <= Math.min(e.length - 1, Math.round((t + hi) * 100)); i++) {
      const c = e[i] + w * Math.abs(i / 100 - t)
      if (c < bc) {
        bc = c
        bt = i / 100
      }
    }
    return bt
  }
  let f = best(from, -0.32, 0, 8)
  let o = best(to, -0.12, 0.03, 15)
  if (o - f < 0.3) {
    f = from
    o = to
  }
  return { from: Math.max(0, f), to: Math.min(buf.duration, o) }
}

/** A song with [from, to] played twice (a short equal-power crossfade at the splice). */
function repeatStretch(buf, from, to) {
  const sr = buf.sampleRate
  const a = Math.round(from * sr)
  const b = Math.round(to * sr)
  const len = b - a
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: buf.length + len, sampleRate: sr })
  const xf = Math.round(0.012 * sr)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    dst.set(src.subarray(0, b), 0) // … up to `to`
    dst.set(src.subarray(a), b) // then from `from` again, to the end
    // the splice at b: the end of the first pass fades into the second
    for (let i = 0; i < xf && b + i < dst.length && b + i < src.length; i++) {
      const k = i / xf
      dst[b + i] = src[b + i] * Math.cos((k * Math.PI) / 2) + src[a + i] * Math.sin((k * Math.PI) / 2)
    }
  }
  return out
}

/** The level of a song's full sections (dBFS RMS): the 80th percentile of its half-second windows, so a quiet
 *  intro or a long tail does not make the loud parts louder than the voices. */
function levelOf(buf) {
  const sr = buf.sampleRate
  const win = Math.round(sr * 0.5)
  const L = buf.getChannelData(0)
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const levels = []
  for (let a = 0; a + win <= buf.length; a += win) {
    let s = 0
    for (let i = a; i < a + win; i += 2) s += L[i] * L[i] + R[i] * R[i]
    levels.push(10 * Math.log10(s / win + 1e-12))
  }
  if (!levels.length) return -20
  levels.sort((x, y) => x - y)
  return levels[Math.min(levels.length - 1, Math.floor(levels.length * 0.8))]
}

export class Soundtrack {
  constructor({ engine, plan, base = import.meta.env.BASE_URL, storeKey = 'v4', defaultTrack = null }) {
    this.engine = engine
    // the song the film is cut on (V4: Dreambound), used unless another song was loaded or the score chosen
    this.defaultTrack = defaultTrack ? { ...defaultTrack, url: base + defaultTrack.url } : null
    this.planOf = plan
    this.base = base + 'media/'
    this.storeKey = 'track:' + storeKey
    this.ctx = null
    this.mix = null // AudioBuffer of the whole film
    this.peaks = null
    this.version = 0
    this.clips = new Map() // key → Promise<AudioBuffer>
    this.scoreCache = { key: '', buffer: null }
    this.custom = null // { name, buffer, offset, gain, grid }: a song from disk replaces the score
    this.cues = null
    this.src = null
    this.startedAt = 0
    this.offset = 0
    this.muted = false
    this.pending = false
    this.status = 'idle'
    this.error = ''
    this.listeners = new Set()
    this._timer = 0
    this._rendering = null
    // unlock on the first gesture anywhere
    const go = () => {
      const c = this.context()
      if (c.state !== 'running') c.resume().catch(() => {})
    }
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, go, { capture: true, passive: true })
  }

  on(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  emit(what) {
    for (const fn of this.listeners) fn(what)
  }
  setStatus(s, err = '') {
    this.status = s
    this.error = err
    this.emit('status')
  }
  context() {
    if (!this.ctx) this.ctx = new AudioContext({ sampleRate: SR, latencyHint: 'interactive' })
    return this.ctx
  }

  /** The musical grid on the film's clock: the score's (120 BPM from 0) or the song's (moved by its offset); null for a song whose beats are unknown. */
  grid() {
    if (this.custom?.grid) {
      const g = this.custom.grid
      const beat = g.beat
      const b0 = (((g.beat0 - this.custom.offset) % beat) + beat) % beat
      const d0 = (((g.downbeat0 - this.custom.offset) % (beat * 4)) + beat * 4) % (beat * 4)
      return { bpm: g.bpm, beat, beat0: b0, downbeat0: d0, confidence: g.confidence, source: 'song' }
    }
    if (this.custom) return null
    return { bpm: 120, beat: 0.5, beat0: 0, downbeat0: 0, confidence: 1, source: 'score' }
  }
  /** Beat (or bar, with bars = true) times between a and b, film seconds. */
  beatsIn(a, b, bars = false) {
    const g = this.grid()
    if (!g) return []
    const step = bars ? g.beat * 4 : g.beat
    const t0 = bars ? g.downbeat0 : g.beat0
    const out = []
    for (let t = t0 + Math.ceil((a - t0) / step - 1e-9) * step; t <= b + 1e-6; t += step) out.push(t)
    return out
  }

  /** The original audio of a clip ('v4/comm-corinne.mp4' → media/v4/comm-corinne.m4a), decoded once. */
  clip(key) {
    const url = this.base + key.replace(/\.mp4$/, '.m4a')
    if (!this.clips.has(key))
      this.clips.set(
        key,
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: ${r.status}`))))
          .then((b) => this.context().decodeAudioData(b)),
      )
    return this.clips.get(key)
  }

  /** Re-render soon (after an edit). */
  invalidate(delay = 260) {
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this.render().catch((e) => console.warn('[audio]', e)), delay)
  }

  async score(plan, duration) {
    if (this.custom) return this.custom.buffer
    const key = JSON.stringify([plan.cues, plan.music, Math.ceil(duration * 10)])
    if (this.scoreCache.key === key && this.scoreCache.buffer) return this.scoreCache.buffer
    let buffer = null
    try {
      const load = SCORE['../v4/score.js']
      if (!load) throw new Error('no src/v4/score.js')
      const { renderScore } = await load()
      const r = await renderScore({ duration, sampleRate: SR, cues: plan.cues, mix: plan.music })
      buffer = r.buffer
      this.cues = r.cues
    } catch (e) {
      console.warn('[audio] score unavailable', e)
    }
    this.scoreCache = { key, buffer }
    return buffer
  }

  /** The whole film's mix. */
  async render() {
    const engine = this.engine
    const T = engine.store.timeline
    const duration = Math.max(0.5, T.duration)
    const plan = this.planOf(T, engine.store.project)
    const v = ++this.version
    this.setStatus('rendering')
    const job = (async () => {
      const music = await this.score(plan, duration)
      const voices = []
      for (const w of plan.voices) {
        try {
          voices.push({ ...w, buf: await this.clip(w.key) })
        } catch (e) {
          console.warn('[audio] voice', w.key, e)
        }
      }
      if (v !== this.version) return null
      const len = Math.ceil(duration * SR)
      const oc = new OfflineAudioContext(2, len, SR)
      const master = oc.createGain()
      master.gain.value = dbToGain(plan.level ?? 0)
      const comp = oc.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 8
      comp.ratio.value = 2
      comp.attack.value = 0.01
      comp.release.value = 0.25
      const lim = oc.createDynamicsCompressor()
      lim.threshold.value = -3.2
      lim.knee.value = 0
      lim.ratio.value = 20
      lim.attack.value = 0.002
      lim.release.value = 0.08
      master.connect(comp).connect(lim).connect(oc.destination)

      // a sentence's own edges sit on the pauses around its words (the deepest dip of the voice near each edge),
      // so it never starts or ends inside a word; then the sound runs on over the time its video is on screen
      // (lead before, tail after: it comes in as the video arrives, it goes as the video leaves), within the
      // clip (never into its last frames, where the picture glides to a hold). The window moves on the film as it
      // moves in the clip: the lips stay on the sound.
      for (const w of voices) {
        if (!w.buf) continue
        // (V4: the plan has already set each window to the time its video is on screen; only a sentence's own
        // edges move, onto their pauses, by a few hundredths)
        const r = w.snapIn === false && w.snapOut === false ? w : snapVoice(w.buf, w.from, w.to)
        if (w.snapIn !== false) {
          w.at += r.from - w.from
          w.from = r.from
        }
        if (w.snapOut !== false) w.to = Math.max(w.from + 0.1, r.to)
        w.to = Math.min(w.buf.duration - 0.05, w.to)
        w.fadeIn ??= 0.035
        w.fadeOut ??= 0.09
      }
      // voices: never two at once (a later one cuts the one before, through its fade)
      const ordered = voices.filter((w) => w.buf && w.to > w.from + 0.05).sort((a, b) => a.at - b.at)
      ordered.forEach((w, i) => {
        const next = ordered[i + 1]
        w.len = Math.min(w.to - w.from, next ? Math.max(0.05, next.at - w.at + (next.fadeIn > 0.06 ? next.fadeIn * 0.5 : 0)) : Infinity, duration - w.at)
      })
      for (const w of ordered) {
        if (w.len <= 0.05 || w.at >= duration) continue
        const s = oc.createBufferSource()
        s.buffer = w.buf
        const g = oc.createGain()
        const peak = dbToGain(w.gain ?? 0) * dbToGain(plan.voice ?? 0)
        const t0 = Math.max(0, w.at)
        const skip = t0 - w.at
        const L = w.len - skip
        const fi = Math.min(w.fadeIn, L * 0.45)
        const fo = Math.min(w.fadeOut, L * 0.45)
        // smooth ramps (a raised cosine), in as it arrives, out as it leaves
        const curve = (from, to) => Float32Array.from({ length: 64 }, (_, k) => from + (to - from) * (0.5 - 0.5 * Math.cos((Math.PI * k) / 63)))
        g.gain.setValueAtTime(0, t0)
        g.gain.setValueCurveAtTime(curve(0, peak), t0, Math.max(0.01, fi))
        g.gain.setValueAtTime(peak, t0 + fi + 0.001)
        g.gain.setValueCurveAtTime(curve(peak, 0), Math.max(t0 + fi + 0.002, t0 + L - fo), Math.max(0.01, Math.min(fo, L - fi - 0.002)))
        s.connect(g).connect(master)
        s.start(t0, Math.max(0, w.from + skip), Math.max(0.01, w.len - skip))
      }

      // the music, ducked under every voice
      if (music && !plan.noMusic) {
        const s = oc.createBufferSource()
        s.buffer = music
        const g = oc.createGain()
        // a song from disk: levelled to sit like the score, then the music slider
        const base = this.custom ? dbToGain((this.custom.gain ?? 0) + (plan.music?.level ?? 0)) : 1
        const low = base * dbToGain(-(plan.duck ?? 12))
        const ramp = 0.22
        g.gain.setValueAtTime(base, 0)
        // each voice can say how far the music goes down under it (V4: the block's own ducking)
        // the music goes down as a video's sound comes in and back up as it goes (with its fades; a sentence
        // cut on its words: down just before the first one, back over the last one's decay)
        const wins = []
        for (const w of ordered) {
          if (w.len <= 0.05) continue
          const long = (w.fadeIn ?? 0) > 0.06
          const a0 = long ? w.at - 0.08 : w.at - 0.06 - ramp
          const a1 = long ? w.at + Math.min(w.fadeIn, w.len * 0.45) : w.at - 0.06
          const end = w.at + w.len
          const b0 = end - Math.max(0.1, Math.min(w.fadeOut ?? 0.09, w.len * 0.45))
          const b1 = end + 0.25
          const d = w.duck ?? plan.duck ?? 12
          const last = wins[wins.length - 1]
          if (last && a0 <= last[3]) {
            last[2] = Math.max(last[2], b0)
            last[3] = Math.max(last[3], b1)
            last[4] = Math.max(last[4], d)
          } else wins.push([a0, a1, b0, b1, d])
        }
        for (const [a0, a1, b0, b1, d] of wins) {
          const lo = d === (plan.duck ?? 12) ? low : base * dbToGain(-d)
          g.gain.setValueAtTime(base, Math.max(0, a0))
          g.gain.linearRampToValueAtTime(lo, Math.max(0.001, a1))
          g.gain.setValueAtTime(lo, Math.max(0.002, b0))
          g.gain.linearRampToValueAtTime(base, b1)
        }
        // a song: a fade over the last second, so it never stops dead
        if (this.custom) {
          g.gain.setValueAtTime(base, Math.max(0, duration - 1.2))
          g.gain.linearRampToValueAtTime(0, duration)
        }
        s.connect(g).connect(master)
        const off = this.custom?.offset ?? 0
        if (off >= 0) s.start(0, off)
        else s.start(-off)
      }
      const buf = await oc.startRendering()
      if (v !== this.version) return null
      this.mix = buf
      this.peaks = null
      this.setStatus('ready')
      this.emit('mix')
      // the new mix while playing (or a play pressed before it was ready): carry on from here
      if (this.engine.playing && !this.muted) this.start(this.engine.time)
      return buf
    })().catch((e) => {
      this.setStatus('error', String(e?.message || e))
      throw e
    })
    this._rendering = job
    return job
  }

  /** Min / max of the mix per column (the timeline's waveform), cached. */
  waveform(cols) {
    const mix = this.mix
    if (!mix || cols < 1) return null
    if (this.peaks && this.peaks.cols === cols) return this.peaks
    const L = mix.getChannelData(0)
    const R = mix.getChannelData(1)
    const per = mix.length / cols
    const lo = new Float32Array(cols)
    const hi = new Float32Array(cols)
    for (let c = 0; c < cols; c++) {
      let mn = 0
      let mx = 0
      const a = Math.floor(c * per)
      const b = Math.min(mix.length, Math.floor((c + 1) * per))
      for (let i = a; i < b; i += 4) {
        const x = (L[i] + R[i]) * 0.5
        if (x < mn) mn = x
        if (x > mx) mx = x
      }
      lo[c] = mn
      hi[c] = mx
    }
    this.peaks = { cols, lo, hi, duration: mix.duration }
    return this.peaks
  }

  /** Mixed audio between two film times (export). */
  async slice(from, to) {
    if (!this.mix || this.status === 'rendering') await (this._rendering || this.render())
    const mix = this.mix
    if (!mix) return null
    const a = Math.max(0, Math.round(from * SR))
    const b = Math.min(mix.length, Math.round(to * SR))
    const out = new AudioBuffer({ numberOfChannels: 2, length: Math.max(1, b - a), sampleRate: SR })
    for (let c = 0; c < 2; c++) out.copyToChannel(mix.getChannelData(c).subarray(a, b), c)
    return out
  }

  // ------------------------------------------------------------ playback (the preview)

  start(t) {
    this.stop()
    const ctx = this.context()
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    if (this.muted) return
    if (!this.mix) {
      this.pending = true // render() starts it when the mix is ready
      return
    }
    this.pending = false
    const s = ctx.createBufferSource()
    s.buffer = this.mix
    s.connect(ctx.destination)
    const lead = 0.03
    this.startedAt = ctx.currentTime + lead
    this.offset = t
    s.start(this.startedAt, Math.max(0, t))
    this.src = s
  }
  stop() {
    this.pending = false
    if (this.src) {
      try {
        this.src.stop()
      } catch {}
      this.src.disconnect()
      this.src = null
    }
  }
  /** The film time the listener hears now (null when no sound is playing). */
  clock() {
    if (!this.src || !this.ctx || this.ctx.state !== 'running') return null
    const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0
    return this.offset + Math.max(0, this.ctx.currentTime - this.startedAt - lat)
  }
  setMuted(m) {
    this.muted = m
    if (m) this.stop()
    else if (this.engine.playing) this.start(this.engine.time)
    this.emit('mute')
  }

  // ------------------------------------------------------------ a song from disk

  async analyze(buffer) {
    const load = BEATS['./beats.js']
    if (!load) return null
    try {
      const { analyzeBeats } = await load()
      return analyzeBeats(buffer, { preferBpm: 120 })
    } catch (e) {
      console.warn('[audio] beats', e)
      return null
    }
  }

  /** A song from disk replaces the score: decoded, levelled to about −16 dB RMS, its beats found, kept in this browser. */
  async loadTrack(file, { offset = 0, keep = true, repeat = null } = {}) {
    this.setStatus('rendering')
    const data = await file.arrayBuffer()
    let buffer = await this.context().decodeAudioData(data.slice(0))
    // an edit of the song: each [from, to] played twice (whole bars: the beat grid stays in phase); the
    // latest first, so the times of the earlier ones (song seconds) still hold
    const reps = (Array.isArray(repeat) ? repeat : repeat ? [repeat] : []).filter((r) => r && r.to > r.from).sort((a, b) => b.from - a.from)
    for (const r of reps) buffer = repeatStretch(buffer, r.from, r.to)
    const grid = await this.analyze(buffer)
    // its full sections levelled to about −19 dB RMS: under the voices (−16 dB more) it is a bed, between them it carries
    const gain = Math.max(-24, Math.min(12, -19 - levelOf(buffer)))
    this.custom = { name: file.name, buffer, offset, gain, grid, duration: buffer.duration }
    if (keep) idbSet(this.storeKey, { name: file.name, type: file.type, data, offset }).catch(() => {})
    this.invalidate(0)
    this.emit('track')
    return this.custom
  }
  /** The song kept from last time; else the default song (unless the score was chosen). */
  async restore() {
    try {
      const v = await idbGet(this.storeKey)
      if (v?.data) {
        await this.loadTrack(new File([v.data], v.name, { type: v.type || 'audio/mpeg' }), { offset: v.offset || 0, keep: false })
        return true
      }
      if (v?.cleared || !this.defaultTrack) return false
      return await this.useDefault({ remember: false })
    } catch (e) {
      console.warn('[audio] restore', e)
      return false
    }
  }
  /** The default song (V4: Dreambound, its offset puts its ending on the final logos). */
  async useDefault({ remember = true } = {}) {
    const d = this.defaultTrack
    if (!d) return false
    const r = await fetch(d.url)
    if (!r.ok) return false
    const blob = await r.blob()
    await this.loadTrack(new File([blob], d.name, { type: blob.type || 'audio/mpeg' }), { offset: d.offset ?? 0, keep: false, repeat: d.repeat || null })
    this.custom.isDefault = true
    if (remember) idbSet(this.storeKey, null).catch(() => {})
    this.emit('track')
    return true
  }
  /** Where the song starts: its second that plays at the film's 0. */
  setOffset(s) {
    if (!this.custom) return
    this.custom.offset = Math.max(0, Number(s) || 0)
    idbGet(this.storeKey)
      .then((v) => v && idbSet(this.storeKey, { ...v, offset: this.custom.offset }))
      .catch(() => {})
    this.invalidate(120)
    this.emit('track')
  }
  /** The original score instead of any song (remembered: the default song does not come back by itself). */
  clearTrack() {
    this.custom = null
    this.scoreCache.key = ''
    idbSet(this.storeKey, { cleared: true }).catch(() => {})
    this.invalidate(0)
    this.emit('track')
  }
}
