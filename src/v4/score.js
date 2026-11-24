// The film's original score: 120 BPM, F major, one chord per bar from t = 0
// (Bbmaj9 | Cadd9 | Am7 | Dm9, round and round), resolving to Fmaj9 on the logos.
//
// Every voice is synthesized in plain JS from seeded noise and maths (FM electric
// piano, detuned saw pad, Karplus-Strong pluck, sine bass, drum and FX one-shots).
// The stems are summed into a dry bus and a reverb send; an OfflineAudioContext
// runs the send through a convolution reverb; the master (glue compressor,
// loudness to -16 LUFS, look-ahead peak limiter) runs in JS on the result. Same
// inputs, same samples: the preview and the frame-exact export always agree.
//
// Cues are absolute seconds on the film's clock, from where the scenes start:
//   intro → groove → peak (an accent on every `hits` time) → drop → pulse (the
//   voices) → build → stop → final (the logos)
// Each is snapped to the beat (the hits to the eighth note) and every one is
// optional: a missing section is simply not there, out-of-order cues are clamped.

export const BPM = 120
export const BEAT = 60 / BPM // 0.5 s; a bar is 4 beats = 2 s, the grid starts at t = 0
export const snapBeat = (t) => Math.round(t / BEAT) * BEAT
export const SCORE_DEFAULTS = { level: 0, drums: 0, bass: 0, keys: 0, pad: 0, pluck: 0, fx: 0 } // dB trims per stem

const BAR = BEAT * 4
const EIGHTH = BEAT / 2
const snapEighth = (t) => Math.round(t / EIGHTH) * EIGHTH
const TAU = Math.PI * 2
const EPS = 1e-6
const LUFS_TARGET = -16
const CEILING_DB = -1.3 // sample-peak ceiling (a little under -1 so true peak stays under -1 too)
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const dbToGain = (d) => Math.pow(10, d / 20)
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

// ---------------------------------------------------------------- randomness

/** Seeded PRNG (mulberry32): one stream per part, same numbers on every render. */
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const jitter = (r, amt) => (r() * 2 - 1) * amt

// ---------------------------------------------------------------- oscillators

const SIN_N = 4096
const SIN = new Float64Array(SIN_N + 1)
for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin((i / SIN_N) * TAU)

/** sin(2π p) by table lookup, p in cycles (any real). */
function sin1(p) {
  p -= Math.floor(p)
  const x = p * SIN_N
  const i = x | 0
  return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i)
}

/** Band-limited sawtooth (polyBLEP); p = phase in [0, 1), dt = frequency / sampleRate. */
function saw(p, dt) {
  let y = 2 * p - 1
  if (p < dt) {
    const t = p / dt
    y -= t + t - t * t - 1
  } else if (p > 1 - dt) {
    const t = (p - 1) / dt
    y -= t * t + t + t + 1
  }
  return y
}

/** Triangle aligned with sin1 (0 at p = 0, +1 at p = 0.25). */
function tri(p) {
  p -= Math.floor(p)
  return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4
}

/** Raised-cosine 0 → 1 ramp (no corners, no clicks). */
const rise = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x))

/** Equal-power pan, unity in the centre: [gainL, gainR] for p in [-1, 1]. */
function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2]
}

// ---------------------------------------------------------------- filters

/** RBJ biquad (transposed direct form II), processed in place. */
class Biquad {
  constructor() {
    this.b0 = 1
    this.b1 = 0
    this.b2 = 0
    this.a1 = 0
    this.a2 = 0
    this.z1 = 0
    this.z2 = 0
  }

  set(type, f, q, sr) {
    const w = (TAU * clamp(f, 10, sr * 0.45)) / sr
    const cw = Math.cos(w)
    const al = Math.sin(w) / (2 * q)
    const a0 = 1 + al
    if (type === 'lp') {
      this.b0 = (1 - cw) / 2 / a0
      this.b1 = (1 - cw) / a0
      this.b2 = this.b0
    } else if (type === 'hp') {
      this.b0 = (1 + cw) / 2 / a0
      this.b1 = -(1 + cw) / a0
      this.b2 = this.b0
    } else {
      // band-pass, 0 dB at the centre
      this.b0 = al / a0
      this.b1 = 0
      this.b2 = -al / a0
    }
    this.a1 = (-2 * cw) / a0
    this.a2 = (1 - al) / a0
    return this
  }

  run(x, i0 = 0, i1 = x.length) {
    const { b0, b1, b2, a1, a2 } = this
    let z1 = this.z1
    let z2 = this.z2
    for (let i = i0; i < i1; i++) {
      const v = x[i]
      const y = b0 * v + z1
      z1 = b1 * v - a1 * y + z2
      z2 = b2 * v - a2 * y
      x[i] = y
    }
    this.z1 = z1
    this.z2 = z2
    return x
  }
}

const filt = (x, type, f, q, sr) => new Biquad().set(type, f, q, sr).run(x)

// ---------------------------------------------------------------- automation

/** Piecewise-linear lane from [[t, v], ...]; `log` interpolates in log space (Hz). */
function lane(points, log = false) {
  const p = points.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).sort((a, b) => a[0] - b[0])
  return (t) => {
    if (!p.length) return 0
    if (t <= p[0][0]) return p[0][1]
    for (let i = 1; i < p.length; i++) {
      if (t < p[i][0]) {
        const [t0, v0] = p[i - 1]
        const [t1, v1] = p[i]
        const x = t1 > t0 ? (t - t0) / (t1 - t0) : 1
        return log ? v0 * Math.pow(v1 / v0, x) : v0 + (v1 - v0) * x
      }
    }
    return p[p.length - 1][1]
  }
}

const BLOCK = 32

/** Time-varying filter: cutoff from hzAt(t), one-pole smoothed (smooth = seconds). */
function filterAuto(x, sr, type, q, hzAt, smooth = 0.05) {
  const bq = new Biquad()
  const k = smooth > 0 ? 1 - Math.exp(-BLOCK / (smooth * sr)) : 1
  let f = hzAt(0)
  for (let i = 0; i < x.length; i += BLOCK) {
    f += (hzAt(i / sr) - f) * k
    bq.set(type, f, q, sr)
    bq.run(x, i, Math.min(x.length, i + BLOCK))
  }
}

/** Time-varying gain in dB from dbAt(t), smoothed, ramped inside each block. */
function gainAuto(x, sr, dbAt, smooth = 0.06) {
  const k = smooth > 0 ? 1 - Math.exp(-BLOCK / (smooth * sr)) : 1
  let g = dbToGain(dbAt(0))
  for (let i = 0; i < x.length; i += BLOCK) {
    const g1 = g + (dbToGain(dbAt((i + BLOCK) / sr)) - g) * k
    const n = Math.min(BLOCK, x.length - i)
    for (let j = 0; j < n; j++) x[i + j] *= g + ((g1 - g) * (j + 1)) / n
    g = g1
  }
}

/** Multiply by a gain curve (sidechain ducking). */
function applyCurve(x, curve) {
  for (let i = 0; i < x.length; i++) x[i] *= curve[i]
}

/** Gain curve that dips on every trigger: [{ t, depth (0..1) }], attack / hold / recover in s. */
function duckCurve(n, sr, triggers, atk = 0.004, hold = 0.02, rec = 0.12) {
  const c = new Float32Array(n).fill(1)
  const A = Math.max(1, Math.round(atk * sr))
  const H = Math.round(hold * sr)
  const R = Math.max(1, Math.round(rec * sr))
  for (const { t, depth } of triggers) {
    const s0 = Math.round(t * sr) - A
    for (let i = 0; i < A + H + R; i++) {
      const j = s0 + i
      if (j < 0 || j >= n) continue
      const d = i < A ? rise(i / A) : i < A + H ? 1 : 1 - rise((i - A - H) / R)
      const g = 1 - depth * d
      if (g < c[j]) c[j] = g
    }
  }
  return c
}

// ---------------------------------------------------------------- instruments

const EP_VEL = [0.42, 0.68, 0.92] // timbre buckets (the FM index follows the velocity)
const epBucket = (v) => (v < 0.55 ? 0 : v < 0.8 ? 1 : 2)

/** Electric piano voice, mono: 2-op FM (ratio 1, index ~2.5 → 0.3) + a quiet tine (ratio 14). */
function renderEP(m, v, len, sr) {
  const n = Math.max(1, Math.ceil(len * sr))
  const out = new Float32Array(n)
  const f = mtof(m)
  const dc = f / sr
  const dt = (14 * f) / sr
  const pitch = Math.pow(261.63 / f, 0.3) // higher notes ring shorter
  const idxHi = 0.8 + 1.9 * v
  const idxLo = 0.22 + 0.1 * v
  const tine = 0.2 + 0.55 * v
  const kI = Math.exp(-1 / (0.33 * sr))
  const kT = Math.exp(-1 / (0.045 * sr))
  const kD = Math.exp(-1 / (0.5 * pitch * sr))
  const kL = Math.exp(-1 / (6 * pitch * sr))
  const A = Math.round(0.005 * sr)
  let pc = 0
  let pt = 0
  let eI = 1
  let eT = 1
  let eD = 1
  let eL = 1
  for (let i = 0; i < n; i++) {
    const mod = (idxLo + (idxHi - idxLo) * eI) * sin1(pc) + tine * eT * sin1(pt)
    let a = (0.35 + 0.65 * eD) * eL
    if (i < A) a *= rise(i / A)
    out[i] = sin1(pc + mod / TAU) * a
    pc += dc
    if (pc >= 1) pc -= 1
    pt += dt
    if (pt >= 1) pt -= 1
    eI *= kI
    eT *= kT
    eD *= kD
    eL *= kL
  }
  return out
}

