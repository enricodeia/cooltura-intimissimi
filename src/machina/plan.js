// V5 · the plan of the take: from the resolved timeline and the frame, where the
// line runs, where every element stands on it, when the pen passes under each
// one, where the camera looks. Rebuilt when the edit or the format changes; the
// actor only reads it (every value is a pure function of time).
//
// World units: at the home framing the frame is VIEW_H (10) tall, so 1 unit is
// 1/10 of the frame height (108 px at 1080). Type sizes are % of the frame's
// short side (the same pixels in 16:9 and 9:16).

import { layout, getFace } from '../lib/type.js'
import { ease, clamp, lerp, smooth } from '../core/util.js'
import { VIEW_H } from '../engine/engine.js'
import { lockupLayout } from './lockup.js'
import { commentSize, COMMENT_COUNT } from './art.js'
import { voiceAtOf } from '../v4/common.js'

export const HERO = 'v3/hero.mp4'
const HERO_SLUG = 'aria-alice-muzza'
/** V4's framed creator: a slug of the library ('v4/x', or a creator of the grid) or a full key → the media key. */
export function heroKeyOf(k) {
  if (!k) return HERO
  if (k.endsWith('.mp4')) return k
  return k.startsWith('v4/') ? k + '.mp4' : `v3/grid/${k}.mp4`
}
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
/** Width of a counter in caps: digits are tabular (the widest digit), as lib/counter.js sets them; kern (V4): each digit its own width. */
export function counterW(value, weight, tracking = 0, kern = false) {
  const face = getFace(weight)
  const em = 1 / face.cap
  const dw = Math.max(...'0123456789'.split('').map((d) => face.glyph(d).adv))
  let x = 0
  const s = String(value)
  for (const ch of s) x += (/\d/.test(ch) && !kern ? dw : face.glyph(ch).adv) * em
  return x + Math.max(0, s.length - 1) * tracking * em
}
/** Gap between the baseline and the line, in caps. */
const standGap = (str) => (DESC.test(str) ? 0.34 : 0.2)

/**
 * V4 · the statement's styles (p.statStyle): how the two lines come in (preIn), how they leave (out) and how
 * AT SCALE takes their place (bigIn), as kinetic phases. m: the panel's movement amount, b: its blur amount;
 * the timings are the panel's. pen: the line changes them, each word as it passes under it.
 */
