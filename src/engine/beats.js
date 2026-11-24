// Beat tracking, no dependencies: the tempo of a song, a fixed beat grid and the
// bar downbeats, so the editor can cut the film on the music.
//
//   analyzeBeats(audioBuffer, { minBpm, maxBpm, preferBpm })
//     → { bpm, beat, beat0, beats, downbeat0, bars, confidence, onset }
//   snapCuts(times, grid, { bars, min }) → the cut times moved onto the grid
//
// The method (every step measured by tools/beats-test.mjs, nothing heard):
//   1. mono, low-passed (three cascaded boxes) and decimated to ~11 kHz
//   2. onset strength: log-magnitude STFT (Hann 46 ms, hop 11.6 ms), the rectified
//      rise of every bin over a 3-bin max of the previous frame (no false onsets
//      from vibrato), summed in four bands (kick < 150 Hz < low-mid < 500 Hz < mid
//      < 2 kHz < high) each scaled to its own mean; minus a local mean, rectified
//   3. tempo: autocorrelation of the (lightly smoothed) onset strength, every lag
//      scored by the comb of its first 4 multiples × a log-normal prior around
//      preferBpm (σ = 1 octave)
//   4. exact period: the onset strength's spectrum at the tempo's first 4 harmonics
//      over the whole song (a zoom DFT), so the fixed grid does not drift
//   5. phase: the comb of beat times that collects the most onset strength, then the
//      attacks themselves: the beat-synchronous average of the low (< 150 Hz) and
//      high (> 1.8 kHz) band energies, the grid on their steepest rise
//   6. metrical level: kicks and snares alternate on the beats (the backbeat); when
//      they alternate clearly twice as fast (or half as fast) the tempo follows
//   7. downbeat: of the 4 bar phases, the one with the kicks on 1 and 3, the snares /
//      claps on 2 and 4, the stronger kick on 1 and the harmonic change on 1, every
//      cue weighed as a t statistic
//   8. confidence: the autocorrelation peak over its median (against lag 0) × the
//      squared fit of one fixed grid to the whole song (4-beat windows, σ = 25 ms):
//      no beat, rubato or a drifting tempo fall under 0.3
// The bpm is rounded to 2 decimals; beat, beat0 and the grids use the exact period.

const TAU = Math.PI * 2
const TARGET_SR = 11025 // the analysis rate (decimated)
const HOP_S = 0.0116 // onset frame hop (s)
const WIN_S = 0.0464 // STFT window (s)
const num = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(+v) ? d : +v)

// ---------------------------------------------------------------- FFT

const FFTS = new Map()

/**
 * In-place iterative radix-2 complex FFT of size n (a power of two ≥ 4), cached by size:
 * bit-reversal by a swap list, the first two stages as one radix-4 pass (twiddles 1, -i),
 * then one contiguous twiddle table per stage.
 */
function fftOf(n) {
  let f = FFTS.get(n)
  if (f) return f
  const bits = Math.round(Math.log2(n))
  const sw = []
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0, v = i; b < bits; b++, v >>= 1) r = (r << 1) | (v & 1)
    if (r > i) sw.push(i, r)
  }
  const swaps = Uint32Array.from(sw)
  const tw = []
  for (let size = 8; size <= n; size <<= 1) for (let j = 0; j < size >> 1; j++) tw.push(Math.cos((TAU * j) / size), Math.sin((TAU * j) / size))
  const W = Float64Array.from(tw)
  f = (re, im) => {
    for (let q = 0; q < swaps.length; q += 2) {
      const i = swaps[q]
      const j = swaps[q + 1]
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
    for (let i = 0; i < n; i += 4) {
      const ar = re[i] + re[i + 1]
      const ai = im[i] + im[i + 1]
      const br = re[i] - re[i + 1]
      const bi = im[i] - im[i + 1]
      const cr = re[i + 2] + re[i + 3]
      const ci = im[i + 2] + im[i + 3]
      const dr = re[i + 2] - re[i + 3]
      const di = im[i + 2] - im[i + 3]
      re[i] = ar + cr
      im[i] = ai + ci
      re[i + 2] = ar - cr
      im[i + 2] = ai - ci
      re[i + 1] = br + di
      im[i + 1] = bi - dr
      re[i + 3] = br - di
      im[i + 3] = bi + dr
    }
    for (let size = 8, o = 0; size <= n; o += size, size <<= 1) {
      const half = size >> 1
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const a = i + j
          const b = a + half
          const c = W[o + 2 * j]
          const s = W[o + 2 * j + 1]
          const xr = re[b]
          const xi = im[b]
          const tr = xr * c + xi * s
          const ti = xi * c - xr * s
          const ur = re[a]
          const ui = im[a]
          re[b] = ur - tr
          im[b] = ui - ti
          re[a] = ur + tr
          im[a] = ui + ti
        }
      }
    }
  }
  FFTS.set(n, f)
  return f
}

// ---------------------------------------------------------------- signal

/** Decimated outputs y[j0..j1) of the stereo (a + b) or mono (b = null) input: kernel k, step D, centre off. */
function decimateBlock(k, a, b, y, j0, j1, D, off, g) {
  const K = k.length
  for (let j = j0; j < j1; j++) {
    const base = j * D - off
    let s = 0
    if (b) for (let t = 0; t < K; t++) s += k[t] * (a[base + t] + b[base + t])
    else for (let t = 0; t < K; t++) s += k[t] * a[base + t]
    y[j] = s * g
  }
}

