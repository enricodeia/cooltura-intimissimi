// cooltura* × intimissimi, side by side: the two logotypes as wide as each
// other, a small thin × exactly in the centre of the frame between them, drawn
// with the same stroke as intimissimi's frame (the official logotype's own
// stroke, kept for coherence with the brand). The × draws itself first, then the
// two logotypes open outwards from it: cooltura letter by letter from right to
// left, intimissimi from left to right inside its frame. Out in opacity only, all
// together. Used by intro A and at the end of intro B.

import * as THREE from 'three'
import { wordmark, WORDMARK_SIZE, loadIntimissimi, svgGeometry, intiMetrics, lockupMetrics } from '../lib/brand.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { rank } from '../lib/kinetic.js'
import { seg, clamp, ease, DEG, seededOrder } from '../core/util.js'

const WCX = WORDMARK_SIZE.width / 2
const WCY = WORDMARK_SIZE.height / 2
const XH = 27.2 // cooltura x-height (the "c"), SVG units
const XH_MID = 22 // its middle, SVG y (down)

export async function createLockup(engine, { types = ['lockup'] } = {}) {
  const inti = await loadIntimissimi()
  const M = intiMetrics(inti)
  const root = new THREE.Group()
  root.visible = false
  engine.hud.add(root)
  const maskInv = new THREE.Matrix4()
  const mk = (geo) => {
    const mat = fxMaterial({ maskInv })
    const mesh = fxMesh(geo, mat)
    root.add(mesh)
    return { mesh, mat }
  }
  // cooltura: one mesh per glyph (c o o l t u r a *), centred on the wordmark's box, x-height centred on y = 0
  const cool = wordmark().map((g) => {
    const o = mk(svgGeometry(g.shapes, { cx: WCX, cy: WCY, k: 1 }))
    return { ...o, box: g.box, ch: g.ch }
  })
  // intimissimi: its letters, centred on themselves (x-height middle on y = 0), and its frame, centred on itself
  const letters = inti.letters.map((l) => ({ ...mk(svgGeometry(l.shapes, { cx: M.ICX, cy: M.ICY, k: 1 })) }))
  const frame = mk(svgGeometry(inti.frameShapes, { cx: M.FR.cx, cy: M.FR.cy, k: 1 }))
  // the ×: two bars
  const barGeo = new THREE.PlaneGeometry(1, 1)
  const bars = [mk(barGeo), mk(barGeo)]
  const permC = seededOrder(cool.length, 13)
  const permI = seededOrder(letters.length, 17)
  const col = new THREE.Color()
  const LET = M.LET

  const lockups = (T) => T.shots.filter((s) => types.includes(s.type))

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const sh = lockups(T).find((s) => t >= s.start - 0.4 && t < s.end + 0.02)
      root.visible = !!sh
      if (!sh) return
      const p = sh.p
      const u = t - sh.start
      col.set(ctx.col(p.logoColor))

      // ---------------- layout, in cooltura SVG units centred on the ×; S = view units per unit
      const G = lockupMetrics(p, M)
      const short = Math.min(view.w, view.h)
      // symmetric about the ×: the wider side decides the size
      const ext = 2 * Math.max(G.left, G.right)
      const S = Math.min((short * 0.8) / ext, (view.w * 0.8) / ext) * p.scale
      root.scale.setScalar(S)
      root.position.set(0, 0, 0)
      const xC = G.xC
      const xI = G.xI
      const yC = XH_MID - WCY // lift that puts cooltura's x-height middle on y = 0
      const px = S * ctx.pxPerUnit // pixels per SVG unit

      // ---------------- out: opacity, a breath of blur
      let fade = 1
      let fadeBlur = 0
      if (p.outOn) {
        const o = seg(t, sh.end - p.outLead, p.outDur, p.outEase)
        fade = 1 - o
        fadeBlur = p.outBlur * o
      }
      const finish = (m, op, blurUnits, localScale = 1) => {
        m.mat.uniforms.uColor.value.copy(col)
        m.mat.uniforms.uOpacity.value = op * fade
        m.mesh.visible = op * fade > 0.002
        fxBlur(m.mesh, blurUnits / localScale, 0, 0, px * localScale)
      }

      // ---------------- × (the same stroke as the frame)
      const xe = seg(u, p.xAt, p.xDur, p.xEase)
      bars.forEach((b, i) => {
        const len = G.xs * Math.SQRT2 * xe
        b.mesh.position.set(0, 0, 0)
        b.mesh.rotation.set(0, 0, (i ? -45 : 45) * DEG + (1 - xe) * p.xSpin * DEG)
        b.mesh.scale.set(Math.max(1e-4, len), G.thick, 1)
        fxMask(b.mesh, false)
        finish(b, clamp(xe * 3), (fadeBlur / 100) * XH)
      })

      // ---------------- cooltura, letter by letter (right → left by default)
      const ce = ease(p.cEase)
      const travelC = WORDMARK_SIZE.height * (p.cY / 100)
      cool.forEach((g, j) => {
        const t0 = p.cAt + rank(p.cOrder, j, cool.length, permC) * p.cStagger
        const k = clamp((u - t0) / Math.max(1e-4, p.cDur))
        const e = ce(k)
        g.mesh.visible = k > 0
        if (k <= 0) return
        g.mesh.position.set(xC, yC - travelC * (1 - e), 0)
        if (p.cMask) fxMask(g.mesh, true, -1e5, yC + (WCY - 36.4), 1e5, yC + (WCY + 1.2))
        else fxMask(g.mesh, false)
        const blur = (p.cBlur / 100) * WORDMARK_SIZE.height * (1 - e) + (fadeBlur / 100) * XH
        finish(g, ce(clamp(k / 0.7)), blur)
      })

      // ---------------- intimissimi: its frame comes up, the letters rise inside it, left → right
      const iS = G.iS
      const [ox, oy] = G.letOff
      frame.mesh.visible = G.frameOn
      if (G.frameOn) {
        const fe = seg(u, p.fAt, p.fDur, 'sine.inOut')
        frame.mesh.position.set(xI, 0, 0)
        frame.mesh.scale.setScalar(iS)
        fxMask(frame.mesh, false)
        finish(frame, fe, (1 - fe) * 0.6 * XH * 0.2 + (fadeBlur / 100) * XH, iS)
      }
      const ie = ease(p.iEase)
      const travelI = LET.h * iS * (p.iY / 100)
      letters.forEach((l, j) => {
        const t0 = p.iAt + rank(p.iOrder, j, letters.length, permI) * p.iStagger
        const k = clamp((u - t0) / Math.max(1e-4, p.iDur))
        const e = ie(k)
        l.mesh.visible = k > 0
        if (k <= 0) return
        l.mesh.position.set(xI + ox, oy - travelI * (1 - e), 0)
        l.mesh.scale.setScalar(iS)
        if (p.iMask) fxMask(l.mesh, true, -1e5, oy + LET.bottom * iS - 0.8, 1e5, oy + LET.top * iS + 0.8)
        else fxMask(l.mesh, false)
        const blur = (p.iBlur / 100) * LET.h * iS * 1.6 * (1 - e) + (fadeBlur / 100) * XH
        finish(l, ie(clamp(k / 0.7)), blur, iS)
      })
    },

    late() {
      if (!root.visible) return
      root.updateWorldMatrix(true, false)
      maskInv.copy(root.matrixWorld).invert()
    },
  }
}