/** Pad voice, stereo: 3 saws at -7 / 0 / +7 cents spread L / C / R + a quiet triangle an octave up. */
function renderPad(m, len, sr, seed) {
  const r = prng(seed)
  const n = Math.max(1, Math.ceil(len * sr))
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const f = mtof(m)
  const d0 = (f * Math.pow(2, -7 / 1200)) / sr
  const d1 = f / sr
  const d2 = (f * Math.pow(2, 7 / 1200)) / sr
  const d3 = (2 * f) / sr
  let p0 = r()
  let p1 = r()
  let p2 = r()
  let p3 = r()
  const [wl, wr] = panGains(-0.75)
  for (let i = 0; i < n; i++) {
    const s0 = saw(p0, d0)
    const s1 = saw(p1, d1)
    const s2 = saw(p2, d2)
    const t3 = 0.35 * tri(p3)
    L[i] = 0.2 * (wl * s0 + s1 + wr * s2 + t3)
    R[i] = 0.2 * (wr * s0 + s1 + wl * s2 + t3)
    p0 += d0
    if (p0 >= 1) p0 -= 1
    p1 += d1
    if (p1 >= 1) p1 -= 1
    p2 += d2
    if (p2 >= 1) p2 -= 1
    p3 += d3
    if (p3 >= 1) p3 -= 1
  }
  return [L, R]
}

/** Karplus-Strong pluck, mono (fractional-delay tuning, loss set for the T60); bright 0 | 1 | 2. */
function renderPluck(m, bright, sr, seed, t60 = 1.5) {
  const r = prng(seed)
  const f = mtof(m)
  const n = Math.round((t60 + 0.3) * sr)
  const out = new Float32Array(n)
  const S = m <= 84 ? 0.5 : Math.max(0.3, 0.5 - (m - 84) * 0.017) // lighter damping up high
  const P = sr / f
  let N = Math.floor(P - S)
  let frac = P - S - N
  if (frac < 0.2) {
    N -= 1
    frac += 1
  }
  const C = (1 - frac) / (1 + frac)
  const w = (TAU * f) / sr
  const H = Math.sqrt((1 - S) * (1 - S) + S * S + 2 * S * (1 - S) * Math.cos(w))
  const rho = Math.min(0.9995, Math.pow(0.001, 1 / (t60 * f)) / H)
  // excitation: one period of low-passed noise, a pick-position notch, zero mean
  const ex = new Float64Array(N + 1)
  const a = [0.16, 0.3, 0.48][bright] ?? 0.3
  let lp = 0
  for (let i = 0; i <= N; i++) {
    lp += a * (r() * 2 - 1 - lp)
    ex[i] = lp
  }
  const pp = Math.max(1, Math.round(N * 0.13))
  for (let i = N; i >= pp; i--) ex[i] -= ex[i - pp]
  let mean = 0
  for (let i = 0; i <= N; i++) mean += ex[i]
  mean /= N + 1
  for (let i = 0; i <= N; i++) ex[i] -= mean
  const buf = new Float64Array(4096)
  let apIn = 0
  let apOut = 0
  for (let i = 0; i < n; i++) {
    const loss = (1 - S) * buf[(i - N) & 4095] + S * buf[(i - N - 1) & 4095]
    apOut = C * loss + apIn - C * apOut
    apIn = loss
    const y = (i <= N ? ex[i] : 0) + rho * apOut
    buf[i & 4095] = y
    out[i] = y
  }
  const F = Math.round(0.1 * sr)
  for (let i = n - F; i < n; i++) out[i] *= (n - i) / F
  return normPeak(out, 0.8, Math.min(n, (N + 1) * 4))
}

/** Scale so the peak (over the first `upto` samples) is p. */
function normPeak(x, p = 1, upto = x.length) {
  let m = 0
  for (let i = 0; i < upto; i++) m = Math.max(m, Math.abs(x[i]))
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= p / m
  return x
}

/** Round bass note into a mono stem: sine (+ a little triangle) through a soft saturator. */
function addBass(dst, sr, e) {
  const f = mtof(e.m)
  const s0 = Math.round(e.t * sr)
  const hold = Math.max(1, Math.round((e.end - e.t) * sr))
  const rel = Math.round(0.06 * sr)
  const A = Math.round(0.006 * sr)
  const drive = e.soft ? 1.1 : 1.9
  const triAmt = e.soft ? 0.05 : 0.22
  const norm = Math.tanh(drive)
  const kD = Math.exp(-1 / (0.35 * sr))
  const dp = f / sr
  let p = 0
  let d = 1
  for (let i = 0; i < hold + rel; i++) {
    const j = s0 + i
    if (j >= dst.length) break
    let env = 0.78 + 0.22 * d
    d *= kD
    if (i < A) env *= rise(i / A)
    if (i >= hold) env *= 1 - rise((i - hold) / rel)
    const x = (sin1(p) + triAmt * tri(p)) * env
    if (j >= 0) dst[j] += (Math.tanh(drive * x) / norm) * e.gain
    p += dp
    if (p >= 1) p -= 1
  }
}

// ---------------------------------------------------------------- drums (one-shots, mono)

function renderKick(sr, seed, o = {}) {
  const { f0 = 150, f1 = 45, tp = 0.034, td = 0.1, len = 0.45, click = 0.1, drive = 1.5, atk = 0.0012, lp = 0 } = o
  const r = prng(seed)
  const n = Math.round(len * sr)
  const out = new Float32Array(n)
  const A = Math.max(1, Math.round(atk * sr))
  const F = Math.round(0.04 * sr)
  const norm = Math.tanh(drive)
  const cn = Math.round(0.004 * sr)
  const clk = new Float32Array(cn)
  for (let i = 0; i < cn; i++) clk[i] = (r() * 2 - 1) * (1 - i / cn) ** 2
  filt(clk, 'hp', 2000, 0.7, sr)
  filt(clk, 'lp', 6500, 0.7, sr)
  let p = 0
  for (let i = 0; i < n; i++) {
    const t = i / sr
    p += (f1 + (f0 - f1) * Math.exp(-t / tp)) / sr
    let a = Math.exp(-t / td)
    if (i < A) a *= rise(i / A)
    if (i > n - F) a *= (n - i) / F
    let y = Math.tanh(drive * sin1(p) * a) / norm
    if (i < cn) y += clk[i] * click
    out[i] = y
  }
  if (lp) filt(out, 'lp', lp, 0.7, sr)
  return normPeak(out)
}

/** Noise one-shot: envelope fn(t) → band-limited by [type, f, q] filters → peak 1. */
function noiseShot(sr, seed, len, env, filters, extra) {
  const r = prng(seed)
  const n = Math.round(len * sr)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * env(i / sr)
  for (const [type, f, q] of filters) filt(out, type, f, q, sr)
  if (extra) for (let i = 0; i < n; i++) out[i] += extra(i / sr)
  const F = Math.round(Math.min(0.03, len * 0.2) * sr)
  for (let i = n - F; i < n; i++) out[i] *= (n - i) / F
  return normPeak(out)
}

const expEnv = (atk, tau, t) => rise(t / atk) * Math.exp(-t / tau)

function renderClap(sr, seed) {
  const env = (t) => {
    let e = 0
    for (const b of [0, 0.0105, 0.021]) if (t >= b) e += expEnv(0.0004, 0.0035, t - b)
    if (t >= 0.029) e += 0.8 * expEnv(0.001, 0.055, t - 0.029)
    return e
  }
  return noiseShot(sr, seed, 0.32, env, [['bp', 1250, 0.8], ['hp', 500, 0.7], ['lp', 7000, 0.7]])
}

function renderSnap(sr, seed) {
  const env = (t) => expEnv(0.0003, 0.011, t)
  const pop = (t) => 0.22 * sin1(1750 * t) * expEnv(0.0004, 0.006, t)
  return noiseShot(sr, seed, 0.14, env, [['bp', 2400, 1.3], ['lp', 8500, 0.7]], pop)
}

function renderHat(sr, seed, open) {
  const tau = open ? 0.075 : 0.015
  const env = (t) => expEnv(0.00025, tau, t)
  return noiseShot(sr, seed, open ? 0.32 : 0.09, env, [['hp', 7000, 0.75], ['hp', 6000, 0.6], ['lp', 13000, 0.6]])
}

function renderShaker(sr, seed) {
  const env = (t) => expEnv(0.008, 0.02, t)
  return noiseShot(sr, seed, 0.1, env, [['bp', 6000, 0.9], ['hp', 3500, 0.7], ['lp', 9000, 0.7]])
}

function renderSnare(sr, seed) {
  const env = (t) => expEnv(0.0003, 0.045, t)
  const body = (t) => 0.45 * sin1(195 * t) * expEnv(0.0008, 0.028, t)
  return noiseShot(sr, seed, 0.26, env, [['bp', 1900, 0.6], ['hp', 350, 0.7], ['lp', 9000, 0.7]], body)
}

// ---------------------------------------------------------------- fx (written straight into the stems)