/** Mono mix, low-passed by three cascaded boxes of length D and decimated by D (~11 kHz). */
function monoDecimate(buf) {
  const sr = buf.sampleRate
  const C = Math.max(1, buf.numberOfChannels | 0)
  const n = buf.length | 0
  const D = Math.max(1, Math.round(sr / TARGET_SR))
  let k = new Float64Array([1])
  for (let s = 0; s < 3 && D > 1; s++) {
    const next = new Float64Array(k.length + D - 1)
    for (let i = 0; i < k.length; i++) for (let j = 0; j < D; j++) next[i + j] += k[i] / D
    k = next
  }
  const K = k.length
  const off = (K - 1) >> 1 // the kernel's centre (half an input sample early at most)
  const m = Math.max(1, Math.floor((n - 1) / D) + 1)
  const y = new Float32Array(m)
  // one or two channels are read in place; more are mixed down first
  let a = buf.getChannelData(0)
  const b = C === 2 ? buf.getChannelData(1) : null
  const g = 1 / C
  if (C > 2) {
    const mix = new Float32Array(n)
    for (let c = 0; c < C; c++) {
      const x = buf.getChannelData(c)
      for (let i = 0; i < n; i++) mix[i] += x[i]
    }
    a = mix
  }
  // the interior in blocks (a small hot function optimises early), the two edges bounds-checked
  const j0 = Math.min(m, Math.ceil(off / D))
  const j1 = Math.max(j0, Math.min(m, Math.floor((n - K + off) / D) + 1))
  for (let j = j0; j < j1; j += 65536) decimateBlock(k, a, b, y, j, Math.min(j1, j + 65536), D, off, g)
  for (const [p, q] of [
    [0, j0],
    [j1, m],
  ])
    for (let j = p; j < q; j++) {
      const base = j * D - off
      let s = 0
      for (let t = 0; t < K; t++) {
        const i = base + t
        if (i >= 0 && i < n) s += k[t] * (a[i] + (b ? b[i] : 0))
      }
      y[j] = s * g
    }
  return { x: y, fs: sr / D }
}

/** The level of the loud part (90th percentile of the RMS of 0.25 s blocks). */
function loudLevel(x, fs) {
  const L = Math.max(1, Math.round(fs * 0.25))
  const r = []
  for (let i = 0; i + L <= x.length; i += L) {
    let e = 0
    for (let j = i; j < i + L; j++) e += x[j] * x[j]
    r.push(Math.sqrt(e / L))
  }
  if (!r.length) {
    let e = 0
    for (let j = 0; j < x.length; j++) e += x[j] * x[j]
    return Math.sqrt(e / Math.max(1, x.length))
  }
  r.sort((p, q) => p - q)
  return r[Math.min(r.length - 1, Math.floor(r.length * 0.9))]
}

/** RBJ biquad coefficients [b0, b1, b2, a1, a2] (a0 = 1). */
function biquad(type, f0, fs, q = Math.SQRT1_2) {
  const w = (TAU * Math.min(f0, fs * 0.45)) / fs
  const cw = Math.cos(w)
  const al = Math.sin(w) / (2 * q)
  const a0 = 1 + al
  const lp = type === 'lp'
  const b0 = (lp ? (1 - cw) / 2 : (1 + cw) / 2) / a0
  const b1 = (lp ? 1 - cw : -(1 + cw)) / a0
  return [b0, b1, b0, (-2 * cw) / a0, (1 - al) / a0]
}

/** Biquad over src[i0, i1) into dst[0, i1 - i0): forward, then backward too (zero phase) unless `once`. */
function filtfilt(c, src, i0, i1, dst, once) {
  const [b0, b1, b2, a1, a2] = c
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  const n = i1 - i0
  for (let i = 0; i < n; i++) {
    const v = src[i0 + i]
    const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = v
    y2 = y1
    y1 = y
    dst[i] = y
  }
  if (once) return
  x1 = x2 = y1 = y2 = 0
  for (let i = n - 1; i >= 0; i--) {
    const v = dst[i]
    const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = v
    y2 = y1
    y1 = y
    dst[i] = y
  }
}

// ---------------------------------------------------------------- onset strength

const FLUX_BANDS = [30, 150, 500, 2000] // band edges (Hz): kick, low-mid, mid, high (to Nyquist)

/**
 * Log-magnitude STFT of the decimated signal (frames centred on t·hop) → per-band
 * spectral flux, a coarse log spectrum (4 bands per octave) and a chroma per frame.
 */
