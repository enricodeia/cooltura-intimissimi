// V5 · the plan of the take: from the resolved timeline and the frame, where the
// line runs, where every element stands on it, when the pen passes under each
// one, where the camera looks. Rebuilt when the edit or the format changes; the
// actor only reads it (every value is a pure function of time).
//
// World units: at the home framing the frame is VIEW_H (10) tall, so 1 unit is
// 1/10 of the frame height (108 px at 1080). Type sizes are % of the frame's
// short side (the same pixels in 16:9 and 9:16).

import { layout, getFace } from '../lib/type.js'
import { ease, clamp, lerp } from '../core/util.js'
import { VIEW_H } from '../engine/engine.js'
import { lockupLayout } from './lockup.js'
import { commentSize, COMMENT_COUNT } from './art.js'

export const HERO = 'v3/hero.mp4'
const HERO_SLUG = 'aria-alice-muzza'
const DESC = /[gjpqy,;()[\]Q]/ // text with descenders stands a little higher on the line

// ------------------------------------------------------------------ text metrics (same wrapping as Kinetic)

export function textBox(str, weight, tracking = 0, measureCaps = Infinity, leading = 1.1) {
  const face = getFace(weight)
  const em = 1 / face.cap
  const s = String(str)
  let L = layout(s, { weight, tracking, maxWidth: measureCaps / em })
  if (Number.isFinite(measureCaps) && L.lines.length > 1 && !s.includes('\n')) {
    const n = L.lines.length
    let lo = L.width / n
    let hi = L.width
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (layout(s, { weight, tracking, maxWidth: mid }).lines.length > n) lo = mid
      else hi = mid
    }
    L = layout(s, { weight, tracking, maxWidth: hi + 1e-6 })
  }
  const n = L.lines.length
  return { w: L.width * em, h: 1 + (n - 1) * leading * em, lines: n, space: L.space * em }
}
/** Width of a counter in caps: digits are tabular (the widest digit), as lib/counter.js sets them. */
export function counterW(value, weight) {
  const face = getFace(weight)
  const em = 1 / face.cap
  const dw = Math.max(...'0123456789'.split('').map((d) => face.glyph(d).adv))
  let x = 0
  for (const ch of String(value)) x += (/\d/.test(ch) ? dw : face.glyph(ch).adv) * em
  return x
}
/** Gap between the baseline and the line, in caps. */
const standGap = (str) => (DESC.test(str) ? 0.34 : 0.2)

// ------------------------------------------------------------------ the path (one polyline, arc length)

class Path {
  constructor() {
    this.x = []
    this.y = []
    this.c = []
  }
  get n() {
    return this.x.length
  }
  get s() {
    return this.c.length ? this.c[this.c.length - 1] : 0
  }
  get lx() {
    return this.x[this.x.length - 1]
  }
  get ly() {
    return this.y[this.y.length - 1]
  }
  move(x, y) {
    if (this.n) return this.to(x, y)
    this.x.push(x)
    this.y.push(y)
    this.c.push(0)
  }
  to(x, y) {
    if (!this.n) return this.move(x, y)
    const d = Math.hypot(x - this.lx, y - this.ly)
    if (d < 1e-7) return
    this.x.push(x)
    this.y.push(y)
    this.c.push(this.s + d)
  }
  /** Arc around (cx, cy), radius r, from angle a0 to a1 (radians, counter-clockwise if a1 > a0). */
  arc(cx, cy, r, a0, a1) {
    if (r <= 1e-6) return
    const steps = Math.max(6, Math.ceil((Math.abs(a1 - a0) / (Math.PI / 2)) * 14))
    for (let i = 1; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      this.to(cx + r * Math.cos(a), cy + r * Math.sin(a))
    }
  }
  /** A horizontal run to x; returns the floor record {s0, x0, x1, y} (for "when does the pen pass x"). */
  floor(x) {
    const f = { s0: this.s, x0: this.lx, x1: x, y: this.ly }
    this.to(x, this.ly)
    return f
  }
  /**
   * A frame standing on the floor (the pen leaves the floor, climbs the left side,
   * crosses the top, comes down the right side and goes on): outer box [xa, xb] ×
   * [y, y + h], corner radius rf, fillets rl where it meets the floor.
   * → { s0 (starts to climb), s1 (back on the floor) }
   */
  frame(xa, xb, h, rf, rl) {
    const y = this.ly
    const D = Math.PI / 180
    this.to(xa - rl, y)
    const s0 = this.s
    this.arc(xa - rl, y + rl, rl, -90 * D, 0)
    this.to(xa, y + h - rf)
    this.arc(xa + rf, y + h - rf, rf, 180 * D, 90 * D)
    this.to(xb - rf, y + h)
    this.arc(xb - rf, y + h - rf, rf, 90 * D, 0)
    this.to(xb, y + rl)
    this.arc(xb + rl, y + rl, rl, 180 * D, 270 * D)
    return { s0, s1: this.s }
  }
  pos(s, out = [0, 0]) {
    const c = this.c
    const n = c.length
    if (!n) return out
    if (s <= 0) {
      out[0] = this.x[0]
      out[1] = this.y[0]
      return out
    }
    if (s >= c[n - 1]) {
      out[0] = this.x[n - 1]
      out[1] = this.y[n - 1]
      return out
    }
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (c[m] <= s) lo = m
      else hi = m
    }
    const k = (s - c[lo]) / Math.max(1e-9, c[hi] - c[lo])
    out[0] = this.x[lo] + (this.x[hi] - this.x[lo]) * k
    out[1] = this.y[lo] + (this.y[hi] - this.y[lo]) * k
    return out
  }
}

