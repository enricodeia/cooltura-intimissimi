// Beat tracking, measured (src/engine/beats.js). Nobody listens: every claim is a number.
//
//   node tools/beats-test.mjs [--out <dir>] [--score | --score-wav <file>] [--song <file>]... [--deep]
//
//   synthetic   drum tracks generated here with a known grid (75 … 170 BPM, swing, syncopation,
//               noise beds, a sparse intro, 48 kHz, 10 minutes): bpm ±0.5, beat0 and every beat
//               ±15 ms, the downbeat where the kicks mark the bar; no beat at all and tempo ramps
//               must say confidence < 0.3
//   --score     renders the film's score first (node tools/score.mjs: needs the dev server on :5410)
//   --score-wav a WAV of the score rendered before. Truth: 120 BPM, beats from 0, bars every 2 s from 0
//   --song      a real song, any format ffmpeg reads (repeatable; never copied anywhere). No truth:
//               ear-free checks instead (onset strength on the beats vs between them, the kick on
//               the downbeats, where the sections enter, where the attacks sit, the ID3 TBPM tag)
//   --deep      per song also: shifted, time-stretched, sped up, resampled, mono, excerpts → the
//               grid must move exactly as the edit says
//   odd inputs  silence, too short, mono, 6 channels, 8 / 22.05 / 96 kHz, a narrow bpm range
//   contract    every result: bpm in range with 2 decimals, 0 ≤ beat0 < beat, the beats and bars
//               one grid to the end, 0 ≤ confidence ≤ 1, the onset strength 0..1 over the song
//   snapCuts    unit tests (order, no two on one beat, min gap, bars) and 500 random cut lists
//   time        the analysis of a 3-minute track (and of every song, per 3 minutes)
//
// Writes <out>/beats-test.json and, per song, <out>/<name>-grid.svg (12 s of onset strength with the
// beats and bars). Exit code 1 when anything with a truth fails.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { analyzeBeats, snapCuts } from '../src/engine/beats.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const TAU = Math.PI * 2

function args(argv) {
  const o = { song: [] }
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const k = argv[i].slice(2)
    const next = argv[i + 1]
    const v = next === undefined || next.startsWith('--') ? true : argv[++i]
    if (k === 'song') o.song.push(v)
    else o[k] = v
  }
  return o
}
const opt = args(process.argv.slice(2))
const OUT = path.resolve(opt.out || path.join(os.tmpdir(), 'cooltura-beats'))
fs.mkdirSync(OUT, { recursive: true })
const report = { synthetic: [], score: null, songs: [], snapCuts: [], timing: null }
let failures = 0
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : String(v))
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v))
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : String(v))
/** Signed distance a - b on a circle of period P (−P/2..P/2). */
const circ = (a, b, P) => {
  const d = (((a - b) % P) + P) % P
  return d > P / 2 ? d - P : d
}
const median = (a) => {
  const s = [...a].sort((p, q) => p - q)
  return s.length ? s[s.length >> 1] : NaN
}

// ---------------------------------------------------------------- audio in

/** Decode any file with ffmpeg into an AudioBuffer-like object (float PCM, deinterleaved). */
function decode(file, { sr = 44100, ch = 2, af = null, ss = null, t = null } = {}) {
  const a = ['-hide_banner', '-v', 'error']
  if (ss !== null) a.push('-ss', String(ss))
  if (t !== null) a.push('-t', String(t))
  a.push('-i', file)
  if (af) a.push('-af', af)
  a.push('-f', 'f32le', '-ac', String(ch), '-ar', String(sr), 'pipe:1')
  const r = spawnSync('ffmpeg', a, { maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(`ffmpeg ${file}: ${String(r.stderr).trim()}`)
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength >> 2)
  const n = Math.floor(f.length / ch)
  const chans = []
  for (let c = 0; c < ch; c++) {
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++) x[i] = f[i * ch + c]
    chans.push(x)
  }
  return { sampleRate: sr, numberOfChannels: ch, length: n, duration: n / sr, getChannelData: (c) => chans[c] }
}

// ---------------------------------------------------------------- synthetic tracks

function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One drum hit: kick (pitch-swept sine + click), snare, clap, closed / open hat, clicks. */
function hit(kind, sr, rnd, vel) {
  const dur = { kick: 0.4, snare: 0.3, clap: 0.3, hat: 0.06, ohat: 0.3, click: 0.03, clickhi: 0.03 }[kind]
  const y = new Float32Array(Math.round(sr * dur))
  let ph = 0
  let lp = 0
  let hpIn = 0
  let hpOut = 0
  for (let i = 0; i < y.length; i++) {
    const t = i / sr
    const w = rnd() * 2 - 1
    let v = 0
    if (kind === 'kick') {
      ph += (TAU * (48 + 110 * Math.exp(-t / 0.03))) / sr
      v = Math.sin(ph) * Math.exp(-t / 0.2) * Math.min(1, t / 0.0006) + w * 0.25 * Math.exp(-t / 0.002)
    } else if (kind === 'snare') {
      ph += (TAU * 185) / sr
      hpOut = 0.9 * (hpOut + w - hpIn)
      hpIn = w
      v = 0.45 * Math.sin(ph) * Math.exp(-t / 0.05) + 0.7 * hpOut * Math.exp(-t / 0.085)
    } else if (kind === 'clap') {
      hpOut = 0.85 * (hpOut + w - hpIn)
      hpIn = w
      lp += 0.5 * (hpOut - lp)
      v = 0.8 * lp * (Math.exp(-t / 0.004) + (t > 0.009 ? Math.exp(-(t - 0.009) / 0.004) : 0) + (t > 0.018 ? Math.exp(-(t - 0.018) / 0.06) : 0))
    } else if (kind === 'hat' || kind === 'ohat') {
      hpOut = 0.5 * (hpOut + w - hpIn)
      hpIn = w
      v = 0.5 * hpOut * Math.exp(-t / (kind === 'hat' ? 0.02 : 0.12))
    } else {
      ph += (TAU * (kind === 'clickhi' ? 1600 : 1000)) / sr
      v = Math.sin(ph) * Math.exp(-t / 0.008)
    }
    y[i] = v * vel
  }
  return y
}