/** Riser: noise through a band-pass sweeping up + detuned saws gliding up, crescendo, cut at t1. */
function addRiser(L, R, sr, t0, t1, seed, o = {}) {
  const { root = 53, octaves = 2, f0 = 300, f1 = 6000, sawAmt = 0.3, level = 1, q = 1.2 } = o
  const r = prng(seed)
  const i0 = Math.max(0, Math.round(t0 * sr))
  const i1 = Math.min(L.length, Math.round(t1 * sr))
  const n = i1 - i0
  if (n < sr * 0.2) return
  const fb = [new Biquad(), new Biquad(), new Biquad(), new Biquad()]
  const nl = new Float32Array(BLOCK)
  const nr = new Float32Array(BLOCK)
  const sl = new Float32Array(BLOCK)
  const sR = new Float32Array(BLOCK)
  const base = mtof(root)
  const det = [Math.pow(2, -12 / 1200), 1, Math.pow(2, 12 / 1200)]
  const ph = [r(), r(), r()]
  const [wl, wr] = panGains(-0.6)
  const F = Math.round(0.006 * sr)
  for (let b = 0; b < n; b += BLOCK) {
    const m = Math.min(BLOCK, n - b)
    const fc = f0 * Math.pow(f1 / f0, b / n)
    fb[0].set('bp', fc, q, sr)
    fb[1].set('bp', fc, q, sr)
    fb[2].set('lp', Math.min(9000, 600 + fc), 0.7, sr)
    fb[3].set('lp', Math.min(9000, 600 + fc), 0.7, sr)
    for (let j = 0; j < m; j++) {
      const k = b + j
      const x = k / n
      const env = Math.pow(x, 2.2) * (n - k < F ? (n - k) / F : 1)
      nl[j] = (r() * 2 - 1) * env
      nr[j] = (r() * 2 - 1) * env
      const f = base * Math.pow(2, octaves * Math.pow(x, 1.4))
      const s = [0, 0, 0]
      for (let v = 0; v < 3; v++) {
        const dt = (f * det[v]) / sr
        ph[v] += dt
        if (ph[v] >= 1) ph[v] -= 1
        s[v] = saw(ph[v], dt)
      }
      sl[j] = (wl * s[0] + s[1] + wr * s[2]) * env * sawAmt
      sR[j] = (wr * s[0] + s[1] + wl * s[2]) * env * sawAmt
    }
    fb[0].run(nl, 0, m)
    fb[1].run(nr, 0, m)
    fb[2].run(sl, 0, m)
    fb[3].run(sR, 0, m)
    for (let j = 0; j < m; j++) {
      L[i0 + b + j] += (nl[j] + sl[j]) * level
      R[i0 + b + j] += (nr[j] + sR[j]) * level
    }
  }
}

/** Sub drop: sine sliding 90 → 30 Hz over 1.2 s, mono. */
function addSubDrop(M, sr, t, level) {
  const s0 = Math.round(t * sr)
  const n = Math.round(1.8 * sr)
  const F = Math.round(0.15 * sr)
  let p = 0
  for (let i = 0; i < n && s0 + i < M.length; i++) {
    const tt = i / sr
    p += (tt < 1.2 ? 90 * Math.pow(30 / 90, tt / 1.2) : 30) / sr
    const a = expEnv(0.006, 0.55, tt) * (i > n - F ? (n - i) / F : 1)
    if (s0 + i >= 0) M[s0 + i] += sin1(p) * a * level
  }
}

/** Soft sub punch under a KPI accent, mono. */
function addPunch(M, sr, t, level) {
  const s0 = Math.round(t * sr)
  const n = Math.round(0.4 * sr)
  let p = 0
  for (let i = 0; i < n && s0 + i < M.length; i++) {
    const tt = i / sr
    p += (48 + 37 * Math.exp(-tt / 0.03)) / sr
    const a = expEnv(0.003, 0.09, tt) * (1 - rise((i - n * 0.8) / (n * 0.2)))
    if (s0 + i >= 0) M[s0 + i] += sin1(p) * a * level
  }
}

/** The final sub boom on F1: sine 62 → 43.65 Hz, decaying with tau, a little saturation. */
function addBoom(M, sr, t, tau, level) {
  const s0 = Math.round(t * sr)
  const n = Math.min(M.length - s0, Math.round(tau * 7 * sr))
  const F = Math.round(0.1 * sr)
  const norm = Math.tanh(1.6)
  let p = 0
  for (let i = 0; i < n; i++) {
    const tt = i / sr
    p += (43.65 + 18.35 * Math.exp(-tt / 0.07)) / sr
    const a = expEnv(0.003, tau, tt) * (i > n - F ? (n - i) / F : 1)
    M[s0 + i] += (Math.tanh(1.6 * sin1(p) * a) / norm) * level
  }
}

/** Airy shimmer on a KPI: a breath of high noise + two soft bell tones (chord tones), stereo. */
function addShimmer(L, R, sr, t, notes, pan, seed, level) {
  const r = prng(seed)
  const s0 = Math.round(t * sr)
  const n = Math.min(L.length - s0, Math.round(1.1 * sr))
  if (n <= 0) return
  const nz = new Float32Array(n)
  for (let i = 0; i < n; i++) nz[i] = (r() * 2 - 1) * expEnv(0.002, 0.045, i / sr)
  filt(nz, 'hp', 6500, 0.7, sr)
  filt(nz, 'lp', 14000, 0.7, sr)
  const [gl, gr] = panGains(pan)
  const fs = notes.map(mtof)
  const F = Math.round(0.05 * sr)
  for (let i = 0; i < n; i++) {
    const tt = i / sr
    let b = 0
    for (const f of fs) b += sin1(f * tt) + 0.3 * sin1(2 * f * tt) * Math.exp(-tt / 0.06)
    b *= (expEnv(0.002, 0.2, tt) * (1 + 0.12 * sin1(6.5 * tt))) / fs.length
    const y = (nz[i] * 0.5 + b * 0.55) * level * (i > n - F ? (n - i) / F : 1)
    L[s0 + i] += y * gl
    R[s0 + i] += y * gr
  }
}

/** Wide noise "air" burst on the final, stereo, decaying with tau. */
function addAir(L, R, sr, t, tau, seed, level) {
  const r = prng(seed)
  const s0 = Math.round(t * sr)
  const n = Math.min(L.length - s0, Math.round(tau * 7 * sr))
  if (n <= 0) return
  const F = Math.round(0.1 * sr)
  for (const [ch, out] of [[0, L], [1, R]]) {
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++) x[i] = (r() * 2 - 1) * expEnv(0.025, tau, i / sr) * (i > n - F ? (n - i) / F : 1)
    filt(x, 'hp', 3500, 0.6, sr)
    filt(x, 'lp', 11000, 0.5, sr)
    for (let i = 0; i < n; i++) out[s0 + i] += x[i] * level * (ch ? 0.97 : 1)
  }
}

// ---------------------------------------------------------------- harmony

// MIDI voicings. keys: the electric piano, voice-led around C5 (the common tone
// of the whole cycle); pad: wider, root low, common tones tied across bars;
// arp: chord tones for the pluck (C5-C7); root: the bass (F1-D2).
const CHORDS = {
  Bb: { root: 34, keys: [62, 65, 69, 72], pad: [46, 53, 62, 69, 72], arp: [74, 77, 81, 84, 86, 89, 93] }, // Bbmaj9
  C: { root: 36, keys: [62, 64, 67, 72], pad: [48, 55, 62, 64, 72], arp: [72, 76, 79, 84, 86, 88, 91] }, // Cadd9
  Am: { root: 33, keys: [64, 67, 69, 72], pad: [45, 52, 64, 67, 72], arp: [72, 76, 79, 81, 84, 88, 91] }, // Am7
  Dm: { root: 38, keys: [65, 69, 72, 76], pad: [50, 57, 65, 72, 76], arp: [74, 77, 81, 84, 88, 93, 96] }, // Dm9
  F: { root: 29, keys: [53, 60, 64, 67, 69, 72], pad: [41, 48, 57, 64, 67, 72, 81], arp: [72, 77, 81, 84, 88, 91, 93, 96] }, // Fmaj9
  Sus: { root: 36, keys: [60, 65, 67, 70, 74], pad: [48, 55, 58, 65, 74], arp: [72, 74, 77, 79, 82, 84, 86] }, // C9sus4: the held question
}
const CYCLE = ['Bb', 'C', 'Am', 'Dm']

// keys comping: [beat in the bar, length in beats, velocity]
const COMP = {
  hold: [[0, 3.8, 0.62]],
  restrike: [[0, 2.8, 0.62], [3, 0.95, 0.42]],
  quarters: [[0, 0.9, 0.56], [1, 0.9, 0.44], [2, 0.9, 0.5], [3, 0.9, 0.46]],
  grooveA: [[0, 1.4, 0.8], [1.5, 0.45, 0.58], [3, 0.9, 0.6]],
  grooveB: [[0, 1.4, 0.8], [1.5, 0.45, 0.58], [2.5, 0.4, 0.5], [3.5, 0.45, 0.6]],
  peak: [[0, 0.6, 0.84], [1.5, 0.3, 0.66], [2.5, 0.3, 0.7], [3.5, 0.35, 0.68]],
  pulseA: [[0, 3.4, 0.5]],
  pulseB: [[0, 2.3, 0.5], [2.5, 1.3, 0.36]],
  sustain: [[0, 3.8, 0.32]],
}
// pluck figures: indices into the chord's arp tones
const ARP8 = [0, 2, 4, 3, 1, 3, 5, 4]
const ARP8_VEL = [0.9, 0.6, 0.75, 0.62, 0.82, 0.58, 0.72, 0.64]
const ARP16 = [0, 2, 4, 2, 5, 2, 4, 2, 1, 3, 5, 3, 6, 3, 5, 3]
const ARP_PULSE = [[0, 0], [1.5, 2], [2, 1], [3, 3]] // [beat in the bar, tone]
const SHAKE = [0.32, 0.6, 0.42, 0.75]