function spectralFeatures(x, fs, gain) {
  const N = Math.max(64, 2 ** Math.round(Math.log2(WIN_S * fs)))
  const H = Math.max(1, Math.round(HOP_S * fs))
  const T = Math.floor((x.length - 1) / H) + 1
  const nb = (N >> 1) + 1
  const win = new Float64Array(N)
  let wsum = 0
  for (let i = 0; i < N; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((TAU * i) / N)
    wsum += win[i]
  }
  const scale = (2 * gain) / wsum // a sinusoid of amplitude A (relative to the loud level) → A·gain
  const hz = fs / N
  const bin = (f) => Math.min(nb, Math.max(1, Math.ceil(f / hz)))
  // flux bands as bin ranges [fk0, fk1)
  const NB = FLUX_BANDS.length
  const fk0 = new Int32Array(NB)
  const fk1 = new Int32Array(NB)
  for (let j = 0; j < NB; j++) {
    fk0[j] = bin(FLUX_BANDS[j])
    fk1[j] = j + 1 < NB ? bin(FLUX_BANDS[j + 1]) : nb
  }
  // coarse spectrum: 4 bands per octave from 40 Hz (at least one bin each)
  const sk = [bin(40)]
  for (let j = 1; ; j++) {
    const k = Math.max(sk[sk.length - 1] + 1, bin(40 * 2 ** (j / 4)))
    if (k >= nb) break
    sk.push(k)
  }
  sk.push(nb)
  const J = sk.length - 1
  const skA = Int32Array.from(sk)
  // chroma: 250 Hz - 3 kHz, each bin split between its two nearest pitch classes
  const kc0 = bin(250)
  const kc1 = Math.min(nb, bin(3000))
  const cpc = new Int8Array(nb)
  const cnx = new Int8Array(nb)
  const cw = new Float64Array(nb)
  for (let k = kc0; k < kc1; k++) {
    const p = 12 * Math.log2((k * hz) / 440) + 69
    const lo = Math.floor(p)
    cpc[k] = ((lo % 12) + 12) % 12
    cnx[k] = (cpc[k] + 1) % 12
    cw[k] = 1 - (p - lo)
  }

  const flux = []
  for (let j = 0; j < NB; j++) flux.push(new Float32Array(T))
  const spec = new Float32Array(T * J)
  const chroma = new Float32Array(T * 12)
  const fft = fftOf(N)
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const magA = new Float64Array(nb)
  const magB = new Float64Array(nb)
  // log spectra of the last two frames, by frame parity (one zero past the end: the 3-bin max reads k + 1)
  const logs = [new Float64Array(nb + 1), new Float64Array(nb + 1)]
  const cacc = new Float64Array(12)
  const half = N >> 1

  const frame = (dst, t) => {
    const s0 = t * H - half
    if (s0 >= 0 && s0 + N <= x.length) for (let i = 0; i < N; i++) dst[i] = x[s0 + i] * win[i]
    else
      for (let i = 0; i < N; i++) {
        const s = s0 + i
        dst[i] = s >= 0 && s < x.length ? x[s] * win[i] : 0
      }
  }
  const onFrame = (t, mag) => {
    const cur = logs[t & 1]
    const prev = logs[(t & 1) ^ 1]
    for (let k = 0; k < nb; k++) cur[k] = Math.log(1 + mag[k] * scale)
    if (t > 0)
      for (let j = 0; j < NB; j++) {
        let s = 0
        // branchless (Math.max): audio makes the branches unpredictable
        for (let k = fk0[j], e = fk1[j]; k < e; k++) s += Math.max(0, cur[k] - Math.max(Math.max(prev[k - 1], prev[k]), prev[k + 1]))
        flux[j][t] = s / Math.max(1, fk1[j] - fk0[j])
      }
    const so = t * J
    for (let j = 0; j < J; j++) {
      let s = 0
      for (let k = skA[j], e = skA[j + 1]; k < e; k++) s += cur[k]
      spec[so + j] = s / (skA[j + 1] - skA[j])
    }
    cacc.fill(0)
    for (let k = kc0; k < kc1; k++) {
      const v = cur[k]
      const w = cw[k]
      cacc[cpc[k]] += v * w
      cacc[cnx[k]] += v - v * w
    }
    const co = t * 12
    for (let c = 0; c < 12; c++) chroma[co + c] = cacc[c]
  }

  for (let t = 0; t < T; t += 2) {
    frame(re, t)
    if (t + 1 < T) frame(im, t + 1)
    else im.fill(0)
    fft(re, im)
    // two real frames from one complex FFT
    for (let k = 0; k < nb; k++) {
      const k2 = (N - k) & (N - 1)
      const ar = re[k] + re[k2]
      const ai = im[k] - im[k2]
      const br = im[k] + im[k2]
      const bi = re[k2] - re[k]
      magA[k] = 0.5 * Math.sqrt(ar * ar + ai * ai)
      magB[k] = 0.5 * Math.sqrt(br * br + bi * bi)
    }
    onFrame(t, magA)
    if (t + 1 < T) onFrame(t + 1, magB)
  }
  return { T, H, N, fps: fs / H, hop: H / fs, flux, spec, J, chroma }
}

/** Weighted sum of the band fluxes (each over its own mean), minus a centred moving mean, rectified. */
function onsetEnvelope(flux, weights, fps) {
  const T = flux[0].length
  const e = new Float64Array(T)
  for (let b = 0; b < flux.length; b++) {
    const f = flux[b]
    let m = 0
    for (let t = 0; t < T; t++) m += f[t]
    m = m / T + 1e-12
    const w = weights[b] / m
    if (w) for (let t = 0; t < T; t++) e[t] += f[t] * w
  }
  const R = Math.max(1, Math.round(0.15 * fps)) // ±150 ms
  const cum = new Float64Array(T + 1)
  for (let t = 0; t < T; t++) cum[t + 1] = cum[t] + e[t]
  const out = new Float64Array(T)
  for (let t = 0; t < T; t++) {
    const a = Math.max(0, t - R)
    const b = Math.min(T, t + R + 1)
    const v = e[t] - (cum[b] - cum[a]) / (b - a)
    out[t] = v > 0 ? v : 0
  }
  return out
}

// ---------------------------------------------------------------- tempo

/** Log-normal tempo prior (σ in octaves). */
const prior = (bpm, prefer, sigma = 1) => {
  const l = Math.log2(bpm / prefer) / sigma
  return Math.exp(-0.5 * l * l)
}

/** Parabolic vertex offset (-0.5..0.5) through three samples. */
function vertex(a, b, c) {
  const d = a - 2 * b + c
  if (!(d < 0)) return 0
  const v = (0.5 * (a - c)) / d
  return v > 0.5 ? 0.5 : v < -0.5 ? -0.5 : v
}

/**
 * Tempo from the autocorrelation of the onset strength: every lag in range scored
 * by the comb of its first four multiples, times the prior. → the period (frames,
 * sub-frame), the normalised autocorrelation and the confidence.
 */
