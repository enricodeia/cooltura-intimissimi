// Small maths + the GSAP easing engine (every animation in the film is a pure
// function of time: value = lerp(a, b, ease(progress)), so scrubbing and the
// frame-exact export always agree).

import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

export const TAU = Math.PI * 2
export const DEG = Math.PI / 180
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, x) => (b === a ? (x >= b ? 1 : 0) : (x - a) / (b - a))
export const smooth = (t) => t * t * (3 - 2 * t)
export const fract = (x) => x - Math.floor(x)
export const mod = (x, m) => ((x % m) + m) % m

/** Deterministic 0..1 noise from an integer-ish seed. */
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}
export const hash2 = (a, b) => hash(a * 12.9898 + b * 78.233)

/** Wrap x into [-span/2, span/2). */
export const wrapSym = (x, span) => mod(x + span / 2, span) - span / 2

// ---------------------------------------------------------------- easing

const cache = new Map()
const linear = (x) => x

/** Easing function by GSAP name: 'power3.out', 'back.out(1.6)', 'elastic.out(1,0.5)', 'coolBounce', 'cubic(x1,y1,x2,y2)'. */
export function ease(name) {
  if (!name || name === 'none' || name === 'linear') return linear
  let f = cache.get(name)
  if (f) return f
  const cb = /^cubic\(([^)]+)\)$/.exec(name)
  if (cb) {
    const v = cb[1].split(',').map(Number)
    f = v.length === 4 && v.every(Number.isFinite) ? CustomEase.create('cb' + cache.size, v.join(',')) : linear
  } else {
    f = gsap.parseEase(name) || linear
  }
  cache.set(name, f)
  return f
}

/** Eased progress of t through [t0, t0 + d]. */
export function seg(t, t0, d, e = 'none') {
  const x = d <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / d)
  return ease(e)(x)
}

/** 0 → 1 over the `tin` seconds after t0, back to 0 over the `tout` seconds before t1. */
export function inOut(t, t0, t1, tin, tout, ein = 'power2.out', eout = 'power2.in') {
  const a = seg(t, t0, tin, ein)
  const b = 1 - seg(t, t1 - tout, tout, eout)
  return Math.min(a, b)
}

// Smooth curves only (V2: no overshoot, no bounce anywhere). Any GSAP name or
// cubic(x1,y1,x2,y2) typed in the panel still works.
export const EASES = [
  'none',
  'sine.inOut', 'power1.inOut', 'power2.inOut', 'power3.inOut', 'power4.inOut', 'expo.inOut', 'circ.inOut',
  'sine.out', 'power1.out', 'power2.out', 'power3.out', 'power4.out', 'expo.out', 'circ.out',
  'sine.in', 'power2.in', 'power3.in', 'power4.in', 'expo.in',
]

// ---------------------------------------------------------------- colour

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export const fmtTime = (t) => {
  const s = Math.max(0, t)
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`
}
