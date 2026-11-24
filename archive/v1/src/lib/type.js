// Type as geometry: PP Neue Machina outlines (opentype.js) → flat or extruded
// meshes, split into the units an animation needs (chars / words / lines).
// Vector outlines stay sharp at any export size and can turn in 3D.
//
// NOTE: the Neue Machina files are the "Free for Personal Use" cut (same as the
// Cooltura reel): a commercial licence from Pangram Pangram is needed to publish.

import * as THREE from 'three'
import { parse } from 'opentype.js'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const FILES = {
  300: 'PPNeueMachina-PlainLight.otf',
  400: 'PPNeueMachina-PlainRegular.otf',
  800: 'PPNeueMachina-PlainUltrabold.otf',
}
export const FAMILY = 'NM Plain'
const fonts = {}

export async function loadFonts(base = import.meta.env.BASE_URL) {
  await Promise.all(
    Object.entries(FILES).map(async ([w, file]) => {
      const r = await fetch(`${base}fonts/${file}`)
      if (!r.ok) throw new Error(`font ${file}: ${r.status}`)
      const buf = await r.arrayBuffer()
      const face = new FontFace(FAMILY, buf.slice(0), { weight: String(w), style: 'normal' })
      await face.load()
      document.fonts.add(face)
      const f = parse(buf)
      f._w = Number(w)
      f._cap = (f.tables.os2?.sCapHeight || f.ascender * 0.7) / f.unitsPerEm
      f._ccw = f.outlinesFormat === 'cff' // PostScript outlines: solids run counter-clockwise
      fonts[w] = f
    }),
  )
}
export const getFont = (w = 800) => fonts[w] || fonts[400]
/** Cap height as a fraction of the em. */
export const capRatio = (w = 800) => getFont(w)._cap

// ------------------------------------------------------------------ glyph outlines

const shapeCache = new Map()
/** THREE.Shape[] of a glyph, em = 1, y up. */
export function glyphShapes(font, glyph) {
  const key = font._w + ':' + glyph.index
  let shapes = shapeCache.get(key)
  if (shapes) return shapes
  const k = 1 / font.unitsPerEm
  const sp = new THREE.ShapePath()
  for (const c of glyph.path.commands) {
    if (c.type === 'M') sp.moveTo(c.x * k, c.y * k)
    else if (c.type === 'L') sp.lineTo(c.x * k, c.y * k)
    else if (c.type === 'C') sp.bezierCurveTo(c.x1 * k, c.y1 * k, c.x2 * k, c.y2 * k, c.x * k, c.y * k)
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1 * k, c.y1 * k, c.x * k, c.y * k)
  }
  shapes = sp.toShapes(font._ccw)
  shapeCache.set(key, shapes)
  return shapes
}

const geoCache = new Map()
function glyphGeometry(font, glyph, depth, bevel, segs) {
  const key = `${font._w}:${glyph.index}:${depth}:${bevel}:${segs}`
  let g = geoCache.get(key)
  if (g !== undefined) return g
  const shapes = glyphShapes(font, glyph)
  if (!shapes.length) g = null
  else if (depth > 0) {
    g = new THREE.ExtrudeGeometry(shapes, {
      depth: Math.max(1e-4, depth - 2 * bevel),
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel * 0.8,
      bevelOffset: -bevel * 0.8, // keep the silhouette of the glyph
      bevelSegments: 3,
      curveSegments: segs,
    })
    g.translate(0, 0, -depth / 2 + bevel)
    g.deleteAttribute('uv')
    g = toCreasedNormals(g, 0.6)
  } else {
    g = new THREE.ShapeGeometry(shapes, segs)
    g.deleteAttribute('uv')
    g = g.toNonIndexed()
  }
  geoCache.set(key, g)
  return g
}

// ------------------------------------------------------------------ layout

/** One word: glyphs with their x (em units), width = advance. */
function layoutWord(font, word, tracking) {
  const upm = font.unitsPerEm
  const out = []
  const end = font.forEachGlyph(word, 0, 0, upm, { kerning: true, features: { liga: false, rlig: false } }, (glyph, x) => {
    out.push({ glyph, x: x / upm + out.length * tracking, adv: (glyph.advanceWidth || 0) / upm })
  })
  const width = end / upm + Math.max(0, out.length - 1) * tracking
  return { text: word, glyphs: out, width }
}

/**
 * Lay a string out. Lines break at "\n" and, when maxWidth is given, between words.
 * Sizes are in em (1 = the font size); scale the result.
 */
export function layout(str, { weight = 800, tracking = 0, maxWidth = Infinity, wordSpace = 1 } = {}) {
  const font = getFont(weight)
  const space = ((font.charToGlyph(' ').advanceWidth || font.unitsPerEm * 0.25) / font.unitsPerEm) * wordSpace + tracking
  const lines = []
  for (const raw of String(str).split('\n')) {
    let cur = { words: [], width: 0 }
    for (const w of raw.split(/\s+/).filter(Boolean)) {
      const lw = layoutWord(font, w, tracking)
      const x = cur.words.length ? cur.width + space : 0
      if (cur.words.length && x + lw.width > maxWidth) {
        lines.push(cur)
        cur = { words: [], width: 0 }
        lw.x = 0
      } else lw.x = x
      cur.words.push(lw)
      cur.width = lw.x + lw.width
    }
    lines.push(cur)
  }
  return { font, lines, width: Math.max(0, ...lines.map((l) => l.width)), space }
}

