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
  } else if (CUSTOM_EASES[name]) {
    f = CustomEase.get(name) || gsap.parseEase(name) || linear
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

// The film's own curves, made with GSAP CustomEase (motion best practice:
// entrances decelerate, exits accelerate, moves ease both ways; no overshoot,
// no bounce). They are GSAP eases like any other: ease('ci.reveal').
export const CUSTOM_EASES = {
  'ci.reveal': { bez: [0.16, 1, 0.3, 1], label: 'Reveal · entra e si posa' },
  'ci.soft': { bez: [0.33, 1, 0.68, 1], label: 'Soft out · più morbido' },
  'ci.emph': { bez: [0.05, 0.7, 0.1, 1], label: 'Enfasi · scatto e frenata lunga' },
  'ci.glide': { bez: [0.76, 0, 0.24, 1], label: 'Glide · movimenti, camera' },
  'ci.swift': { bez: [0.65, 0, 0.35, 1], label: 'Swift · in-out deciso' },
  'ci.exit': { bez: [0.55, 0, 0.8, 0.3], label: 'Exit · accelera e va' },
  'ci.accel': { bez: [0.55, 0, 1, 0.45], label: 'Accelera · corsa finale' },
}
for (const [name, e] of Object.entries(CUSTOM_EASES)) CustomEase.create(name, e.bez.join(','))

// Smooth curves only (no overshoot, no bounce anywhere). Any GSAP name or
// cubic(x1,y1,x2,y2) typed in the panel still works.
export const EASES = [
  'none',
  ...Object.keys(CUSTOM_EASES),
  'sine.inOut', 'power1.inOut', 'power2.inOut', 'power3.inOut', 'power4.inOut', 'expo.inOut', 'circ.inOut',
  'sine.out', 'power1.out', 'power2.out', 'power3.out', 'power4.out', 'expo.out', 'circ.out',
  'sine.in', 'power2.in', 'power3.in', 'power4.in', 'expo.in',
]

/** The four numbers of a curve that is a cubic-bezier (custom or typed), else null. */
export function bezierOf(name) {
  if (CUSTOM_EASES[name]) return CUSTOM_EASES[name].bez
  const cb = /^cubic\(([^)]+)\)$/.exec(String(name))
  if (!cb) return null
  const v = cb[1].split(',').map(Number)
  return v.length === 4 && v.every(Number.isFinite) ? v : null
}

/** Deterministic shuffle order (Fisher-Yates on a seeded hash). */
export function seededOrder(n, seed = 1) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash(seed * 31.7 + i * 7.13) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
