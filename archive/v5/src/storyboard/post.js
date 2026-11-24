// The board in the post format (9:16, 360 × 640): one drawing per animation.

import { C } from './pencil.js'

const BIG = { size: 190, weight: 700, anchor: 'middle', color: C.violet, name: 'numero' }

/** A roadmap stop: the line, its node, the stem, the circle and what it holds, the labels. */
function pin(k, p, o = {}) {
  const g = k.group({}, 'tappa')
  if (!o.noLine) g.line(-6, 430, 186, 430, { strokeWidth: 2.4, name: 'linea' })
  g.circle(180, 430, 12, { fill: C.ink, fillStyle: 'solid', strokeWidth: 1, name: 'nodo' })
  g.line(180, 430, 180, 386, { strokeWidth: 2.2, name: 'gambo' })
  g.circle(180, 296, 180, { strokeWidth: 2.4, fill: o.disc ?? C.sheet, fillStyle: 'solid', name: 'cerchio' })
  if (o.video) {
    g.circle(180, 296, 160, { fill: C.tint, fillStyle: 'hachure', hachureGap: 8, stroke: 'none', name: 'video' })
    g.figure(180, 302, 96)
  }
  g.text(180, 486, p.name, { size: 36, weight: 700, anchor: 'middle', spacing: 1, name: 'nome' })
  if (p.count) g.text(180, 516, p.count, { size: 24, anchor: 'middle', name: 'contenuti' })
  g.text(180, p.count ? 542 : 516, p.date, { size: 24, anchor: 'middle', name: 'data' })
}