// per-section colour: pad level (dB) and the low-pass cutoffs (Hz) of pad / keys / pluck, [start, end]
const LANES = {
  intro: { pad: [-12, -12], padHz: [650, 1900], keysHz: [1100, 3000], pluckHz: [3000, 3000] },
  groove: { pad: [-13.5, -13.5], padHz: [1900, 2100], keysHz: [3200, 3200], pluckHz: [4200, 5000] },
  peak: { pad: [-13, -13], padHz: [2600, 2600], keysHz: [4800, 4800], pluckHz: [8000, 9000] },
  drop: { pad: [-17, -17], padHz: [1700, 1500], keysHz: [2600, 2600], pluckHz: [3000, 3000] },
  pulse: { pad: [-14, -14], padHz: [1000, 1000], keysHz: [1200, 1200], pluckHz: [1300, 1300] },
  build: { pad: [-13.5, -13.5], padHz: [1100, 2600], keysHz: [1800, 4200], pluckHz: [2000, 8000] },
  stop: { pad: [-13, -9], padHz: [600, 5000], keysHz: [2400, 2400], pluckHz: [6000, 6000] },
  final: { pad: [-8, -8], padHz: [3500, 1800], keysHz: [4200, 3000], pluckHz: [9000, 9000] },
  end: { pad: [-10, -10], padHz: [1500, 900], keysHz: [2400, 1800], pluckHz: [4000, 4000] },
}
const PAD_ATTACK = { intro: 1.6, groove: 1.1, peak: 0.9, drop: 0.45, pulse: 1.2, build: 1.0, stop: 0.6, final: 0.03, end: 0.7 }

// ---------------------------------------------------------------- cues → sections

const ORDER = ['groove', 'peak', 'drop', 'pulse', 'build', 'stop', 'final']

/** Snap (beat; hits: eighth note), clamp and order the cues. Never throws. */
function prepareCues(cues, duration) {
  const src = cues && typeof cues === 'object' ? cues : {}
  const num = (v) => (v === null || v === undefined || v === '' || typeof v === 'boolean' ? NaN : Number(v))
  const maxT = Math.floor(duration / BEAT + EPS) * BEAT
  const c = {}
  let prev = 0
  for (const k of ORDER) {
    const v = num(src[k])
    if (!Number.isFinite(v)) continue
    const t = Math.max(prev, clamp(snapBeat(v), 0, maxT))
    if (t >= duration - EPS) continue // nothing left to play after it
    c[k] = t
    prev = t
  }
  const hits = Array.isArray(src.hits) ? src.hits.map(num).filter(Number.isFinite) : []
  c.hits = [...new Set(hits.map(snapEighth))].filter((t) => t >= 0 && t < duration).sort((a, b) => a - b)
  return c
}

/** Sections [t0, t1) in film order; with no `final`, a soft tonic ending near the end. */
function plan(c, duration) {
  const list = [{ type: 'intro', t0: 0 }]
  for (const k of ORDER) if (c[k] !== undefined) list.push({ type: k, t0: c[k] })
  let tonic = c.final
  if (tonic === undefined) {
    const last = list[list.length - 1].t0
    let t = Math.floor((duration - 3) / BAR) * BAR
    if (t < last + BEAT) t = snapBeat(Math.min(last + BAR, duration - 1.5))
    if (t > last && t < duration - 0.5) {
      list.push({ type: 'end', t0: t })
      tonic = t
    }
  }
  list.forEach((s, i) => {
    s.t1 = i + 1 < list.length ? list[i + 1].t0 : duration
  })
  const secs = list.filter((s) => s.t1 - s.t0 > EPS)
  secs.forEach((s, i) => {
    s.next = secs[i + 1] ? secs[i + 1].type : null
  })
  return { secs, tonic }
}

/** Chord name at t: the bar's chord, pushed a beat early by a cue on beat 4, Sus from `stop`, F from the tonic. */
function harmony(c, tonic) {
  const pushes = []
  for (const k of ['groove', 'peak', 'drop', 'pulse', 'build']) {
    const t = c[k]
    if (t === undefined) continue
    const next = Math.ceil(t / BAR - EPS) * BAR
    if (next - t > EPS && next - t <= BEAT + EPS) pushes.push([t, next])
  }
  return (t) => {
    if (tonic !== undefined && t >= tonic - EPS) return 'F'
    if (c.stop !== undefined && t >= c.stop - EPS) return 'Sus'
    let bar = Math.floor(t / BAR + EPS)
    for (const [a, b] of pushes) if (t >= a - EPS && t < b - EPS) bar += 1
    return CYCLE[((bar % 4) + 4) % 4]
  }
}

// ---------------------------------------------------------------- arrangement

