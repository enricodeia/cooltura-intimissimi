// Value 01 · strategy: the Aria wheel (the circular movement of the film before),
// with a hierarchy: it turns in from the right and settles with the protagonist
// in the centre; she comes forward (bigger, upright, in front) and talks, her own
// voice (the music ducks under it), while the others step back; as she finishes
// she goes back into the wheel and the wheel accelerates away to the left.
// The videos are never treated: exactly their pixels.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { keysOf, applyCrop, voiceAtOf, softClipTime } from './common.js'
import { seg, clamp, lerp, ease } from '../core/util.js'

const A = 9 / 16
const extents = (w, h, a) => [(w / 2) * Math.abs(Math.cos(a)) + (h / 2) * Math.abs(Math.sin(a)), (w / 2) * Math.abs(Math.sin(a)) + (h / 2) * Math.abs(Math.cos(a))]

export function createWheel(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  engine.hud.add(root)
  const geo = new THREE.PlaneGeometry(1, 1)
  const cards = []
  const cardAt = (i) => {
    if (!cards[i]) {
      const mat = tileMaterial(videos.placeholder)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      root.add(mesh)
      cards[i] = { mesh, mat }
    }
    return cards[i]
  }
  return {
    keysFor(T) {
      return T.shots.filter((s) => s.type === 'wheel').flatMap((s) => keysOf(videos, s.p.videos))
    },
    update(ctx) {
      const { t, T, view } = ctx
      for (const c of cards) if (c) c.mesh.visible = false
      const sh = T.shots.find((s) => s.type === 'wheel' && t >= s.start - 0.05 && t < s.end + 0.05)
      if (!sh) return
      const p = sh.p
      const keys = keysOf(videos, p.videos)
      const N = keys.length
      if (!N) return
      const hero = Math.max(0, Math.min(N - 1, Math.round(p.hero) - 1))
      const cardH = Math.min(p.cardH * view.h, view.w * 0.62 * (16 / 9))
      const cardW = cardH * A
      const yTop = (p.centerY * view.h) / 2
      const lean = p.lean
      const R = Math.max(cardH * 0.8, p.radius * cardH)
      const inner = Math.max(cardW * 0.6, R - (cardH / 2) * lean)
      const step = 2 * Math.asin(Math.min(0.999, (cardW * (1 + p.spacing)) / (2 * inner)))
      // the angle where a card has left the frame
      let edge = Math.PI
      for (let i = 1; i <= 240; i++) {
        const a = (i / 240) * Math.PI
        const [hx, hy] = extents(cardW, cardH, a * lean)
        if (R * Math.sin(a) - hx > view.w / 2 || yTop - R + R * Math.cos(a) + hy < -view.h / 2) {
          edge = a
          break
        }
      }
      // the turn: in from the right to the protagonist in the centre, out to the left at the end
      const tIn = sh.start
      const tOut = sh.end - p.outDur
      const V1 = edge + hero * step
      let V = V1 * seg(t, tIn, p.inDur, p.inEase)
      const travel = edge + (N - 1 - hero) * step + edge * 0.15
      V += travel * seg(t, tOut, p.outDur, p.outEase)
      const phi0 = edge - V
      // the protagonist comes forward, then goes back
      const kH = clamp(ease(p.heroEase)(clamp((t - (sh.start + p.heroAt)) / p.heroDur)) - ease('cubic(0.5,0,0.3,1)')(clamp((t - (sh.end - p.backAt)) / 0.5)))
      const maxS = (view.h * 0.9) / cardH
      const hs = Math.min(p.heroScale, maxS, (view.w * 0.9) / cardW)
      for (let i = 0; i < N; i++) {
        const c = cardAt(i)
        const phi = phi0 + i * step
        let x = R * Math.sin(phi)
        let y = yTop - R + R * Math.cos(phi)
        let rz = -phi * lean
        let s = 1
        let z = 0
        if (Math.abs(phi) > Math.PI * 0.75) continue
        if (i === hero) {
          x = lerp(x, 0, kH)
          y = lerp(y, 0, kH)
          rz = lerp(rz, 0, kH)
          s = lerp(1, hs, kH)
          z = 0.02 + 0.08 * kH
        } else {
          s = lerp(1, p.heroBack, kH)
          y += (yTop - y) * 0 - kH * cardH * 0.04
          z = -0.04 * kH
        }
        const w = cardW * s
        const h = cardH * s
        const [hx, hy] = extents(w, h, rz)
        if (x - hx > view.w / 2 || x + hx < -view.w / 2 || y - hy > view.h / 2 || y + hy < -view.h / 2) continue
        c.mesh.visible = true
        c.mesh.position.set(x, y, z)
        c.mesh.rotation.set(0, 0, rz)
        c.mesh.scale.set(w, h, 1)
        const u = c.mat.uniforms
        // the one in front speaks with her own voice (any clip of the library: they all carry their sound)
        const voiced = i === hero && p.voiceOn
        const dur = videos.manifest[keys[i]] || 6
        const m = voiced ? (p.voiceFrom ?? 0) + (t - (sh.start + voiceAtOf('wheel', p, sh.dur, dur))) : videos.cleanStart(keys[i], sh.dur, 0.35 + i * 0.37) + (t - tIn)
        // never past its last frame (it glides into it), never looping back to its start
        u.map.value = videos.want(keys[i], softClipTime(m, dur), voiced)
        u.uSize.value.set(w, h)
        u.uRadius.value = p.corner * w
        u.uOpacity.value = 1
        u.uDim.value = 0
        u.uBlur.value = 0
        applyCrop(u, keys[i])
        c.mat.transparent = false
      }
    },
  }
}
