// The campaign carousels (ARIA, Esternabilità): the videos come in from the
// right and turn on a circle. "Semicerchio": a big wheel in the frame plane,
// its centre below the frame, the cards riding its top edge, leaning with it;
// "Anello 3D": a ring around a vertical axis, the cards facing out. A fast
// arrival that settles, a slow turn while they are read, then they accelerate
// out to the left. The statement before them leaves as the first card arrives
// (its unreveal, right to left).
//
// The videos are never treated: no dimming, no blur, no tint, exactly their pixels.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { Kinetic } from '../lib/kinetic.js'
import { seg, clamp, lerp, ease, DEG } from '../core/util.js'

const A = 9 / 16

/** ∫ of a smoothstep ramp that starts at a and lasts L (0 before; then grows at slope 1). */
function rampInt(t, a, L) {
  if (t <= a) return 0
  const x = (t - a) / L
  if (x >= 1) return L / 2 + (t - a - L)
  return L * (x * x * x - (x * x * x * x) / 2)
}

/**
 * Where the carousel is at time t (pure): sizes, and the angle of card 0.
 * Shared with the statement before it, which is swept away by the first card.
 */
export function wheelAt(sh, view, t, N) {
  const p = sh.p
  const cardH = Math.min(p.cardH * view.h, view.w * 0.62 * (16 / 9))
  const cardW = cardH * A
  const yTop = (p.centerY * view.h) / 2
  const ring = p.mode === 'ring'
  const R = p.radius * cardH * (ring ? 0.55 : 1)
  const step = (cardW * p.spacing + cardW * 0.06) / R // angle between two cards
  // where a card is out of the frame on the right / left
  const edge = ring ? Math.PI / 2 : Math.asin(Math.min(0.999, (view.w / 2 + cardW * 0.75) / R))
  // the turn: in fast and settle, a slow drift, out accelerating
  const tIn = sh.start + p.inAt
  const tOut = sh.end - p.outLead - p.outDur
  const V1 = edge + ((N - 1) / 2) * step // the set centred on the frame
  const vIn = V1 * seg(t, tIn, p.inDur, p.inEase)
  const driftV = p.drift * step
  const vDrift = driftV * rampInt(t, tIn + p.inDur * 0.55, 0.7)
  const vDriftAtOut = driftV * rampInt(tOut + p.outDur, tIn + p.inDur * 0.55, 0.7)
  const Vend = edge + edge + (N - 1) * step + step * 0.5
  const vOut = Math.max(0, Vend - V1 - vDriftAtOut) * seg(t, tOut, p.outDur, p.outEase)
  const phi0 = edge - (vIn + vDrift + vOut)
  return { cardH, cardW, yTop, ring, R, step, edge, phi0, tIn }
}