/** Every note and hit of the score, from the cues. */
function arrange(c, duration) {
  const { secs, tonic } = plan(c, duration)
  const chordAt = harmony(c, tonic)
  const ev = { keys: [], pad: [], pluck: [], bass: [], kick: [], perc: [], fx: [] }
  const CUT = new Set(['drop', 'stop', 'final', 'end'])
  const onBar = (t) => Math.abs(t / BAR - Math.round(t / BAR)) < EPS
  const nextBar = (t) => Math.ceil(t / BAR - EPS) * BAR
  const inside = (s, t) => t >= s.t0 - EPS && t < s.t1 - EPS
  const endOf = (s, t, len) => (CUT.has(s.next) ? Math.min(t + len, s.t1) : t + len)
  const eachBar = (s, fn) => {
    for (let b = Math.floor(s.t0 / BAR + EPS); b * BAR < s.t1 - EPS; b++) fn(b * BAR, b)
  }
  // when the harmony moves on after t (a held chord lets go just before)
  const changeAfter = (t) => {
    const ch = chordAt(t + EPS)
    let u = Math.floor(t / BEAT + EPS) * BEAT + BEAT
    for (let i = 0; i < 16 && chordAt(u + EPS) === ch; i++) u += BEAT
    return u
  }

  const keys = (s, T, pattern, mul, roll) => {
    for (const [pos, len, vel] of pattern) {
      const t = T + pos * BEAT
      if (inside(s, t)) ev.keys.push({ t, end: Math.min(endOf(s, t, len * BEAT), changeAfter(t) - 0.04), chord: chordAt(t + EPS), vel: vel * mul, roll })
    }
  }
  // a chord on the cue itself when the bar pattern has none there (sections entering mid-bar)
  const entrance = (s, vel, roll, hold = false) => {
    if (ev.keys.some((e) => Math.abs(e.t - s.t0) < EPS)) return
    const end = hold ? changeAfter(s.t0) - 0.1 : Math.min(s.t0 + 0.9 * BEAT, nextBar(s.t0 + EPS) - 0.05)
    ev.keys.push({ t: s.t0, end: endOf(s, s.t0, end - s.t0), chord: chordAt(s.t0 + EPS), vel, roll, exact: true })
  }
  const drum = (s, type, t, vel, o = {}) => {
    if (!inside(s, t)) return
    ;(type === 'kick' || type === 'heart' ? ev.kick : ev.perc).push({ type, t, vel, ...o })
  }
  const bass = (s, t, len, vel, o = {}) => {
    if (!inside(s, t)) return
    ev.bass.push({ t, end: endOf(s, t, len), m: CHORDS[chordAt(t + EPS)].root + (o.up ? 12 : 0), vel, soft: !!o.soft })
  }
  const pluck = (s, t, idx, vel, bright, pan = 0) => {
    if (!inside(s, t)) return
    const arp = CHORDS[chordAt(t + EPS)].arp
    ev.pluck.push({ t, m: arp[((idx % arp.length) + arp.length) % arp.length], vel, bright, pan })
  }
  const shaker = (s, mul) => {
    const step = BEAT / 4
    for (let k = Math.ceil(s.t0 / step - EPS); k * step < s.t1 - EPS; k++) drum(s, 'shaker', k * step, SHAKE[k % 4] * mul, { pan: -0.35 })
  }
  const arp8 = (s, T, mul, bright) => ARP8.forEach((idx, j) => pluck(s, T + j * EIGHTH, idx, ARP8_VEL[j] * mul, bright, j % 2 ? 0.22 : -0.22))
  const arp16 = (s, T, mul, bright) => ARP16.forEach((idx, j) => pluck(s, T + (j * BEAT) / 4, idx, (j % 4 ? 0.62 : 0.85) * mul, bright, j % 2 ? 0.25 : -0.25))

  for (const s of secs) {
    const L = s.t1 - s.t0
    const prog = (t) => clamp((t - s.t0) / Math.max(L, EPS))
    if (s.type === 'intro') {
      eachBar(s, (T, b) => {
        const last = T + BAR >= s.t1 - EPS && s.t1 >= 2 * BAR - EPS
        keys(s, T, last ? COMP.quarters : b % 2 ? COMP.restrike : COMP.hold, 0.78 + 0.22 * prog(T), 0.018)
      })
      if ((s.next === 'groove' || s.next === 'peak') && s.t1 >= 1.5) ev.fx.push({ type: 'swell', t: s.t1, len: Math.min(2, s.t1 - 0.25), chord: chordAt(s.t1 + EPS) })
    } else if (s.type === 'groove') {
      const half = s.t0 + L / 2
      const pluckIn = Math.ceil((half - BEAT) / BAR - EPS) * BAR
      eachBar(s, (T, b) => {
        const odd = b % 2 === 1
        drum(s, 'kick', T, 0.9)
        if (odd) drum(s, 'kick', T + 1.5 * BEAT, 0.42)
        for (const k of [1, 3]) {
          drum(s, 'snap', T + k * BEAT, k === 1 ? 0.78 : 0.72)
          if (T + k * BEAT >= half - EPS) drum(s, 'clap', T + k * BEAT, 0.34)
        }
        bass(s, T, (odd ? 1.25 : 1.5) * BEAT, 0.72)
        if (odd) bass(s, T + 1.5 * BEAT, 0.4 * BEAT, 0.52)
        bass(s, T + 2.5 * BEAT, 1.25 * BEAT, 0.62)
        keys(s, T, odd ? COMP.grooveB : COMP.grooveA, 0.92, 0.005)
        if (T >= pluckIn - EPS) arp8(s, T, 0.75, 1)
      })
      if (!onBar(s.t0)) {
        drum(s, 'kick', s.t0, 0.85)
        if (!ev.bass.some((e) => Math.abs(e.t - s.t0) < EPS)) bass(s, s.t0, Math.min(BEAT * 0.9, nextBar(s.t0) - s.t0 - 0.05), 0.75)
      }
      entrance(s, 0.74, 0.006)
      shaker(s, 0.9)
    } else if (s.type === 'peak') {
      eachBar(s, (T) => {
        for (let k = 0; k < 4; k++) {
          const t = T + k * BEAT
          drum(s, 'kick', t, k ? 0.93 : 1, { pump: true })
          if (k % 2) drum(s, 'clap', t, 0.82)
          drum(s, 'hatO', t + EIGHTH, 0.6, { pan: 0.25 })
          bass(s, t, 0.2, 0.85)
          bass(s, t + EIGHTH, 0.18, 0.68, { up: true })
        }
        keys(s, T, COMP.peak, 1.04, 0.002)
        arp16(s, T, 1, 2)
      })
      entrance(s, 0.8, 0.002)
      shaker(s, 0.85)
      if (s.t0 >= BEAT) ev.fx.push({ type: 'whoosh', t0: s.t0 - BEAT, t1: s.t0 })
      if (s.next === 'drop') ev.fx.push({ type: 'riser', t0: Math.max(s.t0, s.t1 - BAR), t1: s.t1, root: 53 })
    } else if (s.type === 'drop') {
      ev.fx.push({ type: 'subdrop', t: s.t0 })
      const held = onBar(s.t0) ? s.t0 : changeAfter(s.t0)
      if (!onBar(s.t0)) entrance(s, 0.32, 0.03, true)
      eachBar(s, (T) => T >= held - EPS && keys(s, T, COMP.sustain, 1, 0.03))
    } else if (s.type === 'pulse') {
      eachBar(s, (T, b) => {
        if (T < s.t0 - EPS) return
        drum(s, 'heart', T, 0.85)
        drum(s, 'heart', T + EIGHTH, 0.5)
        bass(s, T, 3.5 * BEAT, 0.38, { soft: true })
        keys(s, T, b % 2 ? COMP.pulseB : COMP.pulseA, 0.85, 0.012)
        if (T >= s.t0 + BAR - EPS) for (const [pos, idx] of ARP_PULSE) pluck(s, T + pos * BEAT, idx, 0.5, 0, pos % 1 ? 0.3 : -0.3)
      })
    } else if (s.type === 'build') {
      const nb = Math.round(L / BEAT)
      const clapIn = s.t0 + Math.round(nb * 0.3) * BEAT
      const kickIn = clamp(Math.round((s.t0 + L / 2) / BAR) * BAR, s.t0, Math.max(s.t0, s.t1 - 2 * BEAT))
      const rollIn = s.t1 - 2 * BEAT
      const lastBar = s.t1 - BAR
      for (let k = Math.ceil(s.t0 / BEAT - EPS); k * BEAT < s.t1 - EPS; k++) {
        const t = k * BEAT
        const p = prog(t)
        const beat = ((k % 4) + 4) % 4
        if (t < lastBar - EPS) {
          drum(s, 'hatC', t, 0.38 + 0.3 * p, { pan: 0.25 })
          drum(s, 'hatC', t + EIGHTH, 0.28 + 0.3 * p, { pan: 0.25 })
        } else {
          for (let j = 0; j < 4; j++) drum(s, 'hatC', t + (j * BEAT) / 4, (0.42 + 0.35 * p) * (j % 2 ? 0.8 : 1), { pan: 0.25 })
        }
        if (t < kickIn - EPS) {
          if (beat === 0) {
            drum(s, 'heart', t, 0.9)
            drum(s, 'heart', t + EIGHTH, 0.55)
            bass(s, t, 3.5 * BEAT, 0.55, { soft: true })
          }
        } else {
          drum(s, 'kick', t, 0.92, { pump: true })
          drum(s, 'hatO', t + EIGHTH, 0.5 + 0.2 * p, { pan: 0.25 })
          bass(s, t, 0.2, 0.8)
          bass(s, t + EIGHTH, 0.18, 0.62, { up: true })
        }
        if (t >= clapIn - EPS && t < rollIn - EPS && beat % 2 === 1) {
          drum(s, 'snap', t, 0.7)
          drum(s, 'clap', t, 0.4 + 0.45 * p)
        }
      }
      if (rollIn >= s.t0 - EPS) {
        for (let j = 0; j < 8; j++) {
          const x = j / 7
          drum(s, 'snare', rollIn + (j * BEAT) / 4, 0.3 + 0.7 * Math.pow(x, 1.2))
          drum(s, 'clap', rollIn + (j * BEAT) / 4, 0.15 + 0.55 * Math.pow(x, 1.5))
        }
      }
      eachBar(s, (T, b) => {
        if (T >= kickIn - EPS) keys(s, T, COMP.peak, 1, 0.002)
        else keys(s, T, b % 2 ? COMP.grooveB : COMP.grooveA, 0.8 + 0.2 * prog(T), 0.005)
        if (T >= lastBar - EPS) arp16(s, T, 0.85, 2)
        else arp8(s, T, 0.6 + 0.3 * prog(T), T >= kickIn - EPS ? 2 : 1)
      })
      entrance(s, 0.66, 0.005)
    } else if (s.type === 'stop') {
      ev.keys.push({ t: s.t0, end: s.t1, chord: chordAt(s.t0 + EPS), vel: 0.58, roll: 0.022, exact: true })
      if (s.next === 'final') {
        ev.fx.push({ type: 'riser', t0: Math.max(s.t0, s.t1 - 4), t1: s.t1, root: 48, tension: true })
        for (const [d, v] of [[2, 0.45], [1, 0.6]]) if (s.t1 - d * BEAT >= s.t0 + BEAT - EPS) drum(s, 'kick', s.t1 - d * BEAT, v)
      }
    } else if (s.type === 'final') {
      s.tau = clamp((L - 0.1) / 5.5, 0.2, 0.6) // the tail is down about 40 dB at the end
      drum(s, 'kick', s.t0, 1)
      ev.fx.push({ type: 'boom', t: s.t0, tau: s.tau }, { type: 'air', t: s.t0, tau: s.tau * 1.1 })
      ev.keys.push({ t: s.t0, end: s.t0 + 0.2, chord: 'F', vel: 0.9, roll: 0.012, relTau: s.tau, exact: true })
      const strum = CHORDS.F.arp
      strum.forEach((m, i) => ev.pluck.push({ t: s.t0 + 0.01 + i * 0.028, m, vel: 0.8 - i * 0.03, bright: 2, pan: -0.4 + (0.8 * i) / (strum.length - 1), exact: true }))
    } else if (s.type === 'end') {
      ev.keys.push({ t: s.t0, end: s.t0 + 0.8, chord: 'F', vel: 0.5, roll: 0.03, relTau: 0.5, exact: true })
    }
  }
  c.hits.forEach((t, i) => ev.fx.push({ type: 'hit', t, i, chord: chordAt(t + EPS) }))
  ev.pad = padEvents(secs, chordAt, c, tonic, duration)
  const chords = []
  for (let k = 0; k * BEAT < duration - EPS; k++) {
    const ch = chordAt(k * BEAT + EPS)
    if (!chords.length || chords[chords.length - 1][1] !== ch) chords.push([k * BEAT, ch])
  }
  return { ev, secs, tonic, chords }
}

/** Pad notes: one chord per harmony segment, common tones tied, re-attacked on stop and the tonic. */
function padEvents(secs, chordAt, c, tonic, duration) {
  const secAt = (t) => secs.find((s) => t >= s.t0 - EPS && t < s.t1 - EPS) || secs[secs.length - 1]
  const forced = new Set([c.stop, tonic].filter((t) => t !== undefined).map((t) => Math.round(t / BEAT)))
  const segs = []
  for (let k = 0; k * BEAT < duration - EPS; k++) {
    const t = k * BEAT
    const chord = chordAt(t + EPS)
    const last = segs[segs.length - 1]
    if (!last || last.chord !== chord || forced.has(k)) segs.push({ chord, t0: t, t1: Math.min(duration, t + BEAT), forced: forced.has(k) })
    else last.t1 = Math.min(duration, t + BEAT)
  }
  const out = []
  let active = new Map()
  for (const g of segs) {
    const s = secAt(g.t0)
    const atk = PAD_ATTACK[s.type] ?? 1
    if (g.forced) for (const e of active.values()) e.rel = 0.12 // a clean change on stop / the tonic
    const next = new Map()
    for (const m of CHORDS[g.chord].pad) {
      let e = g.forced ? null : active.get(m)
      if (e) e.t1 = g.t1
      else {
        e = { m, t0: g.t0, t1: g.t1, atk, rel: 0.45 }
        out.push(e)
      }
      next.set(m, e)
    }
    active = next
  }
  if (tonic !== undefined) {
    const s = secAt(tonic)
    for (const e of out) {
      if (Math.abs(e.t0 - tonic) > EPS) continue
      e.t1 = Math.min(e.t1, tonic + (s.type === 'final' ? 0.2 : 0.6))
      e.rel = s.type === 'final' ? s.tau || 0.4 : 0.55
    }
  }
  return out
}