export const POST = {
  open(k) {
    k.card(36, 52, 288, 512, { r: 24, gap: 10, figure: false, name: 'video-finale' })
    k.card(130, 226, 100, 178, { dash: [5, 5], stroke: C.soft, fill: C.sheet, fillStyle: 'solid', name: 'video-iniziale' })
    k.arrow(132, 230, 52, 72)
    k.arrow(228, 230, 308, 72)
    k.arrow(132, 400, 52, 544)
    k.arrow(228, 400, 308, 544)
    k.tag(180, 610, 'scale up su bianco')
  },
  'stat-2'(k, d) {
    k.card(66, 36, 228, 392, { r: 20, gap: 8 })
    k.text(180, 578, d.s[0].value, { size: 330, weight: 700, anchor: 'middle', stroke: C.violet, sw: 1.5, dash: '7 7', opacity: 0.45, name: 'numero-partenza' })
    k.instagram(44, 340, 50)
    k.tiktok(308, 512, 48)
    k.text(180, 528, d.s[0].value, BIG)
    k.text(180, 590, d.s[0].label, { size: 30, anchor: 'middle', name: 'sottotitolo' })
    k.arrow(30, 470, 96, 470)
    k.arrow(330, 470, 268, 470)
    k.arrow(14, 14, 52, 40)
    k.arrow(346, 14, 300, 40)
    k.tag(180, 24, 'la camera arretra')
  },
  'stat-3'(k, d) {
    k.card(-44, 150, 112, 204)
    k.card(292, 150, 112, 204)
    k.card(124, 140, 112, 214)
    k.arrow(150, 248, 62, 248)
    k.arrow(210, 248, 298, 248)
    k.tag(180, 110, 'escono da dietro')
    k.text(180, 528, d.s[1].value, BIG)
    k.carrow([[268, 520], [300, 470], [276, 404]])
    k.tag(296, 380, 'ruota su X', { size: 19 })
    k.text(180, 592, d.s[1].label, { size: 30, anchor: 'middle', name: 'sottotitolo' })
  },
  'stat-175'(k, d) {
    k.card(-16, 176, 60, 128, { gap: 6 })
    k.card(46, 158, 82, 166)
    k.card(136, 144, 88, 192)
    k.card(232, 158, 82, 166)
    k.card(316, 176, 60, 128, { gap: 6 })
    k.carrow([[22, 130], [180, 104], [338, 130]])
    k.tag(180, 84, 'la riga gira')
    k.text(180, 510, d.s[2].value, { ...BIG, size: 158 })
    k.text(180, 574, d.s[2].label, { size: 30, anchor: 'middle', name: 'sottotitolo' })
  },
  'stat-394'(k, d) {
    const cx = 180
    const cy = 234
    const R = 148
    const sph = k.group({}, 'sfera')
    sph.circle(cx, cy, R * 2, { stroke: C.soft, strokeWidth: 1.2, name: 'contorno' })
    for (let r = -3; r <= 3; r++) {
      const y = cy + r * 40
      const half = Math.sqrt(Math.max(0, R * R - (r * 40) ** 2)) - 8
      const n = Math.max(3, Math.floor((2 * half) / 25))
      const row = sph.group({}, 'riga')
      for (let i = 0; i < n; i++) {
        const x = cx - half + ((i + 0.5) * 2 * half) / n
        const f = Math.sqrt(Math.max(0.05, 1 - ((x - cx) / (half + 8)) ** 2))
        const tw = 17 * f
        const th = 30 * (1 - Math.abs(r) * 0.07)
        row.rr(x - tw / 2, y - th / 2, tw, th, 3, { strokeWidth: 1, fill: (i + r) % 3 ? C.tint : undefined, fillStyle: 'hachure', hachureGap: 4, fillWeight: 0.6, name: 'video' })
      }
      if (r % 2) k.arrow(cx + 62, y + 21, cx + 6, y + 21, { head: 7, strokeWidth: 1.5 })
      else k.arrow(cx - 6, y + 21, cx + 50, y + 21, { head: 7, strokeWidth: 1.5 })
    }
    k.tag(180, 40, 'pop dal centro verso l’esterno', { size: 19 })
    k.text(180, 520, d.s[3].value, { ...BIG, size: 158 })
    k.text(180, 584, d.s[3].label, { size: 30, anchor: 'middle', name: 'sottotitolo' })
  },
  stack(k) {
    k.badge(28, 34, 'a')
    const a = k.group({}, 'sfera')
    a.circle(180, 112, 152, { stroke: C.soft, strokeWidth: 1.1, name: 'contorno' })
    for (const [y, dash] of [
      [62, [3, 4]],
      [87, null],
      [112, null],
      [137, null],
      [162, [3, 4]],
    ]) {
      const half = Math.sqrt(Math.max(0, 76 * 76 - (y - 112) ** 2)) - 6
      for (let x = 180 - half + 8; x <= 180 + half - 8; x += 18) a.rr(x - 6, y - 10, 12, 20, 2, { strokeWidth: 0.9, strokeLineDash: dash || undefined, name: 'video' })
    }
    k.arrow(180, 22, 180, 56, { head: 8 })
    k.arrow(180, 204, 180, 170, { head: 8 })
    k.badge(28, 238, 'b')
    const order = { 1: 1, '-1': 2, 2: 3, '-2': 4, 3: 5, '-3': 6 }
    for (let i = -3; i <= 3; i++) {
      const x = 180 + i * 42
      k.card(x - 17, 272, 34, 62, { r: 5, gap: 4, figure: i === 0 })
      if (i) {
        const sgn = Math.sign(i)
        k.carrow([[x, 266], [x - sgn * Math.abs(i) * 19, 238 - Math.abs(i) * 6], [180 + sgn * 10, 266]], { head: 7, strokeWidth: 1.4 })
        k.text(x, 258 - Math.abs(i) * 9, String(order[i]), { size: 17, color: C.red, anchor: 'middle', weight: 700, name: 'ordine' })
      }
    }
    k.tag(180, 370, 'una sull’altra, alternando i lati', { size: 18 })
    k.badge(28, 408, 'c')
    k.rr(124, 424, 112, 196, 14, { stroke: C.soft, strokeLineDash: [6, 6], strokeWidth: 1.4, name: 'schermo-finale' })
    const deck = k.group({}, 'pila')
    deck.rr(160, 482, 46, 82, 6, { strokeWidth: 1.2, name: 'card' })
    deck.rr(157, 479, 46, 82, 6, { strokeWidth: 1.2, fill: C.sheet, fillStyle: 'solid', name: 'card' })
    deck.card(154, 476, 46, 82, { r: 6, gap: 4 })
    k.arrow(154, 476, 132, 434, { head: 8 })
    k.arrow(200, 476, 228, 434, { head: 8 })
    k.arrow(154, 558, 132, 610, { head: 8 })
    k.arrow(200, 558, 228, 610, { head: 8 })
    k.text(300, 506, 'diventa', { size: 21, color: C.red, anchor: 'middle', weight: 700, name: 'nota' })
    k.text(300, 528, 'lo schermo', { size: 21, color: C.red, anchor: 'middle', weight: 700, name: 'nota' })
  },
  phone(k, d) {
    k.phone(180, 330, 150, 306, { screen: C.tint })
    k.figure(180, 352, 84)
    for (const [x1, y1, x2, y2] of [
      [180, 176, 180, 158],
      [180, 484, 180, 502],
      [104, 330, 86, 330],
      [256, 330, 274, 330],
    ])
      k.arrow(x1, y1, x2, y2, { head: 6, strokeWidth: 1.4 })
    const left = k.text(30, 134, d.left, { size: 44, weight: 700, name: 'testo-sinistra' })
    letterTicks(k, left, 146)
    k.text(30, 168, 'lettera per lettera', { size: 19, color: C.red, weight: 700, name: 'nota' })
    k.text(330, 554, d.right, { size: 44, weight: 700, anchor: 'end', name: 'testo-destra' })
    k.tag(286, 218, 'si forma subito', { size: 18 })
    k.arrow(190, 612, 334, 612, { strokeWidth: 2.2, head: 13 })
    k.text(190, 600, 'poi va a destra', { size: 21, color: C.red, weight: 700, name: 'nota' })
  },
  views(k, d) {
    beams(k, [
      [
        [-40, 70],
        [40, -20],
        [400, 410],
        [328, 498],
      ],
      [
        [126, -20],
        [176, -20],
        [400, 236],
        [400, 312],
      ],
    ])
    dust(k, 26, (u, v) => [-20 + u * 360, 30 + u * 380 + (v - 0.5) * 120])
    const g = k.group({ transform: 'rotate(9 282 330)' }, 'iphone-inclinato')
    g.phone(282, 330, 120, 246, { screen: C.tint, body: C.sheet })
    g.figure(282, 348, 68)
    d.v.forEach((v, i) => {
      k.text(24, 290 + i * 102, v.value, { size: 60, weight: 700, color: C.violet, name: 'numero' })
      k.text(26, 316 + i * 102, v.label, { size: 21, name: 'sottotitolo' })
    })
    k.arrow(14, 560, 14, 498, { head: 8 })
    k.arrow(14, 458, 14, 396, { head: 8 })
    k.tag(120, 602, 'entra dal basso, spinge su', { size: 18 })
    k.tag(236, 48, 'luce + pulviscolo', { size: 19, color: '#b07a22' })
  },
  notifs(k) {
    const ph = k.group({}, 'iphone')
    ph.rr(24, 64, 312, 720, 54, { strokeWidth: 2.2, name: 'scocca' })
    ph.rr(38, 78, 284, 700, 42, { strokeWidth: 1.1, fill: C.tint, fillStyle: 'hachure', hachureGap: 10, fillWeight: 0.5, name: 'blocco-schermo' })
    ph.rr(146, 90, 68, 20, 10, { fill: C.ink, fillStyle: 'solid', strokeWidth: 1, name: 'notch' })
    k.lines(146, 134, 68, 1)
    k.text(180, 200, '9:41', { size: 66, weight: 700, anchor: 'middle', name: 'ora' })
    notifCards(k, 48, 224, 264, 5, { small: 52, big: 62, gap: 9, icon: 30, text: 196 })
    k.arrow(330, 516, 330, 556, { head: 8 })
    brackets(k, 14, 14, 346, 626, 50)
    k.tag(180, 604, 'la camera si avvicina', { size: 19 })
  },
  dive(k) {
    for (const x of [16, 28, 332, 344]) k.line(x, 40, x, 600, { stroke: C.red, strokeWidth: 1, roughness: 0.8, strokeLineDash: x % 3 ? [10, 8] : undefined, name: 'scia' })
    for (let i = 0; i < 8; i++) commentCard(k, 44, 22 + i * 76, 272, 62, i < 2, i % 2)
    k.arrow(300, 600, 300, 420, { strokeWidth: 2.8, head: 16 })
    k.tag(180, 118, 'si sfocano e spariscono', { size: 19 })
    k.tag(214, 410, 'veloci verso l’alto', { size: 19 })
  },
  headline(k, d) {
    const lines = d.headLinesPost
    const y0 = 320 - ((lines.length - 1) * 56) / 2
    lines.forEach((ln, i) => {
      const arriving = i >= lines.length - 2
      k.text(176, y0 + i * 56, ln, { size: 50, weight: 700, anchor: 'middle', color: arriving ? C.violet : C.ink, opacity: arriving ? (i === lines.length - 1 ? 0.35 : 0.65) : 1, name: 'riga-titolo' })
    })
    k.carrow([[46, y0 + 2 * 56 + 6], [34, y0 + 2 * 56 - 18], [50, y0 + 2 * 56 - 40]], { head: 8 })
    k.tag(96, y0 + lines.length * 56 + 6, 'tilt X → dritta', { size: 17 })
    k.arrow(336, y0 + (lines.length - 1) * 56, 336, y0 - 70, { strokeWidth: 2.2, head: 13 })
    k.tag(250, y0 - 82, 'esce in righe', { size: 19 })
    k.tag(180, 590, 'viola trasparente → nero', { size: 19 })
  },
  campaigns(k, d) {
    d.camp.forEach(([v, n], i) => {
      const y = 196 + i * 142
      const g = k.group({}, 'campagna')
      g.text(184, y, v, { size: 86, weight: 700, anchor: 'middle', color: C.violet, name: 'valore' })
      g.text(184, y + 34, n, { size: 25, anchor: 'middle', spacing: 3, weight: 700, name: 'nome' })
      k.text(20, y - 30, '0 →', { size: 24, color: C.red, weight: 700, name: 'contatore' })
    })
    k.arrow(150, 600, 40, 600, { strokeWidth: 2.2, head: 13 })
    k.text(158, 606, 'escono a sinistra', { size: 21, color: C.red, weight: 700, name: 'nota' })
  },
  'pin-aria'(k, d) {
    k.lavender()
    pin(k, d.pins[0], { video: true })
    k.carrow([[176, 392], [104, 360], [92, 282], [128, 214]], { head: 9 })
    k.carrow([[184, 392], [256, 360], [268, 282], [232, 214]], { head: 9 })
    k.arrow(340, 34, 236, 34, { strokeWidth: 2.2 })
    k.tag(140, 42, 'lilla da destra', { size: 19 })
    k.arrow(12, 470, 100, 470, { head: 9 })
    k.badge(30, 404, 1)
    k.badge(122, 452, 2)
    k.badge(208, 404, 3)
    k.badge(296, 214, 4)
    k.badge(222, 326, 5)
  },
  'pins-mid'(k, d) {
    k.lavender()
    k.line(-6, 430, 366, 430, { strokeWidth: 2.4, name: 'linea' })
    const prev = k.group({}, 'tappa-precedente')
    prev.circle(-70, 296, 180, { strokeWidth: 1.6, strokeLineDash: [6, 6], stroke: C.soft, name: 'cerchio' })
    prev.line(-70, 430, -70, 386, { stroke: C.soft, strokeLineDash: [5, 5], name: 'gambo' })
    pin(k, d.pins[1], { video: true, noLine: true })
    k.arrow(70, 60, 292, 60, { strokeWidth: 2.4, head: 14 })
    k.tag(180, 98, 'la camera segue la linea', { size: 19 })
  },
  'pins-logo'(k, d) {
    k.lavender()
    pin(k, d.pins[3], { disc: C.ink })
    logo(k, 180, 300, 1)
    k.arc(180, 300, 236, 74, Math.PI * 0.12, Math.PI * 0.88, { stroke: C.red, strokeWidth: 1.8, roughness: 0.8, name: 'rotazione' })
    k.head(180 + 118 * Math.cos(Math.PI * 0.12), 300 + 37 * Math.sin(Math.PI * 0.12), -0.35)
    k.tag(180, 110, 'il logo gira in 3D', { size: 19 })
  },
  signoff(k) {
    k.lavender()
    k.circle(180, 330, 480, { fill: C.sheet, fillStyle: 'solid', stroke: C.soft, strokeLineDash: [6, 6], strokeWidth: 1.2, name: 'iride-bianca' })
    wordmark(k, 172, 360, 80, 414)
    k.tag(196, 170, 'il ? diventa *', { size: 19 })
    k.tag(180, 52, 'linea e cerchi si ritirano', { size: 19 })
    k.tag(180, 600, 'torna bianco', { size: 19 })
  },
}

