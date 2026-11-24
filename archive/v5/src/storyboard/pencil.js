// A pencil over an SVG: rough.js strokes, a handwriting font, red-pencil arrows
// and notes. Every element it draws is its own named layer (the id becomes the
// layer name when the SVG is pasted into Figma): video-1, freccia-3, nota-2…

import rough from 'roughjs'

export const NS = 'http://www.w3.org/2000/svg'
export const C = {
  ink: '#36353a',
  soft: '#9a958c',
  tint: '#d6cfc0',
  sheet: '#fffdf8',
  violet: '#7466e8',
  red: '#d9472f',
  amber: '#e2a64b',
  lav: '#b19aff',
  pink: '#d62976',
  cyan: '#22c3be',
  tred: '#fe2c55',
  lime: '#9fd61a',
}
export const FONT = 'Caveat'

export const rrPath = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2)
  return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`
}

export function pencil(svg, seed0, { W = 360, H = 640 } = {}) {
  const rc = rough.svg(svg)
  let s = (seed0 * 7919 + 13) % 2147483647
  const seed = () => {
    s = (s * 16807) % 2147483647
    return (s % 100000) + 1
  }
  const counts = {}
  const uid = (base) => `${base}-${(counts[base] = (counts[base] || 0) + 1)}`
  const opt = (o = {}) => {
    const { name, ...rest } = o
    void name
    return { roughness: 1.25, bowing: 0.9, stroke: C.ink, strokeWidth: 1.5, seed: seed(), ...rest }
  }
  const mk = (parent) => {
    const add = (n, base, o) => {
      n.setAttribute('id', uid(o?.name || base))
      parent.appendChild(n)
      return n
    }
    const k = {
      W,
      H,
      group(attrs = {}, base = 'gruppo') {
        const g = document.createElementNS(NS, 'g')
        g.setAttribute('id', uid(base))
        for (const [a, v] of Object.entries(attrs)) g.setAttribute(a, v)
        parent.appendChild(g)
        return mk(g)
      },
      rect: (x, y, w, h, o) => add(rc.rectangle(x, y, w, h, opt(o)), 'rettangolo', o),
      rr: (x, y, w, h, r, o) => add(rc.path(rrPath(x, y, w, h, r), opt(o)), 'forma', o),
      line: (x1, y1, x2, y2, o) => add(rc.line(x1, y1, x2, y2, opt(o)), 'linea', o),
      circle: (x, y, d, o) => add(rc.circle(x, y, d, opt(o)), 'cerchio', o),
      arc: (x, y, w, h, a0, a1, o) => add(rc.arc(x, y, w, h, a0, a1, false, opt(o)), 'arco', o),
      curve: (pts, o) => add(rc.curve(pts, opt(o)), 'curva', o),
      poly: (pts, o) => add(rc.polygon(pts, opt(o)), 'poligono', o),
      path: (d, o) => add(rc.path(d, opt(o)), 'tratto', o),
      head(x, y, ang, o = {}) {
        const L = o.head ?? 11
        for (const sgn of [-1, 1]) k.line(x, y, x - L * Math.cos(ang + sgn * 0.42), y - L * Math.sin(ang + sgn * 0.42), { stroke: o.stroke ?? C.red, strokeWidth: o.strokeWidth ?? 1.8, roughness: 0.5, name: 'punta' })
      },
      /** A red pencil arrow (one layer). */
      arrow(x1, y1, x2, y2, o = {}) {
        const g = k.group({}, o.name || 'freccia')
        g.line(x1, y1, x2, y2, { stroke: o.stroke ?? C.red, strokeWidth: o.strokeWidth ?? 1.8, roughness: 1, strokeLineDash: o.dash, name: 'asta' })
        g.head(x2, y2, Math.atan2(y2 - y1, x2 - x1), o)
        return g
      },
      /** A curved arrow through points, head on the last (one layer). */
      carrow(pts, o = {}) {
        const g = k.group({}, o.name || 'freccia')
        g.curve(pts, { stroke: o.stroke ?? C.red, strokeWidth: o.strokeWidth ?? 1.8, roughness: 0.9, name: 'asta' })
        const [a, b] = pts.slice(-2)
        g.head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), o)
        return g
      },
      text(x, y, str, o = {}) {
        const t = document.createElementNS(NS, 'text')
        t.setAttribute('id', uid(o.name || 'testo'))
        t.setAttribute('x', x)
        t.setAttribute('y', y)
        t.setAttribute('font-family', FONT)
        t.setAttribute('font-size', o.size ?? 22)
        t.setAttribute('font-weight', o.weight ?? 400)
        t.setAttribute('text-anchor', o.anchor ?? 'start')
        if (o.stroke) {
          t.setAttribute('fill', 'none')
          t.setAttribute('stroke', o.stroke)
          t.setAttribute('stroke-width', o.sw ?? 1.5)
          if (o.dash) t.setAttribute('stroke-dasharray', o.dash)
        } else t.setAttribute('fill', o.color ?? C.ink)
        if (o.opacity !== undefined) t.setAttribute('opacity', o.opacity)
        if (o.spacing) t.setAttribute('letter-spacing', o.spacing)
        if (o.rot) t.setAttribute('transform', `rotate(${o.rot} ${x} ${y})`)
        t.textContent = str
        parent.appendChild(t)
        return t
      },
      /** A red note on a scrap of white paper (one layer). */
      tag(x, y, str, o = {}) {
        const g = k.group({}, 'nota')
        const size = o.size ?? 21
        const w = str.length * size * 0.42 + 16
        const ax = o.anchor === 'start' ? x : o.anchor === 'end' ? x - w : x - w / 2
        g.rr(ax, y - size * 0.95, w, size * 1.35, 5, { fill: C.sheet, fillStyle: 'solid', stroke: o.color ?? C.red, strokeWidth: 1.1, roughness: 0.9, name: 'foglietto' })
        g.text(ax + w / 2, y, str, { size, color: o.color ?? C.red, anchor: 'middle', weight: 700, name: 'scritta' })
        return g
      },
      /** Lines of small text, as squiggles. */
      lines(x, y, w, n = 2, o = {}) {
        const g = k.group({}, 'righe-di-testo')
        for (let i = 0; i < n; i++) {
          const len = i === n - 1 && n > 1 ? w * 0.62 : w
          let d = `M${x} ${y + i * (o.gap ?? 9)}`
          for (let u = 6; u <= len; u += 6) d += ` L${x + u} ${y + i * (o.gap ?? 9) + (u % 12 ? -1.6 : 1.6)}`
          g.path(d, { stroke: o.stroke ?? C.soft, strokeWidth: o.sw ?? 1.2, roughness: 0.4, name: 'riga' })
        }
        return g
      },
      /** A person in a video, a head and shoulders. */
      figure(cx, cy, s, o = {}) {
        const g = k.group({}, 'persona')
        const col = o.stroke ?? C.ink
        g.circle(cx, cy - s * 0.2, s * 0.34, { stroke: col, strokeWidth: o.sw ?? 1.4, fill: o.fill, fillStyle: 'solid', name: 'testa' })
        g.curve(
          [
            [cx - s * 0.44, cy + s * 0.46],
            [cx - s * 0.3, cy + s * 0.12],
            [cx, cy + s * 0.04],
            [cx + s * 0.3, cy + s * 0.12],
            [cx + s * 0.44, cy + s * 0.46],
          ],
          { stroke: col, strokeWidth: o.sw ?? 1.4, name: 'spalle' },
        )
        return g
      },
      /** A video card (one layer). */
      card(x, y, w, h, o = {}) {
        const g = k.group({}, o.name || 'video')
        const r = o.r ?? Math.min(w, h) * 0.09
        g.rr(x, y, w, h, r, {
          fill: o.fill === undefined ? C.tint : o.fill,
          fillStyle: o.fillStyle ?? 'hachure',
          hachureGap: o.gap ?? Math.max(4, w * 0.05),
          fillWeight: 0.7,
          hachureAngle: -41,
          stroke: o.stroke ?? C.ink,
          strokeWidth: o.sw ?? 1.6,
          strokeLineDash: o.dash,
          name: 'cornice',
        })
        if (o.figure !== false) g.figure(x + w / 2, y + h * 0.5, Math.min(w, h * 0.56) * 0.62, { stroke: o.stroke ?? C.ink })
        return g
      },
      /** An iPhone outline (one layer); returns its screen rectangle. */
      phone(cx, cy, w, h, o = {}) {
        const g = k.group({}, 'iphone')
        const x = cx - w / 2
        const y = cy - h / 2
        const r = w * 0.17
        g.rr(x, y, w, h, r, { strokeWidth: 2.2, fill: o.body, fillStyle: 'solid', name: 'scocca' })
        const ins = w * 0.045
        const scr = { x: x + ins, y: y + ins, w: w - 2 * ins, h: h - 2 * ins, r: r - ins }
        g.rr(scr.x, scr.y, scr.w, scr.h, scr.r, { strokeWidth: 1.1, fill: o.screen, fillStyle: o.screenStyle ?? 'hachure', hachureGap: 8, fillWeight: 0.6, name: 'schermo' })
        g.rr(cx - w * 0.15, y + ins + w * 0.05, w * 0.3, w * 0.085, w * 0.04, { fill: C.ink, fillStyle: 'solid', strokeWidth: 1, name: 'notch' })
        scr.g = g
        return scr
      },
      /** A red circled step number (one layer). */
      badge(x, y, n, o = {}) {
        const g = k.group({}, 'passo')
        const d = o.d ?? 24
        g.circle(x, y, d, { stroke: C.red, strokeWidth: 1.5, fill: C.sheet, fillStyle: 'solid', roughness: 0.8, name: 'cerchietto' })
        g.text(x, y + d * 0.29, String(n), { size: d * 0.88, color: C.red, anchor: 'middle', weight: 700, name: 'numero' })
        return g
      },
      lavender() {
        return k.rect(5, 5, W - 10, H - 10, { fill: C.lav, fillStyle: 'hachure', hachureGap: 9, fillWeight: 1, hachureAngle: 58, stroke: 'none', roughness: 1.4, name: 'sfondo-lilla' })
      },
      instagram(x, y, s) {
        const g = k.group({}, 'instagram')
        g.rr(x, y, s, s, s * 0.28, { stroke: C.pink, strokeWidth: 2.2, name: 'contorno' })
        g.circle(x + s / 2, y + s / 2, s * 0.46, { stroke: C.pink, strokeWidth: 2, name: 'obiettivo' })
        g.circle(x + s * 0.76, y + s * 0.24, Math.max(3, s * 0.08), { stroke: C.pink, fill: C.pink, fillStyle: 'solid', strokeWidth: 1, name: 'flash' })
        return g
      },
      tiktok(x, y, s) {
        const g = k.group({}, 'tiktok')
        const note = (dx, dy, col, sw, name) => {
          const n = g.group({}, name)
          n.line(x + dx, y - s * 0.5 + dy, x + dx, y + s * 0.26 + dy, { stroke: col, strokeWidth: sw, name: 'gambo' })
          n.circle(x - s * 0.17 + dx, y + s * 0.26 + dy, s * 0.36, { stroke: col, strokeWidth: sw, name: 'nota' })
          n.curve([[x + dx, y - s * 0.5 + dy], [x + s * 0.12 + dx, y - s * 0.32 + dy], [x + s * 0.32 + dx, y - s * 0.27 + dy]], { stroke: col, strokeWidth: sw, name: 'bandiera' })
        }
        note(-2.5, -2.5, C.cyan, 1.8, 'ciano')
        note(2.5, 2.5, C.tred, 1.8, 'rosso')
        note(0, 0, C.ink, 2.2, 'nero')
        return g
      },
    }
    return k
  }
  return mk(svg)
}