// ------------------------------------------------------------------ the pen (eased moves along the path, with a pace)

const easeInv = (e, p) => {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 26; i++) {
    const m = (lo + hi) / 2
    if (e(m) < p) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

class PenTrack {
  constructor() {
    this.moves = []
  }
  /**
   * One move from rest to rest. weights: [[sAbs, w], …] (w > 1 = slower there), smoothed.
   */
  add(t0, dur, easeName, s0, s1, weights = []) {
    if (s1 - s0 < 1e-6) return
    const N = 240
    const len = s1 - s0
    const wAt = (s) => {
      let w = 1
      for (const [sa, wa] of weights) if (s >= sa) w = wa
      return w
    }
    // smoothed weights (a short moving average, so the speed never jumps)
    const raw = new Float64Array(N)
    for (let i = 0; i < N; i++) raw[i] = wAt(s0 + ((i + 0.5) / N) * len)
    const R = 6
    const W = new Float64Array(N + 1)
    for (let i = 0; i < N; i++) {
      let a = 0
      let c = 0
      for (let j = -R; j <= R; j++) {
        const k = Math.min(N - 1, Math.max(0, i + j))
        a += raw[k]
        c++
      }
      W[i + 1] = W[i] + a / c
    }
    for (let i = 0; i <= N; i++) W[i] /= W[N]
    this.moves.push({ t0, dur: Math.max(1e-3, dur), e: ease(easeName), s0, s1, W, N })
    this.moves.sort((a, b) => a.t0 - b.t0)
  }
  _sOf(m, p) {
    // inverse of the cumulative pace: p (0..1) → arc length
    const W = m.W
    let lo = 0
    let hi = m.N
    while (hi - lo > 1) {
      const k = (lo + hi) >> 1
      if (W[k] <= p) lo = k
      else hi = k
    }
    const f = (p - W[lo]) / Math.max(1e-12, W[hi] - W[lo])
    return m.s0 + ((lo + f) / m.N) * (m.s1 - m.s0)
  }
  _pOf(m, s) {
    const x = clamp((s - m.s0) / Math.max(1e-9, m.s1 - m.s0)) * m.N
    const i = Math.min(m.N - 1, Math.floor(x))
    return m.W[i] + (m.W[i + 1] - m.W[i]) * (x - i)
  }
  s(t) {
    let s = 0
    for (const m of this.moves) {
      if (t < m.t0) break
      const u = clamp((t - m.t0) / m.dur)
      s = u >= 1 ? m.s1 : this._sOf(m, m.e(u))
    }
    return s
  }
  /** When the pen passes arc length S (its first move that reaches S). */
  tPass(S) {
    for (const m of this.moves) {
      if (S > m.s1 + 1e-6) continue
      if (S <= m.s0) return m.t0
      return m.t0 + easeInv(m.e, this._pOf(m, S)) * m.dur
    }
    const last = this.moves[this.moves.length - 1]
    return last ? last.t0 + last.dur : 0
  }
  get first() {
    return this.moves[0] || null
  }
  get last() {
    return this.moves[this.moves.length - 1] || null
  }
}

// ------------------------------------------------------------------ the camera (sequential eased moves, x / y / log height)

class CamTrack {
  constructor(init) {
    this.init = init
    this.moves = []
  }
  /** zEase: a separate curve for the zoom (pan first, zoom later). */
  add(t0, dur, easeName, to, zEase = null) {
    this.moves.push({ t0, dur: Math.max(1e-3, dur), e: ease(easeName), ez: zEase ? ease(zEase) : null, to })
    this.moves.sort((a, b) => a.t0 - b.t0)
  }
  at(t) {
    let x = this.init.x
    let y = this.init.y
    let lh = Math.log(this.init.h)
    for (const m of this.moves) {
      if (t < m.t0) break
      const u = clamp((t - m.t0) / m.dur)
      const k = m.e(u)
      const T = typeof m.to === 'function' ? m.to(t) : m.to
      x = lerp(x, T.x, k)
      y = lerp(y, T.y, k)
      lh = lerp(lh, Math.log(T.h), m.ez ? m.ez(u) : k)
    }
    return { x, y, h: Math.exp(lh) }
  }
}

// ------------------------------------------------------------------ the plan

/**
 * @param T resolved timeline · view: engine.view · look: project.look (+ defaults)
 * @param pool: { grid: [keys] } video keys available for the mosaic
 */
export function buildPlan(T, view, look, pool) {
  const S = Math.min(view.w, view.h) // the short side, home framing
  const portrait = view.aspect < 0.9
  const path = new Path()
  const pen = new PenTrack()
  const els = []
  const ctx = { view, S, portrait, path, pen, els, L: 0, prevBox: null, restS: 0, focus: { x: 0, y: 0, h: VIEW_H }, open: null, close: null, stack: null }
  const capOf = (pct, k = 1) => (pct / 100) * S * k
  const restPad = S * 0.035
  let cam = null

  // the frame at height h (world): its width
  const frameW = (h) => h * view.aspect
  /** Camera focus on a box (world), never closer than h0. */
  const focusOn = (x0, x1, y0, y1, h0 = VIEW_H, fill = 0.86) => {
    const w = x1 - x0
    const hh = y1 - y0
    const h = Math.max(h0, w / (view.aspect * fill), hh / 0.8)
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 0.025 * h, h }
  }
  /** Where the next content starts: far enough that the content before is out of frame when the camera looks at this one. */
  const startAfter = (w, h = VIEW_H) => {
    const prevEnd = ctx.prevBox ? ctx.prevBox.x1 : path.lx
    let need = frameW(h) / 2 - w / 2 + S * 0.06
    // after a wide framing (the mosaic) the camera first slides at that zoom until it is out of frame, then zooms in
    if (ctx.prevBox?.k > 1.3) need = Math.max(need, frameW(ctx.prevBox.k * VIEW_H) / 2 - w / 2 + S * 0.3)
    return Math.max(prevEnd + Math.max(S * 0.35, need), path.lx + S * 0.12)
  }
  /** Camera to a station focus: a plain move, or slide-then-zoom after a wide framing. */
  const travelTo = (t0, p, f, lag = 0.05) => {
    const pk = ctx.prevBox?.k || 1
    if (pk > 1.3 && ctx.prevFocus) {
      const slide = p.travel * 0.62
      cam.add(t0 + lag, slide, 'cubic(0.5,0,0.3,1)', { x: f.x, y: ctx.prevFocus.y, h: ctx.prevFocus.h })
      cam.add(t0 + lag + slide * 0.55, p.travel, 'cubic(0.55,0,0.2,1)', f)
    } else cam.add(t0 + lag, p.travel, p.camEase, f)
    ctx.prevFocus = f
  }
  const tPassX = (f, x) => pen.tPass(f.s0 + clamp(x, Math.min(f.x0, f.x1), Math.max(f.x0, f.x1)) - f.x0)

  const shots = T.shots
  const lockups = shots.filter((s) => s.type === 'lockup')
  const openShot = lockups[0] || null
  const closeShot = lockups.length > 1 ? lockups[lockups.length - 1] : null

  // ================================================================ stations
  const B = {}

  B.lockup = (sh) => {
    const p = sh.p
    if (sh === openShot) {
      const g = lockupLayout(view, p, 0, 0)
      ctx.L = g.floorY
      const r = g.hookR
      // the asterisk leaves the logo: right into the gap, down to the floor, onto the floor
      path.move(g.star.x, g.star.y)
      path.to(g.gapX - r, g.star.y)
      path.arc(g.gapX - r, g.star.y - r, r, Math.PI / 2, 0)
      path.to(g.gapX, ctx.L + r)
      path.arc(g.gapX + r, ctx.L + r, r, Math.PI, Math.PI * 1.5)
      ctx.hookEnd = path.s
      ctx.restS = 0
      ctx.open = { g, sh }
      els.push({ kind: 'lockup', id: sh.id, role: 'open', g, sh, box: g.box })
      ctx.focus = { x: 0, y: 0, h: VIEW_H }
      cam = new CamTrack(ctx.focus)
      ctx.prevBox = g.box
      return
    }
    // closing: the line runs under the logo, climbs the gap and the asterisk lands in its place
    const g0 = lockupLayout(view, p, 0, 0)
    const w = g0.box.x1 - g0.box.x0
    const x0 = startAfter(w)
    const cx = x0 - g0.box.x0
    const g = lockupLayout(view, p, cx, ctx.L - g0.floorY)
    const r = g.hookR
    const t0 = sh.start
    const fl = path.floor(g.gapX - r)
    path.arc(g.gapX - r, ctx.L + r, r, -Math.PI / 2, 0)
    path.to(g.gapX, g.star.y - r)
    path.arc(g.gapX - r, g.star.y - r, r, 0, Math.PI / 2)
    path.to(g.star.x, g.star.y)
    const sEnd = path.s
    const climb = fl.s0 + (g.gapX - r - fl.x0)
    pen.add(t0, p.penDur, p.penEase, ctx.restS, sEnd, [
      [ctx.restS, 0.8],
      [climb, 1.45],
    ])
    const dockAt = t0 + p.penDur
    const f = focusOn(g.box.x0, g.box.x1, ctx.L - S * 0.05, g.box.y1)
    cam.add(t0, p.travel, p.camEase, f)
    const leftX = f.x - frameW(f.h) / 2 - S * 0.1
    ctx.close = { g, sh, dockAt, sEnd, tailFrom: fl.s0 + Math.max(0, leftX - fl.x0), retractAt: dockAt + p.retractAt, retractDur: p.retractDur, retractEase: p.retractEase }
    els.push({ kind: 'lockup', id: sh.id, role: 'close', g, sh, revealAt: t0 + p.revealAt, box: g.box })
    ctx.restS = sEnd
    ctx.prevBox = g.box
  }

  B.word = (sh) => {
    els.push({ kind: 'word', id: sh.id, sh, x: 0, y: 0, box: { x0: -view.w / 2, x1: view.w / 2, y0: -view.h / 2, y1: view.h / 2 } })
  }

  B.creators = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const Ht = p.heroH * VIEW_H
    const Wt = (Ht * 9) / 16
    const g = p.gap * Ht
    const m = p.frameGap * Ht
    const rT = p.corner * Wt
    const rF = rT + m
    const rL = Math.min(rF * 0.6, (g - m) * 0.8)
    const pitchX = Wt + g
    const pitchY = Ht + g
    // the first creator: framed at ~64 % of the frame
    const hHero = (Ht + 2 * m) / 0.64
    const xa = startAfter(Wt + 2 * m, hHero) // left side of the frame
    const xh = xa + m // left edge of the video
    path.floor(xa - rL)
    const fr = path.frame(xa, xa + Wt + 2 * m, Ht + 2 * m, rF, rL)
    path.floor(xa + Wt + 2 * m + rL + Math.min(g * 0.45, restPad))
    const sRestA = path.s
    pen.add(t0, p.penDur, p.penEase, ctx.restS, sRestA, [
      [ctx.restS, ctx.restS < (ctx.hookEnd ?? 0) ? 1.5 : 0.8],
      [ctx.hookEnd ?? -1, 0.7],
      [fr.s0 - Ht * 0.15, 1.3],
    ])
    const fHero = { x: xa + (Wt + 2 * m) / 2, y: L + (Ht + 2 * m) / 2 - 0.01 * hHero, h: hHero }
    cam.add(t0 + 0.4, p.travel, p.camEase, fHero) // the asterisk drops out of the logo first, then the camera follows
    els.push({
      kind: 'tile',
      id: sh.id + ':hero',
      key: HERO,
      x: xh + Wt / 2,
      y: L + m + Ht / 2,
      w: Wt,
      h: Ht,
      r: rT,
      reveal: { at: pen.tPass(fr.s0) + 0.04, dur: Math.max(p.revealDur, pen.tPass(fr.s1) - pen.tPass(fr.s0)), ease: p.revealEase },
      media: 'hero',
      box: { x0: xh, x1: xh + Wt, y0: L, y1: L + Ht + m },
    })
    // ---------------- the mosaic: 310 more, column after column rising from the line
    const n = Math.max(1, Math.round(p.count) - 1)
    const auto = Math.sqrt((n * pitchX) / (pitchY * (portrait ? 0.62 : 1.6)))
    const R = Math.max(1, Math.min(n, Math.round(p.rows || (portrait ? auto : 10))))
    const C = Math.ceil(n / R)
    const blockW = (C + 1) * pitchX - g // the hero's column + C columns
    const blockH = R * pitchY - g + m
    const keys = pool.grid.filter((k) => !k.includes(HERO_SLUG))
    const tPB = t0 + p.penDur + p.pbAt
    // the figure (its size follows the zoom out); iterate the fit twice
    const val = String(p.value)
    const lab = String(p.label).toUpperCase()
    const fb = { w: counterW(val, p.weight) }
    const lb = textBox(lab, p.labelWeight, p.labelTracking)
    let kM = 10
    let box = null
    let fig = null
    for (let it = 0; it < 3; it++) {
      const capF = capOf(p.size, kM)
      const capL = capOf(p.labelSize, kM)
      const figW = fb.w * capF
      const labW = lb.w * capL
      if (!portrait) {
        const xf = xh + blockW + capF * 0.55
        fig = { x: xf, base: L + capF * 0.2, cap: capF, labX: xf, labTop: L - capL * 1.15, capL, w: Math.max(figW, labW) }
        box = { x0: xa - rL, x1: xf + fig.w, y0: L - capL * 2.3, y1: L + blockH }
      } else {
        const xf = xh + blockW / 2 - Math.max(figW, labW) / 2
        const top = L - capF * 0.35
        fig = { x: xf, base: top - capF, cap: capF, labX: xf, labTop: top - capF - capL * 1.3, capL, w: Math.max(figW, labW), below: true }
        box = { x0: xa - rL, x1: xh + blockW, y0: fig.labTop - capL * 1.2, y1: L + blockH }
      }
      const fM = focusOn(box.x0, box.x1, box.y0, box.y1, VIEW_H, 0.88)
      kM = fM.h / VIEW_H
      if (it === 2) {
        cam.add(tPB, p.pbDur, p.pbEase, fM)
        ctx.mosaicFocus = fM
      }
    }
    const xEnd = portrait ? xh + blockW + restPad * kM * 0.4 : fig.x + fig.w + restPad * kM * 0.6
    const flB = path.floor(Math.max(path.lx + 0.01, xEnd))
    const sEnd = path.s
    pen.add(tPB, p.pbDur, p.pbEase, sRestA, sEnd)
    for (let c = 0; c < C; c++) {
      const xc = xh + (c + 1) * pitchX // left edge of the column
      const rows = c === C - 1 ? n - R * (C - 1) : R
      const at = tPassX(flB, xc + Wt / 2) - p.riseDur * 0.3
      for (let r = 0; r < rows; r++) {
        const k = c * R + r
        const key = keys[(c * 7 + r * 11 + 3) % keys.length]
        const hs = ((c * 73856093) ^ (r * 19349663)) >>> 0
        els.push({
          kind: 'tile',
          id: `${sh.id}:m${k}`,
          key,
          x: xc + Wt / 2,
          y: L + m + r * pitchY + Ht / 2,
          w: Wt,
          h: Ht,
          r: rT,
          // the column builds up from the line: each video fills from its own bottom edge, row after row
          reveal: { at: at + r * p.rowStagger, dur: p.riseDur, ease: p.riseEase },
          lift: Ht * 0.14,
          noZoom: true,
          clipY: L + m * 0.5,
          zoom: 1 + (hs % 1000) / 1000 * 0.22,
          shift: [((hs >> 10) % 1000) / 1000 - 0.5, ((hs >> 20) % 1000) / 1000 - 0.5],
          media: 'grid',
          box: { x0: xc, x1: xc + Wt, y0: L, y1: L + m + (r + 1) * pitchY },
        })
      }
    }
    const figAt = tPB + 0.12
    els.push({ kind: 'counter', id: sh.id + ':fig', value: val, p, x: fig.x, base: fig.base, cap: fig.cap, at: figAt, dur: Math.max(0.4, p.pbDur * 0.92), spins: p.spins, step: p.spinStep, box: { x0: fig.x, x1: fig.x + fig.w, y0: fig.base, y1: fig.base + fig.cap } })
    els.push(labelEl(sh.id + ':lab', lab, p, fig.labX, fig.labTop, fig.capL, L, { mode: 'time', at: tPB + p.pbDur * 0.72 }))
    ctx.L = L
    ctx.restS = sEnd
    ctx.prevBox = { x0: box.x0, x1: box.x1, k: kM }
    ctx.prevFocus = ctx.mosaicFocus
  }

  /** A caption hanging under the line. */
  function labelEl(id, txt, p, x, top, cap, lineY, rise, floor = null) {
    const tb = textBox(txt, p.labelWeight ?? '400', p.labelTracking ?? 0.08)
    return {
      kind: 'text',
      id,
      text: txt,
      weight: p.labelWeight ?? '400',
      tracking: p.labelTracking ?? 0.08,
      cap,
      x,
      top,
      side: 'below',
      lineY,
      color: p.labelColor ?? 'mute',
      from: p.labelColor ?? 'mute',
      rise: { split: 'chars', delay: 0.1, dur: 0.6, ease: 'ci.reveal', y: 150, blur: 20, stagger: 0.012, ...rise },
      floor,
      motion: 0.5,
      box: { x0: x, x1: x + tb.w * cap, y0: top - cap, y1: top },
    }
  }

  /** Type standing on the line (lead word grey + the rest), rising when the pen passes. */
  function standEls(sh, p, x, L, floor, o = {}) {
    const cap = o.cap ?? capOf(p.size)
    const lead = String(p.lead || '').trim()
    const txt = String(p.text || '')
    const gap = standGap(lead + txt) * cap
    const out = []
    let w = 0
    let h = cap
    const rise = { split: p.riseSplit, delay: p.riseDelay, dur: p.riseDur, ease: p.riseEase, y: p.riseY, blur: p.riseBlur, mode: 'pen', ...o.rise }
    if (lead) {
      const lb = textBox(lead, p.weight, p.tracking)
      const mb = textBox(txt, p.weight, p.tracking)
      const sp = lb.space
      out.push({ kind: 'text', id: sh.id + ':lead', text: lead, weight: p.weight, tracking: p.tracking, cap, x, base: L + gap, side: 'above', lineY: L, color: p.leadColor, from: p.fromColor, rise, floor, motion: p.motion })
      out.push({ kind: 'text', id: sh.id + ':text', text: txt, weight: p.weight, tracking: p.tracking, cap, x: x + (lb.w + sp) * cap, base: L + gap, side: 'above', lineY: L, color: p.color, from: p.fromColor, rise, floor, motion: p.motion })
      w = (lb.w + sp + mb.w) * cap
    } else {
      const measure = Math.min(p.measure * S, view.w * 0.86) / cap
      const tb = textBox(txt, p.weight, p.tracking, measure, p.leading)
      out.push({ kind: 'text', id: sh.id + ':text', text: txt, weight: p.weight, tracking: p.tracking, leading: p.leading, measure, cap, x, base: L + gap, side: 'above', lineY: L, color: p.color, from: p.fromColor, rise, floor, motion: p.motion })
      w = tb.w * cap
      h = tb.h * cap
    }
    for (const e of out) e.box = { x0: x, x1: x + w, y0: L, y1: L + gap + h }
    return { els: out, w, h: gap + h, gap, cap }
  }

  B.title = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    // fit: never wider than the frame
    let cap = capOf(p.size)
    const lead = String(p.lead || '').trim()
    if (lead) {
      const lb = textBox(lead, p.weight, p.tracking)
      const mb = textBox(String(p.text || ''), p.weight, p.tracking)
      const w = (lb.w + lb.space + mb.w) * cap
      if (w > view.w * 0.86) cap *= (view.w * 0.86) / w
    }
    const probe = standEls(sh, p, 0, L, null, { cap })
    const x0 = startAfter(probe.w)
    const fl = path.floor(x0 + probe.w + restPad)
    const st = standEls(sh, p, x0, L, fl, { cap })
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s)
    travelTo(t0, p, focusOn(x0, x0 + st.w, L - S * 0.04, L + st.h))
    els.push(...st.els)
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: x0 + st.w }
  }

  B.campaigns = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const names = [p.n1, p.n2, p.n3, p.n4, p.n5].map((s) => String(s || '').trim()).filter(Boolean)
    const capF = capOf(p.size)
    const capL = capOf(p.labelSize)
    const val = String(p.value)
    const lab = String(p.label).toUpperCase()
    const figW = counterW(val, p.weight) * capF
    const labW = textBox(lab, p.labelWeight, p.labelTracking).w * capL
    const colW = Math.max(figW, labW)
    const colGap0 = S * (portrait ? 0.06 : 0.085)
    const nameCaps = Math.max(...names.map((s) => textBox(s, p.nameWeight, -0.01).w))
    const capN = Math.min(capOf(p.nameSize), (view.w * 0.88 - colW - colGap0) / Math.max(1e-3, nameCaps))
    const nameW = nameCaps * capN
    const face = getFace(p.nameWeight)
    const step = p.nameLeading * (capN / face.cap)
    const gapN = 0.34 * capN
    const colGap = colGap0
    const w = colW + colGap + nameW
    const stackH = gapN + capN + step * (names.length - 1)
    // narrow frames: the names above the figure's column would not fit beside it, so the figure goes first and the names follow on the line
    const x0 = startAfter(w)
    const xn = x0 + colW + colGap
    const wide = (ctx.prevBox?.k || 1) > 1.3
    const fl = path.floor(x0 + w + restPad)
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s, wide ? [[ctx.restS, 0.08], [x0 - fl.x0 + fl.s0 - S * 0.5, 1]] : [])
    const f = focusOn(x0, x0 + w, L - capL * 2.4, L + Math.max(stackH, capF * 1.2))
    travelTo(t0, p, f)
    const tN = tPassX(fl, xn)
    const enters = names.map((_, i) => tN + p.enterAt + i * p.enterEvery)
    const stack = { id: sh.id, enters, enterDur: p.enterDur, enterEase: p.enterEase, step, sink: null }
    names.forEach((txt, i) => {
      els.push({
        kind: 'text',
        id: `${sh.id}:n${i}`,
        text: txt,
        weight: p.nameWeight,
        tracking: -0.01,
        cap: capN,
        x: xn,
        base: L + gapN,
        side: 'above',
        lineY: L,
        color: p.nameColor,
        from: 'violet',
        rise: { mode: 'time', at: enters[i], split: 'words', stagger: 0.035, dur: p.enterDur, ease: p.enterEase, y: 160, blur: 22 },
        stack,
        index: i,
        motion: 0.6,
        box: { x0: xn, x1: xn + nameW, y0: L, y1: L + stackH },
      })
    })
    const fig = { kind: 'counter', id: sh.id + ':fig', value: val, p, x: x0, base: L + capF * 0.2, cap: capF, at: enters[0], dur: p.enterDur, steps: enters, stepDur: p.enterDur * 0.9, spins: Math.max(1, names.length - 1), step: 0, stack, box: { x0, x1: x0 + figW, y0: L, y1: L + capF * 1.2 } }
    els.push(fig)
    const le = labelEl(sh.id + ':lab', lab, p, x0, L - capL * 1.15, capL, L, { mode: 'pen', delay: 0.1 }, fl)
    le.stack = stack
    els.push(le)
    ctx.stack = { stack, x0, x1: x0 + w, focus: f, fig, label: le }
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: x0 + w }
  }

  B.vision = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const st = ctx.stack
    const cap = capOf(p.size)
    const probe = standEls(sh, p, 0, L, null, { cap })
    let x0
    if (st) {
      st.stack.sink = { at: t0 + p.sinkAt, dur: p.sinkDur, ease: p.sinkEase }
      x0 = (st.x0 + st.x1) / 2 - probe.w / 2
      if (x0 + probe.w + restPad > path.lx) {
        const fl = path.floor(x0 + probe.w + restPad)
        pen.add(t0 + p.sinkAt, Math.max(0.5, p.riseAt - p.sinkAt + 0.5), 'cubic(0.5,0,0.3,1)', ctx.restS, path.s)
        void fl
      }
    } else {
      x0 = startAfter(probe.w)
      path.floor(x0 + probe.w + restPad)
      pen.add(t0, 1.2, 'cubic(0.6,0,0.25,1)', ctx.restS, path.s)
    }
    const stx = standEls(sh, p, x0, L, null, { cap, rise: { mode: 'time', at: t0 + p.riseAt, split: p.riseSplit, order: p.riseOrder, stagger: p.riseStagger } })
    const fv = focusOn(x0, x0 + stx.w, L - S * 0.04, L + stx.h)
    cam.add(t0 + 0.1, 1.3, 'cubic(0.5,0,0.3,1)', fv)
    ctx.prevFocus = fv
    els.push(...stx.els)
    ctx.restS = path.s
    ctx.prevBox = { x0: st ? Math.min(st.x0, x0) : x0, x1: Math.max(st ? st.x1 : 0, x0 + stx.w) }
  }

  B.figures = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const capF = capOf(p.size)
    const capL = capOf(p.labelSize)
    const items = [
      [p.v1, p.l1],
      [p.v2, p.l2],
    ]
      .map(([v, l]) => [String(v || '').trim(), String(l || '').trim().toUpperCase()])
      .filter(([v]) => v)
    const cols = items.map(([v, l]) => Math.max(counterW(v, p.weight) * capF, textBox(l, p.labelWeight, p.labelTracking).w * capL))
    const gapC = p.colGap * S
    const w = cols.reduce((a, b) => a + b, 0) + gapC * Math.max(0, items.length - 1)
    const x0 = startAfter(w)
    const fl = path.floor(x0 + w + restPad)
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s)
    travelTo(t0, p, focusOn(x0, x0 + w, L - capL * 2.4, L + capF * 1.2))
    let x = x0
    items.forEach(([v, l], i) => {
      const at = tPassX(fl, x)
      els.push({ kind: 'tick', id: `${sh.id}:t${i}`, x: x - capF * 0.16, y: L, h: capL * 1.25, at: at - 0.05, dur: 0.45, box: { x0: x - capF * 0.2, x1: x, y0: L - capL, y1: L + capL } })
      els.push({ kind: 'counter', id: `${sh.id}:f${i}`, value: v, p, x, base: L + capF * 0.2, cap: capF, at: at + 0.02, dur: p.cDur, spins: p.spins, step: p.spinStep, box: { x0: x, x1: x + cols[i], y0: L, y1: L + capF * 1.2 } })
      els.push(labelEl(`${sh.id}:l${i}`, l, p, x, L - capL * 1.15, capL, L, { mode: 'pen', delay: 0.12 }, fl))
      x += cols[i] + gapC
    })
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: x0 + w }
  }

  B.proof = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const slugs = (p.videos || []).filter(Boolean)
    const n = Math.max(1, Math.min(slugs.length || 1, p.count || (portrait ? 2 : 3)))
    let Ht = p.size * VIEW_H * (portrait ? 0.84 : 1)
    let Wt = (Ht * 9) / 16
    let m = p.frameGap * Ht
    let g = p.gap * Ht
    // never wider than the frame
    const total = () => n * (Wt + 2 * m) + (n - 1) * g
    if (total() > view.w * 0.9) {
      const k = (view.w * 0.9) / total()
      Ht *= k
      Wt *= k
      m *= k
      g *= k
    }
    const rT = p.corner * Wt
    const rF = rT + m
    const rL = Math.min(rF * 0.6, g * 0.4)
    const w = total()
    const x0 = startAfter(w)
    path.floor(x0 - rL)
    const frames = []
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * (Wt + 2 * m + g)
      frames.push({ xa, ...path.frame(xa, xa + Wt + 2 * m, Ht + 2 * m, rF, rL) })
    }
    const fl0 = { s0: frames[0].s0 - 1e-3, x0: x0 - rL, x1: x0 + w, y: L }
    path.floor(x0 + w + rL + restPad)
    const weights = [[ctx.restS, 0.75]]
    for (const f of frames) weights.push([f.s0, 1.25], [f.s1, 0.75])
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s, weights)
    const capL = capOf(p.labelSize)
    travelTo(t0, p, focusOn(x0 - rL, x0 + w + rL, L - capL * 2.6, L + Ht + 2 * m))
    frames.forEach((f, i) => {
      const slug = slugs[i % Math.max(1, slugs.length)] || 'aria-alessia-morelli'
      const a = pen.tPass(f.s0)
      const b = pen.tPass(f.s1)
      els.push({
        kind: 'tile',
        id: `${sh.id}:v${i}`,
        key: `v3/feed/${slug}.mp4`,
        x: f.xa + m + Wt / 2,
        y: L + m + Ht / 2,
        w: Wt,
        h: Ht,
        r: rT,
        reveal: { at: a + 0.03, dur: Math.max(p.revealDur, b - a), ease: p.revealEase },
        media: 'proof',
        box: { x0: f.xa, x1: f.xa + Wt + 2 * m, y0: L, y1: L + Ht + 2 * m },
      })
    })
    const cap = String(p.caption || '').trim().toUpperCase()
    if (cap) els.push(labelEl(sh.id + ':cap', cap, p, x0 + m, L - capL * 1.15, capL, L, { mode: 'pen', delay: 0.05 }, fl0))
    ctx.restS = path.s
    ctx.prevBox = { x0: x0 - rL, x1: x0 + w + rL }
  }

  B.claim = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const capB = capOf(p.size)
    const capT = capOf(p.textSize)
    const big = String(p.big)
    const bigW = counterW(big, p.weight) * capB
    const measure = (p.textMeasure * S) / capT
    const tb = textBox(String(p.text), p.textWeight, 0, measure, 1.32)
    const gapX = capB * 0.32
    const w = bigW + gapX + tb.w * capT
    const x0 = startAfter(w)
    const fl = path.floor(x0 + w + restPad)
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s)
    travelTo(t0, p, focusOn(x0, x0 + w, L - S * 0.04, L + capB * 1.22))
    els.push({ kind: 'counter', id: sh.id + ':big', value: big, p: { ...p, weight: p.weight }, x: x0, base: L + capB * 0.2, cap: capB, at: tPassX(fl, x0), dur: p.cDur, spins: p.spins, step: 0, down: true, digitAlign: 'left', box: { x0, x1: x0 + bigW, y0: L, y1: L + capB * 1.2 } })
    const xt = x0 + bigW + gapX
    const gap = standGap(p.text) * capT
    els.push({
      kind: 'text',
      id: sh.id + ':text',
      text: String(p.text),
      weight: p.textWeight,
      tracking: 0,
      leading: 1.32,
      measure,
      cap: capT,
      x: xt,
      base: L + gap,
      side: 'above',
      lineY: L,
      color: p.textColor,
      from: 'violet',
      rise: { split: p.riseSplit, delay: p.riseDelay, dur: p.riseDur, ease: p.riseEase, y: p.riseY, blur: p.riseBlur, mode: 'pen' },
      floor: fl,
      motion: p.motion,
      box: { x0: xt, x1: xt + tb.w * capT, y0: L, y1: L + gap + tb.h * capT },
    })
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: x0 + w }
  }

  B.thread = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const capF = capOf(p.size)
    const capL = capOf(p.labelSize)
    const val = String(p.value)
    const lab = String(p.label).toUpperCase()
    const figW = Math.max(counterW(val, p.weight) * capF, textBox(lab, p.labelWeight, p.labelTracking).w * capL)
    const r = S * 0.035
    const br = p.branch * S
    const gapC = p.gap * S
    const lead = S * (portrait ? 0.06 : 0.09)
    // one column of comments right of the thread; in narrow frames as wide as fits beside the figure
    const Wc = Math.max(S * 0.5, Math.min(p.width * S * (portrait ? 1.3 : 1), view.w * 0.92 - (figW + lead + r + br)))
    const w = figW + lead + r + br + Wc
    const x0 = startAfter(Math.min(w, frameW(VIEW_H) * 0.9))
    const xc = x0 + figW + lead + r // the thread
    const flA = path.floor(xc - r)
    path.arc(xc - r, L - r, r, Math.PI / 2, 0)
    const sTop = path.s
    const yTop = L - r
    const N = Math.round(p.count)
    // which comment goes where: the first ones are read (short, warm), the middle is the stream
    // (repeats only there, where it is a blur), the last ones are read again as it slows down
    const U = COMMENT_COUNT
    const HEAD = [0, 1, 2, 4].filter((i) => i < U)
    const TAIL = [12, 8, 6, 15].filter((i) => i < U)
    const MID = Array.from({ length: U }, (_, i) => i).filter((i) => !HEAD.includes(i) && !TAIL.includes(i))
    const order = [...HEAD]
    for (let i = 0; order.length < N - TAIL.length; i++) order.push(MID[i % MID.length])
    order.push(...TAIL)
    order.length = N
    const items = []
    let top = yTop - S * 0.07
    for (let k = 0; k < N; k++) {
      const idx = order[k] ?? k % U
      const sz = commentSize(idx, (Wc / S) * 1080)
      const h = Wc * sz.aspect
      items.push({ k, idx, top, h, branchY: top - h * sz.anchor })
      top -= h + gapC
    }
    const lowest = top + gapC
    const L2 = lowest - S * 0.1
    path.to(xc, L2 + r)
    const sBottom = path.s
    path.arc(xc + r, L2 + r, r, Math.PI, Math.PI * 1.5)
    path.floor(xc + r + restPad)
    const vLen = sBottom - sTop
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s, [
      [ctx.restS, 0.35],
      [sTop - r, p.slow],
      [sTop + vLen * p.slowPart, (p.slow + 1) / 2.6],
      [sTop + vLen * p.slowPart * 2.2, 1],
      [sBottom - r, 1.4],
    ])
    // camera: the figure and the top of the thread, then it follows the pen down
    const hT = VIEW_H
    const cxF = xc + (br + Wc) / 2 // the thread and its column, centred
    const fTop = focusOn(x0, xc + br + Wc, L - hT * 0.42, L + capF * 1.25)
    travelTo(t0, p, fTop)
    const follow = (t) => {
      const q = path.pos(pen.s(t))
      return { x: cxF, y: Math.min(fTop.y, q[1] + p.follow * hT), h: hT }
    }
    cam.add(pen.tPass(sTop + S * 0.1), 0.9, 'cubic(0.45,0,0.55,1)', follow)
    ctx.prevFocus = { x: cxF, y: L2 + p.follow * hT, h: hT }
    const figAt = tPassX(flA, x0)
    els.push({ kind: 'counter', id: sh.id + ':fig', value: val, p, x: x0, base: L + capF * 0.2, cap: capF, at: figAt + 0.02, dur: p.cDur, spins: p.spins, step: p.spinStep, box: { x0, x1: x0 + figW, y0: L, y1: L + capF * 1.2 } })
    els.push(labelEl(sh.id + ':lab', lab, p, x0, L - capL * 1.15, capL, L, { mode: 'pen', delay: 0.12 }, flA))
    for (const it of items) {
      const at = pen.tPass(sTop + (yTop - it.branchY))
      const xx = xc + br
      els.push({ kind: 'branch', id: `${sh.id}:b${it.k}`, x0: xc, x1: xc + br * 0.78, y: it.branchY, at: at - 0.04, dur: 0.28, box: { x0: xc, x1: xx, y0: it.branchY - 0.01, y1: it.branchY + 0.01 } })
      els.push({ kind: 'comment', id: `${sh.id}:c${it.k}`, idx: it.idx, x: xx, top: it.top, w: Wc, h: it.h, right: true, clipX: xc + br * 0.5, at, dur: p.revealDur, ease: p.revealEase, box: { x0: xx, x1: xx + Wc, y0: it.top - it.h, y1: it.top } })
    }
    ctx.L = L2
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: xc + br + Wc }
  }

  // ================================================================ walk the film
  for (const sh of shots) {
    if (!cam && sh.type !== 'word' && sh.type !== 'lockup') {
      // a film without an opening logo: the line starts at the left of the frame
      path.move(-view.w * 0.42, -VIEW_H * 0.05)
      ctx.L = -VIEW_H * 0.05
      ctx.focus = { x: 0, y: 0, h: VIEW_H }
      cam = new CamTrack(ctx.focus)
      ctx.prevBox = { x0: -view.w / 2, x1: -view.w * 0.42 }
    }
    const fn = B[sh.type]
    if (fn) fn(sh)
  }
  if (!cam) cam = new CamTrack({ x: 0, y: 0, h: VIEW_H })

  // ================================================================ the asterisk's roll (it turns only when it moves)
  const dur = T.duration
  const dt = 1 / 240
  const nSteps = Math.ceil(dur / dt) + 2
  const rot = new Float32Array(nSteps)
  const q0 = [0, 0]
  const q1 = [0, 0]
  let th = 0
  path.pos(pen.s(0), q0)
  const rFrac = ((look.penSize ?? 2.5) / 100) * (S / VIEW_H) * 0.5 // pen radius / frame height
  for (let i = 1; i < nSteps; i++) {
    const t = i * dt
    path.pos(pen.s(t), q1)
    const d = Math.hypot(q1[0] - q0[0], q1[1] - q0[1])
    if (d > 0) th -= d / Math.max(1e-6, rFrac * cam.at(t).h)
    rot[i] = th
    q0[0] = q1[0]
    q0[1] = q1[1]
  }

  const first = pen.first
  const last = pen.last
  const close = ctx.close
  return {
    S,
    portrait,
    path,
    pen,
    cam,
    els,
    open: ctx.open,
    close,
    departAt: ctx.open && first ? first.t0 : -1,
    dockAt: close ? close.dockAt : Infinity,
    penEnd: last ? last.t0 + last.dur : 0,
    camAt: (t) => cam.at(t),
    penS: (t) => pen.s(t),
    pos: (s, out) => path.pos(s, out),
    tPass: (S) => pen.tPass(S),
    tPassX,
    rotAt(t) {
      const x = clamp(t / dt, 0, nSteps - 1)
      const i = Math.floor(x)
      const j = Math.min(nSteps - 1, i + 1)
      return rot[i] + (rot[j] - rot[i]) * (x - i)
    },
    /** Arc length where the visible line starts (the end reels the line back in). */
    tail(t) {
      if (!close) return 0
      const u = clamp((t - close.retractAt) / Math.max(1e-3, close.retractDur))
      if (u <= 0) return 0
      return lerp(close.tailFrom, close.sEnd, ease(close.retractEase)(u))
    },
  }
}