const eighths = (vOn, vOff) => [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((p) => ['hat', p, p % 1 ? vOff : vOn])
const sixteenths = (vOn, vOff) => Array.from({ length: 16 }, (_, i) => ['hat', i / 4, i % 2 ? vOff : vOn])
// [instrument, position in the bar (beats from the downbeat), velocity]
const PATTERNS = {
  rock: [['kick', 0, 1], ['kick', 2, 0.9], ['snare', 1, 0.9], ['snare', 3, 0.9], ...eighths(0.7, 0.5)],
  rock16: [['kick', 0, 1], ['kick', 2, 0.9], ['snare', 1, 0.9], ['snare', 3, 0.9], ...sixteenths(0.55, 0.35)],
  swing: [
    ['kick', 0, 1],
    ['kick', 2, 0.9],
    ['snare', 1, 0.9],
    ['snare', 3, 0.9],
    ['snare', 5 / 3, 0.25],
    ['snare', 11 / 3, 0.3],
    ...[0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3].map((p) => ['hat', p, p % 1 ? 0.6 : 0.75]),
  ],
  synco: [['kick', 0, 1], ['kick', 2, 0.85], ['kick', 2.5, 0.7], ['kick', 3.75, 0.5], ['snare', 1, 0.9], ['snare', 3, 0.9], ['snare', 1.75, 0.3], ['snare', 3.25, 0.25], ...sixteenths(0.5, 0.3)],
  house: [['kick', 0, 1], ['kick', 1, 1], ['kick', 2, 1], ['kick', 3, 1], ['clap', 1, 0.8], ['clap', 3, 0.8], ...[0.5, 1.5, 2.5, 3.5].map((p) => ['ohat', p, 0.7]), ...sixteenths(0.2, 0.2)],
  halftime: [['kick', 0, 1], ['kick', 2, 0.6], ['kick', 2.5, 0.8], ['snare', 1, 0.9], ['snare', 3, 0.9], ...sixteenths(0.55, 0.35)],
  dnb: [['kick', 0, 1], ['kick', 2.5, 0.85], ['snare', 1, 1], ['snare', 3, 1], ...eighths(0.5, 0.5)],
  trap: [['kick', 0, 1], ['kick', 1.5, 0.8], ['snare', 2, 1], ...sixteenths(0.55, 0.35)], // half-time: the snare on 3
  click: [
    ['clickhi', 0, 1],
    ['click', 1, 0.7],
    ['click', 2, 0.7],
    ['click', 3, 0.7],
  ],
}
const CHORDS = [
  [46, 62, 65, 69],
  [48, 64, 67, 72],
  [45, 60, 64, 67],
  [50, 62, 65, 69],
] // Bb C Am Dm (MIDI, root first)
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

/**
 * A synthetic track. beat0: the first beat (s); barPos: the bar position (0..3) of that beat;
 * intro: bars of chords only before the drums; ramp: [bpm at 0, bpm at the end] instead of bpm;
 * humanize: ± s of random timing per hit; noise: level of a pink noise bed.
 */
function track({ bpm, beat0 = 0.37, barPos = 0, dur = 40, sr = 44100, style = 'rock', noise = 0, chords = false, bass = false, intro = 0, ramp = null, humanize = 0, seed = 7 }) {
  const n = Math.round(dur * sr)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const rnd = prng(seed)
  const beats = []
  for (let t = beat0; t < dur + 1; ) {
    beats.push(t)
    t += 60 / (ramp ? ramp[0] + (ramp[1] - ramp[0]) * Math.min(1, t / dur) : bpm)
  }
  const timeOf = (b) => {
    const i = Math.floor(b)
    return i + 1 < beats.length ? beats[i] + (b - i) * (beats[i + 1] - beats[i]) : beats[beats.length - 1]
  }
  const put = (y, t, gain, pan = 0) => {
    const i0 = Math.round(t * sr)
    for (let i = Math.max(0, -i0); i < y.length && i0 + i < n; i++) {
      L[i0 + i] += y[i] * gain * (1 - pan * 0.5)
      R[i0 + i] += y[i] * gain * (1 + pan * 0.5)
    }
  }
  const nb = beats.length
  for (let k = -barPos; k < nb; k += 4) {
    const bar = Math.floor((k + barPos) / 4)
    if (bar < intro) continue
    for (const [kind, pos, vel] of PATTERNS[style]) {
      const b = k + pos
      if (b < 0 || b >= nb - 1) continue
      const t = timeOf(b) + (humanize ? (rnd() * 2 - 1) * humanize : 0)
      put(hit(kind, sr, rnd, vel * (0.92 + 0.08 * rnd())), t, 0.5, kind.includes('hat') ? 0.4 : 0)
    }
  }
  if (chords || bass)
    for (let k = -barPos; k < nb; k += 4) {
      if (k + 4 <= 0) continue
      const ch = CHORDS[((Math.floor((k + barPos) / 4) % 4) + 4) % 4]
      const t0 = timeOf(Math.max(0, k))
      const len = Math.round((timeOf(Math.min(nb - 1, k + 4)) - t0) * sr)
      if (chords && len > 0) {
        const y = new Float32Array(len)
        for (const m of ch.slice(1)) {
          const f = mtof(m + 12)
          for (let i = 0; i < len; i++) {
            const t = i / sr
            const env = Math.min(1, t / 0.03) * Math.exp(-t / 2.5) * Math.min(1, (len - i) / (0.01 * sr))
            y[i] += 0.035 * env * (Math.sin(TAU * f * t) + 0.3 * Math.sin(2 * TAU * f * t) + 0.1 * Math.sin(3 * TAU * f * t))
          }
        }
        put(y, t0, 1)
      }
      if (bass) {
        const f = mtof(ch[0] - 12)
        for (const pos of style === 'house' ? [0.5, 1.5, 2.5, 3.5] : [0, 2.5]) {
          const b = k + pos
          if (b < 0 || b >= nb - 1) continue
          const y = new Float32Array(Math.round(0.25 * sr))
          for (let i = 0; i < y.length; i++) y[i] = 0.3 * Math.sin((TAU * f * i) / sr) * Math.min(1, i / sr / 0.004) * Math.exp(-i / sr / 0.15)
          put(y, timeOf(b), 1)
        }
      }
    }
  if (noise) {
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < n; i++) {
      const w = rnd() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      const p = (b0 + b1 + b2 + w * 0.1848) * 0.2 * noise
      L[i] += p
      R[i] += p * 0.9
    }
  }
  const P = 60 / bpm
  return { sampleRate: sr, numberOfChannels: 2, length: n, getChannelData: (c) => (c ? R : L), truth: { bpm, P, beat0: ((beat0 % P) + P) % P, downbeat0: beat0 + ((4 - barPos) % 4) * P } }
}