// ------------------------------------------------------------------ shared bits (also used by the wide board)

/** Small red ticks under each letter of a text (letter by letter). */
export function letterTicks(k, textEl, y, o = {}) {
  const n = textEl.getNumberOfChars()
  const g = k.group({}, 'stagger-lettere')
  for (let i = 0; i < n; i++) {
    if (textEl.textContent[i] === ' ') continue
    const a = textEl.getStartPositionOfChar(i).x
    const b = textEl.getEndPositionOfChar(i).x
    g.line(a + (b - a) * 0.18, y, b - (b - a) * 0.18, y, { stroke: C.red, strokeWidth: o.sw ?? 1.4, roughness: 0.6, name: 'lettera' })
  }
}

export function beams(k, polys, o = {}) {
  const g = k.group({}, 'fasci-di-luce')
  polys.forEach((pts, i) => g.poly(pts, { fill: C.amber, fillStyle: 'hachure', hachureGap: (o.gap ?? 12) + i * 3, fillWeight: 0.6, hachureAngle: 40, stroke: 'none', name: 'fascio' }))
}

export function dust(k, n, place, o = {}) {
  const g = k.group({}, 'pulviscolo')
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const [x, y] = place(rnd(), rnd())
    g.circle(x, y, (o.size ?? 3) + rnd() * (o.size ?? 3), { fill: C.amber, fillStyle: 'solid', stroke: C.amber, strokeWidth: 0.6, roughness: 0.4, name: 'granello' })
  }
}

