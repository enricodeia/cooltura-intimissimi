// V4 helpers shared by its actors: which file a video of a list is, how a clip
// is cropped (burnt-in captions at the top of two Venice videos), the media time
// of a clip whose voice is heard (lips on the sound), and the type pose shorthands.

/** A list item → media key: 'v4/x' (a clip with its voice), else a creator of the folders. */
export function keyOf(videos, item) {
  if (!item) return null
  if (item.startsWith('v4/')) return videos.manifest[item + '.mp4'] !== undefined ? item + '.mp4' : null
  for (const k of [`v3/feed/${item}.mp4`, `v3/grid/${item}.mp4`]) if (videos.manifest[k] !== undefined) return k
  return null
}
export const keysOf = (videos, list) => (list || []).map((s) => keyOf(videos, s)).filter(Boolean)

/** How much of a clip to show (zoom ≥ 1, shift in uv): two Venice videos have a caption burnt in at the top. */
export const CROP = {
  'v4/venice-walk.mp4': { zoom: 1.3, y: -0.1 },
  'v4/venice-gemels.mp4': { zoom: 1.3, y: -0.1 },
}
export function applyCrop(u, key) {
  const c = CROP[key]
  u.uZoom.value = c ? c.zoom : 1
  u.uShift.value.set(0, c ? c.y : 0)
}

/**
 * The media time of a voiced clip at film time t: the voice window [from, to] (clip
 * seconds) is heard from `start + at`, so the picture runs on the same line (before
 * and after too): lips on the sound.
 */
export const voicedTime = (p, start, t) => (p.voiceFrom ?? 0) + (t - (start + (p.voiceAt ?? 0)))

/** How long a voice lasts: its window, + the second one when it cuts a pause out. */
export const voiceSpanOf = (p, pre = 'voice') =>
  Math.max(0, (p[pre + 'To'] ?? 0) - (p[pre + 'From'] ?? 0)) + ((p[pre + '2To'] ?? 0) > (p[pre + '2From'] ?? 0) + 0.05 ? p[pre + '2To'] - p[pre + '2From'] : 0)

/**
 * When a block's voice starts (block seconds). voiceAuto: on the campaigns as soon as her video rises in its
 * frame; in the wheel in the middle of the moment she is in front, moved so the picture of that whole moment
 * exists in her clip (no frozen frame while she is in the centre). Otherwise the panel's «Parte a».
 */
export function voiceAtOf(type, p, dur, clipDur = Infinity, portrait = false) {
  if (!p.voiceAuto) return p.voiceAt ?? 0
  // narrow frames: the camera goes to her after the names, she speaks as her video rises there
  if (type === 'campaigns') return portrait ? (p.toHerAt ?? 1.0) + 0.55 + 0.15 : (p.penDur ?? 0.85) + 0.15
  if (type === 'wheel') {
    const span = voiceSpanOf(p)
    const a = (p.heroAt ?? 0.25) + (p.heroDur ?? 0.7) * 0.5
    const b = dur - (p.backAt ?? 0.45)
    let at = a + Math.max(0, (b - a - span) / 2)
    const from = p.voiceFrom ?? 0
    const lo = b + from - (clipDur - 0.1)
    const hi = (p.heroAt ?? 0.25) + from
    if (lo <= hi) at = Math.min(hi, Math.max(lo, at))
    return at
  }
  return p.voiceAt ?? 0
}

/**
 * A clip's media time that never jumps: inside the clip it is the time itself; towards its end it slows down
 * into its last frame (half a second of glide), before its start it eases out of the first one. A talking video
 * that is still on screen after its sentence holds softly instead of looping back or freezing dead.
 */
export function softClipTime(m, dur) {
  const E = Math.max(0.2, dur - 0.08)
  const tauE = Math.min(0.5, E / 3)
  const tauS = Math.min(0.15, E / 6)
  if (m > E - tauE) return E - tauE * Math.exp(-(m - (E - tauE)) / tauE)
  if (m < tauS) return tauS * Math.exp((m - tauS) / tauS)
  return m
}

/** A kinetic phase in one line (Kinetic.pose's in / out). */
export const ph = (at, dur, o = {}) => ({ at, dur, stagger: 0, order: 'start', split: 'chars', ease: 'ci.reveal', x: 0, y: 0, rot: 0, depth: 0, scale: 1, blur: 0, opacity: 0, mask: false, ...o })
