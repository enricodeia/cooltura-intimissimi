// What V4 sounds like at each moment, read from the cut (engine/audio.js mixes it):
//   cues    where the score changes, from where the scenes start: the groove under
//           the campaigns, the peak of the results (an accent on every KPI), the drop
//           on "Let's go beyond numbers", the pulse under the values, the build into
//           Venice, the stop on "The best part?", the final hit on the logos
//   voices  the protagonists' own audio, one window (or two: a pause cut out) per
//           voiced block, placed where the block says
// Edit a block and the music and the voices follow it.

import { LOOK } from './model.js'
import { keyOf, voiceAtOf, voiceSpanOf } from './common.js'
import { BEAT } from './model.js'
import { deckPlan } from './deck.js'
import { heroKeyOf } from '../machina/plan.js'

export function soundPlan(T, project, videos) {
  const look = { ...LOOK.defaults, ...(project.look || {}) }
  const first = (type) => T.shots.find((s) => s.type === type)
  const scene = (id) => T.scene(id)
  const kp = first('kpis')
  const nK = kp ? 4 + (kp.p.fifthOn ? 1 : 0) : 0
  const logos = T.shots.filter((s) => s.type === 'hudlogo')
  const end = logos.length > 1 ? logos[logos.length - 1] : null
  const cues = {
    groove: T.shot('platforms')?.start ?? scene('line')?.start,
    peak: scene('results')?.start,
    hits: kp ? Array.from({ length: nK }, (_, k) => kp.start + kp.p.kAt + k * kp.p.every) : [],
    drop: T.shot('beyond')?.start ?? scene('beyond')?.start,
    pulse: T.shot('v1')?.start,
    build: T.shot('v3')?.start,
    stop: scene('closing')?.start,
    final: end ? end.start + (end.p.xAt ?? 0) : undefined,
  }
  for (const k of Object.keys(cues)) if (cues[k] === undefined || cues[k] === null) delete cues[k]

  // a video's own sound is heard for as long as the video is on screen: it comes in as the video arrives
  // (a [a, a1]) and goes as the video leaves ([b0, b]); the sentence of the panel (In / Out) is where the
  // block places it, lips on the sound. lead / tail: how far the sound runs before / after the sentence.
  const [aw, ah] = String(project.aspect || '16:9').split(':').map(Number)
  const portrait = aw / ah < 0.9
  const voices = []
  const add = (key, at, p, pre, duck, a, a1, b0, b) => {
    const f1 = p[pre + 'From'] ?? 0
    const t1 = p[pre + 'To'] ?? 0
    const f2 = p[pre + '2From'] ?? 0
    const t2 = p[pre + '2To'] ?? 0
    const gain = p[pre + 'Gain'] ?? 0
    const two = t2 > f2 + 0.05
    // the windows of the clip as the picture plays them (lips on the sound): film time ↔ clip time
    const wins = [{ at, from: f1, to: t1 }]
    if (two) wins.push({ at: at + (t1 - f1), from: f2, to: t2 })
    // the picture is the clip's own time only between its first and last frames' glides (softClipTime):
    // the sound never goes where the picture slows down, so it never drifts from the lips
    const dur = videos.manifest[key] || 6
    const E = Math.max(0.2, dur - 0.08)
    const mLo = Math.min(0.15, E / 6) + 0.02
    const mHi = E - Math.min(0.5, E / 3) - 0.02
    wins.forEach((w, i) => {
      // run on before the first window / after the last one, over the time the video is on screen
      let s0 = i === 0 ? Math.min(w.at, a) : w.at
      let s1 = i === wins.length - 1 ? Math.max(w.at + (w.to - w.from), b) : w.at + (w.to - w.from)
      // …and only then: never before the video is there, never after it has gone, never off the clip's own time
      s0 = Math.max(s0, a, w.at + (mLo - w.from))
      s1 = Math.min(s1, b, w.at + (mHi - w.from))
      if (s1 - s0 < 0.15) return
      const snapIn = Math.abs(s0 - w.at) < 0.01
      const snapOut = Math.abs(s1 - (w.at + (w.to - w.from))) < 0.01
      voices.push({
        key,
        at: s0,
        from: w.from + (s0 - w.at),
        to: w.from + (s1 - w.at),
        gain,
        duck,
        snapIn,
        snapOut,
        // in as the video arrives / out as it leaves; on a sentence's own edge a short ramp on its pause
        fadeIn: snapIn ? 0.035 : Math.max(0.12, Math.min(0.5, a1 - s0)),
        fadeOut: snapOut ? 0.09 : Math.max(0.2, Math.min(0.5, s1 >= b - 0.01 ? b - b0 : 0.3)),
      })
    })
  }
  for (const sh of T.shots) {
    const p = sh.p
    if (!p.voiceOn || p.voiceFrom === undefined || sh.type === 'deck') continue
    let key = null
    if (sh.type === 'creators') key = heroKeyOf(p.heroKey)
    else if (sh.type === 'campaigns') {
      // the creator who speaks on the 5 campaigns
      if (!p.heroOn) continue
      key = heroKeyOf(p.heroKey)
    } else {
      const list = p.videos || []
      // the wheel: the one who comes forward (clamped to the list, as the picture does)
      const item = sh.type === 'wheel' ? list[Math.max(0, Math.min(list.length - 1, Math.round(p.hero) - 1))] : list[0]
      key = keyOf(videos, item)
    }
    if (!key) continue
    // every clip of the library carries its own sound (media/…/<clip>.m4a); its block says when it starts
    const at = sh.start + voiceAtOf(sh.type, p, sh.dur, videos.manifest[key] || 6, portrait)
    const duck = p.voiceDuck ?? look.duck
    let a = at
    let a1 = at + 0.05
    let b0 = sh.end - 0.4
    let b = sh.end
    if (sh.type === 'campaigns') {
      // her frame rises just before her voice; she goes out of the frame as the camera pulls back on the 311
      a = at - 0.14
      a1 = at + 0.25
      const cr = T.shots.find((s) => s.type === 'creators' && s.start >= sh.end - 0.01)
      b = cr ? cr.start + (cr.p.pbAt ?? 0) + 0.36 : sh.end
      b0 = b - 0.34
    } else if (sh.type === 'wheel') {
      // she comes forward from the wheel, and goes back into it
      a = sh.start + (p.heroAt ?? 0.25) + (p.heroDur ?? 0.7) * 0.25
      a1 = sh.start + (p.heroAt ?? 0.25) + (p.heroDur ?? 0.7)
      b0 = sh.end - (p.backAt ?? 0.45)
      b = b0 + 0.45
    } else if (sh.type === 'community') {
      a = sh.start
      a1 = sh.start + (p.inDur ?? 0.55)
      b0 = sh.end - (p.outLead ?? 0.28)
      b = sh.end
    }
    add(key, at, p, 'voice', duck, a, a1, b0, b)
  }
  // the deck: each card that speaks, while it is in front (its swipe in → the next swipe, or the curtain)
  for (const sh of T.shots) {
    if (sh.type !== 'deck') continue
    const p = sh.p
    const { tSw, nSw, voices: vs } = deckPlan(sh, videos)
    const sd = p.swipeDur ?? 0.5
    vs.forEach((v, i) => {
      if (!v) return
      const duck = (i === 0 ? p.voiceDuck : p.voiceBDuck) ?? p.voiceDuck ?? look.duck
      const a = i === 0 ? sh.start + (p.popAt ?? 0) : tSw[i - 1] + sd * 0.3
      const a1 = i === 0 ? a + 0.4 : tSw[i - 1] + sd
      const tClose = sh.end - (p.closeLead ?? 0.55)
      const b0 = i < nSw ? tSw[i] : tClose
      const b = i < nSw ? tSw[i] + sd * 0.6 : tClose + (p.closeDur ?? 0.45) * 0.8
      add(v.key, v.at, p, i === 0 ? 'voice' : 'voiceB', duck, a, a1, b0, b)
    })
  }
  // level: −0.8 dB of headroom on the sum, so the AAC never clips
  return { cues, voices, level: 0, duck: look.duck, voice: look.voices, music: { level: look.music }, noMusic: !look.musicOn }
}


