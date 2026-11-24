// Canvas 2D artwork that ends up as textures: iOS-style notification banners
// for the comments, and the short-video interface over the phone's feed.

import { faHeart, faCommentDots, faBookmark, faShare, faHouse, faUserGroup, faPlus, faInbox, faUser, faMagnifyingGlass, faSignalBars, faWifi, faBatteryFull } from '@fortawesome/sharp-solid-svg-icons'
import { faInstagram, faTiktok } from '@fortawesome/free-brands-svg-icons'

const SYS = '-apple-system, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif'

function icon(g, def, cx, cy, size, color) {
  const [w, h, , , d] = def.icon
  const k = size / Math.max(w, h)
  g.save()
  g.translate(cx - (w * k) / 2, cy - (h * k) / 2)
  g.scale(k, k)
  g.fillStyle = color
  g.fill(new Path2D(Array.isArray(d) ? d.join(' ') : d))
  g.restore()
}

function wrapLines(g, text, maxW, maxLines) {
  const words = text.split(/\s+/)
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

function appIcon(g, app, x, y, s) {
  const r = s * 0.235
  g.save()
  g.beginPath()
  g.roundRect(x, y, s, s, r)
  g.clip()
  if (app === 'instagram') {
    const gr = g.createRadialGradient(x + s * 0.28, y + s * 1.05, s * 0.05, x + s * 0.28, y + s * 1.05, s * 1.25)
    gr.addColorStop(0, '#ffd15c')
    gr.addColorStop(0.3, '#f77a1c')
    gr.addColorStop(0.6, '#d62976')
    gr.addColorStop(1, '#5b51d8')
    g.fillStyle = gr
    g.fillRect(x, y, s, s)
    icon(g, faInstagram, x + s / 2, y + s / 2, s * 0.64, '#ffffff')
  } else {
    g.fillStyle = '#000000'
    g.fillRect(x, y, s, s)
    const o = s * 0.022
    icon(g, faTiktok, x + s / 2 - o, y + s / 2 - o, s * 0.56, '#25f4ee')
    icon(g, faTiktok, x + s / 2 + o, y + s / 2 + o, s * 0.56, '#fe2c55')
    icon(g, faTiktok, x + s / 2, y + s / 2, s * 0.56, '#ffffff')
  }
  g.restore()
}

/**
 * One notification banner. → { canvas, w, h, pad } (w × h = the card in px, pad = transparent
 * margin around it, kept so the blur and the shadow have room).
 */
export function drawNotification({ user, text, app = 'tiktok', time = 'ora' }) {
  const S = 3
  const W = 358 * S
  const pad = 14 * S
  const ic = 38 * S
  const out = 34 * S
  const tx = pad + ic + 10 * S
  const tw = W - tx - pad
  const lh = 20 * S
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = `400 ${15 * S}px ${SYS}`
  const lines = wrapLines(probe, text, tw, 3)
  const H = Math.max(pad * 2 + ic, pad + lh + lines.length * lh + pad - 4 * S)
  const c = document.createElement('canvas')
  c.width = W + out * 2
  c.height = H + out * 2
  const g = c.getContext('2d')
  g.translate(out, out)
  // the card: light material, soft contact shadow
  g.save()
  g.shadowColor = 'rgba(0,0,0,0.28)'
  g.shadowBlur = 18 * S
  g.shadowOffsetY = 6 * S
  g.fillStyle = 'rgba(246,246,248,0.96)'
  g.beginPath()
  g.roundRect(0, 0, W, H, 24 * S)
  g.fill()
  g.restore()
  g.strokeStyle = 'rgba(255,255,255,0.7)'
  g.lineWidth = 1.5
  g.beginPath()
  g.roundRect(0.75, 0.75, W - 1.5, H - 1.5, 24 * S)
  g.stroke()

  appIcon(g, app, pad, (H - ic) / 2, ic)
  g.textBaseline = 'alphabetic'
  g.fillStyle = 'rgba(60,60,67,0.6)'
  g.font = `400 ${13 * S}px ${SYS}`
  const timeW = g.measureText(time).width
  g.fillText(time, W - pad - timeW, pad + 14.5 * S)
  g.fillStyle = '#000000'
  g.font = `600 ${15 * S}px ${SYS}`
  let name = user
  while (name.length > 2 && g.measureText(name).width > tw - timeW - 8 * S) name = name.slice(0, -2) + '…'
  g.fillText(name, tx, pad + 15 * S)
  g.font = `400 ${15 * S}px ${SYS}`
  lines.forEach((l, i) => g.fillText(l, tx, pad + 15 * S + (i + 1) * lh))
  return { canvas: c, w: W, h: H, pad: out }
}

/** The interface over the feed (status bar, tabs, action rail, tab bar). Transparent elsewhere. */
export function drawFeedUI(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const u = w / 393 // points → px
  let gr = g.createLinearGradient(0, 0, 0, h * 0.2)
  gr.addColorStop(0, 'rgba(0,0,0,0.42)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, w, h * 0.2)
  gr = g.createLinearGradient(0, h * 0.62, 0, h)
  gr.addColorStop(0, 'rgba(0,0,0,0)')
  gr.addColorStop(1, 'rgba(0,0,0,0.5)')
  g.fillStyle = gr
  g.fillRect(0, h * 0.62, w, h * 0.38)

  // status bar, either side of the island
  const sy = 31 * u
  g.fillStyle = '#fff'
  g.font = `600 ${16.5 * u}px ${SYS}`
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  g.fillText('9:41', 62 * u, sy + u)
  icon(g, faSignalBars, w - 96 * u, sy, 17 * u, '#fff')
  icon(g, faWifi, w - 72 * u, sy, 17 * u, '#fff')
  icon(g, faBatteryFull, w - 43 * u, sy, 25 * u, '#fff')

  // tabs
  const ty = 80 * u
  g.font = `500 ${16 * u}px ${SYS}`
  g.fillStyle = 'rgba(255,255,255,0.62)'
  g.fillText('Seguiti', w / 2 - 42 * u, ty)
  g.fillStyle = '#fff'
  g.font = `700 ${16 * u}px ${SYS}`
  g.fillText('Per te', w / 2 + 40 * u, ty)
  g.fillRect(w / 2 + 40 * u - 14 * u, ty + 14 * u, 28 * u, 2.5 * u)
  icon(g, faMagnifyingGlass, w - 30 * u, ty, 20 * u, '#fff')

  // action rail
  const rx = w - 34 * u
  const tabH = 78 * u
  const base = h - tabH - 46 * u
  g.beginPath()
  g.arc(rx, base - 248 * u, 22 * u, 0, Math.PI * 2)
  g.fillStyle = '#b19aff'
  g.fill()
  g.lineWidth = 2 * u
  g.strokeStyle = '#fff'
  g.stroke()
  ;[faHeart, faCommentDots, faBookmark, faShare].forEach((def, i) => icon(g, def, rx, base - 180 * u + i * 60 * u, 30 * u, '#fff'))

  // tab bar
  g.fillStyle = '#000'
  g.fillRect(0, h - tabH, w, tabH)
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9]
  ;[faHouse, faUserGroup, null, faInbox, faUser].forEach((def, i) => {
    const x = w * xs[i]
    const y = h - tabH + 27 * u
    if (def) icon(g, def, x, y, 23 * u, i === 0 ? '#fff' : 'rgba(255,255,255,0.6)')
    else {
      g.fillStyle = '#fff'
      g.beginPath()
      g.roundRect(x - 22 * u, y - 14 * u, 44 * u, 28 * u, 9 * u)
      g.fill()
      icon(g, faPlus, x, y, 16 * u, '#000')
    }
  })
  // home indicator
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath()
  g.roundRect(w / 2 - 67 * u, h - 13 * u, 134 * u, 5 * u, 2.5 * u)
  g.fill()
  return c
}
