// The board in the wide format (16:9, 640 × 360), composed as the film plays in
// 16:9: the opening card centred with white either side, numbers under the
// videos, the three cards all in view, the row across the whole width, "made
// for" and "externability" beside the phone, two or three roadmap stops in view.

import { C } from './pencil.js'
import { letterTicks, beams, dust, notifCards, commentCard, brackets, logo, wordmark } from './post.js'

const NUM = { weight: 700, anchor: 'middle', color: C.violet, name: 'numero' }
const LAB = { size: 22, anchor: 'middle', name: 'sottotitolo' }
const Y_LINE = 236

/** A roadmap stop centred on x: node, stem, circle and what it holds, labels. */
function pin(k, x, p, o = {}) {
  const g = k.group({}, o.ghost ? 'tappa-successiva' : 'tappa')
  const dash = o.ghost ? [5, 5] : undefined
  const ink = o.ghost ? C.soft : C.ink
  g.circle(x, Y_LINE, 9, { fill: ink, fillStyle: 'solid', strokeWidth: 1, name: 'nodo' })
  g.line(x, Y_LINE, x, 214, { strokeWidth: 2, stroke: ink, strokeLineDash: dash, name: 'gambo' })
  g.circle(x, 150, 128, { strokeWidth: 2.2, stroke: ink, strokeLineDash: dash, fill: o.ghost ? undefined : o.disc ?? C.sheet, fillStyle: 'solid', name: 'cerchio' })
  if (o.video) {
    g.circle(x, 150, 112, { fill: C.tint, fillStyle: 'hachure', hachureGap: 7, stroke: 'none', name: 'video' })
    g.figure(x, 154, 66)
  }
  if (o.ghost) return g
  g.text(x, 268, p.name, { size: 25, weight: 700, anchor: 'middle', spacing: 1, name: 'nome' })
  if (p.count) g.text(x, 290, p.count, { size: 17, anchor: 'middle', name: 'contenuti' })
  g.text(x, p.count ? 309 : 290, p.date, { size: 17, anchor: 'middle', name: 'data' })
  return g
}