// ---------------------------------------------------------------- stems

// stem level into the master (dB) and reverb send (linear); the `mix` trims add on top
const STEMS = {
  kick: { db: -6.5, send: 0, trim: 'drums' },
  perc: { db: 3, send: 0.14, trim: 'drums' },
  bass: { db: -8.5, send: 0, trim: 'bass' },
  keys: { db: -3.5, send: 0.24, trim: 'keys' },
  pad: { db: 0, send: 0.34, trim: 'pad' },
  pluck: { db: 6, send: 0.3, trim: 'pluck' },
  fxWet: { db: -6, send: 0.5, trim: 'fx' },
  fxDry: { db: -4, send: 0, trim: 'fx' },
}

function addMono(dst, src, t, gain, sr) {
  const s0 = Math.round(t * sr)
  const n = Math.min(src.length, dst.length - s0)
  for (let i = Math.max(0, -s0); i < n; i++) dst[s0 + i] += src[i] * gain
}

function addStereo(L, R, src, t, gain, gl, gr, sr) {
  const s0 = Math.round(t * sr)
  const n = Math.min(src.length, L.length - s0)
  for (let i = Math.max(0, -s0); i < n; i++) {
    const v = src[i] * gain
    L[s0 + i] += v * gl
    R[s0 + i] += v * gr
  }
}

/** A cached one-shot note with a held part and an exponential release ({ t, end, relTau }). */
function mixNote(dst, src, n, gain, sr) {
  const s0 = Math.round(n.t * sr)
  const hold = Math.max(1, Math.round((n.end - n.t) * sr))
  const tau = Math.max(1, n.relTau * sr)
  const len = Math.min(src.length, hold + Math.round(tau * 5))
  const F = Math.round(0.005 * sr)
  const k = Math.exp(-1 / tau)
  let e = 1
  for (let i = 0; i < len; i++) {
    const j = s0 + i
    if (j >= dst.length) break
    let a = gain
    if (i >= hold) {
      e *= k
      a *= e
    }
    if (i > len - F) a *= (len - i) / F
    if (j >= 0) dst[j] += src[i] * a
  }
}

function stemKick(L, sr, ev) {
  const kick = renderKick(sr, 11)
  const heart = renderKick(sr, 12, { f0: 92, f1: 42, tp: 0.045, td: 0.13, click: 0, drive: 1.2, atk: 0.004, lp: 220 })
  for (const e of ev.kick) addMono(L, e.type === 'heart' ? heart : kick, e.t, (e.type === 'heart' ? 0.55 : 1) * Math.pow(e.vel, 1.3), sr)
}

function stemPerc(L, R, sr, ev) {
  const r = prng(77)
  const kit = {
    clap: [21, 22].map((s) => renderClap(sr, s)),
    snap: [23, 24].map((s) => renderSnap(sr, s)),
    hatC: [30, 31, 32, 33].map((s) => renderHat(sr, s, false)),
    hatO: [40, 41].map((s) => renderHat(sr, s, true)),
    shaker: [50, 51, 52, 53].map((s) => renderShaker(sr, s)),
    snare: [60, 61].map((s) => renderSnare(sr, s)),
  }
  const LEVEL = { clap: 0.5, snap: 0.42, hatC: 0.2, hatO: 0.2, shaker: 0.07, snare: 0.45 }
  for (const e of ev.perc) {
    const set = kit[e.type]
    const src = set[Math.floor(r() * set.length)]
    const vel = clamp(e.vel * (1 + jitter(r, e.type === 'snare' ? 0.04 : 0.12)), 0.02, 1.2)
    const t = Math.max(0, e.t + jitter(r, e.type === 'shaker' ? 0.004 : 0.002))
    const [gl, gr] = panGains(e.pan || 0)
    addStereo(L, R, src, t, LEVEL[e.type] * Math.pow(vel, 1.3), gl, gr, sr)
  }
  for (const x of [L, R]) {
    filt(x, 'hp', 200, 0.7, sr)
    filt(x, 'lp', 14000, 0.7, sr)
  }
}

function stemBass(L, sr, ev) {
  for (const e of ev.bass) addBass(L, sr, { ...e, gain: 0.5 * e.vel })
  filt(L, 'lp', 320, 0.7, sr)
  filt(L, 'hp', 28, 0.7, sr)
  const triggers = ev.kick.map((k) => ({ t: k.t, depth: (k.type === 'heart' ? 0.35 : 0.5) * Math.min(1, k.vel) }))
  applyCurve(L, duckCurve(L.length, sr, triggers, 0.004, 0.02, 0.1))
}

function stemKeys(L, R, sr, ev, hzAt, pump) {
  const r = prng(88)
  const notes = []
  for (const e of ev.keys) {
    const dt = e.exact ? 0 : jitter(r, 0.006)
    CHORDS[e.chord].keys.forEach((m, i) => {
      const t = Math.max(0, e.t + dt + i * e.roll + (e.exact && i === 0 ? 0 : jitter(r, 0.0015)))
      const vel = clamp(e.vel * (1 + jitter(r, 0.1)), 0.05, 1)
      notes.push({ m, t, end: Math.max(t + 0.06, e.end + i * e.roll), vel, relTau: e.relTau || 0.09 })
    })
  }
  const need = new Map()
  for (const n of notes) {
    const key = n.m * 4 + epBucket(n.vel)
    need.set(key, Math.max(need.get(key) || 0, n.end - n.t + n.relTau * 5 + 0.02))
  }
  const cache = new Map()
  for (const [key, len] of need) cache.set(key, renderEP(Math.floor(key / 4), EP_VEL[key % 4], len, sr))
  for (const n of notes) mixNote(L, cache.get(n.m * 4 + epBucket(n.vel)), n, 0.2 * Math.pow(n.vel, 1.3), sr)
  filterAuto(L, sr, 'lp', 0.6, hzAt)
  filt(L, 'hp', 110, 0.7, sr)
  // stereo tremolo / autopan, 4.5 Hz
  for (let i = 0; i < L.length; i++) {
    const p = 0.28 * sin1((4.5 * i) / sr)
    const x = L[i] * pump[i]
    L[i] = x * (1 - p)
    R[i] = x * (1 + p)
  }
}

function stemPad(L, R, sr, ev, dbAt, hzAt, pump) {
  const need = new Map()
  for (const e of ev.pad) need.set(e.m, Math.max(need.get(e.m) || 0, e.t1 - e.t0 + e.rel * 5.5 + 0.05))
  const cache = new Map()
  for (const [m, len] of need) cache.set(m, renderPad(m, len, sr, 1000 + m))
  for (const e of ev.pad) {
    const [sl, sR] = cache.get(e.m)
    const s0 = Math.round(e.t0 * sr)
    const hold = Math.max(1, Math.round((e.t1 - e.t0) * sr))
    const A = Math.max(1, Math.round(e.atk * sr))
    const tau = Math.max(1, e.rel * sr)
    const len = Math.min(sl.length, hold + Math.round(tau * 5.5))
    const k = Math.exp(-1 / tau)
    const F = Math.round(0.01 * sr)
    let rel = 1
    for (let i = 0; i < len; i++) {
      const j = s0 + i
      if (j >= L.length) break
      let a = 0.5 * rise(Math.min(i, hold) / A)
      if (i >= hold) {
        rel *= k
        a *= rel
      }
      if (i > len - F) a *= (len - i) / F
      L[j] += sl[i] * a
      R[j] += sR[i] * a
    }
  }
  const lfo = (t) => hzAt(t) * (1 + 0.12 * Math.sin(TAU * 0.11 * t))
  for (const x of [L, R]) {
    filt(x, 'hp', 100, 0.6, sr)
    filterAuto(x, sr, 'lp', 0.54, lfo, 0.08)
    filterAuto(x, sr, 'lp', 1.31, lfo, 0.08)
    gainAuto(x, sr, dbAt, 0.08)
    applyCurve(x, pump)
  }
}

function stemPluck(L, R, sr, ev, hzAt, cuts) {
  const r = prng(99)
  const cache = new Map()
  for (const e of ev.pluck) {
    const key = `${e.m}|${e.bright}`
    if (!cache.has(key)) cache.set(key, renderPluck(e.m, e.bright, sr, 500 + e.m * 3 + e.bright))
    const t = e.exact ? e.t : Math.max(0, e.t + jitter(r, 0.003))
    const vel = clamp(e.vel * (1 + jitter(r, 0.08)), 0.05, 1)
    const [gl, gr] = panGains(e.pan || 0)
    addStereo(L, R, cache.get(key), t, 0.28 * Math.pow(vel, 1.2), gl, gr, sr)
  }
  for (const x of [L, R]) {
    filt(x, 'hp', 300, 0.7, sr)
    filterAuto(x, sr, 'lp', 0.7, hzAt)
  }
  pingPong(L, R, sr, 0.75 * BEAT, 0.36, 0.3)
  // a clean stop: notes and echoes let go on the drop and on the stop (back with the next note)
  const F = Math.round(0.03 * sr)
  for (const c of cuts) {
    const back = ev.pluck.reduce((m, e) => (e.t > c + 0.05 && e.t < m ? e.t : m), Infinity)
    const a = Math.max(0, Math.round((c - 0.005) * sr))
    const b = Math.min(L.length, Number.isFinite(back) ? Math.round((back - 0.01) * sr) : L.length)
    for (let i = a; i < b; i++) {
      const g = i - a < F ? 1 - rise((i - a) / F) : 0
      L[i] *= g
      R[i] *= g
    }
  }
}