export function notifCards(k, x, y0, w, n, o) {
  let y = y0
  for (let i = 0; i < n; i++) {
    const h = i % 2 ? o.big : o.small
    const g = k.group({}, 'notifica')
    g.rr(x, y, w, h, o.r ?? 14, { fill: C.sheet, fillStyle: 'solid', strokeWidth: 1.4, strokeLineDash: i === n - 1 ? [5, 4] : undefined, name: 'vetro' })
    g.rr(x + 10, y + (h - o.icon) / 2 - 2, o.icon, o.icon, o.icon * 0.26, { fill: i % 2 ? C.pink : C.ink, fillStyle: 'solid', strokeWidth: 1, name: 'icona-app' })
    g.lines(x + o.icon + 20, y + h * 0.36, o.text, i % 2 ? 3 : 2, { gap: o.lineGap ?? 9 })
    y += h + o.gap
  }
  return y
}

export function commentCard(k, x, y, w, h, ghost, alt) {
  const g = k.group({}, 'commento')
  g.rr(x, y, w, h, Math.min(14, h * 0.24), { fill: C.sheet, fillStyle: 'solid', strokeWidth: ghost ? 1 : 1.4, stroke: ghost ? C.soft : C.ink, strokeLineDash: ghost ? [4, 5] : undefined, name: 'vetro' })
  const ic = h * 0.48
  g.rr(x + 10, y + (h - ic) / 2, ic, ic, ic * 0.26, { fill: alt ? C.pink : C.ink, fillStyle: 'solid', strokeWidth: 1, stroke: ghost ? C.soft : C.ink, name: 'icona-app' })
  g.lines(x + ic + 20, y + h * 0.4, w - ic - 40, 2, { stroke: ghost ? '#cfc9be' : C.soft, gap: Math.max(6, h * 0.14) })
}

