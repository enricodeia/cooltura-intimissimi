// The campaign carousels (ARIA, Externability): a wheel of videos. Its hub is
// below the frame; the cards ride its rim, upright at the top and leaning with
// it at the sides, so they come up from the right, pass over the top and go
// down to the left. Three moves, one at a time so each one reads:
//   arrival  the wheel turns in from the right and settles with a card in the
//            centre (the statement before it leaves word by word as the first
//            card reaches it)
//   steps    it turns one card at a time, with a pause on every video
//   exit     it accelerates away to the left
// The cards never overlap: their spacing is measured where they are closest
// (their inner edges, towards the hub). "Anello 3D": the same turn on a ring
// around a vertical axis. The campaign's name above, the #1 claim under ARIA.
//
// The videos are never treated: no dimming, no blur, no tint, exactly their pixels.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { Kinetic } from '../lib/kinetic.js'
import { caseOf } from './shared.js'
import { seg, clamp, DEG } from '../core/util.js'

const A = 9 / 16

/** Half extents of a card of w × h turned by `a` radians in the frame plane. */
const extents = (w, h, a) => [(w / 2) * Math.abs(Math.cos(a)) + (h / 2) * Math.abs(Math.sin(a)), (w / 2) * Math.abs(Math.sin(a)) + (h / 2) * Math.abs(Math.cos(a))]

/** Which card is in the centre when the wheel settles. */
function settleIndex(p, view, cardW, N) {
  if (p.settle === 'first') return 0
  if (p.settle === 'middle') return Math.floor((N - 1) / 2)
  // auto: the frame shows `fit` cards side by side; the middle one is in the centre
  const fit = Math.max(1, Math.floor(view.w / (cardW * (1 + p.spacing))))
  return Math.min(N - 1, Math.max(0, Math.floor((fit - 1) / 2)))
}

/**
 * Where the carousel is at time t (pure): sizes, the angle of card 0, which cards exist.
 * Shared with the statement before it, which is swept away by the first card.
 */
export function wheelAt(sh, view, t, N) {
  const p = sh.p
  const cardH = Math.min(p.cardH * view.h, view.w * 0.62 * (16 / 9))
  const cardW = cardH * A
  const yTop = (p.centerY * view.h) / 2
  const ring = p.mode === 'ring'
  const lean = ring ? 0 : p.lean ?? 1
  const R = Math.max(cardH * 0.8, p.radius * cardH * (ring ? 0.55 : 1))
  // neighbours are closest at their inner edges (towards the hub): space them there
  const inner = ring ? R : Math.max(cardW * 0.6, R - (cardH / 2) * lean)
  const step = 2 * Math.asin(Math.min(0.999, (cardW * (1 + p.spacing)) / (2 * inner)))
  // the angle where a card has left the frame (right side or below it)
  let edge = Math.PI / 2
  if (!ring) {
    edge = Math.PI
    for (let i = 1; i <= 240; i++) {
      const a = (i / 240) * Math.PI
      const [hx, hy] = extents(cardW, cardH, a * lean)
      const x = R * Math.sin(a)
      const y = yTop - R + R * Math.cos(a)
      if (x - hx > view.w / 2 || y + hy < -view.h / 2) {
        edge = a
        break
      }
    }
  }
  // ---------------- the turn: V = how far the wheel has turned (card k is at edge − V + k·step)
  const s = settleIndex(p, view, cardW, N)
  const tIn = sh.start + p.inAt
  const tArr = tIn + p.inDur
  const tOut = sh.end - p.outLead - p.outDur
  const V1 = edge + s * step
  // steps between arrival and exit, each followed by a pause of at least minPause
  let n = Math.max(0, Math.min(Math.round(p.steps), N - 1 - s))
  let pause = 0
  const minPause = p.minPause ?? 0.3
  for (; n >= 0; n--) {
    pause = (tOut - tArr - n * p.stepDur) / (n + 1)
    if (pause >= minPause || n === 0) break
  }
  n = Math.max(0, n)
  let V = V1 * seg(t, tIn, p.inDur, p.inEase)
  for (let k = 0; k < n; k++) V += step * seg(t, tArr + pause * (k + 1) + p.stepDur * k, p.stepDur, p.stepEase)
  // exit: the wheel turns until the last card on screen has left on the left
  const Vo = V1 + n * step
  const last = Math.min(N - 1, Math.ceil(Vo / step - 1e-6) - 1 + (ring ? 0 : 0))
  const travel = Math.max(0, 2 * edge + last * step - Vo) + 0.02
  V += travel * seg(t, tOut, p.outDur, p.outEase)
  const phi0 = edge - V
  return { cardH, cardW, yTop, ring, lean, R, step, edge, phi0, tIn, tArr, tOut, last: Math.max(0, last), settle: s }
}