export const STATEMENT = {
  line: (m, b) => ({
    pen: true,
    preIn: { y: 36 * m, blur: 34 * b, scale: 1 + 0.16 * m, opacity: 0, mask: false },
    out: { split: 'words', y: -55 * m, blur: 44 * b, scale: 1 + 0.04 * m, opacity: 0 },
    bigIn: { split: 'chars', y: 130 * Math.max(0.8, m), blur: 4 * b, scale: 1, opacity: 1, mask: true, spread: 0.3 * m },
    bigOut: { split: 'chars', y: 130 * Math.max(0.8, m), blur: 6 * b, scale: 1, opacity: 1, mask: true },
  }),
  focus: (m, b) => ({
    preIn: { y: 0, blur: 46 * b, scale: 1 + 0.12 * m, opacity: 0, mask: false },
    out: { split: 'words', order: 'center', y: 0, blur: 56 * b, scale: 1 + 0.1 * m, opacity: 0 },
    bigIn: { split: 'words', y: 0, blur: 64 * b, scale: 1 + 0.16 * m, opacity: 0, mask: false, spread: 0 },
    bigOut: { split: 'words', y: 0, blur: 64 * b, scale: 1 + 0.12 * m, opacity: 0 },
  }),
  up: (m, b) => ({
    preIn: { y: 70 * m, blur: 22 * b, scale: 1, opacity: 0, mask: false },
    out: { split: 'words', y: -80 * m, blur: 26 * b, scale: 1, opacity: 0 },
    bigIn: { split: 'chars', y: 130 * Math.max(0.8, m), blur: 10 * b, scale: 1, opacity: 0, mask: true, spread: 0.15 * m },
    bigOut: { split: 'chars', y: -90 * m, blur: 26 * b, scale: 1, opacity: 0 },
  }),
  zoom: (m, b) => ({
    preIn: { y: 0, blur: 30 * b, scale: Math.max(0.2, 1 - 0.3 * m), opacity: 0, mask: false },
    out: { split: 'lines', y: 0, blur: 40 * b, scale: 1 + 0.9 * m, opacity: 0 },
    bigIn: { split: 'words', y: 0, blur: 36 * b, scale: Math.max(0.2, 1 - 0.4 * m), opacity: 0, mask: false, spread: 0 },
    bigOut: { split: 'words', y: 0, blur: 40 * b, scale: 1 + 1.2 * m, opacity: 0 },
  }),
  mask: () => ({
    preIn: { y: 105, blur: 0, scale: 1, opacity: 1, mask: true },
    out: { split: 'words', y: -105, blur: 0, scale: 1, opacity: 1, mask: true },
    bigIn: { split: 'chars', y: 105, blur: 0, scale: 1, opacity: 1, mask: true, spread: 0 },
    bigOut: { split: 'chars', y: -105, blur: 0, scale: 1, opacity: 1, mask: true },
  }),
}

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
  /**
   * creep (V4, world units per second): the pen never stops. Between its moves it keeps rolling slowly forward,
   * and each move starts and ends at that speed (the move's own ease, which should start and end flat, rides on
   * top of the creep), so it slows down into a station, drifts on, and picks up again: no dead stop, no jolt.
   */
  constructor(creep = 0) {
    this.moves = []
    this.v = Math.max(0, creep || 0)
  }
  /**
   * One move from rest to rest. weights: [[sAbs, w], …] (w > 1 = slower there), smoothed.
   */
  add(t0, dur, easeName, s0, s1, weights = [], zoom = 1) {
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
    // zoom (V4): how wide the camera is while the pen drifts after this move (× the home framing), so the drift
    // reads the same on screen everywhere (slow on a close station, and still visible on the wide wall of the 311)
    const mv = { t0, dur: Math.max(1e-3, dur), e: ease(easeName), s0, s1, W, N, zoom }
    this.moves.push(mv)
    this.moves.sort((a, b) => a.t0 - b.t0)
    return mv
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
    if (this.v > 0) return this._flow(t)
    let s = 0
    for (const m of this.moves) {
      if (t < m.t0) break
      const u = clamp((t - m.t0) / m.dur)
      s = u >= 1 ? m.s1 : this._sOf(m, m.e(u))
    }
    return s
  }
  /**
   * V4: the moves on top of a slow roll (see the constructor). Each move starts at the drift speed of the station
   * before and ends at the drift speed of its own station (its speed goes from one to the other in a straight
   * ramp under the eased part), so the speed never jumps.
   */
  _flow(t) {
    let s = 0
    let tEnd = null
    let vPrev = 0
    for (const m0 of this.moves) {
      // (a move that would start before the one before it ends waits for it, keeping its end)
      const m = tEnd !== null && m0.t0 < tEnd ? { ...m0, t0: tEnd, dur: Math.max(0.05, m0.t0 + m0.dur - tEnd) } : m0
      if (t < m.t0) break
      const v0 = tEnd === null ? 0 : vPrev
      // where the pen really is when this move starts (it kept rolling since the last one)
      const s0 = tEnd === null ? m.s0 : s + vPrev * Math.max(0, m.t0 - tEnd)
      const v1 = this.v * (m.zoom ?? 1)
      const D = m.s1 - s0
      const lin = ((v0 + v1) / 2) * m.dur
      const tau = Math.min(t - m.t0, m.dur)
      const sLin = s0 + v0 * tau + ((v1 - v0) * tau * tau) / (2 * m.dur)
      const u = clamp((t - m.t0) / m.dur)
      if (u < 1) {
        if (D <= lin) return sLin
        const q = (this._sOf(m, m.e(u)) - m.s0) / Math.max(1e-9, m.s1 - m.s0)
        return sLin + (D - lin) * q
      }
      s = D <= lin ? s0 + lin : m.s1
      tEnd = m.t0 + m.dur
      vPrev = v1
    }
    return tEnd === null ? s : s + vPrev * (t - tEnd)
  }
  /** When the pen passes arc length S (its first move that reaches S). */
  tPass(S) {
    if (this.v > 0) {
      const f = this.first
      if (!f) return 0
      if (S <= this.s(f.t0) + 1e-9) return f.t0
      let lo = f.t0
      let hi = lo + 1
      while (this.s(hi) < S && hi - lo < 1200) hi = lo + (hi - lo) * 2
      for (let i = 0; i < 44; i++) {
        const mid = (lo + hi) / 2
        if (this.s(mid) < S) lo = mid
        else hi = mid
      }
      return hi
    }
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
  // V4 (look.flow): the asterisk never stops (it slows down into a station and drifts on), the camera keeps it in the frame
  const flow = !!look.flow
  const pen = new PenTrack(flow ? (look.creep ?? 0.42) * (S / 10) : 0)
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
  /** V4 · the frame of the creator who speaks (on the 5 campaigns, the first of the 311). */
  const heroGeometry = (p) => {
    const Ht = (p.heroH ?? 0.62) * VIEW_H
    const Wt = (Ht * 9) / 16
    const m = (p.frameGap ?? 0.014) * Ht
    const rT = (p.corner ?? 0.06) * Wt
    const rF = rT + m
    const rL = Math.min(rF * 0.6, S * 0.03)
    return { Ht, Wt, m, rT, rF, rL, outerW: Wt + 2 * m, outerH: Ht + 2 * m, outer: Wt + 2 * m + 2 * rL, gapH: S * (p.heroGap ?? 0.09) }
  }
  /** How long a voice lasts (its window, + the second one when it cuts a pause out). */
  const voiceSpan = (p) => Math.max(0, (p.voiceTo ?? 0) - (p.voiceFrom ?? 0)) + ((p.voice2To ?? 0) > (p.voice2From ?? 0) + 0.05 ? p.voice2To - p.voice2From : 0)

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
    // V4: the first creator is the one who spoke on the 5 campaigns (her frame is already drawn): the 310 rise beside her
    const H = flow && ctx.hero && p.fromCampaigns !== false ? ctx.hero : null
    const Ht = H ? H.Ht : p.heroH * VIEW_H
    const Wt = (Ht * 9) / 16
    const g = p.gap * Ht
    const m = H ? H.m : p.frameGap * Ht
    const rT = H ? H.rT : p.corner * Wt
    const rF = rT + m
    const rL = Math.min(rF * 0.6, (g - m) * 0.8)
    const pitchX = Wt + g
    const pitchY = Ht + g
    let xa
    let xh
    let sRestA
    if (H) {
      xa = H.xa
      xh = H.xh
      sRestA = ctx.restS
      // the names of the campaigns go back into the line as the creators rise
      if (ctx.stack && p.stackSink !== false) ctx.stack.stack.sink = { at: t0 + (p.stackSinkAt ?? 0), dur: p.stackSinkDur ?? 0.45, ease: 'cubic(0.6,0,0.8,0.4)' }
    } else {
      // the first creator: framed at ~64 % of the frame
      const hHero = (Ht + 2 * m) / 0.64
      xa = startAfter(Wt + 2 * m, hHero) // left side of the frame
      xh = xa + m // left edge of the video
      path.floor(xa - rL)
      const fr = path.frame(xa, xa + Wt + 2 * m, Ht + 2 * m, rF, rL)
      path.floor(xa + Wt + 2 * m + rL + Math.min(g * 0.45, restPad))
      sRestA = path.s
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
        key: heroKeyOf(p.heroKey),
        // V4: her own voice is heard (a clip cut with its sound), the picture runs on the same line as the sound
        voice: p.voiceOn && heroKeyOf(p.heroKey).startsWith('v4/') ? { from: p.voiceFrom ?? 0, at: t0 + (p.voiceAt ?? 0) } : null,
        x: xh + Wt / 2,
        y: L + m + Ht / 2,
        w: Wt,
        h: Ht,
        r: rT,
        reveal: { at: pen.tPass(fr.s0) + 0.04, dur: Math.max(p.revealDur, pen.tPass(fr.s1) - pen.tPass(fr.s0)), ease: p.revealEase },
        media: 'hero',
        box: { x0: xh, x1: xh + Wt, y0: L, y1: L + Ht + m },
      })
    }
    // ---------------- the mosaic: 310 more, column after column rising from the line
    const n = Math.max(1, Math.round(p.count) - 1)
    const auto = Math.sqrt((n * pitchX) / (pitchY * (portrait ? 0.62 : 1.6)))
    const R = Math.max(1, Math.min(n, Math.round(p.rows || (portrait ? auto : 10))))
    const C = Math.ceil(n / R)
    const blockW = (C + 1) * pitchX - g // the hero's column + C columns
    const blockH = R * pitchY - g + m
    // V4: the videos chosen for the mosaic (none chosen = all of them); never the framed creator again
    const chosen = (p.gridVideos || []).map((s) => `v3/grid/${s}.mp4`).filter((k) => pool.grid.includes(k))
    const heroKey = H ? H.el.key : heroKeyOf(p.heroKey)
    const heroSlug = heroKey === HERO ? HERO_SLUG : heroKey.split('/').pop().slice(0, -4)
    let keys = (chosen.length ? chosen : pool.grid).filter((k) => !k.includes(heroSlug))
    if (!keys.length) keys = chosen.length ? chosen : pool.grid
    const tPB = H ? Math.max(t0 + p.pbAt, H.frameEnd + 0.02) : t0 + p.penDur + p.pbAt
    // the figure (its size follows the zoom out); iterate the fit twice
    const val = String(p.value)
    const lab = String(p.label).toUpperCase()
    const fb = { w: counterW(val, p.weight, p.figTracking ?? 0, !!p.figKern) }
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
        // V4: room on the right for where the asterisk drifts to while the 311 holds (it stays well inside the frame)
        if (flow) box.x1 = Math.max(box.x1, xf + fig.w + restPad * kM * 0.6 + pen.v * Math.max(0, sh.end - tPB - p.pbDur) + S * 0.22 * kM)
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
    // V4: slower at first, while the camera is still close (on screen the pen keeps an even pace as it pulls back)
    pen.add(tPB, p.pbDur, p.pbEase, sRestA, sEnd, H ? [[sRestA, 2.4], [sRestA + pitchX * 2.5, 1.5], [sRestA + pitchX * 7, 1]] : [], kM)
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
    // V4: the figure and its caption can be moved (× the short side of the frame, as seen after the zoom out) and spaced
    const ox = (p.figX ?? 0) * S * kM
    const oy = (p.figY ?? 0) * S * kM
    const ly = (p.labelDY ?? 0) * fig.capL
    const exitC = p.exitOn ? { at: sh.end - p.exitLead, dur: p.sinkDur ?? 0.5, ease: p.sinkEase ?? 'cubic(0.55,0,0.75,0.3)' } : null
    // V4: the whole wall goes down into the line at once, as one block (no stagger), the first creator with it
    const drop = exitC && p.exitMode === 'drop' ? blockH + m * 2 : 0
    els.push({ kind: 'counter', id: sh.id + ':fig', value: val, p, x: fig.x + ox, base: fig.base + oy, cap: fig.cap, at: figAt, dur: Math.max(0.4, p.pbDur * 0.92), spins: p.spins, step: p.spinStep, exit: exitC, kern: !!p.figKern, box: { x0: fig.x + ox, x1: fig.x + ox + fig.w, y0: fig.base + oy, y1: fig.base + oy + fig.cap } })
    const leC = labelEl(sh.id + ':lab', lab, p, fig.labX + ox, fig.labTop + oy - ly, fig.capL, L, { mode: 'time', at: tPB + p.pbDur * 0.72 })
    leC.exit = exitC
    els.push(leC)
    if (exitC) {
      // the end of the line here (V4): every video sinks back into the line, column after column from the left,
      // the asterisk runs off to the right and the line is reeled out behind it
      const spread = drop ? 0 : (p.sinkSpread ?? 0.35)
      for (const e of els)
        if ((e.id.startsWith(sh.id + ':') || (H && e === H.el)) && e.kind === 'tile') e.exit = { ...exitC, at: exitC.at + Math.max(0, (e.x - xh) / Math.max(1e-3, blockW)) * spread, drop }
      const fM = ctx.mosaicFocus
      const xOut = fM.x + frameW(fM.h) / 2 + S * 0.6 * kM
      const leftX = fM.x - frameW(fM.h) / 2 - S * 0.15 * kM
      const sFrom = sAtX(leftX)
      path.floor(Math.max(path.lx + 0.01, xOut))
      const runAt = exitC.at + (p.runAt ?? 0.12)
      pen.add(runAt, p.runDur ?? 0.7, p.runEase ?? 'cubic(0.5,0,0.75,0.25)', sEnd, path.s)
      ctx.exit = { at: exitC.at, runAt, runDur: p.runDur ?? 0.7, runEase: p.runEase ?? 'cubic(0.5,0,0.75,0.25)', lag: p.reelLag ?? 0.08, sFrom, sEnd: path.s, end: Math.max(runAt + (p.runDur ?? 0.7) + (p.reelLag ?? 0.08), exitC.at + exitC.dur + spread) + 0.04 }
    }
    ctx.L = L
    ctx.restS = ctx.exit && p.exitOn ? path.s : sEnd
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
    const up = (s) => (p.caps === false ? s : s.toUpperCase())
    const lead = up(String(p.lead || '').trim())
    const txt = up(String(p.text || ''))
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

  /**
   * V4 · the statement: "TO ACTIVATE CREATORS / FOR CULTURAL IMPACT" come in on two lines, word after word, and
   * at once AT SCALE takes their place in the same box (as tall as the two lines together): the two lines leave
   * as it arrives, one move with no pause. p.statStyle says how (STATEMENT); the line passes under them at the
   * change (in 'line' it is the line that changes them, word by word as it passes), the camera pushes in on
   * AT SCALE as it arrives and the asterisk takes it on to the first value.
   */
  function statement(sh) {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    const up = (s) => (p.caps === false ? s : s.toUpperCase())
    const preLines = up(String(p.pre || '').trim()).split('\n').map((s) => s.trim()).filter(Boolean)
    const big = up(String(p.text || ''))
    const acc = String(p.preAccent ?? '')
      .split(/[^0-9]+/)
      .map((x) => parseInt(x, 10) - 1)
      .filter((x) => x >= 0 && x < preLines.length)
    const wOf = (i) => (acc.includes(i) ? p.preAccentWeight ?? '600' : p.preWeight ?? '300')
    const lead = p.preLeading ?? 1.18
    const em = 1 / getFace(p.preWeight ?? '300').cap
    const hCaps = 1 + (preLines.length - 1) * lead * em // the two lines: last baseline → first cap top, in caps
    const preWc = Math.max(...preLines.map((s, i) => textBox(s, wOf(i), p.preTracking ?? 0).w))
    const bigWc = textBox(big, p.weight, p.tracking).w
    // one box for both: the two lines, then AT SCALE in their place, as tall as they are (bigK)
    let capP = capOf(p.preSize ?? 3.6) * (portrait ? 1.5 : 1)
    let capB = capP * hCaps * (p.bigK ?? 1)
    let total = Math.max(preWc * capP, bigWc * capB)
    const fit = Math.min(1, (view.w * (portrait ? 0.84 : 0.8)) / total)
    capP *= fit
    capB *= fit
    total *= fit
    const preW = preWc * capP
    const bigW = bigWc * capB
    const x0 = startAfter(total)
    const gB = standGap(big) * capB
    // the two lines and AT SCALE stand on the line (their last baseline on its gap)
    const base = L + gB
    const top = Math.max(base + hCaps * capP, base + capB)
    const fl = path.floor(x0 + total + restPad)
    const sBox = path.s
    // read, then AT SCALE goes, quick, and the line runs on towards the first value (no still moment)
    path.floor(x0 + total + restPad + S * (p.lineRun ?? 0.45))
    const st = (STATEMENT[p.statStyle] || STATEMENT.line)(p.statMove ?? 1, p.statBlur ?? 1)
    const sw = t0 + (p.swapAt ?? 1.2)
    const tOut = Math.max(sw + 0.4, t0 + (p.bigOutAt ?? 2.3))
    const byPen = !!st.pen
    els.push({
      kind: 'text',
      id: sh.id + ':pre',
      text: preLines.join('\n'),
      weight: p.preWeight ?? '300',
      weights: preLines.map((_, i) => wOf(i)),
      accent: acc.length ? { paras: acc, color: p.preAccentColor ?? 'wine' } : null,
      tracking: p.preTracking ?? 0,
      leading: lead,
      cap: capP,
      x: x0,
      base,
      side: 'above',
      lineY: L,
      noClip: !st.preIn.mask,
      color: p.preColor ?? 'ink',
      from: p.preFrom ?? 'rose',
      rise: { mode: 'time', exact: true, at: t0 + (p.preAt ?? 0.04), split: 'words', order: 'start', stagger: p.preStagger ?? 0.07, lineStep: p.preLineStep ?? 0.22, dur: p.preDur ?? 0.5, ease: p.preEase ?? 'cubic(0.16,0.8,0.25,1)', ...st.preIn },
      out: { mode: byPen ? 'pen' : 'time', at: sw, delay: byPen ? p.outDelay ?? -0.2 : 0, order: 'start', stagger: p.outStagger ?? 0.02, lineStep: p.outLineStep ?? 0.05, dur: p.outDur ?? 0.26, ease: p.outEase ?? 'cubic(0.55,0,0.75,0.3)', ...st.out },
      floor: fl,
      motion: 0.7,
      box: { x0, x1: x0 + preW, y0: L, y1: base + hCaps * capP },
    })
    els.push({
      kind: 'text',
      id: sh.id + ':text',
      text: big,
      weight: p.weight,
      tracking: p.tracking,
      cap: capB,
      x: x0,
      base,
      side: 'above',
      lineY: L,
      color: p.color,
      from: p.fromColor,
      rise: { mode: byPen ? 'pen' : 'time', exact: true, at: sw + (p.bigLag ?? 0.14), delay: byPen ? p.riseDelay ?? 0.08 : 0, order: 'start', stagger: p.bigStagger ?? 0.028, dur: p.riseDur ?? 0.55, ease: p.riseEase ?? 'cubic(0.2,0.75,0.2,1)', ...st.bigIn },
      out: { mode: 'time', at: tOut, order: 'start', stagger: p.bigOutStagger ?? 0.014, dur: p.bigOutDur ?? 0.3, ease: p.bigOutEase ?? 'cubic(0.55,0,0.8,0.3)', ...st.bigOut },
      floor: fl,
      motion: p.motion,
      box: { x0, x1: x0 + bigW, y0: L, y1: base + capB },
    })
    // the camera: on the box from the first word (a slow drift in while they read), then it pushes in on
    // AT SCALE as it takes their place; the next station takes it on with the asterisk
    const fBox = focusOn(x0, x0 + total, L - S * 0.05, top, VIEW_H * 0.25, p.camFill ?? 0.66)
    const push = p.pushOn !== false
    const fBig = { x: x0 + bigW / 2, y: fBox.y, h: fBox.h / (p.pushTo ?? 1.12) }
    cam.add(t0 - 0.62, 0.001, 'linear', { ...fBox, h: fBox.h * (p.camFrom ?? 1.08) })
    cam.add(t0 - 0.6, sw - t0 + 0.6, 'cubic(0.33,0,0.67,1)', fBox)
    // (the push lasts until AT SCALE goes: it grows while it is read)
    if (push) cam.add(sw + (p.pushAt ?? 0), Math.max(0.3, tOut + 0.15 - sw - (p.pushAt ?? 0)), p.pushEase ?? 'cubic(0.3,0,0.3,1)', fBig)
    ctx.prevFocus = push ? fBig : fBox
    // here the camera has its own choreography: it does not ride the pen; when AT SCALE goes it rides it on
    ;(ctx.noRide ||= []).push([t0 - 0.6, tOut + 0.05])
    // the line passes under the start of the box at the change (lineLag later); 'line': that is the change
    const z = (push ? fBig.h : fBox.h) / VIEW_H
    const mv = pen.add(sw, p.penDur ?? 0.85, p.penEase, ctx.restS, sBox, [], z)
    mv.t0 = Math.max(t0 + 0.1, mv.t0 + sw + (p.lineLag ?? 0) - tPassX(fl, x0))
    pen.moves.sort((a, b) => a.t0 - b.t0)
    // as AT SCALE goes, the asterisk runs on (the camera with it) into the next station
    pen.add(Math.max(mv.t0 + mv.dur, tOut - 0.1), Math.max(0.5, sh.end - tOut + 0.25), p.runEase ?? 'cubic(0.45,0,0.4,1)', sBox, path.s, [], z)
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: x0 + total }
  }

  B.title = (sh) => {
    const p = sh.p
    const t0 = sh.start
    const L = ctx.L
    if (flow && String(p.pre || '').trim()) return statement(sh)
    // fit: never wider than the frame
    let cap = capOf(p.size)
    const up = (s) => (p.caps === false ? s : s.toUpperCase())
    const lead = up(String(p.lead || '').trim())
    if (lead) {
      const lb = textBox(lead, p.weight, p.tracking)
      const mb = textBox(up(String(p.text || '')), p.weight, p.tracking)
      const w = (lb.w + lb.space + mb.w) * cap
      if (w > view.w * 0.86) cap *= (view.w * 0.86) / w
    } else {
      const w = textBox(up(String(p.text || '')), p.weight, p.tracking).w * cap
      if (w > view.w * 0.8) cap *= (view.w * 0.8) / w
    }
    const rise = p.riseSpread ? { spread: p.riseSpread } : {}
    const probe = standEls(sh, p, 0, L, null, { cap, rise })
    const x0 = startAfter(probe.w)
    const fl = path.floor(x0 + probe.w + restPad)
    const st = standEls(sh, p, x0, L, fl, { cap, rise })
    const f = focusOn(x0, x0 + st.w, L - S * 0.04, L + st.h)
    pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s, [], (f.h / VIEW_H) / (p.pushOn ? p.pushTo ?? 1.3 : 1))
    if (p.pushOn) {
      // V4 · AT SCALE: the line shoots in under the words while the camera pushes in on them (they grow), from
      // pushFrom × to pushTo × the size they stand at (the camera is still here: nothing on the paper before the line)
      const at = (k) => ({ x: f.x, y: f.y, h: f.h / k })
      cam.add(t0 - 0.002, 0.001, 'linear', at(p.pushFrom ?? 1))
      cam.add(t0 + (p.pushAt ?? 0), p.pushDur ?? 1.3, p.pushEase ?? 'cubic(0.25,0.6,0.25,1)', at(p.pushTo ?? 1.3))
      ctx.prevFocus = at(p.pushTo ?? 1.3)
    } else travelTo(t0, p, f)
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
    const figW = counterW(val, p.weight, p.figTracking ?? 0) * capF
    const labW = textBox(lab, p.labelWeight, p.labelTracking).w * capL
    const colW = Math.max(figW, labW)
    const colGap0 = S * (portrait ? 0.06 : 0.085)
    const nameCaps = Math.max(...names.map((s) => textBox(s, p.nameWeight, -0.01).w))
    // V4 · the creator who speaks stands on the right of the names, in a frame the line draws around her while she
    // talks (the first of the 311): the figure and the names move left to make room
    const hero = flow && p.heroOn ? heroGeometry(p) : null
    const roomN = hero && !portrait ? view.w * 0.9 - colW - colGap0 - hero.gapH - hero.outer : view.w * 0.88 - colW - colGap0
    const capN = Math.min(capOf(p.nameSize), roomN / Math.max(1e-3, nameCaps))
    const nameW = nameCaps * capN
    const face = getFace(p.nameWeight)
    const step = p.nameLeading * (capN / face.cap)
    const gapN = 0.34 * capN
    const colGap = colGap0
    const w = colW + colGap + nameW
    const stackH = gapN + capN + step * (names.length - 1)
    // narrow frames: the names above the figure's column would not fit beside it, so the figure goes first and the names follow on the line
    const x0 = startAfter(hero && !portrait ? w + hero.gapH + hero.outer : w)
    const xn = x0 + colW + colGap
    const wide = (ctx.prevBox?.k || 1) > 1.3
    let fl
    let f
    if (hero) {
      // the floor under the names, then the frame (its foot a little after them), then on
      const xa = x0 + w + hero.gapH + hero.rL
      fl = path.floor(xa - hero.rL)
      const fr = path.frame(xa, xa + hero.outerW, hero.outerH, hero.rF, hero.rL)
      path.floor(xa + hero.outerW + hero.rL + restPad)
      // the pen runs under the names to the foot of the frame, then goes round her frame while she talks (slow), then
      // drifts on. Narrow frames: it waits after the names (they are read), then runs to her as the camera goes to her
      const tToHer = t0 + (p.toHerAt ?? 1.0)
      let footAt = t0 + p.penDur
      if (portrait) {
        const sNames = fl.s0 + (xn + nameW + restPad * 0.6 - fl.x0)
        pen.add(t0, p.penDur, p.penEase, ctx.restS, sNames, wide ? [[ctx.restS, 0.08], [x0 - fl.x0 + fl.s0 - S * 0.5, 1]] : [], 1)
        pen.add(tToHer, 0.55, 'cubic(0.45,0,0.2,1)', sNames, fr.s0, [], 1)
        footAt = tToHer + 0.55
      } else pen.add(t0, p.penDur, p.penEase, ctx.restS, fr.s0, wide ? [[ctx.restS, 0.08], [x0 - fl.x0 + fl.s0 - S * 0.5, 1]] : [], 1)
      const span = voiceSpan(p)
      const vAt = voiceAtOf('campaigns', p, sh.dur, Infinity, portrait)
      const fAt = t0 + (p.frameFollow !== false && p.voiceOn ? vAt - 0.05 : (p.frameAt ?? 0.8))
      const fStart = Math.max(fAt, footAt)
      const fDur = Math.max(0.3, Math.min(p.frameFollow !== false && p.voiceOn && span > 0.3 ? span + 0.3 : (p.frameDur ?? 1.8), sh.end - 0.04 - fStart))
      pen.add(fStart, fDur, p.frameEase ?? 'cubic(0.42,0,0.4,1)', fr.s0, path.s, [], 1)
      const box = { x0, x1: xa + hero.outerW + hero.rL, y0: L - capL * 2.4, y1: L + hero.outerH }
      if (!portrait) {
        f = focusOn(box.x0, box.x1, box.y0, box.y1, VIEW_H * (p.heroRoom ?? 1.08), 0.84)
        travelTo(t0, p, f)
      } else {
        // narrow frames: the figure and the names first, then the camera goes to her as the pen starts round her frame
        f = focusOn(x0, x0 + w, L - capL * 2.4, L + Math.max(stackH, capF * 1.2))
        travelTo(t0, p, f)
        const fh = focusOn(xa - hero.rL, xa + hero.outerW + hero.rL, L - S * 0.06, L + hero.outerH, VIEW_H, 0.9)
        cam.add(tToHer - 0.05, 0.75, 'cubic(0.55,0,0.2,1)', fh)
        ctx.prevFocus = fh
      }
      const xh = xa + hero.m
      const at = pen.tPass(fr.s0)
      const el = {
        kind: 'tile',
        id: sh.id + ':hero',
        key: heroKeyOf(p.heroKey),
        // her own voice: the picture runs on the same line as the sound (lips on the sound)
        voice: p.voiceOn ? { from: p.voiceFrom ?? 0, at: t0 + vAt } : null,
        x: xh + hero.Wt / 2,
        y: L + hero.m + hero.Ht / 2,
        w: hero.Wt,
        h: hero.Ht,
        r: hero.rT,
        reveal: { at: at + 0.02, dur: p.revealDur ?? 0.55, ease: p.revealEase ?? 'cubic(0.3,0.6,0.2,1)' },
        // the line is its floor: at the end of the 311 it goes down into it with the others
        clipY: L + hero.m * 0.5,
        media: 'hero',
        box: { x0: xh, x1: xh + hero.Wt, y0: L, y1: L + hero.Ht + hero.m },
      }
      els.push(el)
      ctx.hero = { ...hero, xa, xh, L, el, sh, frameEnd: fStart + fDur }
    } else {
      fl = path.floor(x0 + w + restPad)
      pen.add(t0, p.penDur, p.penEase, ctx.restS, path.s, wide ? [[ctx.restS, 0.08], [x0 - fl.x0 + fl.s0 - S * 0.5, 1]] : [])
      f = focusOn(x0, x0 + w, L - capL * 2.4, L + Math.max(stackH, capF * 1.2))
      travelTo(t0, p, f)
    }
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
    const fox = (p.figX ?? 0) * S
    const foy = (p.figY ?? 0) * S
    const fig = { kind: 'counter', id: sh.id + ':fig', value: val, p, x: x0 + fox, base: L + capF * 0.2 + foy, cap: capF, at: enters[0], dur: p.enterDur, steps: enters, stepDur: p.enterDur * 0.9, spins: Math.max(1, names.length - 1), step: 0, stack, box: { x0, x1: x0 + figW, y0: L, y1: L + capF * 1.2 } }
    els.push(fig)
    const le = labelEl(sh.id + ':lab', lab, p, x0 + fox, L - capL * 1.15 + foy - (p.labelDY ?? 0) * capL, capL, L, { mode: 'pen', delay: 0.1 }, fl)
    le.stack = stack
    els.push(le)
    ctx.stack = { stack, x0, x1: x0 + w, focus: f, fig, label: le }
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: ctx.hero && ctx.hero.sh === sh ? ctx.hero.xa + ctx.hero.outerW + ctx.hero.rL : x0 + w }
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
    const fF = focusOn(x0, x0 + w, L - capL * 2.4, L + capF * 1.2)
    travelTo(t0, p, fF)
    // the end of the line: the figures sink back into it, the asterisk runs off to the right with it
    const exit = p.exitOn ? { at: sh.end - p.exitLead, dur: p.sinkDur, ease: p.sinkEase } : null
    let x = x0
    items.forEach(([v, l], i) => {
      const at = tPassX(fl, x)
      els.push({ kind: 'tick', id: `${sh.id}:t${i}`, x: x - capF * 0.16, y: L, h: capL * 1.25, at: at - 0.05, dur: 0.45, exit, box: { x0: x - capF * 0.2, x1: x, y0: L - capL, y1: L + capL } })
      els.push({ kind: 'counter', id: `${sh.id}:f${i}`, value: v, p, x, base: L + capF * 0.2, cap: capF, at: at + 0.02, dur: p.cDur, spins: p.spins, step: p.spinStep, exit, box: { x0: x, x1: x + cols[i], y0: L, y1: L + capF * 1.2 } })
      const le = labelEl(`${sh.id}:l${i}`, l, p, x, L - capL * 1.15, capL, L, { mode: 'pen', delay: 0.12 }, fl)
      le.exit = exit
      els.push(le)
      x += cols[i] + gapC
    })
    ctx.restS = path.s
    ctx.prevBox = { x0, x1: x0 + w }
    if (exit) {
      const xOut = fF.x + frameW(fF.h) / 2 + S * 0.6
      const leftX = fF.x - frameW(fF.h) / 2 - S * 0.15
      const sFrom = sAtX(leftX)
      path.floor(xOut)
      const runAt = exit.at + p.runAt
      pen.add(runAt, p.runDur, p.runEase, ctx.restS, path.s)
      ctx.exit = { at: exit.at, runAt, runDur: p.runDur, runEase: p.runEase, lag: p.reelLag, sFrom, sEnd: path.s, end: Math.max(runAt + p.runDur + p.reelLag, exit.at + exit.dur) + 0.04 }
      ctx.restS = path.s
    }
  }

  /** Arc length where the line (walking back from its end) crosses x. */
  function sAtX(x) {
    for (let i = path.n - 1; i > 0; i--) {
      const xa = path.x[i - 1]
      const xb = path.x[i]
      if ((xa - x) * (xb - x) <= 0 && xa !== xb) return path.c[i - 1] + ((x - xa) / (xb - xa)) * (path.c[i] - path.c[i - 1])
    }
    return 0
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
    // only the line's own stations (V4 puts other blocks around them: ONE…, the results, the values)
    if (!B[sh.type]) continue
    if (!cam && sh.type !== 'word' && sh.type !== 'lockup') {
      // a film without an opening logo: the line starts at the left of the frame
      // (V4, look.lineFromLeft: just outside it, so the asterisk rolls in drawing the line)
      const x0 = look.lineFromLeft ? -view.w / 2 - S * 0.12 : -view.w * 0.42
      path.move(x0, -VIEW_H * 0.05)
      ctx.L = -VIEW_H * 0.05
      ctx.focus = { x: 0, y: 0, h: VIEW_H }
      cam = new CamTrack(ctx.focus)
      ctx.prevBox = { x0: -view.w / 2, x1: look.lineFromLeft ? -view.w / 2 : -view.w * 0.42 }
    }
    const fn = B[sh.type]
    if (fn) fn(sh)
  }
  if (!cam) cam = new CamTrack({ x: 0, y: 0, h: VIEW_H })
  const dur = T.duration

  // ================================================================ V4 · the camera never loses the asterisk
  // The stations' framings, pushed just enough that the pen stays inside a band of the frame (from when it has
  // come into the frame until it runs off at the end of the line), then smoothed with no lag (a centred gaussian:
  // the whole take is known), so the follow never jolts.
  let camAt = (t) => cam.at(t)
  if (flow && pen.first) {
    const fps = 120
    const n = Math.ceil((dur + 1) * fps) + 1
    const X = new Float64Array(n)
    const Y = new Float64Array(n)
    const LH = new Float64Array(n)
    const q = [0, 0]
    // the band: while the camera travels the asterisk is kept near the middle (camLeft … camRight of the
    // frame); while it holds on a station it may go anywhere inside the frame (a margin from the edges), so a
    // composition is never pushed aside just because the pen draws round its far side
    const bL = look.camLeft ?? 0.16
    const bR = look.camRight ?? 0.78
    const edge = 0.07
    const bB = 0.1
    const bT = 0.9
    const tOn = pen.first.t0
    const tOff = ctx.exit ? ctx.exit.runAt : Infinity
    // first pass: the stations' camera, the pen, how much the camera travels (k: 0 hold → 1 travel), where the
    // pen sits on the screen under the stations' camera (fb)
    const C = new Array(n)
    const QX = new Float64Array(n)
    const QY = new Float64Array(n)
    const K = new Float64Array(n)
    const FB = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / fps
      const c = cam.at(t)
      C[i] = c
      path.pos(pen.s(t), q)
      QX[i] = q[0]
      QY[i] = q[1]
      const hw = (c.h * view.aspect) / 2
      const ca = cam.at(t - 0.05)
      const cb = cam.at(t + 0.05)
      const v = Math.abs(cb.x - ca.x) / 0.1 / (2 * hw)
      K[i] = smooth(clamp((v - 0.04) / 0.4))
      FB[i] = (q[0] - c.x) / (2 * hw) + 0.5
    }
    // where the pen will sit once the camera has settled on the next station: while it travels the camera holds the
    // pen right there on the screen, so it arrives on the station's framing without ever turning back
    const FE = new Float64Array(n)
    let fe = FB[n - 1]
    for (let i = n - 1; i >= 0; i--) {
      if (K[i] < 0.04) fe = FB[i]
      FE[i] = fe
    }
    let entered = false
    for (let i = 0; i < n; i++) {
      const t = i / fps
      const c = C[i]
      let x = c.x
      let y = c.y
      if (t >= tOn && t <= tOff) {
        const hw = (c.h * view.aspect) / 2
        const hh = c.h / 2
        const k = (ctx.noRide || []).some(([a, b]) => t >= a && t <= b) ? 0 : K[i]
        const L0 = lerp(edge, bL, k)
        const R0 = lerp(1 - edge, Math.max(bR, Math.min(0.88, FE[i]) + 0.02), k)
        if (!entered) entered = QX[i] > c.x - hw * 0.94 && QX[i] < c.x + hw * 0.94
        if (entered) {
          // the camera rides with the asterisk while it travels (the pen holds its place on the screen: where it
          // will be on the next station, kept inside camLeft … camRight), and is the station's framing on a hold
          const lead = clamp(FE[i], look.camLeft ?? 0.16, Math.max(look.camRight ?? 0.78, Math.min(0.88, FE[i])))
          x = lerp(x, QX[i] - (lead - 0.5) * 2 * hw, k * (look.camRide ?? 1))
          x = clamp(x, QX[i] - (R0 - 0.5) * 2 * hw, QX[i] + (0.5 - L0) * 2 * hw)
          y = clamp(y, QY[i] - (bT - 0.5) * 2 * hh, QY[i] + (0.5 - bB) * 2 * hh)
        }
      }
      X[i] = x
      Y[i] = y
      LH[i] = Math.log(c.h)
    }
    const blur = (A, sigma) => {
      const r = Math.ceil(sigma * 3)
      const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * sigma * sigma)))
      const out = new Float64Array(A.length)
      for (let i = 0; i < A.length; i++) {
        let a = 0
        let ws = 0
        for (let k = -r; k <= r; k++) {
          const j = Math.min(A.length - 1, Math.max(0, i + k))
          a += A[j] * w[k + r]
          ws += w[k + r]
        }
        out[i] = a / ws
      }
      return out
    }
    const sg = Math.max(0.5, (look.camSmooth ?? 0.04) * fps)
    const SX = blur(X, sg)
    const SY = blur(Y, sg)
    const SH = blur(LH, Math.max(1, sg * 0.35))
    // the smoothing may let a very quick move slip out by a hair: kept inside the frame (5 %), then softened lightly
    if (true) {
      let on = false
      for (let i = 0; i < n; i++) {
        const t = i / fps
        if (t < tOn || t > tOff) continue
        path.pos(pen.s(t), q)
        const h = Math.exp(SH[i])
        const hw = (h * view.aspect) / 2
        const hh = h / 2
        if (!on) on = q[0] > SX[i] - hw * 0.94 && q[0] < SX[i] + hw * 0.94
        if (!on) continue
        SX[i] = clamp(SX[i], q[0] - 0.9 * hw, q[0] + 0.9 * hw)
        SY[i] = clamp(SY[i], q[1] - 0.86 * hh, q[1] + 0.86 * hh)
      }
      const fx = blur(SX, Math.max(1, sg * 0.25))
      const fy = blur(SY, Math.max(1, sg * 0.25))
      SX.set(fx)
      SY.set(fy)
    }
    camAt = (t) => {
      const x = clamp(t * fps, 0, n - 1)
      const i = Math.floor(x)
      const j = Math.min(n - 1, i + 1)
      const k = x - i
      return { x: SX[i] + (SX[j] - SX[i]) * k, y: SY[i] + (SY[j] - SY[i]) * k, h: Math.exp(SH[i] + (SH[j] - SH[i]) * k) }
    }
  }

  // ================================================================ the asterisk's roll (it turns only when it moves)
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
    if (d > 0) th -= d / Math.max(1e-6, rFrac * camAt(t).h)
    rot[i] = th
    q0[0] = q1[0]
    q0[1] = q1[1]
  }

  const first = pen.first
  const last = pen.last
  const close = ctx.close
  const exit = ctx.exit || null
  return {
    exit,
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
    camAt,
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
      if (exit && t >= exit.runAt + exit.lag) {
        // the line follows the asterisk out of the frame
        const u = clamp((t - exit.runAt - exit.lag) / Math.max(1e-3, exit.runDur))
        return lerp(exit.sFrom, exit.sEnd, ease(exit.runEase)(u))
      }
      if (!close) return 0
      const u = clamp((t - close.retractAt) / Math.max(1e-3, close.retractDur))
      if (u <= 0) return 0
      return lerp(close.tailFrom, close.sEnd, ease(close.retractEase)(u))
    },
  }
}
