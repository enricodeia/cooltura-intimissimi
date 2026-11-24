// Externability: the campaign's videos as a stack of cards in the centre of the
// frame. They pop up from the centre (scale up, the ones under it peeking at the
// bottom: a deck), then the top card is swiped away, right, left, right (only the
// gesture, no like / nope), and the card under it comes forward to take its
// place. After the last swipe the card left turns away on its vertical axis,
// through its centre, its face turning to the left, until it is edge-on and gone.
// The campaign's name in capitals at the bottom, in the centre.
//
// The videos are never treated: no dimming, no blur, no tint, exactly their pixels.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { Kinetic } from '../lib/kinetic.js'
import { carouselKeys } from './carousel.js'
import { caseOf } from './shared.js'
import { seg, clamp, ease, DEG } from '../core/util.js'

export function createSwipe(engine) {
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
  const label = new Kinetic(engine.hud)

  return {
    keysFor(T) {
      return T.shots.filter((s) => s.type === 'swipe').flatMap((s) => carouselKeys(videos, s.p.videos))
    },
    update(ctx) {
      const { t, T, view } = ctx
      for (const c of cards) c.mesh.visible = false
      label.group.visible = false
      const sh = T.shots.find((s) => s.type === 'swipe' && t >= s.start + Math.min(0, s.p.popAt) - 0.05 && t < s.end + 0.05)
      if (!sh) return
      const p = sh.p
      const keys = carouselKeys(videos, p.videos)
      const nSw = Math.max(0, Math.round(p.swipes))
      const N = Math.min(keys.length, nSw + 1)
      if (!N) return
      const short = Math.min(view.w, view.h)
      const margin = short * 0.075
      const portrait = view.aspect < 0.9

      // ---------------- sizes: the card in the centre, a little above it the label's room
      const capL = (p.labelSize / 100) * short * (portrait ? 1.3 : 1)
      const room = p.labelOn ? capL * 3.2 : 0
      let H = p.cardH * view.h
      let W = (H * 9) / 16
      if (W > view.w * 0.8) {
        W = view.w * 0.8
        H = (W * 16) / 9
      }
      const yC = room / 2
      const r = p.corner * W
      const peek = 0.055 // how far each card under the top one shows at the bottom (× height)

      // ---------------- the schedule
      const tSw = (k) => sh.start + p.swipeAt + k * p.swipeEvery
      const tTurn = sh.end - p.turnLead
      const swE = ease(p.swipeEase)
      const fwdE = ease('ci.swift')
      const popE = ease(p.popEase)
      const turnE = ease(p.turnEase)
      const turnK = turnE(clamp((t - tTurn) / p.turnDur))
      const first = p.first === 'left' ? -1 : 1

      for (let i = 0; i < N; i++) {
        const c = cardAt(i)
        // it pops up from the centre
        const a = clamp((t - (sh.start + p.popAt + i * p.popStagger)) / p.popDur)
        if (a <= 0) continue
        // where it is in the deck: the cards above it that have gone bring it forward
        let level = i
        for (let j = 0; j < Math.min(i, nSw); j++) level -= fwdE(clamp((t - (tSw(j) + p.swipeDur * 0.15)) / p.riseDur))
        const sDeck = Math.pow(p.under, Math.max(0, level))
        let x = 0
        let y = yC - peek * H * Math.max(0, level)
        let rz = 0
        let ry = 0
        let z = -0.02 * Math.max(0, level)
        // swiped away: right, left, right…
        if (i < nSw) {
          const e = swE(clamp((t - tSw(i)) / p.swipeDur))
          if (e >= 1) continue
          const d = i % 2 === 0 ? first : -first
          x += d * (view.w / 2 + W * 0.95) * e
          y += p.swipeLift * H * e
          rz = -d * p.swipeRot * DEG * e
          if (e > 0) z = 0.03 // the one leaving passes in front of the deck
        } else if (turnK > 0) {
          // the last one turns away on its vertical axis, its face to the left
          ry = p.turnAngle * DEG * turnK
          x -= p.turnShift * W * turnK
        }
        const edge = Math.cos(ry)
        if (edge <= 0.02) continue
        const sc = sDeck * popE(a)
        c.mesh.visible = true
        c.mesh.position.set(x, y, z)
        c.mesh.rotation.set(0, ry, rz)
        c.mesh.scale.set(W * sc, H * sc, 1)
        const u = c.mat.uniforms
        // its clip plays from where it does not cut while this card is in front
        const front = i === 0 ? sh.start + p.popAt : tSw(i - 1)
        const leave = i < nSw ? tSw(i) + p.swipeDur : sh.end
        const m0 = videos.cleanStart(keys[i], leave - front)
        u.map.value = videos.want(keys[i], Math.max(0, m0 + (t - front)))
        u.uSize.value.set(W * sc, H * sc)
        u.uRadius.value = r * sc
        const fade = clamp(edge * 7) // edge-on: gone
        u.uOpacity.value = fade
        u.uDim.value = 0
        u.uBlur.value = 0
        c.mat.transparent = fade < 0.999
      }

      // ---------------- the campaign's name, at the bottom in the centre
      if (p.labelOn && String(p.label || '').trim()) {
        const info = label.set({ text: caseOf(p.label, p.caps), weight: p.labelWeight, align: 'center', tracking: p.labelTracking })
        const k = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, info.width * capL))
        const cL = capL * k
        const cardBottom = yC - H / 2
        const yL = (cardBottom - view.h / 2) / 2 + cL * 0.1
        label.group.position.set(0, Math.min(yL, cardBottom - cL * 1.6), 0)
        label.group.scale.setScalar(cL)
        label.pose(t, {
          in: { at: sh.start + p.labelAt, dur: 0.6, stagger: 0.022, order: 'start', split: 'chars', ease: 'ci.reveal', x: 0, y: 110, rot: 0, depth: 0, scale: 1, blur: 25, opacity: 0, mask: true },
          out: { at: sh.end - p.labelOut, dur: 0.4, stagger: 0.012, order: 'start', split: 'chars', ease: 'ci.exit', x: 0, y: -110, rot: 0, depth: 0, scale: 1, blur: 25, opacity: 0, mask: true },
          from: ctx.col('violet'),
          to: ctx.col(p.labelColor),
          motion: 0.6,
          fps: ctx.fps,
          px: cL * ctx.pxPerUnit,
        })
      }
    },
    late() {
      label.late()
    },
  }
}