export function brackets(k, x0, y0, x1, y1, L) {
  const g = k.group({}, 'camera-che-si-avvicina')
  g.path(`M${x0} ${y0 + L} L${x0} ${y0} L${x0 + L} ${y0}`, { stroke: C.red, strokeWidth: 2.2, name: 'angolo' })
  g.path(`M${x1 - L} ${y0} L${x1} ${y0} L${x1} ${y0 + L}`, { stroke: C.red, strokeWidth: 2.2, name: 'angolo' })
  g.path(`M${x0} ${y1 - L} L${x0} ${y1} L${x0 + L} ${y1}`, { stroke: C.red, strokeWidth: 2.2, name: 'angolo' })
  g.path(`M${x1 - L} ${y1} L${x1} ${y1} L${x1} ${y1 - L}`, { stroke: C.red, strokeWidth: 2.2, name: 'angolo' })
}

/** The "c?" logo, centred on (cx, cy), at scale s (1 = the post size). */
export function logo(k, cx, cy, s) {
  const g = k.group({}, 'logo-c-punto-interrogativo')
  g.text(cx - 20 * s, cy + 36 * s, 'c', { size: 124 * s, weight: 700, anchor: 'middle', color: C.lime, name: 'c' })
  g.text(cx + 34 * s, cy - 18 * s, '?', { size: 64 * s, weight: 700, anchor: 'middle', color: C.lime, name: 'punto-interrogativo' })
}