/** Buffers with no beat at all. */
function noBeat(kind, dur = 40, sr = 44100) {
  const n = Math.round(dur * sr)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const rnd = prng(3)
  if (kind === 'noise')
    for (let i = 0; i < n; i++) {
      L[i] = (rnd() * 2 - 1) * 0.3
      R[i] = (rnd() * 2 - 1) * 0.3
    }
  else if (kind === 'random hits')
    for (let t = 0.2; t < dur - 1; t += -Math.log(1 - rnd()) / 3) {
      const i0 = Math.round(t * sr)
      const f = 80 + rnd() * 2000
      for (let i = 0; i < 0.2 * sr; i++) {
        const v = Math.sin((TAU * f * i) / sr) * Math.exp(-i / sr / 0.05) * 0.4
        L[i0 + i] += v
        R[i0 + i] += v
      }
    }
  else
    for (let i = 0; i < n; i++) {
      const t = i / sr
      let v = 0
      for (const m of [
        [57, 60, 64],
        [53, 57, 60],
        [55, 59, 62],
        [52, 55, 59],
      ][Math.floor(t / 3.7) % 4])
        v += Math.sin(TAU * mtof(m) * t) * 0.08
      L[i] = R[i] = v
    }
  return { sampleRate: sr, numberOfChannels: 2, length: n, getChannelData: (c) => (c ? R : L) }
}

/** The result contract of analyzeBeats (types, ranges, one consistent grid). → the broken rules. */
function contract(r, duration, { minBpm = 70, maxBpm = 180 } = {}) {
  const bad = []
  const eq = (a, b, tol) => Math.abs(a - b) <= tol
  if (!(r.bpm >= minBpm && r.bpm <= maxBpm) || !eq(Math.round(r.bpm * 100), r.bpm * 100, 1e-6)) bad.push('bpm in range, 2 decimals')
  if (!eq((r.beat * r.bpm) / 60, 1, 1e-4)) bad.push('beat = 60 / bpm')
  if (!(r.beat0 >= 0 && r.beat0 < r.beat)) bad.push('0 ≤ beat0 < beat')
  const k = (r.downbeat0 - r.beat0) / r.beat
  if (!(k > -1e-4 && k < 3 + 1e-4 && eq(k, Math.round(k), 1e-3))) bad.push('downbeat0 = beat0 + k·beat, k in 0..3')
  const grid = (a, t0, step) => a.length > 0 && eq(a[0], t0, 1e-4) && a.every((t, i) => eq(t, t0 + i * step, 1e-4)) && a[a.length - 1] < duration && a[a.length - 1] + step >= duration - 1e-4
  if (!grid(r.beats, r.beat0, r.beat)) bad.push('beats: beat0 + k·beat to the end')
  if (!grid(r.bars, r.downbeat0, 4 * r.beat)) bad.push('bars: downbeat0 + 4k·beat to the end')
  if (!(r.confidence >= 0 && r.confidence <= 1)) bad.push('0 ≤ confidence ≤ 1')
  const e = r.onset && r.onset.env
  if (!(e instanceof Float32Array) || !(r.onset.hop > 0) || Math.abs(e.length * r.onset.hop - duration) > 2 * r.onset.hop || !e.every((v) => v >= 0 && v <= 1))
    bad.push('onset: { hop, env 0..1 over the whole song }')
  return bad
}
const checkContract = (label, r, duration, o) => {
  const bad = contract(r, duration, o)
  report.contract = report.contract || []
  report.contract.push({ label, bad })
  if (bad.length) {
    failures++
    console.log(`FAIL  contract of ${label}: ${bad.join('; ')}`)
  }
}