function tempoOf(e, fps, minBpm, maxBpm, preferBpm) {
  const T = e.length
  // Gaussian-smoothed (σ = 1.5 frames): the peaks of the autocorrelation get wide enough
  // to be sampled at integer lags (a lag of 35.5 frames would lose 20 % of a sharp peak)
  const G = [1, 0.8007, 0.4111, 0.1353, 0.0286]
  const gs = G[0] + 2 * (G[1] + G[2] + G[3] + G[4])
  const z = new Float64Array(T)
  let mean = 0
  for (let t = 0; t < T; t++) {
    let v = e[t] * G[0]
    for (let j = 1; j < G.length; j++) v += ((t - j >= 0 ? e[t - j] : 0) + (t + j < T ? e[t + j] : 0)) * G[j]
    z[t] = v / gs
    mean += z[t]
  }
  mean /= T
  for (let t = 0; t < T; t++) z[t] -= mean
  const lagLo = Math.max(2, Math.floor((60 * fps) / maxBpm))
  const lagHi = Math.max(lagLo + 1, Math.ceil((60 * fps) / minBpm))
  const maxLag = Math.min(T - 2, 4 * lagHi + 8)
  const ac = new Float64Array(maxLag + 1)
  for (let L = 0; L <= maxLag; L++) {
    let s = 0
    for (let t = 0, n = T - L; t < n; t++) s += z[t] * z[t + L]
    ac[L] = s / (T - L)
  }
  const a0 = ac[0] > 0 ? ac[0] : 1
  for (let L = 0; L <= maxLag; L++) ac[L] /= a0
  const near = (c, w) => {
    const a = Math.max(0, Math.ceil(c - w))
    const b = Math.min(maxLag, Math.floor(c + w))
    let m = -Infinity
    for (let i = a; i <= b; i++) if (ac[i] > m) m = ac[i]
    return m === -Infinity ? 0 : m
  }
  const hi = Math.min(lagHi, maxLag)
  const score = new Float64Array(hi + 1)
  const comb = new Float64Array(hi + 1)
  let best = -1
  for (let L = lagLo; L <= hi; L++) {
    let s = 0
    let n = 0
    for (let m = 1; m <= 4; m++) {
      if (m * L > maxLag + 1) break
      s += near(m * L, 0.5 * (m - 1))
      n++
    }
    comb[L] = n ? s / n : 0
    score[L] = Math.max(0, comb[L]) * prior((60 * fps) / L, preferBpm)
    if (best < 0 || score[L] > score[best]) best = L
  }
  // the autocorrelation peak next to the best lag, sub-frame
  let pk = best
  for (let L = Math.max(1, best - 2); L <= Math.min(maxLag - 1, best + 2); L++) if (ac[L] > ac[pk]) pk = L
  const P0 = pk + (pk > 0 && pk < maxLag ? vertex(ac[pk - 1], ac[pk], ac[pk + 1]) : 0)
  // confidence: the peak over the median of the lag range, against lag 0
  const range = Array.from(ac.subarray(lagLo, hi + 1)).sort((p, q) => p - q)
  const med = range[range.length >> 1]
  const conf = Math.max(0, Math.min(1, (ac[pk] - med) / Math.max(1e-9, 1 - med)))
  return { P0, conf }
}

/**
 * The exact period near P0 (frames): the peak of Σ_h |DFT(e)(h / P)|² over the first H
 * harmonics (a zoom DFT on half-beat blocks, ±span). Songs longer than SEG frames: first
 * the powers of SEG-long pieces summed (a coarse peak), then the whole song coherently
 * around it, so the cost stays linear in the length.
 */
function zoomPeriod(e, P0, span = 0.04, H = 4) {
  const SEG = 24000 // frames (~4.6 min)
  const T = e.length
  const B = Math.max(1, Math.round(P0 / 2))
  const J = Math.ceil(T / B)
  const yr = new Float64Array(H * J)
  const yi = new Float64Array(H * J)
  for (let h = 1; h <= H; h++) {
    const w = (TAU * h) / P0
    const cw = Math.cos(w)
    const sw = Math.sin(w)
    const o = (h - 1) * J
    for (let j = 0; j < J; j++) {
      let sr = 0
      let si = 0
      // exp(-i w t) by rotation from the block start
      let c = Math.cos(w * j * B)
      let s = Math.sin(w * j * B)
      for (let t = j * B, t1 = Math.min(T, t + B); t < t1; t++) {
        sr += e[t] * c
        si -= e[t] * s
        const c2 = c * cw - s * sw
        s = s * cw + c * sw
        c = c2
      }
      yr[o + j] = sr
      yi[o + j] = si
    }
  }
  // Σ_h |Σ_j y_h[j] exp(-i 2π h d t_j)|² over blocks [j0, j1), t_j = the block's centre
  const power = (d, j0, j1) => {
    let z = 0
    for (let h = 1; h <= H; h++) {
      const o = (h - 1) * J
      const w = TAU * h * d
      let c = Math.cos(w * (j0 * B + (B - 1) / 2))
      let s = Math.sin(w * (j0 * B + (B - 1) / 2))
      const cw = Math.cos(w * B)
      const sw = Math.sin(w * B)
      let ar = 0
      let ai = 0
      for (let j = j0; j < j1; j++) {
        const r = yr[o + j]
        const q = yi[o + j]
        ar += r * c + q * s
        ai += q * c - r * s
        const c2 = c * cw - s * sw
        s = s * cw + c * sw
        c = c2
      }
      z += ar * ar + ai * ai
    }
    return z
  }
  // the peak of z(d) on d = d0 + i·df, i = -n..n, sub-step; null at the edge of the range
  const peak = (d0, df, n, z) => {
    const Z = new Float64Array(2 * n + 1)
    let bi = 0
    for (let i = -n; i <= n; i++) {
      Z[i + n] = z(d0 + i * df)
      if (Z[i + n] > Z[bi]) bi = i + n
    }
    if (bi === 0 || bi === 2 * n) return null
    const lg = (v) => Math.log(v + 1e-300)
    return d0 + (bi - n + vertex(lg(Z[bi - 1]), lg(Z[bi]), lg(Z[bi + 1]))) * df
  }
  const f0 = 1 / P0
  const segJ = Math.max(1, Math.ceil(Math.min(T, SEG) / B))
  const df1 = 1 / (4 * H * Math.min(T, SEG)) // a quarter of a piece's narrowest main lobe
  const d1 = peak(0, df1, Math.ceil((span * f0) / df1), (d) => {
    let z = 0
    for (let j0 = 0; j0 < J; j0 += segJ) z += power(d, j0, Math.min(J, j0 + segJ))
    return z
  })
  if (d1 === null) return null
  if (T <= SEG) return 1 / (f0 + d1)
  const df2 = 1 / (4 * H * T)
  const d2 = peak(d1, df2, Math.ceil((2 * df1) / df2), (d) => power(d, 0, J))
  return 1 / (f0 + (d2 === null ? d1 : d2))
}