/** "cooltura" with a numbered arrow under each letter (they rise in order) and the "?" that docks as "*". */
export function wordmark(k, cx, base, size, arrowsY, lift = 1.9) {
  const word = k.text(cx, base, 'cooltura', { size, weight: 700, anchor: 'middle', name: 'logotipo' })
  const n = word.getNumberOfChars()
  let x0 = cx - size * 1.7
  let x1 = cx + size * 1.7
  const g = k.group({}, 'stagger-lettere')
  for (let i = 0; i < n; i++) {
    const a = word.getStartPositionOfChar(i).x
    const b = word.getEndPositionOfChar(i).x
    if (i === 0) x0 = a
    x1 = b
    const x = (a + b) / 2
    g.arrow(x, arrowsY, x, arrowsY - size * 0.35, { head: Math.max(5, size * 0.075), strokeWidth: 1.3 })
    g.text(x, arrowsY + size * 0.25, String(i + 1), { size: Math.max(12, size * 0.2), color: C.red, anchor: 'middle', weight: 700, name: 'ordine' })
  }
  k.line(x0 - 6, base + 7, x1 + 6, base + 7, { stroke: C.red, strokeWidth: 1, strokeLineDash: [4, 4], name: 'linea-di-base' })
  const st = k.group({}, 'asterisco')
  st.text(x1 + size * 0.05, base - size * lift, '?', { size: size * 0.75, weight: 700, anchor: 'middle', color: C.lime, name: 'punto-interrogativo' })
  st.carrow(
    [
      [x1 + size * 0.15, base - size * (lift - 0.05)],
      [x1 + size * 0.42, base - size * (lift * 0.66)],
      [x1 + size * 0.24, base - size * 0.6],
    ],
    { head: 9 },
  )
  st.text(x1 + size * 0.16, base - size * 0.32, '*', { size: size * 0.6, weight: 700, anchor: 'middle', name: 'asterisco' })
  return { x0, x1 }
}
