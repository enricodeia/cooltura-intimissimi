// Kinetic type: a text block as one mesh per glyph on the FX layer, animated
// the way GSAP SplitText is: the reveal and the unreveal each choose their own
// split (chars / words / lines), stagger order, offsets, turn about X (a tilt,
// or a cube when the turn has depth), scale, blur, opacity, mask; the colour
// travels (violet at 0 → ink at 100). A pure function of time.
//
// Block space: 1 unit = the cap height. Origin: x at the alignment anchor
// (left edge, centre, right edge), y at the middle of the block. Offsets are in
// % of the cap height (100 = one capital, which a mask hides completely).
//
// V4 adds (all off by default, so the other editions do not change):
//   lineStep  a stagger in two levels: the lines one after the other (lineStep
//             apart), the words / letters of each line staggered inside it
//   spread    tracking in / out: the letters start (or end) further apart from
//             the centre of their line (0.4 = 40 % further), without a mask
//   lineShift a horizontal offset per line (the words that arrive re-centre it)
//   accent.in the lines in evidence come in with a phase of their own

import * as THREE from 'three'
import { getFace, glyphGeometry, layout, glyphEpoch } from './type.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { ease, clamp, lerp, DEG, seededOrder } from '../core/util.js'

export const SPLITS = [
  ['chars', 'Lettere'],
  ['words', 'Parole'],
  ['lines', 'Righe'],
]
export const ORDERS = [
  ['start', 'Dall’inizio'],
  ['end', 'Dalla fine'],
  ['center', 'Dal centro'],
  ['edges', 'Dai bordi'],
  ['random', 'Casuale'],
]

export function rank(order, i, n, perm) {
  switch (order) {
    case 'end':
      return n - 1 - i
    case 'center':
      return Math.abs(i - (n - 1) / 2)
    case 'edges':
      return (n - 1) / 2 - Math.abs(i - (n - 1) / 2)
    case 'random':
      return perm ? perm[i % perm.length] : i
    default:
      return i
  }
}
/** Largest rank of an order over n units (the length of the stagger, in steps). */
export function rankSpan(order, n) {
  if (n <= 1) return 0
  if (order === 'center' || order === 'edges') return (n - 1) / 2
  return n - 1
}

const _c = new THREE.Color()

export class Kinetic {
  constructor(parent) {
    this.group = new THREE.Group()
    this.group.visible = false
    parent.add(this.group)
    this.maskInv = new THREE.Matrix4()
    this.chars = []
    this.key = ''
    this.info = { width: 0, height: 0, lines: [], words: [], nChars: 0 }
    this.from = new THREE.Color()
    this.to = new THREE.Color()
    this.outTo = new THREE.Color()
    // optional mask edges in block space (V5: the line the type stands on). clipLo
    // replaces the bottom of the mask band of the LAST line, clipHi the top of the FIRST.
    this.clipLo = null
    this.clipHi = null
    // optional window in block x (a masked line that text is pushed through): replaces
    // the left / right edge of every unit's mask cell
    this.clipX0 = null
    this.clipX1 = null
  }

