// Type as geometry: PP Neue Machina outlines (opentype.js) → flat or extruded
// meshes, split into the units an animation needs (chars / words / lines).
// Vector outlines stay sharp at any export size and can turn in 3D.
//
// Weights are continuous (300…800). The three cuts we have (Light 300, Regular
// 400, Ultrabold 800) share their point structure, like the masters of a
// variable font, so any weight in between is a real instance: outlines,
// advances and kerning of the two nearest cuts interpolated point by point
// (a semibold 600 is half way between Regular and Ultrabold). The few glyphs
// whose outlines differ by a point are aligned first (dynamic programming on
// the contour), so they interpolate too.
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
const masters = {}
/** Tools (node): hand the parsed cuts in directly instead of loadFonts(). */
export function setMasters(m) {
  Object.assign(masters, m)
  faces.clear()
}

export async function loadFonts(base = import.meta.env.BASE_URL) {
  await Promise.all(
    Object.entries(FILES).map(async ([w, file]) => {
      const r = await fetch(`${base}fonts/${file}`)
      if (!r.ok) throw new Error(`font ${file}: ${r.status}`)
      const buf = await r.arrayBuffer()
      const face = new FontFace(FAMILY, buf.slice(0), { weight: String(w), style: 'normal' })
      await face.load()
      document.fonts.add(face)
      masters[w] = parse(buf)
    }),
  )
}

// ------------------------------------------------------------------ outline interpolation

function contoursOf(cmds) {
  const out = []
  let cur = null
  for (const c of cmds) {
    if (c.type === 'M' || !cur) {
      cur = []
      out.push(cur)
    }
    cur.push(c)
  }
  return out
}

const sameTypes = (a, b) => a.length === b.length && a.every((c, i) => c.type === b[i].type)
const dist = (a, b) => (a.x === undefined || b.x === undefined ? 0 : Math.hypot(a.x - b.x, a.y - b.y))

/**
 * Align two contours whose command lists differ only by extra straight segments
 * in the longer one: each extra point pairs with a copy of the shorter contour's
 * nearest preceding point (a zero-length segment). Minimum total point distance.
 * → [a', b'] with identical command types, or null.
 */
function alignContours(a, b) {
  if (sameTypes(a, b)) return [a, b]
  const swap = a.length > b.length
  const S = swap ? b : a
  const Lg = swap ? a : b
  const n = S.length
  const m = Lg.length
  const INF = 1e18
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF))
  const how = Array.from({ length: n + 1 }, () => new Int8Array(m + 1))
  D[0][0] = 0
  for (let i = 0; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // match S[i-1] with Lg[j-1]
      if (i > 0 && S[i - 1].type === Lg[j - 1].type && D[i - 1][j - 1] < INF) {
        const c = D[i - 1][j - 1] + dist(S[i - 1], Lg[j - 1])
        if (c < D[i][j]) {
          D[i][j] = c
          how[i][j] = 1
        }
      }
      // Lg[j-1] is an extra straight segment: pairs with a copy of S[i-1]
      if (i > 0 && Lg[j - 1].type === 'L' && S[i - 1].x !== undefined && D[i][j - 1] < INF) {
        const c = D[i][j - 1] + dist(S[i - 1], Lg[j - 1])
        if (c < D[i][j]) {
          D[i][j] = c
          how[i][j] = 2
        }
      }
    }
  }
  if (D[n][m] >= INF) return null
  const sOut = []
  const lOut = []
  let i = n
  let j = m
  while (j > 0) {
    if (how[i][j] === 1) {
      sOut.push(S[i - 1])
      lOut.push(Lg[j - 1])
      i--
      j--
    } else {
      sOut.push({ type: 'L', x: S[i - 1].x, y: S[i - 1].y })
      lOut.push(Lg[j - 1])
      j--
    }
  }
  sOut.reverse()
  lOut.reverse()
  return swap ? [lOut, sOut] : [sOut, lOut]
}

const KEYS = ['x', 'y', 'x1', 'y1', 'x2', 'y2']
function blendCommands(ca, cb, k) {
  if (k <= 0) return ca
  if (k >= 1) return cb
  const A = contoursOf(ca)
  const B = contoursOf(cb)
  if (A.length !== B.length) return k < 0.5 ? ca : cb
  const out = []
  for (let c = 0; c < A.length; c++) {
    const al = alignContours(A[c], B[c])
    if (!al) return k < 0.5 ? ca : cb
    const [a, b] = al
    for (let i = 0; i < a.length; i++) {
      const o = { type: a[i].type }
      for (const key of KEYS) if (a[i][key] !== undefined) o[key] = a[i][key] + (b[i][key] - a[i][key]) * k
      out.push(o)
    }
  }
  return out
}

// ------------------------------------------------------------------ faces (one per integer weight)

const faces = new Map()
const clampW = (w) => Math.round(Math.min(800, Math.max(300, Number(w) || 400)))