// ---------------------------------------------------------------- 1. synthetic

console.log('\n== synthetic (truth known)')
const CASES = [
  ['92 rock, 8th hats', { bpm: 92, style: 'rock' }],
  ['100 swung hats + ghost snares, noise', { bpm: 100, style: 'swing', noise: 0.05, barPos: 1 }],
  ['118.5 syncopated, chords, noise', { bpm: 118.5, style: 'synco', noise: 0.08, chords: true, bass: true, barPos: 2 }],
  ['120 rock, first beat at 0', { bpm: 120, style: 'rock', beat0: 0 }],
  ['120 rock, first beat at 0.49', { bpm: 120, style: 'rock', beat0: 0.49 }],
  ['120 click track, accent on 1', { bpm: 120, style: 'click', barPos: 3, kicks: false }],
  ['128 house: 4-floor, offbeat bass, chords, noise', { bpm: 128, style: 'house', noise: 0.05, chords: true, bass: true, barPos: 1 }],
  ['140 rock, 16th hats, noise', { bpm: 140, style: 'rock16', noise: 0.08, barPos: 2 }],
  ['75 half-time R&B, chords', { bpm: 75, style: 'halftime', chords: true, bass: true }],
  ['170 drum & bass', { bpm: 170, style: 'dnb' }],
  ['96 rock after 4 bars of chords only', { bpm: 96, style: 'rock', intro: 4, chords: true }],
  ['110 rock, ±8 ms human timing, noise', { bpm: 110, style: 'rock', humanize: 0.008, noise: 0.03, barPos: 3 }],
  ['124 house at 48 kHz', { bpm: 124, style: 'house', sr: 48000, chords: true, bass: true, barPos: 2 }],
  ['85 boom-bap, loud 8th hats (170 must not win)', { bpm: 85, style: 'rock', barPos: 1 }],
  ['123.37 house, chords, noise, 10 minutes', { bpm: 123.37, style: 'house', chords: true, bass: true, noise: 0.04, dur: 600, beat0: 0.21, barPos: 3 }],
]
for (const [name, o] of CASES) {
  const tr = track(o)
  const t0 = performance.now()
  const r = analyzeBeats(tr)
  const ms = performance.now() - t0
  const { P } = tr.truth
  const dBpm = r.bpm - tr.truth.bpm
  const e0 = circ(r.beat0, tr.truth.beat0, P) * 1000
  const dd = circ(r.downbeat0, tr.truth.downbeat0, 4 * P) / P
  const down = o.kicks === false ? 'n/a' : Math.abs(dd) < 0.5 ? 'ok' : `off ${dd > 0 ? '+' : ''}${Math.round(dd)}`
  // the worst distance between a true beat and the grid, over the whole track
  let worst = 0
  for (let t = tr.truth.beat0; t < tr.length / tr.sampleRate; t += P) worst = Math.max(worst, Math.abs(t - (r.beat0 + Math.round((t - r.beat0) / r.beat) * r.beat)))
  worst *= 1000
  const ok = Math.abs(dBpm) <= 0.5 && Math.abs(e0) <= 15 && worst <= 15 && !down.startsWith('off')
  if (!ok) failures++
  report.synthetic.push({ name, truth: tr.truth, bpm: r.bpm, beat0: r.beat0, downbeat0: r.downbeat0, confidence: r.confidence, dBpm, beat0ErrMs: e0, worstBeatErrMs: worst, downbeat: down, ms, ok })
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} bpm ${String(r.bpm).padStart(6)} (Δ ${f2(dBpm)})  beat0 Δ ${f1(e0).padStart(5)} ms  worst beat ${f1(worst).padStart(4)} ms  downbeat ${down.padEnd(6)} conf ${f2(r.confidence)}  ${f1(ms)} ms`,
  )
  checkContract(name, r, tr.length / tr.sampleRate)
}
console.log('-- no beat / no fixed tempo: the confidence must say so (< 0.3)')
for (const [name, buf] of [
  ['white noise', noBeat('noise')],
  ['random hits (Poisson, 3/s)', noBeat('random hits')],
  ['sustained chords, no attacks', noBeat('pad')],
  ['tempo ramp 110 → 130 BPM over 60 s', track({ bpm: 120, ramp: [110, 130], dur: 60, noise: 0.03 })],
  ['tempo ramp 118 → 122 BPM over 60 s', track({ bpm: 120, ramp: [118, 122], dur: 60, noise: 0.03 })],
]) {
  const r = analyzeBeats(buf)
  const ok = r.confidence < 0.3
  if (!ok) failures++
  report.synthetic.push({ name, bpm: r.bpm, confidence: r.confidence, ok })
  checkContract(name, r, buf.length / buf.sampleRate)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} bpm ${String(r.bpm).padStart(6)}  confidence ${f3(r.confidence)}`)
}

// ---------------------------------------------------------------- ear-free checks (score and songs)

/** Linear interpolation of the onset strength at time t (s). */
const onsetAt = (r, t) => {
  const x = t / r.onset.hop
  const i = Math.floor(x)
  if (i < 0 || i + 1 >= r.onset.env.length) return NaN
  return r.onset.env[i] + (r.onset.env[i + 1] - r.onset.env[i]) * (x - i)
}
const meanOf = (r, times) => {
  let s = 0
  let n = 0
  for (const t of times) {
    const v = onsetAt(r, t)
    if (Number.isFinite(v)) {
      s += v
      n++
    }
  }
  return n ? s / n : NaN
}