/** Width of a single line in cap heights (how wide a string is when its capitals are 1 tall). */
export function widthInCaps(str, weight = 800, tracking = 0) {
  const L = layout(str, { weight, tracking })
  return L.width / capRatio(weight)
}

/**
 * Build text as meshes.
 *   cap      cap height in world units (the size designers think in)
 *   by       'chars' | 'words' | 'lines' | 'all': what becomes one animatable unit
 *   align    'center' | 'left' | 'right'
 *   depth    extrusion in cap heights (0 = flat)
 *   pivot    'center' (middle of the cap height) | 'baseline'
 *   material one material shared by every unit, or a function (unit) → material
 * → { group, units: [{ mesh, x, y, w, line, word, index, text }], lines, width, height, cap, lineHeight }
 *   group origin = centre of the block (x by align, y = middle between first cap top and last baseline)
 */
export function buildText(str, o = {}) {
  const { weight = 800, cap = 1, by = 'words', align = 'center', maxWidth = Infinity, leading = 1.5, tracking = 0, depth = 0, bevel = 0.012, segs = 10, pivot = 'center', material = null, wordSpace = 1 } = o
  const cr = capRatio(weight)
  const em = cap / cr // world size of 1 em
  const L = layout(str, { weight, tracking, maxWidth: maxWidth / em, wordSpace })
  const font = L.font
  const lineHeight = cap * leading // baseline to baseline, in cap heights
  const n = L.lines.length
  const height = cap + (n - 1) * lineHeight
  const group = new THREE.Group()
  const units = []
  const depthEm = depth > 0 ? (depth * cap) / em : 0
  const bevelEm = depth > 0 ? Math.min(bevel, depthEm * 0.3) : 0
  const pivY = pivot === 'center' ? cr / 2 : 0

  const mkMat = (u) => (typeof material === 'function' ? material(u) : material || new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  const shared = typeof material !== 'function' ? mkMat(null) : null

  const makeUnit = (parts, x0, x1, lineIndex, wordIndex, textStr) => {
    // parts: [{ glyph, x }] in em, line-relative; unit pivot = centre of [x0, x1]
    const cx = (x0 + x1) / 2
    const geos = []
    for (const p of parts) {
      const g = glyphGeometry(font, p.glyph, depthEm, bevelEm, segs)
      if (!g) continue
      const c = g.clone()
      c.translate(p.x - cx, -pivY, 0)
      geos.push(c)
    }
    if (!geos.length) return null
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    geos.length > 1 && geos.forEach((g) => g.dispose())
    const u = { text: textStr, line: lineIndex, word: wordIndex, index: units.length, w: (x1 - x0) * em }
    const mesh = new THREE.Mesh(geo, shared || mkMat(u))
    mesh.scale.setScalar(em)
    u.mesh = mesh
    u.emX = cx
    return u
  }

  let wordCount = 0
  L.lines.forEach((line, li) => {
    const lw = line.width
    const ox = align === 'center' ? -lw / 2 : align === 'right' ? -lw : 0 // em
    const baseY = height / 2 - cap - li * lineHeight // world y of this baseline
    const place = (u) => {
      if (!u) return
      u.x = (ox + u.emX) * em
      u.y = baseY + pivY * em
      u.baseline = baseY
      u.mesh.position.set(u.x, u.y, 0)
      group.add(u.mesh)
      units.push(u)
    }
    if (by === 'lines' || by === 'all') {
      const parts = []
      for (const w of line.words) for (const g of w.glyphs) parts.push({ glyph: g.glyph, x: w.x + g.x })
      place(makeUnit(parts, 0, lw, li, wordCount, line.words.map((w) => w.text).join(' ')))
      wordCount += line.words.length
    } else if (by === 'words') {
      for (const w of line.words) {
        place(makeUnit(w.glyphs.map((g) => ({ glyph: g.glyph, x: w.x + g.x })), w.x, w.x + w.width, li, wordCount, w.text))
        wordCount++
      }
    } else {
      for (const w of line.words) {
        w.glyphs.forEach((g, gi) => place(makeUnit([{ glyph: g.glyph, x: w.x + g.x }], w.x + g.x, w.x + g.x + g.adv, li, wordCount, w.text[gi])))
        wordCount++
      }
    }
    line.y = baseY
    line.w = lw * em
  })

  return {
    group,
    units,
    lines: L.lines.map((l) => ({ y: l.y, w: l.w })),
    width: L.width * em,
    height,
    cap,
    em,
    lineHeight,
    dispose() {
      const seen = new Set()
      for (const u of units) {
        u.mesh.geometry.dispose()
        const m = u.mesh.material
        if (!seen.has(m)) {
          seen.add(m)
          m.dispose?.()
        }
      }
    },
  }
}

/** Polylines (THREE.Vector2[][]) of a glyph outline, em = 1: for stroke-drawing type. */
export function glyphContours(font, ch, divisions = 10) {
  const shapes = glyphShapes(font, font.charToGlyph(ch))
  const out = []
  for (const s of shapes) {
    out.push(s.getPoints(divisions))
    for (const h of s.holes) out.push(h.getPoints(divisions))
  }
  return out
}