export const WIDE = {
  open(k) {
    k.card(227, 15, 186, 330, { r: 16, gap: 8, figure: false, name: 'video-finale' })
    k.card(296, 134, 48, 88, { dash: [4, 4], stroke: C.soft, fill: C.sheet, fillStyle: 'solid', name: 'video-iniziale' })
    k.arrow(298, 138, 233, 22)
    k.arrow(342, 138, 407, 22)
    k.arrow(298, 218, 233, 338)
    k.arrow(342, 218, 407, 338)
    k.tag(112, 186, 'su bianco', { size: 17 })
    k.tag(528, 186, 'scale up', { size: 17 })
  },
  'stat-2'(k, d) {
    k.card(266, 18, 108, 196, { r: 12, gap: 6 })
    k.text(320, 318, d.s[0].value, { size: 236, weight: 700, anchor: 'middle', stroke: C.violet, sw: 1.3, dash: '6 6', opacity: 0.45, name: 'numero-partenza' })
    k.instagram(214, 160, 34)
    k.tiktok(424, 268, 32)
    k.text(320, 286, d.s[0].value, { ...NUM, size: 132 })
    k.text(320, 322, d.s[0].label, LAB)
    k.arrow(150, 252, 252, 252)
    k.arrow(490, 252, 390, 252)
    k.arrow(12, 12, 46, 36)
    k.arrow(628, 12, 594, 36)
    k.arrow(12, 348, 46, 324)
    k.arrow(628, 348, 594, 324)
    k.tag(122, 46, 'la camera arretra', { size: 16 })
  },
  'stat-3'(k, d) {
    k.card(170, 24, 92, 166)
    k.card(378, 24, 92, 166)
    k.card(274, 16, 92, 178)
    k.arrow(292, 106, 220, 106)
    k.arrow(348, 106, 420, 106)
    k.tag(548, 70, 'escono da dietro', { size: 16 })
    k.text(320, 296, d.s[1].value, { ...NUM, size: 126 })
    k.carrow([[360, 292], [384, 258], [364, 220]])
    k.tag(452, 250, 'ruota su X', { size: 16 })
    k.text(320, 330, d.s[1].label, LAB)
  },
  'stat-175'(k, d) {
    const xs = [34, 116, 208, 320, 432, 524, 606]
    const ws = [44, 66, 82, 92, 82, 66, 44]
    xs.forEach((x, i) => {
      const h = ws[i] * 1.92
      k.card(x - ws[i] / 2, 206 - h, ws[i], h, { gap: Math.max(4, ws[i] * 0.07) })
    })
    k.carrow([[44, 26], [320, 10], [596, 26]])
    k.tag(548, 300, 'la riga gira', { size: 17 })
    k.text(320, 296, d.s[2].value, { ...NUM, size: 112 })
    k.text(320, 330, d.s[2].label, LAB)
  },
  'stat-394'(k, d) {
    const cx = 320
    const cy = 112
    const R = 98
    const sph = k.group({}, 'sfera')
    sph.circle(cx, cy, R * 2, { stroke: C.soft, strokeWidth: 1.1, name: 'contorno' })
    for (let r = -3; r <= 3; r++) {
      const y = cy + r * 27
      const half = Math.sqrt(Math.max(0, R * R - (r * 27) ** 2)) - 6
      const n = Math.max(3, Math.floor((2 * half) / 17))
      const row = sph.group({}, 'riga')
      for (let i = 0; i < n; i++) {
        const x = cx - half + ((i + 0.5) * 2 * half) / n
        const f = Math.sqrt(Math.max(0.05, 1 - ((x - cx) / (half + 6)) ** 2))
        const tw = 11.5 * f
        const th = 20 * (1 - Math.abs(r) * 0.07)
        row.rr(x - tw / 2, y - th / 2, tw, th, 2, { strokeWidth: 0.9, fill: (i + r) % 3 ? C.tint : undefined, fillStyle: 'hachure', hachureGap: 3.5, fillWeight: 0.5, name: 'video' })
      }
      if (r % 2) k.arrow(cx + 158, y, cx + 116, y, { head: 6, strokeWidth: 1.4 })
      else k.arrow(cx + 116, y, cx + 158, y, { head: 6, strokeWidth: 1.4 })
    }
    k.tag(120, 70, 'pop dal centro verso l’esterno', { size: 15 })
    k.tag(120, 150, 'righe alternate', { size: 15 })
    k.text(320, 300, d.s[3].value, { ...NUM, size: 112 })
    k.text(320, 334, d.s[3].label, LAB)
  },
  stack(k) {
    for (const x of [214, 426]) k.line(x, 20, x, 340, { stroke: C.soft, strokeWidth: 1, strokeLineDash: [4, 6], name: 'separatore' })
    // a
    k.badge(26, 28, 'a', { d: 22 })
    const a = k.group({}, 'sfera')
    a.circle(110, 170, 150, { stroke: C.soft, strokeWidth: 1.1, name: 'contorno' })
    for (const [y, dash] of [
      [120, [3, 4]],
      [145, null],
      [170, null],
      [195, null],
      [220, [3, 4]],
    ]) {
      const half = Math.sqrt(Math.max(0, 75 * 75 - (y - 170) ** 2)) - 6
      for (let x = 110 - half + 8; x <= 110 + half - 8; x += 17) a.rr(x - 6, y - 10, 12, 20, 2, { strokeWidth: 0.9, strokeLineDash: dash || undefined, name: 'video' })
    }
    k.arrow(110, 70, 110, 108, { head: 8 })
    k.arrow(110, 270, 110, 232, { head: 8 })
    k.tag(110, 318, 'le righe rientrano', { size: 15 })
    // b
    k.badge(238, 28, 'b', { d: 22 })
    const order = { 1: 1, '-1': 2, 2: 3, '-2': 4, 3: 5, '-3': 6 }
    for (let i = -3; i <= 3; i++) {
      const x = 320 + i * 27
      k.card(x - 11, 168, 22, 40, { r: 4, gap: 3.5, figure: i === 0 })
      if (i) {
        const sgn = Math.sign(i)
        k.carrow([[x, 162], [x - sgn * Math.abs(i) * 12, 136 - Math.abs(i) * 6], [320 + sgn * 7, 162]], { head: 6, strokeWidth: 1.3 })
        k.text(x, 152 - Math.abs(i) * 9, String(order[i]), { size: 14, color: C.red, anchor: 'middle', weight: 700, name: 'ordine' })
      }
    }
    k.tag(320, 260, 'una sull’altra,', { size: 15 })
    k.tag(320, 284, 'alternando i lati', { size: 15 })
    // c
    k.badge(450, 28, 'c', { d: 22 })
    k.rr(482, 60, 96, 200, 12, { stroke: C.soft, strokeLineDash: [6, 6], strokeWidth: 1.4, name: 'schermo-finale' })
    const deck = k.group({}, 'pila')
    deck.rr(514, 128, 36, 64, 5, { strokeWidth: 1.2, name: 'card' })
    deck.rr(512, 126, 36, 64, 5, { strokeWidth: 1.2, fill: C.sheet, fillStyle: 'solid', name: 'card' })
    deck.card(510, 124, 36, 64, { r: 5, gap: 3.5 })
    k.arrow(510, 124, 488, 68, { head: 7 })
    k.arrow(546, 124, 572, 68, { head: 7 })
    k.arrow(510, 188, 488, 252, { head: 7 })
    k.arrow(546, 188, 572, 252, { head: 7 })
    k.tag(530, 318, 'diventa lo schermo', { size: 15 })
  },
  phone(k, d) {
    k.phone(320, 186, 116, 236, { screen: C.tint })
    k.figure(320, 202, 64)
    for (const [x1, y1, x2, y2] of [
      [320, 70, 320, 56],
      [320, 302, 320, 316],
      [262, 186, 248, 186],
      [378, 186, 392, 186],
    ])
      k.arrow(x1, y1, x2, y2, { head: 5, strokeWidth: 1.3 })
    const left = k.text(236, 196, d.left, { size: 36, weight: 700, anchor: 'end', name: 'testo-sinistra' })
    letterTicks(k, left, 206)
    const right = k.text(404, 196, d.right, { size: 36, weight: 700, name: 'testo-destra' })
    letterTicks(k, right, 206)
    k.text(236, 228, 'lettera per lettera', { size: 15, color: C.red, anchor: 'end', weight: 700, name: 'nota' })
    k.tag(320, 34, 'si forma subito', { size: 15 })
    k.arrow(420, 334, 600, 334, { strokeWidth: 2, head: 12 })
    k.text(420, 324, 'poi va a destra', { size: 17, color: C.red, weight: 700, name: 'nota' })
  },
  views(k, d) {
    beams(k, [
      [
        [-40, 56],
        [52, -20],
        [430, 300],
        [338, 380],
      ],
      [
        [150, -20],
        [214, -20],
        [570, 240],
        [522, 302],
      ],
    ])
    dust(k, 30, (u, v) => [-10 + u * 520, 10 + u * 300 + (v - 0.5) * 110], { size: 2.4 })
    const g = k.group({ transform: 'rotate(9 478 182)' }, 'iphone-inclinato')
    g.phone(478, 182, 128, 262, { screen: C.tint, body: C.sheet })
    g.figure(478, 200, 70)
    d.v.forEach((v, i) => {
      k.text(46, 112 + i * 84, v.value, { size: 54, weight: 700, color: C.violet, name: 'numero' })
      k.text(48, 132 + i * 84, v.label, { size: 17, name: 'sottotitolo' })
    })
    k.arrow(30, 292, 30, 236, { head: 7 })
    k.arrow(30, 208, 30, 152, { head: 7 })
    k.tag(150, 336, 'entra dal basso, spinge su', { size: 15 })
    k.tag(300, 30, 'luce + pulviscolo', { size: 16, color: '#b07a22' })
  },
  notifs(k) {
    const ph = k.group({}, 'iphone')
    ph.rr(214, 20, 212, 440, 36, { strokeWidth: 2.2, name: 'scocca' })
    ph.rr(224, 30, 192, 420, 28, { strokeWidth: 1.1, fill: C.tint, fillStyle: 'hachure', hachureGap: 8, fillWeight: 0.5, name: 'blocco-schermo' })
    ph.rr(296, 38, 48, 14, 7, { fill: C.ink, fillStyle: 'solid', strokeWidth: 1, name: 'notch' })
    k.lines(296, 70, 48, 1)
    k.text(320, 110, '9:41', { size: 46, weight: 700, anchor: 'middle', name: 'ora' })
    notifCards(k, 232, 124, 176, 5, { small: 34, big: 40, gap: 7, icon: 20, text: 128, r: 9, lineGap: 7 })
    k.arrow(424, 300, 424, 330, { head: 7 })
    brackets(k, 12, 12, 628, 348, 40)
    k.tag(112, 186, 'la camera', { size: 16 })
    k.tag(112, 212, 'si avvicina', { size: 16 })
    k.tag(530, 186, 'una sotto l’altra', { size: 16 })
  },
  dive(k) {
    for (const x of [176, 186, 454, 464]) k.line(x, 20, x, 340, { stroke: C.red, strokeWidth: 1, roughness: 0.8, strokeLineDash: x % 4 ? [9, 7] : undefined, name: 'scia' })
    for (let i = 0; i < 7; i++) commentCard(k, 196, 8 + i * 50, 248, 40, i < 2, i % 2)
    k.arrow(530, 320, 530, 120, { strokeWidth: 2.6, head: 15 })
    k.tag(560, 96, 'veloci verso l’alto', { size: 16 })
    k.tag(96, 50, 'si sfocano', { size: 16 })
    k.tag(96, 76, 'e spariscono', { size: 16 })
  },
  headline(k, d) {
    const lines = d.headLinesWide
    const y0 = 186 - ((lines.length - 1) * 52) / 2
    lines.forEach((ln, i) => {
      const arriving = i === lines.length - 1
      k.text(320, y0 + i * 52, ln, { size: 50, weight: 700, anchor: 'middle', color: arriving ? C.violet : C.ink, opacity: arriving ? 0.4 : 1, name: 'riga-titolo' })
    })
    k.carrow([[110, y0 + 52 + 8], [96, y0 + 52 - 14], [112, y0 + 52 - 36]], { head: 8 })
    k.tag(110, y0 + 52 + 40, 'tilt X → dritta', { size: 15 })
    k.arrow(566, y0 + (lines.length - 1) * 52, 566, 40, { strokeWidth: 2.2, head: 13 })
    k.tag(566, 28, 'esce in righe', { size: 15 })
    k.tag(320, 336, 'viola trasparente → nero, parola per parola', { size: 15 })
  },
  campaigns(k, d) {
    d.camp.forEach(([v, n], i) => {
      const y = 92 + i * 96
      const g = k.group({}, 'campagna')
      g.text(320, y, v, { size: 62, weight: 700, anchor: 'middle', color: C.violet, name: 'valore' })
      g.text(320, y + 24, n, { size: 18, anchor: 'middle', spacing: 2.5, weight: 700, name: 'nome' })
      k.text(176, y - 14, '0 →', { size: 20, color: C.red, weight: 700, name: 'contatore' })
    })
    k.arrow(250, 338, 130, 338, { strokeWidth: 2, head: 12 })
    k.text(258, 344, 'escono a sinistra', { size: 17, color: C.red, weight: 700, name: 'nota' })
  },
  'pin-aria'(k, d) {
    k.lavender()
    k.line(-6, Y_LINE, 320, Y_LINE, { strokeWidth: 2.4, name: 'linea' })
    pin(k, 320, d.pins[0], { video: true })
    k.carrow([[316, 212], [266, 192], [258, 140], [282, 98]], { head: 8 })
    k.carrow([[324, 212], [374, 192], [382, 140], [358, 98]], { head: 8 })
    k.arrow(628, 26, 520, 26, { strokeWidth: 2.2 })
    k.tag(452, 34, 'lilla da destra', { size: 16 })
    k.arrow(16, 268, 120, 268, { head: 9 })
    k.badge(30, 214, 1, { d: 20 })
    k.badge(298, 222, 2, { d: 20 })
    k.badge(344, 210, 3, { d: 20 })
    k.badge(396, 92, 4, { d: 20 })
    k.badge(352, 170, 5, { d: 20 })
  },
  'pins-mid'(k, d) {
    k.lavender()
    k.line(-6, Y_LINE, 320, Y_LINE, { strokeWidth: 2.4, name: 'linea' })
    pin(k, 90, d.pins[0], { video: true })
    pin(k, 320, d.pins[1], { video: true })
    pin(k, 550, d.pins[2], { ghost: true })
    k.arrow(200, 24, 440, 24, { strokeWidth: 2.4, head: 14 })
    k.tag(320, 56, 'la camera segue la linea', { size: 16 })
  },
  'pins-logo'(k, d) {
    k.lavender()
    k.line(-6, Y_LINE, 320, Y_LINE, { strokeWidth: 2.4, name: 'linea' })
    pin(k, 90, d.pins[2], { video: true })
    pin(k, 320, d.pins[3], { disc: C.ink })
    logo(k, 320, 156, 0.62)
    k.arc(320, 154, 170, 52, Math.PI * 0.12, Math.PI * 0.88, { stroke: C.red, strokeWidth: 1.7, roughness: 0.8, name: 'rotazione' })
    k.head(320 + 85 * Math.cos(Math.PI * 0.12), 154 + 26 * Math.sin(Math.PI * 0.12), -0.35)
    pin(k, 550, d.pins[4], { ghost: true })
    k.tag(320, 30, 'il logo “c?” gira in 3D', { size: 16 })
    k.tag(550, 280, 'poi NATALE: disco viola,', { size: 14 })
    k.tag(550, 302, 'logo bianco', { size: 14 })
  },
  signoff(k) {
    k.lavender()
    k.circle(320, 180, 760, { fill: C.sheet, fillStyle: 'solid', stroke: C.soft, strokeLineDash: [6, 6], strokeWidth: 1.2, name: 'iride-bianca' })
    wordmark(k, 304, 214, 96, 274, 1.18)
    k.tag(150, 70, 'il ? diventa *', { size: 16 })
    k.tag(320, 28, 'linea e cerchi si ritirano', { size: 16 })
    k.tag(320, 340, 'torna bianco', { size: 16 })
  },
}
