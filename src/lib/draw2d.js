// Canvas 2D artwork that ends up as textures: iOS-style notification banners
// for the comments, and the short-video interface over the phone's feed.

import { faHeart, faCommentDots, faBookmark, faShare, faHouse, faUserGroup, faPlus, faInbox, faUser, faMagnifyingGlass, faSignalBars, faWifi, faBatteryFull, faFlashlight, faCamera, faLock } from '@fortawesome/sharp-solid-svg-icons'
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
 * The content of one iOS notification (icon, sender, time, message) on a
 * transparent canvas exactly the size of the card. The card itself (frosted
 * glass over what is behind it, the rounded shape, the shadow) is drawn by the
 * shader, so the backdrop is real. → { canvas, w, h, r } (px; r = corner radius)
 * Proportions of iOS 17 on a 393 pt wide iPhone: 358 pt card, 14 pt padding,
 * 38 pt icon, SF Pro 15 pt semibold / regular, 13 pt time.
 */
export function drawNotification({ user, text, app = 'tiktok', time = 'ora' }, style = 'light') {
  const S = 3
  const W = 358 * S
  const pad = 14 * S
  const ic = 38 * S
  const tx = pad + ic + 10 * S
  const tw = W - tx - pad
  const lh = 20 * S
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = `400 ${15 * S}px ${SYS}`
  const lines = wrapLines(probe, text, tw, 4)
  const H = Math.max(pad * 2 + ic, pad + 18 * S + lines.length * lh + pad - 2 * S)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const dark = style === 'dark'
  appIcon(g, app, pad, Math.min((H - ic) / 2, pad + 1 * S), ic)
  g.textBaseline = 'alphabetic'
  g.fillStyle = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)'
  g.font = `400 ${13 * S}px ${SYS}`
  const timeW = g.measureText(time).width
  g.fillText(time, W - pad - timeW, pad + 14.5 * S)
  g.fillStyle = dark ? '#ffffff' : '#000000'
  g.font = `600 ${15 * S}px ${SYS}`
  let name = user
  while (name.length > 2 && g.measureText(name).width > tw - timeW - 8 * S) name = name.slice(0, -2) + '…'
  g.fillText(name, tx, pad + 15 * S)
  g.font = `400 ${15 * S}px ${SYS}`
  lines.forEach((l, i) => g.fillText(l, tx, pad + 15 * S + (i + 1) * lh))
  return { canvas: c, w: W, h: H, r: 22 * S }
}

/**
 * The lock screen over the wallpaper: status icons, lock, date, the big clock, the two buttons,
 * the home bar. Transparent elsewhere. pt = the screen's width in points (393 iPhone 15 Pro, 402 iPhone 17 Pro).
 */
export function drawLockScreen(w, h, { clock = '9:41', date = 'lunedì 17 novembre', pt = 393, status = false } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const u = w / pt
  // a touch of shade behind the clock and the buttons, as iOS does over bright photos
  let gr = g.createLinearGradient(0, 0, 0, h * 0.34)
  gr.addColorStop(0, 'rgba(0,0,0,0.30)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, w, h * 0.34)
  gr = g.createLinearGradient(0, h * 0.8, 0, h)
  gr.addColorStop(0, 'rgba(0,0,0,0)')
  gr.addColorStop(1, 'rgba(0,0,0,0.28)')
  g.fillStyle = gr
  g.fillRect(0, h * 0.8, w, h * 0.2)
  // status icons right of the island (signal, wi-fi, battery)
  if (status) {
    const sy = 31 * u
    icon(g, faSignalBars, w - 96 * u, sy, 17 * u, '#fff')
    icon(g, faWifi, w - 72 * u, sy, 17 * u, '#fff')
    icon(g, faBatteryFull, w - 43 * u, sy, 25 * u, '#fff')
  }
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  icon(g, faLock, w / 2, 78 * u, 15 * u, 'rgba(255,255,255,0.92)')
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.font = `600 ${18 * u}px ${SYS}`
  g.fillText(date, w / 2, 118 * u)
  g.fillStyle = 'rgba(255,255,255,0.94)'
  g.font = `600 ${96 * u}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`
  g.fillText(clock, w / 2, 205 * u)
  // flashlight + camera
  const by = h - 88 * u
  for (const [x, def] of [
    [52 * u, faFlashlight],
    [w - 52 * u, faCamera],
  ]) {
    g.fillStyle = 'rgba(30,30,34,0.42)'
    g.beginPath()
    g.arc(x, by, 25 * u, 0, Math.PI * 2)
    g.fill()
    icon(g, def, x, by, 20 * u, '#ffffff')
  }
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.beginPath()
  g.roundRect(w / 2 - 67 * u, h - 13 * u, 134 * u, 5 * u, 2.5 * u)
  g.fill()
  return c
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

/**
 * A comment as a notification card on white (V3: no phone behind it): the
 * card, a soft shadow, the app icon, sender, time and message, on a canvas a
 * little larger than the card (room for the shadow). → { canvas, w, h, cw, ch, pad } px.
 * Proportions of iOS 17 (358 pt card, 14 pt padding, 38 pt icon, SF 15 pt).
 */
export function drawCommentCard({ user, text, app = 'tiktok', time = 'ora' }, style = 'light') {
  const S = 3
  const W = 358 * S
  const pad = 14 * S
  const ic = 38 * S
  const tx = pad + ic + 10 * S
  const tw = W - tx - pad
  const lh = 20 * S
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = `400 ${15 * S}px ${SYS}`
  const lines = wrapLines(probe, text, tw, 4)
  const H = Math.max(pad * 2 + ic, pad + 18 * S + lines.length * lh + pad - 2 * S)
  const sh = 30 * S // room for the shadow
  const c = document.createElement('canvas')
  c.width = W + sh * 2
  c.height = H + sh * 2
  const g = c.getContext('2d')
  const dark = style === 'dark'
  const r = 22 * S
  g.save()
  g.shadowColor = dark ? 'rgba(0,0,0,0.35)' : 'rgba(24,22,40,0.13)'
  g.shadowBlur = 26 * S
  g.shadowOffsetY = 7 * S
  g.fillStyle = dark ? 'rgba(30,30,32,1)' : 'rgba(246,246,248,1)'
  g.beginPath()
  g.roundRect(sh, sh, W, H, r)
  g.fill()
  g.restore()
  g.lineWidth = 1 * S
  g.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  g.beginPath()
  g.roundRect(sh + 0.5 * S, sh + 0.5 * S, W - S, H - S, r)
  g.stroke()
  g.translate(sh, sh)
  appIcon(g, app, pad, Math.min((H - ic) / 2, pad + 1 * S), ic)
  g.textBaseline = 'alphabetic'
  g.fillStyle = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)'
  g.font = `400 ${13 * S}px ${SYS}`
  const timeW = g.measureText(time).width
  g.fillText(time, W - pad - timeW, pad + 14.5 * S)
  g.fillStyle = dark ? '#ffffff' : '#000000'
  g.font = `600 ${15 * S}px ${SYS}`
  let name = user
  while (name.length > 2 && g.measureText(name).width > tw - timeW - 8 * S) name = name.slice(0, -2) + '…'
  g.fillText(name, tx, pad + 15 * S)
  g.font = `400 ${15 * S}px ${SYS}`
  lines.forEach((l, i) => g.fillText(l, tx, pad + 15 * S + (i + 1) * lh))
  return { canvas: c, w: W + sh * 2, h: H + sh * 2, cw: W, ch: H, pad: sh }
}
