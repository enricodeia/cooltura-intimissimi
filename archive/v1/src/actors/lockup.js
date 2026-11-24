// Intro: cooltura* over a wide, hairline × over intimissimi, on paper.
// The × is the hinge to the next shot: its arms stretch to the corners of the
// hero card, the card opens from the crossing point, the arms retract.

import * as THREE from 'three'
import { wordmark, WORDMARK_SIZE, loadIntimissimi, svgGeometry } from '../lib/brand.js'
import { makeLine, lineWindow, lineStyle, v3 } from '../lib/lines.js'
import { flatMaterial } from '../lib/materials.js'
import { heroCard, planeFromLocal } from './shared.js'
import { seg, lerp, clamp, DEG, ease } from '../core/util.js'

export async function createLockup(engine) {
  const inti = await loadIntimissimi()
  const root = new THREE.Group()
  engine.hud.add(root)

  // ---- cooltura wordmark: one mesh per glyph, SVG units, origin = centre of the 213 × 36 box
  const word = new THREE.Group()
  const wordClip = [new THREE.Plane(), new THREE.Plane()]
  const wordMat = flatMaterial('#0b0b0c')
  wordMat.clippingPlanes = wordClip
  const glyphs = wordmark().map((g) => {
    const m = new THREE.Mesh(svgGeometry(g.shapes, { cx: WORDMARK_SIZE.width / 2, cy: WORDMARK_SIZE.height / 2, k: 1 }), wordMat)
    word.add(m)
    return m
  })
  root.add(word)

  // ---- intimissimi: letters + the thin frame as a drawn line
  const brand = new THREE.Group()
  const brandClip = [new THREE.Plane(), new THREE.Plane()]
  const brandMat = flatMaterial('#0b0b0c')
  brandMat.clippingPlanes = brandClip
  const letters = inti.letters.map((l) => {
    const m = new THREE.Mesh(svgGeometry(l.shapes, { cx: inti.cx, cy: inti.cy, k: 1 }), brandMat)
    brand.add(m)
    return m
  })
  const f = inti.frame
  const fx0 = f.x0 - inti.cx
  const fx1 = f.x1 - inti.cx
  const fy0 = -(f.y1 - inti.cy)
  const fy1 = -(f.y0 - inti.cy)
  // two halves from the bottom centre, so the frame closes symmetrically
  const frameA = makeLine([v3(0, fy0), v3(fx1, fy0), v3(fx1, fy1), v3(0, fy1)], { color: 0x0b0b0c, width: 0.01 })
  const frameB = makeLine([v3(0, fy0), v3(fx0, fy0), v3(fx0, fy1), v3(0, fy1)], { color: 0x0b0b0c, width: 0.01 })
  brand.add(frameA, frameB)
  root.add(brand)

  // ---- the ×: four arms from the crossing point (unit square, scaled per frame)
  const cross = new THREE.Group()
  const arms = [
    [1, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
  ].map(([x, y]) => {
    const l = makeLine([v3(0, 0), v3(x, y)], { color: 0x0b0b0c, width: 0.012 })
    cross.add(l)
    return l
  })
  root.add(cross)

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const b = T.shot('lockup')
      const hero = T.shot('hero')
      const p = b.p
      const openDur = Math.min(hero.p.openDur, hero.dur)
      const visible = t < hero.start + openDur + 0.05
      root.visible = visible
      if (!visible) return
      const u = t - b.start
      const k = Math.min(1, b.dur / 1.8) // short shots compress their in-animation
      const out0 = b.end - Math.min(p.outDur, b.dur * 0.45)
      const outU = seg(t, out0, b.end - out0, p.outEase)
      const card = heroCard(view, hero.p)
      const ink = ctx.col(p.logoColor)
      wordMat.color.set(ink)
      brandMat.color.set(ink)

      // sizes: one scale for the lockup, from the frame (wider frames give it more room)
      const S = Math.min(view.w / 5.625, (view.h / 10) * 1.5)
      const hc = 0.4 * p.crossSize * S
      const wordW = 2.85 * p.logoSize * S
      const ws = wordW / WORDMARK_SIZE.width
      const wordH = WORDMARK_SIZE.height * ws
      const brandW = 2.6 * p.logoSize * S
      const bs = brandW / inti.width
      const brandH = inti.height * bs
      const gap = 0.52 * p.gap * S
      const wy = hc + gap + wordH / 2
      const by = -(hc + gap + brandH / 2)
      word.position.set(0, wy, 0)
      word.scale.setScalar(ws)
      brand.position.set(0, by, 0)
      brand.scale.setScalar(bs)

      // ---- wordmark: letters rise out of the baseline, leave through the top
      const inE = ease(p.inEase)
      glyphs.forEach((m, i) => {
        const a = inE(clamp((u - (0.1 + i * p.letterStagger) * k) / (0.62 * k)))
        const o = ease('power3.in')(clamp((t - out0 - i * 0.018) / Math.max(0.01, b.end - out0 - 0.14)))
        m.position.y = lerp(-WORDMARK_SIZE.height * 1.12, 0, a) + o * WORDMARK_SIZE.height * 1.15
      })
      word.visible = u < b.dur + 0.001

      // ---- intimissimi: frame draws, letters rise from its lower edge, drop back out
      const fr = seg(u, 0.16 * k, 0.75 * k, 'power3.inOut') * (1 - outU)
      lineWindow(frameA, 0, fr)
      lineWindow(frameB, 0, fr)
      const lw = inti.frame.stroke * bs * view.lw
      lineStyle(frameA, { color: ink, width: lw })
      lineStyle(frameB, { color: ink, width: lw })
      const travel = inti.height * 0.62
      letters.forEach((m, i) => {
        const a = inE(clamp((u - (0.26 + i * p.letterStagger * 0.8) * k) / (0.6 * k)))
        const o = ease('power3.in')(clamp((t - out0 - (letters.length - 1 - i) * 0.014) / Math.max(0.01, b.end - out0 - 0.14)))
        m.position.y = lerp(-travel, 0, a) - o * travel
      })
      brand.visible = u < b.dur + 0.001

      // ---- ×: spins in while its arms grow, then stretches to the card's diagonals, then retracts
      const grow = seg(u, 0.02 * k, 0.7 * k, 'expo.out')
      const stretch = outU
      const retract = seg(t, hero.start, openDur * 0.85, 'power3.inOut')
      cross.rotation.z = (1 - seg(u, 0, 0.9 * k, 'expo.out')) * p.crossSpin * DEG
      cross.scale.set(lerp(hc, card.w / 2, stretch), lerp(hc, card.h / 2, stretch), 1)
      const cw = 0.011 * p.crossWeight * view.lw
      const cc = ctx.col(p.crossColor)
      for (const l of arms) {
        lineWindow(l, retract, grow)
        lineStyle(l, { color: cc, width: cw })
      }
      this._clip = { wy, wordH, by, brandH }
    },

    // clipping masks need the final camera matrix (the HUD rides the camera)
    late() {
      if (!root.visible || !this._clip) return
      const { wy, wordH, by, brandH } = this._clip
      planeFromLocal(wordClip[0], root, 0, 1, 0, 0, wy - wordH * 0.5 - wordH * 0.02, 0)
      planeFromLocal(wordClip[1], root, 0, -1, 0, 0, wy + wordH * 0.5 + wordH * 0.02, 0)
      const inner = brandH * 0.5 - (inti.frame.stroke * brandH) / inti.height
      planeFromLocal(brandClip[0], root, 0, 1, 0, 0, by - inner, 0)
      planeFromLocal(brandClip[1], root, 0, -1, 0, 0, by + inner, 0)
    },
  }
}