/** Mono, low-passed below 150 Hz (two one-poles) and the full band, as Float32Arrays. */
function bands(buf) {
  const C = buf.numberOfChannels
  const n = buf.length
  const m = new Float32Array(n)
  for (let c = 0; c < C; c++) {
    const x = buf.getChannelData(c)
    for (let i = 0; i < n; i++) m[i] += x[i] / C
  }
  const lo = new Float32Array(n)
  const a = Math.exp((-TAU * 150) / buf.sampleRate)
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < n; i++) {
    y1 = (1 - a) * m[i] + a * y1
    y2 = (1 - a) * y1 + a * y2
    lo[i] = y2
  }
  return { m, lo }
}
const energy = (x, sr, t0, t1) => {
  const a = Math.max(0, Math.round(t0 * sr))
  const b = Math.min(x.length, Math.round(t1 * sr))
  let e = 0
  for (let i = a; i < b; i++) e += x[i] * x[i]
  return b > a ? e / (b - a) : NaN
}

/**
 * Checks that need no ears, on a result r of the buffer buf:
 *   onBeat / halfBeat   onset strength exactly on the beats vs half a beat later (the grid sits on
 *                       the onsets, not between them)
 *   quarter             … vs a quarter beat later
 *   downbeat / others   onset strength and the kick (< 150 Hz energy step, 0-60 ms after vs 60-0 ms
 *                       before) on the downbeats vs the other beats
 *   sections            the 10 largest sustained loudness jumps (beat vs the two before, held 3 beats):
 *                       how many land on each bar position
 *   attack              the beat-synchronous average of the 2 ms energy envelope (no filter): its
 *                       steepest rise, in ms from the grid
 */
function earFree(buf, r) {
  const sr = buf.sampleRate
  const P = r.beat
  const B = r.beats
  const out = {}
  out.onBeat = meanOf(r, B)
  out.halfBeat = meanOf(
    r,
    B.map((t) => t + P / 2),
  )
  out.quarter = meanOf(
    r,
    B.map((t) => t + P / 4),
  )
  out.beatVsHalf = out.onBeat / out.halfBeat
  const p0 = Math.round((r.downbeat0 - r.beat0) / P)
  const isDown = (k) => (((k - p0) % 4) + 4) % 4 === 0
  out.onsetDown = meanOf(
    r,
    B.filter((_, k) => isDown(k)),
  )
  out.onsetOthers = meanOf(
    r,
    B.filter((_, k) => !isDown(k)),
  )
  const { m, lo } = bands(buf)
  const kick = [0, 0, 0, 0]
  const kn = [0, 0, 0, 0]
  const loud = []
  B.forEach((t, k) => {
    const j = (((k - p0) % 4) + 4) % 4
    const s = energy(lo, sr, t, t + 0.06) - energy(lo, sr, t - 0.06, t)
    if (Number.isFinite(s)) {
      kick[j] += s
      kn[j]++
    }
    loud.push(10 * Math.log10(energy(m, sr, t, t + P) + 1e-12))
  })
  const kickPos = kick.map((v, j) => v / Math.max(1, kn[j]))
  const kickMax = Math.max(...kickPos.map(Math.abs)) || 1
  out.kickByBarPos = kickPos.map((v) => +(v / kickMax).toFixed(3))
  const jumps = []
  for (let k = 2; k + 2 < loud.length; k++) jumps.push([k, Math.min(loud[k], loud[k + 1], loud[k + 2]) - Math.max(loud[k - 1], loud[k - 2])])
  jumps.sort((a, b) => b[1] - a[1])
  out.sectionsByBarPos = [0, 0, 0, 0]
  for (const [k] of jumps.slice(0, 10)) out.sectionsByBarPos[(((k - p0) % 4) + 4) % 4]++
  // attack: 2 ms energy envelope, ±40 ms around every beat, averaged in dB; steepest 2 ms rise
  const step = 0.0005
  const half = Math.round(0.04 / step)
  const w = Math.round(0.001 * sr)
  const avg = new Float64Array(2 * half + 1)
  let used = 0
  for (const t of B) {
    if (t < 0.05 || t > buf.length / sr - 0.05) continue
    for (let d = -half; d <= half; d++) {
      const c = Math.round((t + d * step) * sr)
      let e = 0
      for (let i = c - w; i <= c + w; i++) e += m[i] * m[i]
      avg[d + half] += 10 * Math.log10(e / (2 * w + 1) + 1e-12)
    }
    used++
  }
  let best = 0
  let bestV = -Infinity
  const g = Math.round(0.001 / step)
  for (let d = g; d < avg.length - g; d++) {
    const v = avg[d + g] - avg[d - g]
    if (v > bestV) {
      bestV = v
      best = d
    }
  }
  out.attackMs = used ? (best - half) * step * 1000 : NaN
  return out
}