  /**
   * (Re)build when the copy or its setting changes. measure = max line width in caps.
   * balance: keep the number of lines the measure gives, but make them as even as
   * possible (CSS text-wrap: balance), so no word is left alone on the last line.
   */
  set({ text = '', weight = 400, align = 'center', measure = Infinity, leading = 1.15, tracking = 0, balance = true, weights = null } = {}) {
    const key = [text, weight, align, Number.isFinite(measure) ? measure.toFixed(3) : 'inf', leading, tracking, balance, weights ? weights.join(',') : '', glyphEpoch()].join('|')
    if (key === this.key) return this.info
    this.dispose()
    this.key = key
    const face = getFace(weight)
    const em = 1 / face.cap // caps per em
    let L = layout(String(text), { weight, tracking, maxWidth: measure / em })
    // each paragraph (a "\n" line) laid out on its own: its index (for the lines in evidence) and its weight
    if (String(text).includes('\n')) {
      const lines = []
      String(text)
        .split('\n')
        .forEach((par, pi) => {
          const Lp = layout(par, { weight: weights?.[pi] ?? weight, tracking, maxWidth: measure / em })
          for (const ln of Lp.lines) lines.push({ ...ln, face: Lp.face, para: pi })
        })
      L = { lines, width: Math.max(0, ...lines.map((l) => l.width)), face }
    }
    if (balance && Number.isFinite(measure) && L.lines.length > 1 && !String(text).includes('\n')) {
      const n = L.lines.length
      let lo = L.width / n
      let hi = L.width
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2
        if (layout(String(text), { weight, tracking, maxWidth: mid }).lines.length > n) lo = mid
        else hi = mid
      }
      L = layout(String(text), { weight, tracking, maxWidth: hi + 1e-6 })
    }
    for (const ln of L.lines) {
      ln.face ??= L.face || face
      ln.para ??= 0
    }
    const lh = leading * em
    const n = L.lines.length
    const height = 1 + (n - 1) * lh
    const lines = []
    const words = []
    let wi = 0
    let ci = 0
    const lineWords = []
    const lineChars = []
    const paraFirst = new Map() // paragraph → its first line
    L.lines.forEach((line, li) => {
      const lw = line.width * em
      const ox = align === 'center' ? -lw / 2 : align === 'right' ? -lw : 0
      const base = height / 2 - 1 - li * lh
      lines.push({ x0: ox, x1: ox + lw, base, cx: ox + lw / 2, para: line.para ?? 0 })
      if (!paraFirst.has(line.para ?? 0)) paraFirst.set(line.para ?? 0, li)
      let wl = 0
      let cl = 0
      for (const w of line.words) {
        const word = { x0: Infinity, x1: -Infinity, base, li }
        for (const g of w.glyphs) {
          const geo = glyphGeometry(line.face || face, g.ch)
          const x0 = ox + (w.x + g.x) * em
          const x1 = x0 + g.adv * em
          word.x0 = Math.min(word.x0, x0)
          word.x1 = Math.max(word.x1, x1)
          if (!geo) continue
          if (!geo.boundingBox) geo.computeBoundingBox()
          const bb = geo.boundingBox
          const mat = fxMaterial({ maskInv: this.maskInv })
          const mesh = fxMesh(geo, mat)
          const holder = new THREE.Object3D()
          holder.add(mesh)
          this.group.add(holder)
          mesh.scale.setScalar(em)
          this.chars.push({
            ch: g.ch,
            pi: line.para ?? 0,
            li,
            lp: li - paraFirst.get(line.para ?? 0), // line inside its paragraph
            wl, // word inside its line
            cl: cl++, // letter inside its line
            wi,
            ci: ci++,
            x0,
            x1,
            cx: (x0 + x1) / 2,
            base,
            yLo: base + Math.min(0, bb.min.y * em) - 0.03,
            yHi: base + Math.max(1, bb.max.y * em) + 0.03,
            holder,
            mesh,
            mat,
          })
        }
        words.push({ ...word, cx: (word.x0 + word.x1) / 2 })
        wi++
        wl++
      }
      lineWords.push(wl)
      lineChars.push(cl)
    })
    // the band of each line (lowest descender → highest top), for word / line masks
    this.lineBand = lines.map(() => [Infinity, -Infinity])
    for (const c of this.chars) {
      const b = this.lineBand[c.li]
      b[0] = Math.min(b[0], c.yLo)
      b[1] = Math.max(b[1], c.yHi)
    }
    this.em = em
    this.counts = { chars: ci, words: wi, lines: n }
    this.lineWords = lineWords
    this.lineChars = lineChars
    this.lineShift = null
    this.perm = { chars: seededOrder(ci, 3), words: seededOrder(wi, 5), lines: seededOrder(n, 7) }
    this.lines = lines
    this.words = words
    this.info = { width: Math.max(0, ...lines.map((l) => l.x1 - l.x0)), height, lines, words, nChars: ci, lineHeight: lh, align }
    return this.info
  }

  _group(c, split) {
    return split === 'lines' ? c.li : split === 'words' ? c.wi : c.ci
  }
  _cell(c, split) {
    if (split === 'lines') {
      const l = this.lines[c.li]
      return [l.x0 - 0.08, l.x1 + 0.08, l.cx]
    }
    if (split === 'words') {
      const w = this.words[c.wi]
      return [w.x0 - 0.06, w.x1 + 0.06, w.cx]
    }
    return [c.x0 - 0.05, c.x1 + 0.05, c.cx]
  }
  _band(c, split) {
    let [lo, hi] = split === 'chars' ? [c.yLo, c.yHi] : this.lineBand[c.li] // words / lines: the band of the whole line
    if (this.clipLo !== null && c.li === this.lines.length - 1) lo = this.clipLo
    if (this.clipHi !== null && c.li === 0) hi = this.clipHi
    return [lo, hi]
  }

  /** Start time (relative to phase start) of a unit. ph.times (absolute, per group) overrides the stagger. */
  delayOf(c, ph) {
    const split = ph.split || 'chars'
    const gi = this._group(c, split)
    if (ph.times) return (ph.times[gi] ?? ph.at) - ph.at
    if (ph.lineStep && split !== 'lines') {
      // two levels: the line's turn, then the unit's place inside its line
      const [ii, nn] = split === 'words' ? [c.wl, this.lineWords[c.li]] : [c.cl, this.lineChars[c.li]]
      return (ph.paraLocal ? c.lp : c.li) * ph.lineStep + rank(ph.order, ii, nn, null) * (ph.stagger || 0)
    }
    if (ph.paraLocal) {
      // a phase of its own for a paragraph (the line in evidence): ranked inside its lines
      const [ii, nn] = split === 'words' ? [c.wl, this.lineWords[c.li]] : split === 'lines' ? [c.lp, 1] : [c.cl, this.lineChars[c.li]]
      return rank(ph.order, ii, nn, null) * (ph.stagger || 0)
    }
    const n = this.counts[split]
    return rank(ph.order, gi, n, this.perm[split]) * (ph.stagger || 0)
  }
  /** When line li starts in a phase (seconds after ph.at): its first unit. */
  lineStart(li, ph) {
    let m = Infinity
    for (const c of this.chars) if (c.li === li) m = Math.min(m, this.delayOf(c, ph))
    return Number.isFinite(m) ? m : 0
  }
  /** When the phase ends (last unit done), seconds after ph.at. */
  phaseLength(ph) {
    if (!ph) return 0
    const split = ph.split || 'chars'
    if (ph.times) return Math.max(0, ...ph.times.map((x) => x - ph.at)) + ph.dur
    if (ph.lineStep && split !== 'lines') {
      const per = split === 'words' ? this.lineWords : this.lineChars
      let m = 0
      per.forEach((nn, li) => (m = Math.max(m, li * ph.lineStep + rankSpan(ph.order, nn) * (ph.stagger || 0))))
      return m + ph.dur
    }
    return rankSpan(ph.order, this.counts[split]) * (ph.stagger || 0) + ph.dur
  }
  /** Extent (block x0, x1) of each group of a split: chars, words or lines. */
  groupsX(split) {
    if (split === 'lines') return this.lines.map((l) => [l.x0, l.x1])
    if (split === 'words') return this.words.map((w) => [w.x0, w.x1])
    return this.chars.map((c) => [c.x0, c.x1])
  }

  _state(c, t, s, out) {
    const I = s.accent?.in && s.accent.paras.has(c.pi) ? s.accent.in : s.in
    const O = s.out
    const pI = clamp((t - I.at - this.delayOf(c, I)) / Math.max(1e-4, I.dur))
    const started = t >= I.at + this.delayOf(c, I)
    const eI = ease(I.ease)(pI)
    let pO = 0
    let eO = 0
    if (O) {
      pO = clamp((t - O.at - this.delayOf(c, O)) / Math.max(1e-4, O.dur))
      eO = ease(O.ease)(pO)
    }
    const oX = O ? O.x : 0
    const oY = O ? O.y : 0
    out.started = started
    out.done = O ? pO >= 1 : false
    out.pI = pI
    out.pO = pO
    out.eI = eI
    out.eO = eO
    // offsets as in GSAP: x + = right, y + = down (block space is y up)
    out.dx = (I.x / 100) * (1 - eI) + (oX / 100) * eO
    out.dy = -(I.y / 100) * (1 - eI) - (oY / 100) * eO
    out.rot = (I.rot || 0) * (1 - eI) + (O ? O.rot || 0 : 0) * eO
    out.depth = pO > 0 ? (O.depth ?? 0) : (I.depth ?? 0)
    out.sc = lerp(I.scale ?? 1, 1, eI) * (O ? lerp(1, O.scale ?? 1, eO) : 1)
    const opI = lerp(I.opacity ?? 0, 1, ease(I.ease)(clamp(pI / 0.72)))
    const opO = O ? lerp(1, O.opacity ?? 0, ease(O.ease)(clamp((pO - 0.12) / 0.88))) : 1
    out.op = opI * opO
    out.blur = (I.blur || 0) * (1 - eI) + (O ? O.blur || 0 : 0) * eO
    out.spread = (I.spread || 0) * (1 - eI) + (O ? O.spread || 0 : 0) * eO
    out.phaseOut = pO > 0
    out.ph = pO > 0 ? O : I
    return out
  }

  /**
   * Pose for time t.
   * s = { in: phase, out: phase | null, from, to, outTo, opacity, motion, fps, px }
   * phase = { at, dur, stagger, order, split, ease, x, y, rot, depth, scale, blur, opacity, mask }
   * from / to / outTo: colours (outTo optional); px = pixels per cap (taps); motion = motion blur amount.
   */
  pose(t, s) {
    const any = this.chars.length > 0
    this.group.visible = any
    if (!any) return
    this.from.set(s.from)
    this.to.set(s.to)
    if (s.accent) (this.accentTo ??= new THREE.Color()).set(s.accent.color)
    const hasOutTo = !!s.outTo
    if (hasOutTo) this.outTo.set(s.outTo)
    const h = 1 / (s.fps || 30)
    const motion = s.motion ?? 0
    const fade = s.opacity ?? 1
    const A = {}
    const B = {}
    let shown = 0
    for (const c of this.chars) {
      const st = this._state(c, t, s, A)
      const vis = st.started && !st.done && st.op * fade > 0.002
      c.holder.visible = vis
      if (!vis) continue
      shown++
      const ph = st.ph
      const split = ph.split || 'chars'
      const [x0, x1, gcx] = this._cell(c, split)
      const [b0, b1] = this._band(c, split)
      const gcy = (b0 + b1) / 2
      const cy = c.base + 0.5
      const d = st.depth || 0
      const ls = this.lineShift ? this.lineShift[c.li] || 0 : 0
      const lcx = this.lines[c.li].cx
      const place = (o, k) => {
        k.x = gcx + (c.cx - gcx) * o.sc + o.dx + (c.cx - lcx) * (o.spread || 0) + ls
        k.y = gcy + (cy - gcy) * o.sc + o.dy
        return k
      }
      const P = place(st, {})
      c.holder.position.set(P.x, P.y, -d)
      c.holder.rotation.set(st.rot * DEG, 0, 0)
      c.holder.scale.setScalar(Math.max(1e-4, st.sc))
      c.mesh.position.set(-(c.x1 - c.x0) / 2, -0.5, d)
      // colour: violet → ink as it comes in, then (optionally) to the out colour
      const u = c.mat.uniforms
      u.uColor.value.copy(this.from).lerp(s.accent && s.accent.paras.has(c.pi) ? this.accentTo : this.to, st.eI)
      if (hasOutTo && st.eO > 0) u.uColor.value.lerp(this.outTo, st.eO)
      // a turn that shows the glyph edge-on fades it
      const edge = Math.abs(Math.cos(st.rot * DEG))
      u.uOpacity.value = st.op * fade * (Math.abs(st.rot) > 1 ? clamp(edge * 1.4) : 1)
      // mask: the unit's own cell (the SplitText mask), only for flat moves
      if (ph.mask) fxMask(c.mesh, true, this.clipX0 ?? x0 + ls, b0, this.clipX1 ?? x1 + ls, b1)
      else fxMask(c.mesh, false)
      // blur + motion blur (from the move over the last frame)
      let sx = 0
      let sy = 0
      if (motion > 0) {
        const Q = place(this._state(c, t - h, s, B), {})
        sx = (P.x - Q.x) * motion
        sy = (P.y - Q.y) * motion
      }
      const toLocal = 1 / (this.em * Math.max(1e-3, st.sc))
      fxBlur(c.mesh, (st.blur / 100) * toLocal, sx * toLocal, sy * toLocal, (s.px || 100) * this.em * st.sc)
    }
    this.group.visible = shown > 0
  }

  /** After the camera moved: the mask space follows the block. */
  late() {
    if (!this.group.visible) return
    this.group.updateWorldMatrix(true, false)
    this.maskInv.copy(this.group.matrixWorld).invert()
  }

  dispose() {
    for (const c of this.chars) {
      this.group.remove(c.holder)
      c.mesh.geometry.dispose()
      c.mat.dispose()
    }
    this.chars = []
    this.key = ''
  }
}

/** A phase from shot parameters with a prefix ('in' / 'out'): inSplit, inOrder, inDur… */
export function phaseOf(p, pre, at) {
  const g = (k, d) => (p[pre + k] !== undefined ? p[pre + k] : d)
  return {
    at,
    dur: g('Dur', 0.8),
    stagger: g('Stagger', 0.04),
    order: g('Order', 'start'),
    split: g('Split', 'words'),
    ease: g('Ease', 'ci.reveal'),
    x: g('X', 0),
    y: g('Y', 0),
    rot: g('Rot', 0),
    depth: g('Depth', 0),
    scale: g('Scale', 1),
    blur: g('Blur', 0),
    opacity: g('Opacity', 0),
    mask: !!g('Mask', false),
    lineStep: g('LineStep', 0),
    spread: g('Spread', 0),
  }
}