/** Linear interpolation of e at fractional index t (0 outside). */
function at(e, t) {
  const i = Math.floor(t)
  if (i < 0 || i + 1 >= e.length) return i >= 0 && i < e.length ? e[i] : 0
  const f = t - i
  return e[i] + (e[i + 1] - e[i]) * f
}

/** The phase (frames, 0..P) whose comb of beats collects the most onset strength. */
function combPhase(e, P, step = 0.25) {
  const T = e.length
  const n = Math.max(1, Math.ceil(P / step))
  const F = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const ph = i * step
    let s = 0
    for (let t = ph; t < T - 1; t += P) s += at(e, t)
    F[i] = s
  }
  let bi = 0
  for (let i = 1; i < n; i++) if (F[i] > F[bi]) bi = i
  return (bi + vertex(F[(bi - 1 + n) % n], F[bi], F[(bi + 1) % n])) * step
}

/**
 * How well one fixed grid fits the whole song. In windows of 4 beats: the local phase
 * (±0.45 beat, sub-frame) that collects the most onset strength, its distance δ from the
 * grid scored exp(-δ²/2σ²) with σ = 25 ms, weighted by how much that window's best phase
 * stands out → 0..1 (a drifting tempo, rubato or a second tempo section lowers it).
 */
function gridFit(e, P, phase, hop) {
  const T = e.length
  const R = Math.max(1, Math.floor(0.45 * P))
  const S = new Float64Array(2 * R + 1)
  const sig = 0.025 / hop
  let num = 0
  let den = 0
  for (let k0 = 0; phase + k0 * P < T; k0 += 4) {
    let bi = 0
    let mean = 0
    for (let d = -R; d <= R; d++) {
      let sum = 0
      for (let k = k0; k < k0 + 4; k++) sum += at(e, phase + k * P + d)
      S[d + R] = sum
      mean += sum
      if (sum > S[bi]) bi = d + R
    }
    mean /= 2 * R + 1
    const w = S[bi] - mean
    if (!(w > 0)) continue
    const v = bi > 0 && bi < 2 * R ? vertex(S[bi - 1], S[bi], S[bi + 1]) : 0
    const delta = bi - R + v
    num += w * Math.exp((-0.5 * delta * delta) / (sig * sig))
    den += w
  }
  return den > 0 ? num / den : 0
}

// ---------------------------------------------------------------- attacks (time domain)

const LOW_HZ = 150 // kick band: below
const HIGH_HZ = 1800 // snare / clap band: above
const SCAN = 0.045 // ±45 ms around every beat
const SCAN_STEP = 0.0005 // 0.5 ms

/**
 * The low (< 150 Hz) and high (> 1.8 kHz) band energies around the given times (s),
 * zero-phase filtered on a short segment each:
 *   e{L,H}{0,1}  mean energy 45-8 ms before / 2-45 ms after every time (the step)
 *   avg{L,H}     (curves) the mean log energy on a 0.5 ms grid ±45 ms: the beat-synchronous average
 */
function attackScan(x, fs, times, level, curves) {
  const nD = Math.round((2 * SCAN) / SCAN_STEP) + 1
  const wL = Math.max(1, Math.round(0.004 * fs)) // ±4 ms energy window, low band
  const wH = Math.max(1, Math.round(0.001 * fs)) // ±1 ms, high band
  const lp = biquad('lp', LOW_HZ, fs)
  const hp = biquad('hp', HIGH_HZ, fs)
  const floor = level * level * 1e-6
  const pre = Math.round((SCAN + 0.03) * fs) + wL // 30 ms of filter warm-up
  const post = Math.round(SCAN * fs) + wL + 2
  const segN = pre + post
  const bl = new Float64Array(segN)
  const bh = new Float64Array(segN)
  const cl = new Float64Array(segN + 1)
  const ch = new Float64Array(segN + 1)
  const n = times.length
  const eL0 = new Float64Array(n).fill(NaN)
  const eL1 = new Float64Array(n).fill(NaN)
  const eH0 = new Float64Array(n).fill(NaN)
  const eH1 = new Float64Array(n).fill(NaN)
  const avgL = new Float64Array(nD)
  const avgH = new Float64Array(nD)
  const a0 = pre - Math.round(0.045 * fs)
  const a1 = pre - Math.round(0.008 * fs)
  const b0 = pre + Math.round(0.002 * fs)
  const b1 = pre + Math.round(0.045 * fs)
  let used = 0
  for (let k = 0; k < n; k++) {
    const c = Math.round(times[k] * fs)
    const i0 = c - pre
    const i1 = c + post
    if (i0 < 0 || i1 > x.length) continue
    // the curves need zero phase; the steps (37-43 ms windows) do not mind 1.5 ms of delay
    filtfilt(lp, x, i0, i1, bl, !curves)
    filtfilt(hp, x, i0, i1, bh, !curves)
    for (let i = 0; i < segN; i++) {
      cl[i + 1] = cl[i] + bl[i] * bl[i]
      ch[i + 1] = ch[i] + bh[i] * bh[i]
    }
    eL0[k] = (cl[a1] - cl[a0]) / (a1 - a0)
    eL1[k] = (cl[b1] - cl[b0]) / (b1 - b0)
    eH0[k] = (ch[a1] - ch[a0]) / (a1 - a0)
    eH1[k] = (ch[b1] - ch[b0]) / (b1 - b0)
    if (curves) {
      for (let d = 0; d < nD; d++) {
        const s = Math.round((times[k] - SCAN + d * SCAN_STEP) * fs) - i0
        avgL[d] += 10 * Math.log10((cl[s + wL + 1] - cl[s - wL]) / (2 * wL + 1) + floor)
        avgH[d] += 10 * Math.log10((ch[s + wH + 1] - ch[s - wH]) / (2 * wH + 1) + floor)
      }
    }
    used++
  }
  if (curves && used)
    for (let d = 0; d < nD; d++) {
      avgL[d] /= used
      avgH[d] /= used
    }
  return { eL0, eL1, eH0, eH1, avgL, avgH, used }
}

