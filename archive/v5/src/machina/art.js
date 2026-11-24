// V5 · the comments as they hang off the thread: the way a comment panel sets
// them (platform glyph and user in grey, the comment under it in black, no
// card), in PP Neue Machina, on a transparent canvas. Emoji come from the
// system's colour emoji font (canvas falls back to it). Real comments from the
// campaign report (data/comments.js), verbatim.

import { faInstagram, faTiktok } from '@fortawesome/free-brands-svg-icons'
import { COMMENTS } from '../data/comments.js'
import { FAMILY } from '../lib/type.js'

export const COMMENT_COUNT = COMMENTS.length
const K = 2.2 // canvas pixels per design pixel (design = px of a frame whose short side is 1080)
const NAME = 22
const TEXT = 30
const LH = 39
const PAD = 6

function glyph(g, def, x, y, size, color) {
  const [w, h, , , d] = def.icon
  const k = size / Math.max(w, h)
  g.save()
  g.translate(x, y - (h * k) / 2)
  g.scale(k, k)
  g.fillStyle = color
  g.fill(new Path2D(Array.isArray(d) ? d.join(' ') : d))
  g.restore()
}

function wrap(g, text, maxW, maxLines) {
  const words = String(text).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w
    if (g.measureText(next).width <= maxW || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines.length = maxLines
    let last = lines[maxLines - 1]
    while (last.length > 1 && g.measureText(last + '…').width > maxW) last = last.slice(0, -1)
    lines[maxLines - 1] = last.trimEnd() + '…'
  }
  return lines
}

const cache = new Map()

/** → { canvas, aspect (h / w), anchor (where the branch meets it, fraction of the height from the top) } */
export function commentArt(idx, designW) {
  const Wd = Math.round(designW)
  const key = idx + '|' + Wd
  let a = cache.get(key)
  if (a) return a
  const c = COMMENTS[idx % COMMENTS.length]
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = `400 ${TEXT}px "${FAMILY}"`
  const lines = wrap(probe, c.text, Wd - 6, 3)
  const Hd = PAD + NAME + 12 + lines.length * LH + PAD
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(Wd * K)
  cv.height = Math.ceil(Hd * K)
  const g = cv.getContext('2d')
  g.scale(K, K)
  g.textBaseline = 'alphabetic'
  const mute = '#6b6b70'
  const yName = PAD + NAME * 0.86
  glyph(g, c.app === 'instagram' ? faInstagram : faTiktok, 0, PAD + NAME * 0.52, NAME * 0.86, mute)
  g.fillStyle = mute
  g.font = `400 ${NAME}px "${FAMILY}"`
  g.fillText(c.user, NAME * 1.05, yName)
  g.fillStyle = '#0b0b0c'
  g.font = `400 ${TEXT}px "${FAMILY}"`
  lines.forEach((l, i) => g.fillText(l, 0, yName + 12 + TEXT * 0.9 + i * LH))
  a = { canvas: cv, aspect: Hd / Wd, anchor: (PAD + NAME * 0.5) / Hd }
  cache.set(key, a)
  return a
}

export function commentSize(idx, designW) {
  const a = commentArt(idx, designW)
  return { aspect: a.aspect, anchor: a.anchor }
}