/** A weight instance: { w, upm, cap, glyph(ch) → { ch, key, adv, commands }, kern(a, b) } (em = 1). */
export function getFace(weight = 400) {
  const w = clampW(weight)
  let f = faces.get(w)
  if (f) return f
  const [A, B, k] = w <= 400 ? [masters[300], masters[400], (w - 300) / 100] : [masters[400], masters[800], (w - 400) / 400]
  const upm = A.unitsPerEm
  const capOf = (F) => (F.tables.os2?.sCapHeight || F.ascender * 0.7) / upm
  const glyphs = new Map()
  const kerns = new Map()
  f = {
    w,
    upm,
    cap: capOf(A) + (capOf(B) - capOf(A)) * k,
    ccw: A.outlinesFormat === 'cff', // PostScript outlines: solids run counter-clockwise
    glyph(ch) {
      let g = glyphs.get(ch)
      if (g) return g
      const ga = A.charToGlyph(ch)
      const gb = B.charToGlyph(ch)
      g = {
        ch,
        key: w + ':' + ch,
        adv: ((ga.advanceWidth || 0) + ((gb.advanceWidth || 0) - (ga.advanceWidth || 0)) * k) / upm,
        commands: blendCommands(ga.path.commands, gb.path.commands, k),
        a: ga,
        b: gb,
      }
      glyphs.set(ch, g)
      return g
    },
    kern(c1, c2) {
      const key = c1 + c2
      let v = kerns.get(key)
      if (v !== undefined) return v
      const g1 = this.glyph(c1)
      const g2 = this.glyph(c2)
      const ka = A.getKerningValue(g1.a, g2.a) || 0
      const kb = B.getKerningValue(g1.b, g2.b) || 0
      v = (ka + (kb - ka) * k) / upm
      kerns.set(key, v)
      return v
    },
  }
  faces.set(w, f)
  return f
}
/** Cap height as a fraction of the em. */
export const capRatio = (w = 400) => getFace(w).cap

// ------------------------------------------------------------------ glyph outlines

const shapeCache = new Map()
/** THREE.Shape[] of a glyph, em = 1, y up. */
export function glyphShapes(face, ch) {
  const g = face.glyph(ch)
  let shapes = shapeCache.get(g.key)
  if (shapes) return shapes
  const k = 1 / face.upm
  const sp = new THREE.ShapePath()
  for (const c of g.commands) {
    if (c.type === 'M') sp.moveTo(c.x * k, c.y * k)
    else if (c.type === 'L') sp.lineTo(c.x * k, c.y * k)
    else if (c.type === 'C') sp.bezierCurveTo(c.x1 * k, c.y1 * k, c.x2 * k, c.y2 * k, c.x * k, c.y * k)
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1 * k, c.y1 * k, c.x * k, c.y * k)
  }
  shapes = sp.toShapes(face.ccw)
  shapeCache.set(g.key, shapes)
  return shapes
}

const geoCache = new Map()
/** Geometry of one glyph (em = 1, origin on its baseline at its left side); null for a space. Cached, do not dispose. */
export function glyphGeometry(face, ch, depth = 0, bevel = 0, segs = 10) {
  const key = `${face.w}:${ch}:${depth}:${bevel}:${segs}`
  let g = geoCache.get(key)
  if (g !== undefined) return g
  const shapes = glyphShapes(face, ch)
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

/** One word: glyphs with their x (em units), width = last advance end. Kerned, no ligatures. */
function layoutWord(face, word, tracking) {
  const out = []
  let x = 0
  const chars = Array.from(word)
  chars.forEach((ch, i) => {
    if (i) x += face.kern(chars[i - 1], ch) + tracking
    const g = face.glyph(ch)
    out.push({ ch, x, adv: g.adv })
    x += g.adv
  })
  return { text: word, glyphs: out, width: x }
}

/**
 * Lay a string out. Lines break at "\n" and, when maxWidth is given, between words.
 * Sizes are in em (1 = the font size); scale the result.
 */
export function layout(str, { weight = 400, tracking = 0, maxWidth = Infinity, wordSpace = 1 } = {}) {
  const face = getFace(weight)
  const space = face.glyph(' ').adv * wordSpace + tracking
  const lines = []
  for (const raw of String(str).split('\n')) {
    let cur = { words: [], width: 0 }
    for (const w of raw.split(/\s+/).filter(Boolean)) {
      const lw = layoutWord(face, w, tracking)
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
  return { face, lines, width: Math.max(0, ...lines.map((l) => l.width)), space }
}

/** Width of a single line in cap heights (how wide a string is when its capitals are 1 tall). */
export function widthInCaps(str, weight = 400, tracking = 0) {
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
  const { weight = 400, cap = 1, by = 'words', align = 'center', maxWidth = Infinity, leading = 1.5, tracking = 0, depth = 0, bevel = 0.012, segs = 10, pivot = 'center', material = null, wordSpace = 1 } = o
  const cr = capRatio(weight)
  const em = cap / cr // world size of 1 em
  const L = layout(str, { weight, tracking, maxWidth: maxWidth / em, wordSpace })
  const face = L.face
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
    // parts: [{ ch, x }] in em, line-relative; unit pivot = centre of [x0, x1]
    const cx = (x0 + x1) / 2
    const geos = []
    for (const p of parts) {
      const g = glyphGeometry(face, p.ch, depthEm, bevelEm, segs)
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
      for (const w of line.words) for (const g of w.glyphs) parts.push({ ch: g.ch, x: w.x + g.x })
      place(makeUnit(parts, 0, lw, li, wordCount, line.words.map((w) => w.text).join(' ')))
      wordCount += line.words.length
    } else if (by === 'words') {
      for (const w of line.words) {
        place(makeUnit(w.glyphs.map((g) => ({ ch: g.ch, x: w.x + g.x })), w.x, w.x + w.width, li, wordCount, w.text))
        wordCount++
      }
    } else {
      for (const w of line.words) {
        w.glyphs.forEach((g) => place(makeUnit([{ ch: g.ch, x: w.x + g.x }], w.x + g.x, w.x + g.x + g.adv, li, wordCount, g.ch)))
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
export function glyphContours(face, ch, divisions = 10) {
  const out = []
  for (const s of glyphShapes(face, ch)) {
    out.push(s.getPoints(divisions))
    for (const h of s.holes) out.push(h.getPoints(divisions))
  }
  return out
}

/** Free a text block made by buildText (geometries only: shared materials stay). */
export function freeText(blk) {
  blk.units.forEach((u) => u.mesh.geometry.dispose())
}