/** Dotted-eighth ping-pong echo, in place: first repeat left, then right, then left... */
function pingPong(L, R, sr, delay, fb, wet) {
  const d = Math.max(1, Math.round(delay * sr))
  const bl = new Float32Array(d)
  const br = new Float32Array(d)
  const lpk = 1 - Math.exp((-TAU * 4500) / sr)
  const hpk = 1 - Math.exp((-TAU * 500) / sr)
  let lpL = 0
  let lpR = 0
  let hpL = 0
  let hpR = 0
  let w = 0
  for (let i = 0; i < L.length; i++) {
    const yl = bl[w]
    const yr = br[w]
    const inL = (L[i] + R[i]) * 0.5 + fb * yr
    const inR = fb * yl
    lpL += lpk * (inL - lpL)
    lpR += lpk * (inR - lpR)
    hpL += hpk * (lpL - hpL)
    hpR += hpk * (lpR - hpR)
    bl[w] = lpL - hpL
    br[w] = lpR - hpR
    L[i] += wet * yl
    R[i] += wet * yr
    if (++w >= d) w = 0
  }
}

// ---------------------------------------------------------------- reverb + fx

/** Stereo room IR: seeded noise, RT60 2.6 s, 20 ms pre-delay, early reflections, darker as it decays, HP 200 Hz, unit energy. */
function makeIR(sr) {
  const r = prng(0x2e7)
  const len = Math.round(3.2 * sr)
  const pre = Math.round(0.02 * sr)
  const tau = 2.6 / 6.908
  const buf = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: sr })
  for (let ch = 0; ch < 2; ch++) {
    const x = new Float32Array(len)
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr
      x[i] = (r() * 2 - 1) * Math.exp(-t / tau) * rise(t / 0.01)
    }
    for (let k = 0; k < 7; k++) {
      const t = 0.004 + r() * 0.06
      x[pre + Math.round(t * sr)] += (r() < 0.5 ? -1 : 1) * 0.6 * Math.exp(-t / 0.05)
    }
    filterAuto(x, sr, 'lp', 0.6, (t) => 8000 * Math.pow(2500 / 8000, clamp((t - 0.02) / 2.4)), 0)
    filt(x, 'hp', 200, 0.6, sr)
    let e = 0
    for (let i = 0; i < len; i++) e += x[i] * x[i]
    const g = 1 / Math.sqrt(e || 1)
    for (let i = 0; i < len; i++) x[i] *= g
    buf.copyToChannel(x, ch)
  }
  return buf
}

/** Reverse swell: the next chord through the reverb (wet only), reversed, peaking on the cue. Peak 1. */
async function renderSwell(sr, ir, chord, len) {
  const srcLen = Math.round(0.8 * sr)
  const x = new Float32Array(srcLen)
  const ch = CHORDS[chord]
  ch.keys.forEach((m, i) => mixNote(x, renderEP(m, 0.8, 0.8, sr), { t: i * 0.008, end: 0.35, relTau: 0.1 }, 0.25, sr))
  ch.arp.slice(1, 6).forEach((m) => addMono(x, renderPluck(m, 2, sr, 600 + m), 0, 0.12, sr))
  const src = new AudioBuffer({ numberOfChannels: 2, length: srcLen, sampleRate: sr })
  src.copyToChannel(x, 0)
  src.copyToChannel(x, 1)
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: srcLen + ir.length, sampleRate: sr })
  const node = new AudioBufferSourceNode(ctx, { buffer: src })
  node.connect(new ConvolverNode(ctx, { buffer: ir, disableNormalization: true })).connect(ctx.destination)
  node.start(0)
  const out = await ctx.startRendering()
  const pre = Math.round(0.02 * sr)
  const n = Math.max(1, Math.round(len * sr))
  const fin = Math.round(n * 0.35)
  const fout = Math.round(0.004 * sr)
  const res = [new Float32Array(n), new Float32Array(n)]
  let peak = 0
  for (let c = 0; c < 2; c++) {
    const y = out.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const k = pre + n - 1 - i
      let v = k < y.length ? y[k] * rise(i / fin) : 0
      if (i > n - fout) v *= (n - i) / fout
      res[c][i] = v
      peak = Math.max(peak, Math.abs(v))
    }
  }
  if (peak > 0) for (const a of res) for (let i = 0; i < n; i++) a[i] /= peak
  return res
}

async function stemFx(L, R, M, sr, ev, ir) {
  for (const e of ev.fx) {
    if (e.type === 'riser') addRiser(L, R, sr, e.t0, e.t1, 700 + Math.round(e.t0 * 10), { root: e.root, level: e.tension ? 0.36 : 0.42 })
    else if (e.type === 'whoosh') addRiser(L, R, sr, e.t0, e.t1, 800, { f0: 900, f1: 5000, sawAmt: 0, level: 0.22, q: 0.9 })
    else if (e.type === 'subdrop') addSubDrop(M, sr, e.t, 0.1)
    else if (e.type === 'boom') addBoom(M, sr, e.t, e.tau, 0.55)
    else if (e.type === 'air') addAir(L, R, sr, e.t, e.tau, 950, 0.2)
    else if (e.type === 'hit') {
      const arp = CHORDS[e.chord].arp
      const notes = [arp[Math.min(arp.length - 1, 2 + e.i)], arp[Math.min(arp.length - 1, 4 + e.i)]]
      addShimmer(L, R, sr, e.t, notes, e.i % 2 ? 0.35 : -0.35, 900 + e.i, 0.55)
      addPunch(M, sr, e.t, 0.35)
    } else if (e.type === 'swell') {
      const [a, b] = await renderSwell(sr, ir, e.chord, e.len)
      const s0 = Math.round((e.t - e.len) * sr)
      for (let i = 0; i < a.length; i++) {
        const j = s0 + i
        if (j < 0 || j >= L.length) continue
        L[j] += a[i] * 0.3
        R[j] += b[i] * 0.3
      }
    }
  }
  for (const x of [L, R]) {
    filt(x, 'hp', 150, 0.7, sr)
    filt(x, 'lp', 13000, 0.7, sr)
  }
}

// ---------------------------------------------------------------- master

const MASTER_IN_DB = -8 // mix level into the glue compressor
const TAIL_TAU = 0.55 // after the final hit the reverb return also fades with this time constant

/** Glue compressor, stereo-linked RMS detector: -18 dB, 2.5:1, 6 dB knee, 20 / 200 ms. Returns the deepest gain reduction (dB). */
function glue(L, R, sr, thr = -18, ratio = 2.5, knee = 6, att = 0.02, rel = 0.2) {
  const ka = 1 - Math.exp(-1 / (att * sr))
  const kr = 1 - Math.exp(-1 / (rel * sr))
  const B = 16
  let env = 0
  let g0 = 1
  let deepest = 0
  for (let i0 = 0; i0 < L.length; i0 += B) {
    const n = Math.min(B, L.length - i0)
    for (let j = 0; j < n; j++) {
      const p = (L[i0 + j] * L[i0 + j] + R[i0 + j] * R[i0 + j]) * 0.5
      env += (p > env ? ka : kr) * (p - env)
    }
    const o = 10 * Math.log10(env + 1e-20) - thr
    let gr = 0
    if (o > knee / 2) gr = (1 / ratio - 1) * o
    else if (o > -knee / 2) gr = ((1 / ratio - 1) * (o + knee / 2) ** 2) / (2 * knee)
    deepest = Math.min(deepest, gr)
    const g1 = dbToGain(gr)
    for (let j = 0; j < n; j++) {
      const g = g0 + ((g1 - g0) * (j + 1)) / n
      L[i0 + j] *= g
      R[i0 + j] *= g
    }
    g0 = g1
  }
  return deepest
}

