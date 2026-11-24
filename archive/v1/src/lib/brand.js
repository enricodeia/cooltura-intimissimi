// Brand artwork → geometry: the Cooltura wordmark and asterisk, the Intimissimi
// logo (official SVG from intimissimi.com), the Instagram / TikTok glyphs
// (Font Awesome brands).

import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { faInstagram, faTiktok } from '@fortawesome/free-brands-svg-icons'
import { WORDMARK_GLYPHS, WORDMARK_SIZE, WORDMARK_STAR, COOLTURA_SVG_D, COOLTURA_SVG_SIZE } from './wordmark-data.js'

const loader = new SVGLoader()

export function shapesFromD(d) {
  const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`)
  const shapes = []
  for (const p of data.paths) shapes.push(...p.toShapes())
  return shapes
}

export function shapesBox(shapes) {
  const b = new THREE.Box2()
  for (const s of shapes) for (const p of s.getPoints(8)) b.expandByPoint(p)
  return b
}

/**
 * Geometry from SVG-space shapes (y down): centred on (cx, cy), scaled by k,
 * turned to y up. depth / bevel are in output units; depth 0 = flat.
 */
export function svgGeometry(shapes, { cx = 0, cy = 0, k = 1, depth = 0, bevel = 0, segs = 14 } = {}) {
  let g
  if (depth > 0) {
    const bv = Math.min(bevel, depth * 0.3)
    g = new THREE.ExtrudeGeometry(shapes, {
      depth: Math.max(1e-4, depth - 2 * bv) / k,
      bevelEnabled: bv > 0,
      bevelThickness: bv / k,
      bevelSize: (bv * 0.8) / k,
      bevelOffset: (-bv * 0.8) / k,
      bevelSegments: 3,
      curveSegments: segs,
    })
    g.translate(-cx, -cy, -(depth / 2 - bv) / k)
  } else {
    g = new THREE.ShapeGeometry(shapes, segs)
    g.translate(-cx, -cy, 0)
  }
  g.rotateX(Math.PI) // y down → y up as a rotation, so the faces stay outward
  g.scale(k, k, k)
  g.deleteAttribute('uv')
  if (depth > 0) g = toCreasedNormals(g, 0.6)
  else g = g.toNonIndexed()
  g.computeBoundingBox()
  return g
}

/** Outline polylines (y up, centred, scaled) of SVG-space shapes: for stroke drawing. */
export function svgContours(shapes, { cx = 0, cy = 0, k = 1, divisions = 12 } = {}) {
  const out = []
  const conv = (pts) => pts.map((p) => new THREE.Vector3((p.x - cx) * k, -(p.y - cy) * k, 0))
  for (const s of shapes) {
    out.push(conv(s.getPoints(divisions)))
    for (const h of s.holes) out.push(conv(h.getPoints(divisions)))
  }
  return out
}

// ------------------------------------------------------------------ cooltura

let _word = null
/** Wordmark glyphs: [{ ch, shapes, box: [x0,y0,x1,y1] }] in SVG units (213 × 36). */
export function wordmark() {
  if (!_word) _word = WORDMARK_GLYPHS.map((g) => ({ ch: g.ch, shapes: shapesFromD(g.d), box: g.bbox }))
  return _word
}
export { WORDMARK_SIZE, WORDMARK_STAR }

let _star = null
/** The brand asterisk: shapes + centre + diameter (SVG units, 193 × 181). */
export function asterisk() {
  if (!_star) {
    const shapes = shapesFromD(COOLTURA_SVG_D)
    _star = { shapes, cx: COOLTURA_SVG_SIZE.width / 2, cy: COOLTURA_SVG_SIZE.height / 2 + 4, size: 193 }
  }
  return _star
}

// ------------------------------------------------------------------ intimissimi

let _inti = null
/** → { letters: [{ shapes, x0, x1 }] left to right, frame: { x0, y0, x1, y1, stroke }, width, height } (SVG units, 121 × 35) */
export async function loadIntimissimi(base = import.meta.env.BASE_URL) {
  if (_inti) return _inti
  const txt = await (await fetch(`${base}logos/intimissimi-logo.svg`)).text()
  const data = loader.parse(txt)
  const all = data.paths.map((p) => {
    const shapes = p.toShapes()
    return { shapes, box: shapesBox(shapes) }
  })
  all.sort((a, b) => b.box.getSize(new THREE.Vector2()).x - a.box.getSize(new THREE.Vector2()).x)
  const frameBox = all[0].box
  const glyphShapes = all.slice(1).flatMap((a) => a.shapes)
  // group the letter shapes by overlapping x ranges (the dot of an "i" joins its stem)
  const parts = glyphShapes.map((s) => ({ s, b: shapesBox([s]) })).sort((a, b) => a.b.min.x - b.b.min.x)
  const letters = []
  for (const p of parts) {
    const last = letters[letters.length - 1]
    if (last && p.b.min.x < last.x1 - 0.15) {
      last.shapes.push(p.s)
      last.x1 = Math.max(last.x1, p.b.max.x)
    } else letters.push({ shapes: [p.s], x0: p.b.min.x, x1: p.b.max.x })
  }
  const stroke = 0.83
  _inti = {
    letters,
    frame: { x0: frameBox.min.x + stroke / 2, y0: frameBox.min.y + stroke / 2, x1: frameBox.max.x - stroke / 2, y1: frameBox.max.y - stroke / 2, stroke },
    cx: (frameBox.min.x + frameBox.max.x) / 2,
    cy: (frameBox.min.y + frameBox.max.y) / 2,
    width: frameBox.max.x - frameBox.min.x,
    height: frameBox.max.y - frameBox.min.y,
  }
  return _inti
}

// ------------------------------------------------------------------ platform glyphs

const iconCache = {}
/** → { shapes, w, h, d } of a Font Awesome icon (SVG units). */
export function faShapes(def) {
  const name = def.iconName
  if (!iconCache[name]) {
    const [w, h, , , d] = def.icon
    iconCache[name] = { shapes: shapesFromD(Array.isArray(d) ? d.join(' ') : d), w, h, d: Array.isArray(d) ? d.join(' ') : d }
  }
  return iconCache[name]
}
export const instagramIcon = () => faShapes(faInstagram)
export const tiktokIcon = () => faShapes(faTiktok)

// ------------------------------------------------------------------ helpers

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  r = Math.min(r, w / 2, h / 2)
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** Closed polyline of a rounded rectangle, starting at the bottom centre and running counter-clockwise. */
export function roundedRectPoints(w, h, r, arc = 14) {
  r = Math.min(r, w / 2, h / 2)
  const pts = []
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= arc; i++) {
      const a = a0 + (i / arc) * (Math.PI / 2)
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
    }
  }
  pts.push(new THREE.Vector3(0, -h / 2, 0))
  corner(w / 2 - r, -h / 2 + r, -Math.PI / 2)
  corner(w / 2 - r, h / 2 - r, 0)
  corner(-w / 2 + r, h / 2 - r, Math.PI / 2)
  corner(-w / 2 + r, -h / 2 + r, Math.PI)
  pts.push(new THREE.Vector3(0, -h / 2, 0))
  return pts
}