// The steepest rise of a log energy leads the attack: it comes as soon as the energy window
// (±4 ms low, ±1 ms high) and the filter's spread first touch it. Measured on isolated
// sounds at known times (44.1 and 48 kHz, with and without noise): low band -4.5 ms on a
// sharp kick, -3.5 ms on an 808 with a 3 ms attack; high band -0.5..-1 ms on snares, hats.
const RISE_LEAD = [0.004, 0.00075]

/**
 * The attack in the beat-synchronous average: per band the steepest rise of the log
 * energy (2 ms difference, sub-step), corrected by RISE_LEAD, the bands weighted by their
 * total rise (dB). → seconds from the beat times scanned (0 when nothing rises). The
 * steepest rise, not the half-way point: it stays put when the audio is shifted or cut.
 */
function riseOffset(sc) {
  const nD = sc.avgL.length
  const mid = (nD - 1) >> 1
  const iPre = Math.round(0.035 / SCAN_STEP)
  const i3 = Math.round(0.003 / SCAN_STEP)
  const g = Math.round(0.001 / SCAN_STEP)
  const lim = Math.round(0.035 / SCAN_STEP)
  const D = new Float64Array(nD)
  let num = 0
  let den = 0
  for (const [band, avg] of [sc.avgL, sc.avgH].entries()) {
    let p0 = 0
    let p1 = 0
    for (let d = 0; d < iPre; d++) {
      p0 += avg[d]
      p1 += avg[mid + i3 + d]
    }
    const rise = (p1 - p0) / iPre // dB
    if (!(rise > 0.5)) continue
    let best = -1
    for (let d = Math.max(g, mid - lim); d <= Math.min(nD - 1 - g, mid + lim); d++) {
      D[d] = avg[d + g] - avg[d - g]
      if (best < 0 || D[d] > D[best]) best = d
    }
    if (!(D[best] > 0)) continue
    const v = vertex(D[best - 1] ?? D[best], D[best], D[best + 1] ?? D[best])
    num += rise * ((best + v - mid) * SCAN_STEP + RISE_LEAD[band])
    den += rise
  }
  return den > 0 ? num / den : 0
}

/** Per-time steps of the two bands, over the band's local level (±R entries): kick and snare evidence. */
function steps(sc, R) {
  const n = sc.eL0.length
  const out = { kick: new Float64Array(n), snare: new Float64Array(n) }
  for (const [e0, e1, dst] of [
    [sc.eL0, sc.eL1, out.kick],
    [sc.eH0, sc.eH1, out.snare],
  ]) {
    const lv = new Float64Array(n + 1)
    const cnt = new Float64Array(n + 1)
    for (let i = 0; i < n; i++) {
      const ok = Number.isFinite(e0[i])
      lv[i + 1] = lv[i] + (ok ? 0.5 * (e0[i] + e1[i]) : 0)
      cnt[i + 1] = cnt[i] + (ok ? 1 : 0)
    }
    const tot = lv[n] / Math.max(1, cnt[n])
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(e0[i])) {
        dst[i] = NaN
        continue
      }
      const a = Math.max(0, i - R)
      const b = Math.min(n, i + R + 1)
      const m = (lv[b] - lv[a]) / Math.max(1, cnt[b] - cnt[a])
      dst[i] = (e1[i] - e0[i]) / (m + tot * 1e-3 + 1e-30)
    }
  }
  return out
}

// ---------------------------------------------------------------- metre

const zscore = (a) => {
  let m = 0
  let n = 0
  for (const v of a) {
    if (!Number.isFinite(v)) continue
    m += v
    n++
  }
  m /= Math.max(1, n)
  let s = 0
  for (const v of a) if (Number.isFinite(v)) s += (v - m) * (v - m)
  s = Math.sqrt(s / Math.max(1, n)) || 1
  return Array.from(a, (v) => (Number.isFinite(v) ? (v - m) / s : NaN))
}

/**
 * Backbeat: kicks on one parity of the beats, snares on the other. cls(i) → 0 / 1 (the
 * parity of entry i) or -1 (not a beat at this level). → √(Δkick·Δsnare) when kicks and
 * snares favour opposite parities, else 0 (a lone accent is not a backbeat).
 */
function backbeat(kz, sz, cls) {
  const k = [0, 0]
  const sn = [0, 0]
  const n = [0, 0]
  for (let i = 0; i < kz.length; i++) {
    const c = cls(i)
    if (c < 0 || !Number.isFinite(kz[i]) || !Number.isFinite(sz[i])) continue
    k[c] += kz[i]
    sn[c] += sz[i]
    n[c]++
  }
  if (!n[0] || !n[1]) return 0
  const dk = k[0] / n[0] - k[1] / n[1]
  const ds = sn[1] / n[1] - sn[0] / n[0]
  return dk * ds > 0 ? Math.sqrt(dk * ds) : 0
}

/** Per-beat mean of a frame feature (dim d) over [b_k, b_k+1). */
function perBeat(feat, d, T, hop, beat0, P, K) {
  const out = new Float64Array(K * d)
  for (let k = 0; k < K; k++) {
    const a = Math.max(0, Math.ceil((beat0 + k * P) / hop))
    const b = Math.min(T, Math.ceil((beat0 + (k + 1) * P) / hop))
    if (b <= a) continue
    for (let t = a; t < b; t++) for (let j = 0; j < d; j++) out[k * d + j] += feat[t * d + j]
    for (let j = 0; j < d; j++) out[k * d + j] /= b - a
  }
  return out
}