/** The left edge (view x) of card 0 at time t: what sweeps the statement away. */
export function leadEdgeX(sh, view, t, N) {
  const w = wheelAt(sh, view, t, N)
  const phi = w.phi0
  if (w.ring) return w.R * Math.sin(phi) - (w.cardW / 2) * Math.abs(Math.cos(phi))
  const [hx] = extents(w.cardW, w.cardH, phi * w.lean)
  return w.R * Math.sin(phi) - hx
}

/** The right edge (view x) of the last card on screen at time t: the wheel's wake, what the next sentence comes in behind. */
export function trailEdgeX(sh, view, t, N) {
  const w = wheelAt(sh, view, t, N)
  const phi = w.phi0 + w.last * w.step
  if (w.ring) return w.R * Math.sin(phi) + (w.cardW / 2) * Math.abs(Math.cos(phi))
  const [hx] = extents(w.cardW, w.cardH, phi * w.lean)
  return w.R * Math.sin(phi) + hx
}

/** The videos of a carousel, as media keys, in order (only the ones that exist). */
export function carouselKeys(videos, list) {
  return (list || []).map((slug) => `v3/feed/${slug}.mp4`).filter((k) => videos.manifest[k] !== undefined)
}

export function createCarousel(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  engine.hud.add(root)
  const geo = new THREE.PlaneGeometry(1, 1)
  const cards = []
  function cardAt(i) {
    if (!cards[i]) {
      const mat = tileMaterial(videos.placeholder)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      root.add(mesh)
      cards[i] = { mesh, mat }
    }
    return cards[i]
  }
  // the campaign's name, and the claim under ARIA: "#1" + its line
  const label = new Kinetic(engine.hud)
  const claimBig = new Kinetic(engine.hud)
  const claimText = new Kinetic(engine.hud)
  const blocks = [label, claimBig, claimText]

  return {
    get keys() {
      return videos.keys('v3/feed/')
    },
    update(ctx) {
      const { t, T, view } = ctx
      const shots = T.shots.filter((s) => s.type === 'carousel')
      const sh = shots.find((s) => t >= s.start + s.p.inAt - 0.05 && t < s.end + 0.05)
      for (const c of cards) c.mesh.visible = false
      for (const b of blocks) b.group.visible = false
      if (!sh) return
      const p = sh.p
      const keys = carouselKeys(videos, p.videos)
      const N = keys.length
      if (!N) return
      const short = Math.min(view.w, view.h)
      const margin = short * 0.075

      // ---------------- the wheel (view units, angle of card 0)
      const w = wheelAt(sh, view, t, N)
      const { cardH, cardW, yTop, ring, lean, R, step, phi0, tIn } = w
      const r = p.corner * cardW
      for (let i = 0; i < N; i++) {
        if (i > w.last) continue // never on screen: the set ends with the last card shown
        const c = cardAt(i)
        const phi = phi0 + i * step
        let x
        let y
        let z = 0
        let fade = 1
        let hx = cardW / 2
        let hy = cardH / 2
        if (ring) {
          // around a vertical axis behind the frame: the front card is on the frame plane
          x = R * Math.sin(phi)
          z = R * Math.cos(phi) - R
          y = yTop
          fade = clamp((Math.cos(phi) + 0.05) / 0.35)
          c.mesh.rotation.set(p.tilt * DEG, phi, 0)
        } else {
          // the rim of a wheel whose hub is below the frame: upright at the top, leaning at the sides
          x = R * Math.sin(phi)
          y = yTop - R + R * Math.cos(phi)
          c.mesh.rotation.set(0, 0, -phi * lean)
          ;[hx, hy] = extents(cardW, cardH, phi * lean)
          fade = Math.abs(phi) < Math.PI * 0.75 ? 1 : 0
        }
        const vis = fade > 0.01 && x - hx < view.w / 2 && x + hx > -view.w / 2 && y - hy < view.h / 2 && y + hy > -view.h / 2
        c.mesh.visible = vis
        if (!vis) continue
        c.mesh.position.set(x, y, z)
        c.mesh.scale.set(cardW, cardH, 1)
        const u = c.mat.uniforms
        // from where its clip does not cut while the wheel is on screen (the creators' own edits)
        const m0 = videos.cleanStart(keys[i], sh.end - tIn, 0.35 + i * 0.37)
        u.map.value = videos.want(keys[i], Math.max(0, m0 + (t - tIn)))
        u.uSize.value.set(cardW, cardH)
        u.uRadius.value = r
        u.uOpacity.value = fade
        u.uDim.value = 0
        u.uBlur.value = 0
        c.mat.transparent = fade < 0.999
      }

      const reveal = (at, split, stagger, blur) => ({ at, dur: 0.85, stagger, order: 'start', split, ease: 'ci.reveal', x: 0, y: 110, rot: 0, depth: 0, scale: 1, blur, opacity: 0, mask: true })
      const leave = (at, split, stagger, blur) => ({ at, dur: 0.5, stagger, order: 'start', split, ease: 'ci.exit', x: 0, y: -110, rot: 0, depth: 0, scale: 1, blur, opacity: 0, mask: true })
      const cardTop = yTop + cardH / 2
      const cardBottom = yTop - cardH / 2

      // ---------------- the campaign's name: under the wheel in the centre (or above it)
      const claimShown = sh.id === 'aria' && p.claimOn
      if (p.labelOn && String(p.label || '').trim()) {
        const cap = (p.labelSize / 100) * short * (view.aspect < 0.9 ? 1.3 : 1)
        const info = label.set({ text: caseOf(p.label, p.caps), weight: p.labelWeight, align: 'center', tracking: p.labelTracking ?? 0.14 })
        const k = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, info.width * cap))
        const capL = cap * k
        const below = p.labelPos !== 'above' && !claimShown
        const yL = below ? (cardBottom - view.h / 2) / 2 : Math.min(view.h / 2 - margin - capL / 2, (cardTop + view.h / 2) / 2)
        label.group.position.set(0, yL, 0)
        label.group.scale.setScalar(capL)
        label.pose(t, {
          in: reveal(sh.start + p.labelAt, 'chars', 0.035, 30),
          out: leave(sh.end - p.labelOut, 'chars', 0.02, 30),
          from: ctx.col('violet'),
          to: ctx.col(p.labelColor),
          motion: 0.6,
          fps: ctx.fps,
          px: capL * ctx.pxPerUnit,
        })
      }

      // ---------------- the claim (ARIA): "#1" + "result on TikTok search for the product category"
      // beside it in wide frames, under it (two lines, centred) in narrow ones
      if (claimShown) {
        const stacked = view.w < view.h * 0.8
        const capB = short * 0.1 * p.claimSize
        const capT = short * (p.claimCaps ? (stacked ? 0.028 : 0.0205) : stacked ? 0.034 : 0.027) * p.claimSize
        const align = stacked ? 'center' : 'left'
        const ib = claimBig.set({ text: String(p.claimBig), weight: p.claimFace, align, tracking: -0.02 })
        const it = claimText.set({ text: caseOf(p.claim, p.claimCaps), weight: p.claimTextFace, align, measure: (stacked ? view.w - 2 * margin : short * (p.claimCaps ? 0.5 : 0.42)) / capT, leading: 1.5, tracking: p.claimCaps ? 0.12 : 0.01 })
        const at = sh.start + p.claimAt
        const outAt = sh.end - p.claimOut
        const free = (cardBottom - -view.h / 2) // the white under the wheel
        if (stacked) {
          const gap = capB * 0.42
          const th = it.height * capT
          const total = capB + gap + th
          const k = Math.min(1, (free - margin * 0.6) / Math.max(1e-3, total))
          const yC = (cardBottom - view.h / 2) / 2
          const top = yC + (total * k) / 2
          claimBig.group.position.set(0, top - (capB * k) / 2, 0)
          claimBig.group.scale.setScalar(capB * k)
          claimText.group.position.set(0, top - (capB + gap) * k - (th * k) / 2, 0)
          claimText.group.scale.setScalar(capT * k)
          claimBig.pose(t, { in: reveal(at, 'chars', 0.06, 25), out: leave(outAt, 'chars', 0.03, 25), from: ctx.col('violet'), to: ctx.col(p.claimColor), motion: 0.6, fps: ctx.fps, px: capB * k * ctx.pxPerUnit })
          claimText.pose(t, { in: reveal(at + 0.15, 'words', 0.035, 25), out: leave(outAt + 0.04, 'words', 0.02, 25), from: ctx.col('violet'), to: ctx.col(p.claimTextColor), motion: 0.6, fps: ctx.fps, px: capT * k * ctx.pxPerUnit })
        } else {
          let bw = ib.width * capB
          let tw = it.width * capT
          const gap = capB * 0.3
          const k = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, bw + gap + tw), (free - margin * 0.6) / Math.max(1e-3, Math.max(capB, it.height * capT)))
          const cB = capB * k
          const cT = capT * k
          bw *= k
          tw *= k
          const total = bw + gap * k + tw
          const yC = cardBottom - (cardBottom + view.h / 2) * 0.56
          const x0 = -total / 2
          claimBig.group.position.set(x0, yC, 0)
          claimBig.group.scale.setScalar(cB)
          // the lines of text centred on "#1"
          claimText.group.position.set(x0 + bw + gap * k, yC, 0)
          claimText.group.scale.setScalar(cT)
          claimBig.pose(t, { in: reveal(at, 'chars', 0.06, 25), out: leave(outAt, 'chars', 0.03, 25), from: ctx.col('violet'), to: ctx.col(p.claimColor), motion: 0.6, fps: ctx.fps, px: cB * ctx.pxPerUnit })
          claimText.pose(t, { in: reveal(at + 0.15, 'words', 0.035, 25), out: leave(outAt + 0.04, 'words', 0.02, 25), from: ctx.col('violet'), to: ctx.col(p.claimTextColor), motion: 0.6, fps: ctx.fps, px: cT * ctx.pxPerUnit })
        }
      }
    },
    late() {
      for (const b of blocks) b.late()
    },
  }
}