/** K-weighting biquads (ITU-R BS.1770): exact at 48 kHz, re-derived otherwise. */
function kWeights(sr) {
  if (sr === 48000) {
    return [
      [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
      [1, -2, 1, -1.99004745483398, 0.99007225036621],
    ]
  }
  const A = Math.pow(10, 3.99984385397 / 40)
  let w = (TAU * 1681.9744509555319) / sr
  let c = Math.cos(w)
  let al = Math.sin(w) / (2 * 0.7071752369554193)
  const sA = Math.sqrt(A)
  const a0 = A + 1 - (A - 1) * c + 2 * sA * al
  const shelf = [
    (A * (A + 1 + (A - 1) * c + 2 * sA * al)) / a0,
    (-2 * A * (A - 1 + (A + 1) * c)) / a0,
    (A * (A + 1 + (A - 1) * c - 2 * sA * al)) / a0,
    (2 * (A - 1 - (A + 1) * c)) / a0,
    (A + 1 - (A - 1) * c - 2 * sA * al) / a0,
  ]
  w = (TAU * 38.13547087613982) / sr
  c = Math.cos(w)
  al = Math.sin(w) / (2 * 0.5003270373253953)
  const h0 = 1 + al
  return [shelf, [(1 + c) / 2 / h0, -(1 + c) / h0, (1 + c) / 2 / h0, (-2 * c) / h0, (1 - al) / h0]]
}

/** Integrated loudness (LUFS), BS.1770-4: K-weighting, 400 ms blocks, 75 % overlap, -70 / -10 LU gates. */
function loudness(L, R, sr) {
  const hop = Math.round(0.1 * sr)
  const nh = Math.floor(L.length / hop)
  if (nh < 4) return -Infinity
  const ms = new Float64Array(nh)
  const [s, h] = kWeights(sr)
  for (const x of [L, R]) {
    let s1 = 0
    let s2 = 0
    let h1 = 0
    let h2 = 0
    for (let j = 0; j < nh; j++) {
      let acc = 0
      for (let i = j * hop; i < (j + 1) * hop; i++) {
        const v = x[i]
        const y = s[0] * v + s1
        s1 = s[1] * v - s[3] * y + s2
        s2 = s[2] * v - s[4] * y
        const z = h[0] * y + h1
        h1 = h[1] * y - h[3] * z + h2
        h2 = h[2] * y - h[4] * z
        acc += z * z
      }
      ms[j] += acc / hop
    }
  }
  const z = []
  for (let j = 0; j + 3 < nh; j++) z.push((ms[j] + ms[j + 1] + ms[j + 2] + ms[j + 3]) / 4)
  const lk = (v) => -0.691 + 10 * Math.log10(v)
  const mean = (a) => a.reduce((p, v) => p + v, 0) / a.length
  const abs = z.filter((v) => lk(v) > -70)
  if (!abs.length) return -Infinity
  const gate = lk(mean(abs)) - 10
  const rel = abs.filter((v) => lk(v) > gate)
  return rel.length ? lk(mean(rel)) : -Infinity
}

/** Look-ahead brickwall limiter (4 ms window, 80 ms release); zero latency, the whole buffer is known. */
function limit(L, R, sr, ceil, w) {
  const n = L.length
  const W = Math.max(1, Math.round(0.004 * sr))
  const { need, m, dq } = w
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    need[i] = a > ceil ? ceil / a : 1
  }
  let h = 0
  let t = 0
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && need[dq[t - 1]] >= need[i]) t--
    dq[t++] = i
    while (dq[h] > i + W - 1) h++
    m[i] = need[dq[h]] // min of need[i .. i + W - 1]
  }
  const kr = 1 - Math.exp(-1 / (0.08 * sr))
  let g = 1
  for (let i = 0; i < n; i++) {
    g = Math.min(m[i], g + (1 - g) * kr)
    m[i] = g
  }
  let acc = W
  let low = 1
  let over = 0
  for (let i = 0; i < n; i++) {
    acc += m[i] - (i >= W ? m[i - W] : 1)
    const gg = Math.min(1, acc / W)
    L[i] *= gg
    R[i] *= gg
    if (gg < low) low = gg
    if (gg < 0.891) over++
  }
  w.stats = { deepestDb: Math.round(200 * Math.log10(low)) / 10, overOneDbPct: Math.round((over / Math.max(1, n)) * 1e4) / 100 }
}

/** HP 25 Hz → glue → loudness to target with the limiter in the loop → 4 ms fade-in, 150 ms fade-out. */
function master(L, R, sr, levelDb, dbg) {
  for (const x of [L, R]) filt(x, 'hp', 25, Math.SQRT1_2, sr)
  dbg.glueDb = glue(L, R, sr)
  const target = LUFS_TARGET + levelDb
  const ceil = dbToGain(CEILING_DB)
  const pre = [L.slice(), R.slice()]
  const work = { need: new Float32Array(L.length), m: new Float32Array(L.length), dq: new Int32Array(L.length) }
  let lu = loudness(L, R, sr)
  dbg.preLufs = lu
  let g = Number.isFinite(lu) ? dbToGain(target - lu) : 1
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < L.length; i++) {
      L[i] = pre[0][i] * g
      R[i] = pre[1][i] * g
    }
    limit(L, R, sr, ceil, work)
    lu = loudness(L, R, sr)
    dbg.iterations = it + 1
    if (!Number.isFinite(lu) || Math.abs(target - lu) < 0.02) break
    g *= dbToGain(target - lu)
  }
  dbg.lufs = lu
  dbg.limiter = work.stats
  dbg.masterGainDb = 20 * Math.log10(g)
  const fi = Math.min(L.length, Math.round(0.004 * sr))
  const fo = Math.min(L.length, Math.round(0.15 * sr))
  for (let i = 0; i < fi; i++) {
    L[i] *= i / fi
    R[i] *= i / fi
  }
  for (let i = 0; i < fo; i++) {
    const k = L.length - 1 - i
    const a = rise(i / fo)
    L[k] *= a
    R[k] *= a
  }
}

function sectionDb(L, R, g, secs, sr) {
  const out = {}
  for (const s of secs) {
    const a = Math.round(s.t0 * sr)
    const b = Math.min(L.length, Math.round(s.t1 * sr))
    let e = 0
    for (let i = a; i < b; i++) e += L[i] * L[i] + R[i] * R[i]
    out[s.type] = Math.round(10 * Math.log10((e * g * g) / Math.max(1, 2 * (b - a)) + 1e-20) * 10) / 10
  }
  return out
}

// ---------------------------------------------------------------- render

/** Stems → dry bus + reverb send (temporaries die with this call). */
async function mixStems(N, sr, ev, secs, mix, ir, debug) {
  const pts = { pad: [], padHz: [], keysHz: [], pluckHz: [] }
  for (const s of secs) for (const k of Object.keys(pts)) pts[k].push([s.t0, LANES[s.type][k][0]], [s.t1 - 1e-3, LANES[s.type][k][1]])
  const pump = duckCurve(N, sr, ev.kick.filter((k) => k.pump).map((k) => ({ t: k.t, depth: 0.25 })), 0.005, 0.01, 0.14)
  const dry = [new Float32Array(N), new Float32Array(N)]
  const send = new AudioBuffer({ numberOfChannels: 2, length: N, sampleRate: sr })
  const sL = send.getChannelData(0)
  const sR = send.getChannelData(1)
  const tL = new Float32Array(N)
  const tR = new Float32Array(N)
  const stems = {}
  const put = (name, mono) => {
    const st = STEMS[name]
    const g = dbToGain(st.db + mix[st.trim])
    const gs = g * st.send
    const R = mono ? tL : tR
    for (let i = 0; i < N; i++) {
      dry[0][i] += tL[i] * g
      dry[1][i] += R[i] * g
      if (gs) {
        sL[i] += tL[i] * gs
        sR[i] += R[i] * gs
      }
    }
    if (debug) stems[name] = sectionDb(tL, R, g, secs, sr)
    tL.fill(0)
    tR.fill(0)
  }
  stemKick(tL, sr, ev)
  put('kick', true)
  stemPerc(tL, tR, sr, ev)
  put('perc')
  stemBass(tL, sr, ev)
  put('bass', true)
  stemKeys(tL, tR, sr, ev, lane(pts.keysHz, true), pump)
  put('keys')
  stemPad(tL, tR, sr, ev, lane(pts.pad), lane(pts.padHz, true), pump)
  put('pad')
  stemPluck(tL, tR, sr, ev, lane(pts.pluckHz, true), secs.filter((s) => s.type === 'drop' || s.type === 'stop').map((s) => s.t0))
  put('pluck')
  const sub = new Float32Array(N)
  await stemFx(tL, tR, sub, sr, ev, ir)
  put('fxWet')
  tL.set(sub)
  put('fxDry', true)
  return { dry, send, stems }
}

/**
 * @param {{ duration: number, sampleRate?: number, cues: object, mix?: Partial<typeof SCORE_DEFAULTS> }} o
 * @returns {Promise<{ buffer: AudioBuffer, cues: object }>} cues as actually used (snapped to the beat)
 */
export async function renderScore(o = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0
  const d = Number(o.duration)
  const duration = clamp(Number.isFinite(d) && d > 0 ? d : 42, 0.5, 120)
  const sr = clamp(Math.round(Number(o.sampleRate) || 48000), 8000, 192000)
  const mix = { ...SCORE_DEFAULTS }
  for (const k of Object.keys(mix)) {
    const v = Number(o.mix && o.mix[k])
    if (Number.isFinite(v)) mix[k] = clamp(v, -60, 24)
  }
  const cues = prepareCues(o.cues, duration)
  const { ev, secs, chords } = arrange(cues, duration)
  const N = Math.max(1, Math.round(duration * sr))
  const ir = makeIR(sr)
  const { dry, send, stems } = await mixStems(N, sr, ev, secs, mix, ir, !!o.debug)

  // the reverb (the only native DSP): send → convolver, then dry + wet in JS
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: N, sampleRate: sr })
  const src = new AudioBufferSourceNode(ctx, { buffer: send })
  src.connect(new ConvolverNode(ctx, { buffer: ir, disableNormalization: true })).connect(ctx.destination)
  src.start(0)
  const buffer = await ctx.startRendering()
  const L = buffer.getChannelData(0)
  const R = buffer.getChannelData(1)
  const fin = secs.find((s) => s.type === 'final')
  const from = fin ? Math.round((fin.t0 + 0.35) * sr) : N
  const kw = Math.exp(-1 / (TAIL_TAU * sr))
  const pre = dbToGain(MASTER_IN_DB)
  let w = 1
  for (let i = 0; i < N; i++) {
    if (i >= from) w *= kw
    L[i] = (dry[0][i] + L[i] * w) * pre
    R[i] = (dry[1][i] + R[i] * w) * pre
  }
  const dbg = {}
  master(L, R, sr, mix.level, dbg)

  const used = { ...cues, hits: [...cues.hits] }
  const res = { buffer, cues: used }
  const counts = Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, v.length]))
  if (o.debug) res.debug = { ...dbg, stems, chords, counts, sections: secs.map((s) => ({ type: s.type, t0: s.t0, t1: s.t1 })), ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) }
  return res
}