/** 1 - cosine similarity of the 2-beat windows before and after each beat (mean-removed vectors if `center`). */
function novelty(v, d, K, center) {
  const nov = new Float64Array(K).fill(NaN)
  const A = new Float64Array(d)
  const B = new Float64Array(d)
  for (let k = 2; k + 1 < K; k++) {
    let ma = 0
    let mb = 0
    for (let j = 0; j < d; j++) {
      A[j] = v[(k - 2) * d + j] + v[(k - 1) * d + j]
      B[j] = v[k * d + j] + v[(k + 1) * d + j]
      ma += A[j]
      mb += B[j]
    }
    ma = center ? ma / d : 0
    mb = center ? mb / d : 0
    let ab = 0
    let aa = 0
    let bb = 0
    for (let j = 0; j < d; j++) {
      const p = A[j] - ma
      const q = B[j] - mb
      ab += p * q
      aa += p * p
      bb += q * q
    }
    nov[k] = aa > 0 && bb > 0 ? 1 - ab / Math.sqrt(aa * bb) : NaN
  }
  return nov
}

/** Welch t of the mean of v at bar positions `A` against positions `B` (positions j = (k - p) mod 4). */
function tPos(v, p, A, B) {
  let sa = 0
  let qa = 0
  let na = 0
  let sb = 0
  let qb = 0
  let nb = 0
  for (let k = 0; k < v.length; k++) {
    const x = v[k]
    if (!Number.isFinite(x)) continue
    const j = (((k - p) % 4) + 4) % 4
    if (A.includes(j)) {
      sa += x
      qa += x * x
      na++
    } else if (B.includes(j)) {
      sb += x
      qb += x * x
      nb++
    }
  }
  if (na < 2 || nb < 2) return 0
  const ma = sa / na
  const mb = sb / nb
  const va = Math.max(0, qa / na - ma * ma) / (na - 1)
  const vb = Math.max(0, qb / nb - mb * mb) / (nb - 1)
  return (ma - mb) / Math.sqrt(va + vb + 1e-12 * (ma * ma + mb * mb) + 1e-30)
}

/**
 * The bar phase (0..3) of beat 0, every cue as a t statistic (how sure, not how big):
 *   kicks on 1 and 3, snares on 2 and 4 (which pair of beats starts the half bars),
 *   the kick on 1 stronger than on 3, the harmony (chroma) and the spectrum changing on 1.
 */
function barPhase(kick, snare, chromaNov, specNov) {
  const T = 6 // a t this large is beyond doubt: cap it so one cue cannot drown the others
  const cap = (t) => Math.max(-T, Math.min(T, t))
  const scores = []
  for (let p = 0; p < 4; p++) {
    const cues = {
      kick13: cap(tPos(kick, p, [0, 2], [1, 3])),
      snare24: cap(tPos(snare, p, [1, 3], [0, 2])),
      kick1: cap(tPos(kick, p, [0], [2])),
      chroma1: cap(tPos(chromaNov, p, [0], [1, 2, 3])),
      spec1: cap(tPos(specNov, p, [0], [1, 2, 3])),
    }
    let total = 0
    for (const v of Object.values(cues)) total += v
    scores.push({ p, total, cues })
  }
  let best = 0
  for (let p = 1; p < 4; p++) if (scores[p].total > scores[best].total) best = p
  return best
}

// ---------------------------------------------------------------- the analysis

function grid(beat0, beat, duration, every = 1) {
  const out = []
  for (let k = 0; beat0 + k * beat * every < duration - 1e-9; k++) out.push(Math.round((beat0 + k * beat * every) * 1e5) / 1e5)
  return out
}

function result(bpmExact, beat0, duration, p, confidence, onset) {
  const beat = 60 / bpmExact
  const b0 = ((beat0 % beat) + beat) % beat
  const downbeat0 = b0 + p * beat
  return {
    bpm: Math.round(bpmExact * 100) / 100,
    beat,
    beat0: Math.round(b0 * 1e5) / 1e5,
    beats: grid(b0, beat, duration),
    downbeat0: Math.round(downbeat0 * 1e5) / 1e5,
    bars: grid(downbeat0, beat, duration, 4),
    confidence: Math.round(confidence * 1000) / 1000,
    onset,
  }
}

/**
 * Tempo, beat grid and bar downbeats of a song.
 * @param {{ sampleRate: number, numberOfChannels: number, length: number, getChannelData(c: number): Float32Array }} buf  an AudioBuffer (or the same shape)
 * @param {{ minBpm?: number, maxBpm?: number, preferBpm?: number }} [o]  defaults 70 / 180 / 120 (a gentle log-normal prior around preferBpm)
 * @returns {{ bpm: number, beat: number, beat0: number, beats: number[], downbeat0: number, bars: number[], confidence: number, onset?: { hop: number, env: Float32Array } }}
 */