/** 12 s of onset strength with the beats (grey) and bars (red), as an SVG. */
function svg(r, from, file) {
  const W = 1600
  const H = 260
  const span = 12
  const x = (t) => (((t - from) / span) * W).toFixed(1)
  const pts = []
  for (let t = from; t < from + span; t += r.onset.hop) {
    const v = onsetAt(r, t)
    if (Number.isFinite(v)) pts.push(`${x(t)},${(H - 20 - v * (H - 40)).toFixed(1)}`)
  }
  const lines = []
  for (const t of r.beats) if (t >= from && t < from + span) lines.push(`<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H}" stroke="#bbb"/>`)
  for (const t of r.bars) if (t >= from && t < from + span) lines.push(`<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H}" stroke="#d33" stroke-width="2"/>`)
  fs.writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>${lines.join('')}<polyline fill="none" stroke="#123" stroke-width="1.5" points="${pts.join(' ')}"/><text x="8" y="16" font-family="sans-serif" font-size="13">${r.bpm} BPM, ${from.toFixed(1)}-${(from + span).toFixed(1)} s: onset strength, beats (grey), bars (red)</text></svg>`,
  )
}

function timed(buf, runs = 1) {
  const ms = []
  let r
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    r = analyzeBeats(buf)
    ms.push(performance.now() - t0)
  }
  return { r, ms }
}

// ---------------------------------------------------------------- 2. the score

let scoreWav = typeof opt['score-wav'] === 'string' ? opt['score-wav'] : null
if (opt.score) {
  console.log('\n== rendering the score (node tools/score.mjs)')
  const dir = path.join(OUT, 'score')
  const run = spawnSync(process.execPath, [path.join(ROOT, 'tools/score.mjs'), '--out', dir], { encoding: 'utf8', maxBuffer: 64 << 20 })
  if (run.status === 0 && fs.existsSync(path.join(dir, 'score.wav'))) scoreWav = path.join(dir, 'score.wav')
  else console.log('   score render failed, skipped:', (run.stderr || run.stdout || '').trim().split('\n').slice(-3).join(' | '))
}
if (scoreWav) {
  console.log('\n== the film score (truth: 120 BPM, beats from 0, bars every 2 s from 0)')
  const buf = decode(scoreWav, { sr: 48000 })
  const { r, ms } = timed(buf)
  const e0 = circ(r.beat0, 0, 0.5) * 1000
  const eBar = circ(r.downbeat0, 0, 2) * 1000
  const ok = Math.abs(r.bpm - 120) <= 0.5 && Math.abs(e0) <= 15 && Math.abs(eBar) <= 15
  if (!ok) failures++
  // the worst grid error over the whole film (the fixed grid against the true one)
  const worst = Math.max(...r.beats.map((t) => Math.abs(circ(t, 0, 0.5)))) * 1000
  const ef = earFree(buf, r)
  checkContract('the score', r, buf.length / buf.sampleRate)
  report.score = { wav: scoreWav, bpm: r.bpm, beat0: r.beat0, downbeat0: r.downbeat0, confidence: r.confidence, beat0ErrMs: e0, downbeatErrMs: eBar, worstBeatErrMs: worst, ms: ms[0], earFree: ef, ok }
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  bpm ${r.bpm}  beat0 ${f3(r.beat0)} (Δ ${f1(e0)} ms)  downbeat0 ${f3(r.downbeat0)} (Δ ${f1(eBar)} ms)  worst beat over ${f1(buf.length / 48000)} s ${f1(worst)} ms  conf ${f2(r.confidence)}  ${f1(ms[0])} ms`,
  )
  console.log(`      onset on beats ${f3(ef.onBeat)} vs half-beats ${f3(ef.halfBeat)} (×${f2(ef.beatVsHalf)}), kick by bar position ${ef.kickByBarPos.join(' / ')}`)
}

// ---------------------------------------------------------------- 3. real songs