/** The left edge (view x) of card 0 at time t: what sweeps the statement away. */
export function leadEdgeX(sh, view, t, N) {
  const w = wheelAt(sh, view, t, N)
  const phi = w.phi0
  if (w.ring) return w.R * Math.sin(phi) - (w.cardW / 2) * Math.abs(Math.cos(phi))
  return w.R * Math.sin(phi) - (w.cardW / 2) * Math.abs(Math.cos(phi)) - (w.cardH / 2) * Math.abs(Math.sin(phi))
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
  // the claim under ARIA: "#1" + its line
  const claimBig = new Kinetic(engine.hud)
  const claimText = new Kinetic(engine.hud)

  return {
    get keys() {
      return videos.keys('v3/feed/')
    },
    update(ctx) {
      const { t, T, view } = ctx
      const shots = T.shots.filter((s) => s.type === 'carousel')
      const sh = shots.find((s) => t >= s.start + s.p.inAt - 0.05 && t < s.end + 0.05)
      for (const c of cards) c.mesh.visible = false
      claimBig.group.visible = claimText.group.visible = false
      if (!sh) return
      const p = sh.p
      const keys = carouselKeys(videos, p.videos)
      const N = keys.length
      if (!N) return

      // ---------------- where the wheel is (view units, angle of card 0)
      const { cardH, cardW, yTop, ring, R, step, phi0, tIn } = wheelAt(sh, view, t, N)

      const r = p.corner * cardW
      for (let i = 0; i < N; i++) {
        const c = cardAt(i)
        const phi = phi0 + i * step
        let x
        let y
        let z = 0
        let fade = 1
        if (ring) {
          // around a vertical axis behind the frame: the front card is on the frame plane
          x = R * Math.sin(phi)
          z = R * Math.cos(phi) - R
          y = yTop
          fade = clamp((Math.cos(phi) + 0.05) / 0.35)
          c.mesh.rotation.set(p.tilt * DEG, phi, 0)
        } else {
          // a wheel in the frame plane, its centre below: the cards ride the top edge and lean with it
          x = R * Math.sin(phi)
          y = yTop - R + R * Math.cos(phi)
          c.mesh.rotation.set(0, 0, -phi)
          fade = Math.abs(phi) < Math.PI / 2 ? 1 : 0
        }
        const vis = fade > 0.01 && Math.abs(x) < view.w / 2 + cardW && y > -view.h / 2 - cardH && y < view.h / 2 + cardH
        c.mesh.visible = vis
        if (!vis) continue
        c.mesh.position.set(x, y, z)
        c.mesh.scale.set(cardW, cardH, 1)
        const u = c.mat.uniforms
        u.map.value = videos.want(keys[i], Math.max(0, t - tIn + i * 0.37))
        u.uSize.value.set(cardW, cardH)
        u.uRadius.value = r
        u.uOpacity.value = fade
        u.uDim.value = 0
        u.uBlur.value = 0
        c.mat.transparent = fade < 0.999
      }

      // ---------------- the claim (ARIA): "#1" + "result on TikTok search for the product category"
      if (sh.id === 'aria' && p.claimOn) {
        const short = Math.min(view.w, view.h)
        const capB = short * 0.075 * p.claimSize
        const capT = short * 0.022 * p.claimSize
        const ib = claimBig.set({ text: String(p.claimBig), weight: 400, align: 'left' })
        const it = claimText.set({ text: String(p.claim), weight: 400, align: 'left', measure: (short * 0.52) / capT, leading: 1.25 })
        const bw = ib.width * capB
        const tw = it.width * capT
        const gap = capB * 0.35
        const total = bw + gap + tw
        const yC = -view.h / 2 + Math.max(capB * 1.2, (view.h / 2 + yTop - cardH / 2) * 0.42)
        const x0 = -total / 2
        claimBig.group.position.set(x0, yC, 0)
        claimBig.group.scale.setScalar(capB)
        claimText.group.position.set(x0 + bw + gap, yC + (it.height * capT) / 2 - capT / 2 - (capB - capT) / 2 + capT * 0.0, 0)
        claimText.group.scale.setScalar(capT)
        const at = sh.start + p.claimAt
        const outAt = sh.end - p.claimOut
        const ph = (split, stagger, blur) => ({
          in: { at, dur: 0.8, stagger, order: 'start', split, ease: 'ci.reveal', x: 0, y: 110, rot: 0, depth: 0, scale: 1, blur, opacity: 0, mask: true },
          out: { at: outAt, dur: 0.45, stagger: stagger * 0.5, order: 'start', split, ease: 'ci.exit', x: 0, y: -110, rot: 0, depth: 0, scale: 1, blur, opacity: 0, mask: true },
        })
        claimBig.pose(t, { ...ph('chars', 0.05, 25), from: ctx.col('violet'), to: ctx.col(p.claimColor), motion: 0.6, fps: ctx.fps, px: capB * ctx.pxPerUnit })
        const pt = ph('words', 0.03, 25)
        pt.in.at += 0.12
        claimText.pose(t, { ...pt, from: ctx.col('violet'), to: ctx.col(p.claimTextColor), motion: 0.6, fps: ctx.fps, px: capT * ctx.pxPerUnit })
      }
      void lerp
      void ease
    },
    late() {
      claimBig.late()
      claimText.late()
    },
  }
}