export function analyzeBeats(buf, o) {
  const opt = o || {}
  const minBpm = Math.max(20, num(opt.minBpm, 70))
  const maxBpm = Math.max(minBpm * 1.05, num(opt.maxBpm, 180))
  const preferBpm = Math.max(1, num(opt.preferBpm, 120))
  const sr = Number(buf && buf.sampleRate)
  const duration = sr > 0 ? (Number(buf.length) || 0) / sr : 0
  // too short or silent: the preferred tempo from 0, confidence 0
  const fallback = () => result(Math.min(maxBpm, Math.max(minBpm, preferBpm)), 0, duration, 0, 0, undefined)
  if (!(duration >= 2)) return fallback()
  const { x, fs } = monoDecimate(buf)
  const level = loudLevel(x, fs)
  if (!(level > 1e-6)) return fallback()

  // onset strength: all bands alike for the tempo, the kick band doubled for the phase
  const F = spectralFeatures(x, fs, 100 / level)
  const env = onsetEnvelope(F.flux, [1, 1, 1, 1], F.fps)
  const envPh = onsetEnvelope(F.flux, [2, 1, 1, 0.5], F.fps)
  const tp = tempoOf(env, F.fps, minBpm, maxBpm, preferBpm)
  let P = (zoomPeriod(env, tp.P0) || tp.P0) * F.hop // the period (s)

  // phase: the comb on the onset strength, then the attacks. The flux of frame t (centred on
  // t·hop) peaks for an attack 0.35 frame (4 ms) after the frame's centre: measured (from
  // -0.5 frame the attacks moved the grid by +3..+15 ms on every test signal; from 0.35 they
  // move it by -3..+4.4 ms, mean +1.2, on the synthetic tracks, the score and two songs)
  const FLUX_LAG = 0.35
  let phase = (combPhase(envPh, P / F.hop) + FLUX_LAG) * F.hop
  const times = (start, step) => {
    const out = []
    const t0 = ((start % P) + P) % P // entry 0 is always a beat
    for (let i = 0; t0 + i * step < duration; i++) out.push(t0 + i * step)
    return out
  }
  phase += riseOffset(attackScan(x, fs, times(phase, P), level, true))
  phase = ((phase % P) + P) % P

  // the metrical level: is the backbeat clearer twice as fast, or half as fast?
  const hbT = times(phase, P / 2)
  const hb = steps(attackScan(x, fs, hbT, level, false), Math.round(8 / (P / 2)))
  const kz = zscore(hb.kick)
  const sz = zscore(hb.snare)
  const bbP = backbeat(kz, sz, (i) => (i % 2 ? -1 : (i / 2) % 2))
  const bbFast = backbeat(kz, sz, (i) => i % 2)
  const bbSlow = [0, 2].map((q) => backbeat(kz, sz, (i) => (i < q || (i - q) % 4 ? -1 : ((i - q) / 4) % 2)))
  let pick = (i) => i % 2 === 0 // the half-beat entries that are beats
  if ((60 / P) * 2 <= maxBpm && bbFast > bbP + 0.25 && bbFast > 0.5) {
    P /= 2
    pick = () => true
  } else if (60 / P / 2 >= minBpm && Math.max(...bbSlow) > bbP + 0.5 && Math.max(...bbSlow) > 0.8) {
    const q = bbSlow[1] > bbSlow[0] ? 2 : 0
    P *= 2
    pick = (i) => i >= q && (i - q) % 4 === 0
  }
  const first = hbT.findIndex((_, i) => pick(i))
  const beat0 = (((first >= 0 ? hbT[first] : phase) % P) + P) % P

  // the bar: per-beat kick / snare steps (index k ↔ beat0 + k·P), chroma and spectrum
  const K = Math.max(0, Math.floor((duration - beat0) / P - 1e-9) + 1)
  const kick = new Float64Array(K).fill(NaN)
  const snare = new Float64Array(K).fill(NaN)
  hbT.forEach((t, i) => {
    const k = Math.round((t - beat0) / P)
    if (pick(i) && k >= 0 && k < K) {
      kick[k] = hb.kick[i]
      snare[k] = hb.snare[i]
    }
  })
  const chromaNov = novelty(perBeat(F.chroma, 12, F.T, F.hop, beat0, P, K), 12, K, false)
  const specNov = novelty(perBeat(F.spec, F.J, F.T, F.hop, beat0, P, K), F.J, K, true)
  const bar = barPhase(kick, snare, chromaNov, specNov)

  // confidence: the autocorrelation peak × how well one fixed grid fits the whole song, squared
  const fit = gridFit(env, P / F.hop, beat0 / F.hop - FLUX_LAG, F.hop)
  // the onset strength for the UI: aligned to i·hop, 0..1
  let mx = 0
  for (let t = 0; t < env.length; t++) if (env[t] > mx) mx = env[t]
  const out = new Float32Array(env.length)
  for (let i = 0; i < out.length; i++) out[i] = at(env, i - FLUX_LAG) / (mx || 1)
  return result(60 / P, beat0, duration, bar, tp.conf * fit * fit, { hop: F.hop, env: out })
}

/**
 * Snap a sequence of cut times (seconds, increasing) to a grid: each to the nearest
 * beat (or bar where `bars` says so), never two on the same beat, never earlier than
 * the previous + min. Returns new times.
 * @param {number[]} times
 * @param {{ beat: number, beat0: number, downbeat0?: number }} grid  analyzeBeats' result, or a synthetic { beat, beat0 }
 * @param {{ bars?: boolean[], min?: number }} [opts]
 * @returns {number[]}
 */
export function snapCuts(times, grid, { bars = [], min = 0.25 } = {}) {
  const beat = Number(grid && grid.beat)
  const beat0 = Number(grid && grid.beat0) || 0
  if (!(beat > 0) || !Array.isArray(times)) return Array.isArray(times) ? times.slice() : []
  const down0 = Number.isFinite(Number(grid.downbeat0)) ? Number(grid.downbeat0) : beat0
  const dk = Math.round((down0 - beat0) / beat) // beat index of the first downbeat
  const gap = Math.max(0, Number(min) || 0)
  const onBar = Array.isArray(bars) ? bars : []
  const T = (k) => beat0 + k * beat
  const out = []
  let prev = -Infinity
  let prevK = -Infinity
  for (let i = 0; i < times.length; i++) {
    // the first beat index allowed after the previous cut (a time that is not a number goes there)
    const lo = Math.max(prevK + 1, Math.ceil((prev + gap - beat0) / beat - 1e-9), 0)
    const t = Number.isFinite(Number(times[i])) ? Number(times[i]) : T(lo)
    let k = -1
    if (onBar[i]) {
      // the nearest downbeat within half a bar, if it is allowed
      const m = Math.round((t - T(dk)) / (4 * beat))
      for (const mm of [m, m + 1, m - 1]) {
        const kk = dk + 4 * mm
        if (kk >= lo && Math.abs(T(kk) - t) <= 2 * beat + 1e-9 && (k < 0 || Math.abs(T(kk) - t) < Math.abs(T(k) - t))) k = kk
      }
    }
    if (k < 0) k = Math.max(lo, Math.round((t - beat0) / beat))
    const v = T(k)
    out.push(Math.round(v * 1e6) / 1e6)
    prev = v
    prevK = k
  }
  return out
}