for (const file of opt.song) {
  const name = path.basename(file).replace(/\.[^.]+$/, '')
  console.log(`\n== ${name}`)
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:format_tags', '-of', 'json', file], { encoding: 'utf8' })
  const tags = probe.status === 0 ? JSON.parse(probe.stdout).format?.tags || {} : {}
  const tbpm = Object.entries(tags).find(([k]) => /^(tbpm|bpm)$/i.test(k))?.[1] ?? null
  const buf = decode(file)
  const { r, ms } = timed(buf, 5)
  checkContract(name, r, buf.duration)
  const ef = earFree(buf, r)
  const song = { file, duration: buf.duration, bpm: r.bpm, beat: r.beat, beat0: r.beat0, downbeat0: r.downbeat0, confidence: r.confidence, tbpm, msFirst: ms[0], msMedian: median(ms), earFree: ef }
  console.log(
    `bpm ${r.bpm}  beat0 ${f3(r.beat0)} s  downbeat0 ${f3(r.downbeat0)} s  confidence ${f2(r.confidence)}  ID3 TBPM ${tbpm ?? 'none'}  (${f1(buf.duration)} s analysed in ${f1(ms[0])} ms first run, ${f1(median(ms))} ms median of 5)`,
  )
  console.log(`  onset strength on beats ${f3(ef.onBeat)} vs half-beat offsets ${f3(ef.halfBeat)} (×${f2(ef.beatVsHalf)}) vs quarter offsets ${f3(ef.quarter)}`)
  console.log(`  downbeats vs other beats: onset ${f3(ef.onsetDown)} vs ${f3(ef.onsetOthers)}; kick (<150 Hz step) by bar position 1..4: ${ef.kickByBarPos.join(' / ')}`)
  console.log(
    `  the 10 largest section entries by bar position 1..4: ${ef.sectionsByBarPos.join(' / ')};  attack (steepest rise of the beat-synchronous energy) at ${f1(ef.attackMs)} ms from the grid`,
  )
  svg(r, Math.min(Math.max(0, buf.duration / 2 - 6), buf.duration - 12), path.join(OUT, `${name.replace(/[^\w.-]+/g, '_')}-grid.svg`))
  if (opt.deep) {
    const P = r.beat
    const inv = []
    const check = (label, b, expect) => {
      const x = analyzeBeats(b)
      const row = { label, bpm: x.bpm, confidence: x.confidence }
      if (expect.k) row.bpmRatioErrPct = (x.bpm / (r.bpm * expect.k) - 1) * 100
      if (expect.shift !== undefined) {
        row.gridErrMs = circ(x.beat0 + expect.shift, r.beat0, P) * 1000
        row.downbeatMoved = Math.round(circ(x.downbeat0 + expect.shift, r.downbeat0, 4 * P) / P)
      }
      inv.push(row)
      console.log(
        `  ${label.padEnd(30)} bpm ${String(x.bpm).padStart(6)}${row.bpmRatioErrPct !== undefined ? ` (expected ${f2(r.bpm * expect.k)}, ${f3(row.bpmRatioErrPct)} %)` : ''}${row.gridErrMs !== undefined ? `  grid ${f1(row.gridErrMs)} ms, downbeat ${row.downbeatMoved ? `moved ${row.downbeatMoved} beat(s)` : 'same'}` : ''}  conf ${f2(x.confidence)}`,
      )
    }
    check('+0.25 s of silence in front', decode(file, { af: 'adelay=11025S:all=1' }), { k: 1, shift: -0.25 })
    check('+0.1234 s of silence in front', decode(file, { af: 'adelay=5442S:all=1' }), { k: 1, shift: -5442 / 44100 })
    check('resampled to 48 kHz', decode(file, { sr: 48000 }), { k: 1, shift: 0 })
    check('mono, 22.05 kHz', decode(file, { sr: 22050, ch: 1 }), { k: 1, shift: 0 })
    check('time-stretched ×1.06 (atempo)', decode(file, { af: 'atempo=1.06' }), { k: 1.06 })
    check('time-stretched ×0.95 (atempo)', decode(file, { af: 'atempo=0.95' }), { k: 0.95 })
    check('sped up ×1.04 (pitch too)', decode(file, { af: 'asetrate=44100*1.04,aresample=44100' }), { k: 1.04 })
    for (const ss of [10, 50, 100]) if (ss + 45 <= buf.duration) check(`excerpt ${ss}-${ss + 45} s`, decode(file, { ss, t: 45 }), { k: 1, shift: ss })
    song.invariance = inv
  }
  report.songs.push(song)
}

// ---------------------------------------------------------------- 4. odd inputs