/**
 * Does a block's voice fit (the panel's warning, the brief: never cut a sentence to fit a block)? keys: the
 * phrase picker's params. → null (it fits, or the voice is off) | { text, fix?: { label, dur } }: the sentence
 * ends past its clip, or it lasts longer than the moment the block gives it (fix: the block a few beats longer).
 */
export function voiceStatus(T, id, keys, videos) {
  const sh = T.shot(id)
  if (!sh || !keys) return null
  const p = sh.p
  if (keys.on && !p[keys.on]) return null
  const pre = String(keys.from || 'voiceFrom').replace(/From$/, '')
  const from = p[pre + 'From'] ?? 0
  const to = p[pre + 'To'] ?? 0
  const two = (p[pre + '2To'] ?? 0) > (p[pre + '2From'] ?? 0) + 0.05
  const span = voiceSpanOf(p, pre)
  if (span <= 0.05) return null
  // the clip that speaks
  let key = null
  if (sh.type === 'campaigns' || sh.type === 'creators') key = heroKeyOf(p.heroKey)
  else if (sh.type === 'deck') key = deckPlan(sh, videos).keys[pre === 'voiceB' ? 1 : 0] || null
  else {
    const list = p.videos || []
    key = keyOf(videos, sh.type === 'wheel' ? list[Math.max(0, Math.min(list.length - 1, Math.round(p.hero) - 1))] : list[0])
  }
  const clipDur = key ? videos.manifest[key] : undefined
  const end = Math.max(to, two ? p[pre + '2To'] : 0)
  const f2 = (x) => x.toFixed(2).replace('.', ',')
  if (clipDur && end > clipDur - 0.03) return { text: `La frase finisce a ${f2(end)} s, oltre la fine del video (${f2(clipDur)} s): l’ultima parola si taglierebbe. Scegli un Out più presto o un’altra frase.` }
  if (from < 0 || to <= from) return { text: 'In e Out non formano una frase (Out deve venire dopo In).' }
  // the moment the block gives the voice
  let room = Infinity
  if (sh.type === 'campaigns') room = sh.dur - voiceAtOf('campaigns', p, sh.dur, clipDur) - 0.05
  else if (sh.type === 'wheel') room = sh.dur - (p.backAt ?? 0.45) - ((p.heroAt ?? 0.25) + (p.heroDur ?? 0.7) * 0.5)
  else if (sh.type === 'community') room = sh.dur - (p.voiceAt ?? 0) - (p.outLead ?? 0.28)
  else if (sh.type === 'creators') room = sh.dur - (p.voiceAt ?? 0) - (p.exitOn ? p.exitLead ?? 0.85 : 0)
  else if (sh.type === 'deck') {
    const v = deckPlan(sh, videos).voices[pre === 'voiceB' ? 1 : 0]
    if (v) room = span - (v.end - (sh.end - (p.closeLead ?? 0.55)))
  }
  if (span > room + 0.02) {
    const extra = Math.ceil((span - room + 0.05) / BEAT) * BEAT
    const beats = Math.round(extra / BEAT)
    return { text: `La frase dura ${f2(span)} s, il video resta in scena ${f2(Math.max(0, room))} s: l’audio finisce quando il video va via, la frase si sente a metà.`, fix: { label: `Allunga il blocco di ${beats} ${beats === 1 ? 'battuta' : 'battute'}`, dur: Math.round((sh.dur + extra) * 100000) / 100000 } }
  }
  return null
}