console.log('\n== odd inputs (the contract must hold, the grid must stay right)')
{
  const base = track({ bpm: 120, style: 'rock', dur: 20 })
  const silent = { sampleRate: 44100, numberOfChannels: 2, length: 44100 * 5, getChannelData: () => new Float32Array(44100 * 5) }
  const six = { sampleRate: 44100, numberOfChannels: 6, length: base.length, getChannelData: (c) => base.getChannelData(c % 2) }
  const mono = { sampleRate: 44100, numberOfChannels: 1, length: base.length, getChannelData: () => base.getChannelData(0) }
  const rows = [
    ['silence, 5 s', silent, {}, null],
    ['1.5 s (too short: the fallback)', track({ bpm: 120, style: 'rock', dur: 1.5 }), {}, null],
    ['3 s of rock', track({ bpm: 120, style: 'rock', dur: 3 }), {}, 120],
    ['mono', mono, {}, 120],
    ['6 channels', six, {}, 120],
    ['22.05 kHz', track({ bpm: 120, style: 'rock', dur: 20, sr: 22050 }), {}, 120],
    ['96 kHz', track({ bpm: 120, style: 'rock', dur: 20, sr: 96000 }), {}, 120],
    ['8 kHz', track({ bpm: 120, style: 'rock', dur: 20, sr: 8000 }), {}, 120],
    ['140 rock, range 60-100 → its half', track({ bpm: 140, style: 'rock', dur: 20 }), { minBpm: 60, maxBpm: 100 }, 70],
    ['100 rock, preferBpm 60', track({ bpm: 100, style: 'rock', dur: 20 }), { preferBpm: 60 }, 100],
    ['trap at 140, snare on 3: felt at 70', track({ bpm: 140, style: 'trap', dur: 30 }), {}, 70],
    ['… the same with minBpm 100 → 140', track({ bpm: 140, style: 'trap', dur: 30 }), { minBpm: 100 }, 140],
  ]
  for (const [name, buf, o, want] of rows) {
    const r = analyzeBeats(buf, o)
    const dur = buf.length / buf.sampleRate
    const bad = dur >= 2 && r.onset ? contract(r, dur, o) : r.confidence === 0 && r.beat0 === 0 ? [] : ['fallback: preferred tempo from 0, confidence 0']
    const ok = !bad.length && (want === null || Math.abs(r.bpm - want) <= 0.5)
    if (!ok) failures++
    report.contract = report.contract || []
    report.contract.push({ label: name, bpm: r.bpm, bad, ok })
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(40)} bpm ${String(r.bpm).padStart(6)}  beat0 ${f3(r.beat0)}  confidence ${f3(r.confidence)}  beats ${r.beats.length}${bad.length ? '  ' + bad.join('; ') : ''}`,
    )
  }
}

// ---------------------------------------------------------------- 5. snapCuts

console.log('\n== snapCuts')
const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9)
const unit = (name, got, want) => {
  const ok = near(got, want)
  if (!ok) failures++
  report.snapCuts.push({ name, got, want, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} → [${got.join(', ')}]${ok ? '' : `  want [${want.join(', ')}]`}`)
}
const G = { beat: 0.5, beat0: 0.1 }
const GB = { beat: 0.5, beat0: 0.1, downbeat0: 0.6 } // bars at 0.6, 2.6, 4.6 …
unit('each cut to its nearest beat', snapCuts([0.32, 0.86, 1.4], G), [0.1, 1.1, 1.6])
unit('three cuts nearest one beat: pushed to the next free ones', snapCuts([1.0, 1.05, 1.1], G), [1.1, 1.6, 2.1])
unit('min gap 0.25 s on a 0.2 s grid skips a beat', snapCuts([1.0, 1.2, 1.4], { beat: 0.2, beat0: 0 }), [1, 1.4, 1.8])
unit('min 0: still never two on one beat', snapCuts([1.0, 1.01], G, { min: 0 }), [1.1, 1.6])
unit('bars: to the downbeat within half a bar, else the beat', snapCuts([1.2, 2.3, 3.0], GB, { bars: [true, true, false] }), [0.6, 2.6, 3.1])
unit('bars: the downbeat taken → the next free beat', snapCuts([2.5, 2.7], GB, { bars: [true, true] }), [2.6, 3.1])
unit('bars: no downbeat within half a bar → the nearest beat', snapCuts([0.12], { beat: 0.5, beat0: 0.1, downbeat0: 1.6 }, { bars: [true] }), [0.1])
unit('a synthetic { beat, beat0 } grid: bars every 4 beats from beat0', snapCuts([1.9, 4.2], { beat: 0.5, beat0: 0 }, { bars: [true, true] }), [2, 4])
unit('empty in, empty out', snapCuts([], G), [])
unit('no grid → the times unchanged', snapCuts([0.3, 0.7], { beat: 0 }), [0.3, 0.7])
unit('a time that is not a number → the next free beat', snapCuts([1, NaN, 2], { beat: 0.5, beat0: 0 }), [1, 1.5, 2])
unit('bars: null → plain beats', snapCuts([1.1, 2.2], { beat: 0.5, beat0: 0 }, { bars: null }), [1, 2])
{
  // properties over random cut lists on a real analysis grid
  const grid = analyzeBeats(track({ bpm: 124, style: 'house', chords: true, dur: 30 }))
  const rnd = prng(11)
  let bad = 0
  for (let n = 0; n < 500; n++) {
    const times = []
    for (let t = rnd() * 2; t < 28; t += rnd() * 1.5) times.push(+t.toFixed(3))
    const bars = times.map(() => rnd() < 0.3)
    const min = [0, 0.25, 0.6][n % 3]
    const out = snapCuts(times, grid, { bars, min })
    const onGrid = out.every((t) => Math.abs((t - grid.beat0) / grid.beat - Math.round((t - grid.beat0) / grid.beat)) < 1e-4)
    const increasing = out.every((t, i) => i === 0 || t > out[i - 1] + 1e-9)
    const gaps = out.every((t, i) => i === 0 || t - out[i - 1] >= min - 1e-9)
    // a bar cut lands on a downbeat whenever its nearest downbeat was within half a bar and free
    let barsOk = true
    let prev = -Infinity
    out.forEach((t, i) => {
      if (bars[i]) {
        const d = grid.downbeat0 + Math.round((times[i] - grid.downbeat0) / (4 * grid.beat)) * 4 * grid.beat
        const free = d > prev + 1e-6 && d >= prev + min - 1e-6 && d >= 0 // outputs are rounded to 1 µs
        if (free && Math.abs(d - times[i]) <= 2 * grid.beat && Math.abs(t - d) > 1e-6) barsOk = false
      }
      prev = t
    })
    if (out.length !== times.length || !onGrid || !increasing || !gaps || !barsOk) bad++
  }
  const ok = bad === 0
  if (!ok) failures++
  report.snapCuts.push({ name: 'properties over 500 random cut lists', bad, ok })
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  500 random cut lists (grid of a real analysis, min 0 / 0.25 / 0.6 s): same length, on the grid, strictly increasing, gaps ≥ min, bar cuts on the downbeat when it was free (${bad} bad)`,
  )
}

// ---------------------------------------------------------------- 6. time

console.log('\n== analysis time')
{
  const buf = track({ bpm: 124, style: 'house', chords: true, bass: true, noise: 0.05, dur: 180 })
  const { ms } = timed(buf, 7)
  report.timing = { syntheticSeconds: 180, firstMs: ms[0], medianMs: median(ms), maxMs: Math.max(...ms), runs: ms }
  console.log(`a 3-minute track (synthetic, 44.1 kHz stereo): first run ${f1(ms[0])} ms, median of 7 ${f1(median(ms))} ms, slowest ${f1(Math.max(...ms))} ms (Node ${process.version})`)
  for (const s of report.songs)
    console.log(`${path.basename(s.file)} (${f1(s.duration)} s): first run ${f1(s.msFirst)} ms, median ${f1(s.msMedian)} ms → ${f1((s.msMedian / s.duration) * 180)} ms per 3 minutes`)
}

fs.writeFileSync(path.join(OUT, 'beats-test.json'), JSON.stringify(report, null, 1))
console.log(`\n${failures ? `${failures} FAILED` : 'all passed'} → ${path.join(OUT, 'beats-test.json')}`)
process.exit(failures ? 1 : 0)
