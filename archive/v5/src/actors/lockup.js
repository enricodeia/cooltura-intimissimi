// cooltura × intimissimi, side by side: the two logotypes on one axis with a
// small, thin × between them, sized on cooltura's x-height; intimissimi is the
// plain logotype (no frame), its x-height on cooltura's. The × draws itself
// first, then the two logotypes open outwards from it: cooltura letter by letter
// from right to left, intimissimi from left to right. Out in opacity only, all
// together (nothing shrinks, nothing blurs unless asked). Used by intro A, at
// the end of intro B, and to close.

import * as THREE from 'three'
import { wordmark, WORDMARK_SIZE, loadIntimissimi, svgGeometry } from '../lib/brand.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { rank } from '../lib/kinetic.js'
import { seg, clamp, ease, DEG, seededOrder } from '../core/util.js'

const WCX = WORDMARK_SIZE.width / 2
const WCY = WORDMARK_SIZE.height / 2
const XH = 27.2 // cooltura x-height (the "c"), SVG units
const XH_MID = 22 // its middle, SVG y (down)

export async function createLockup(engine) {
  const inti = await loadIntimissimi()
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
  // intimissimi: the letters only (the logotype without its frame), centred on themselves
  let lx0 = Infinity
  let lx1 = -Infinity
  let ly0 = Infinity
  let ly1 = -Infinity
  for (const l of inti.letters)
    for (const s of l.shapes)
      for (const p of s.getPoints(6)) {
        lx0 = Math.min(lx0, p.x)
        lx1 = Math.max(lx1, p.x)
        ly0 = Math.min(ly0, p.y)
        ly1 = Math.max(ly1, p.y)
      }
  // its x-height: the "n" (second letter), from its top to the baseline
  let nTop = Infinity
  let base = -Infinity
  for (const s of inti.letters[1].shapes)
    for (const p of s.getPoints(6)) {
      nTop = Math.min(nTop, p.y)
      base = Math.max(base, p.y)
    }
  const ICX = (lx0 + lx1) / 2
  const ICY = (nTop + base) / 2 // the middle of its x-height on y = 0, like cooltura
  const letters = inti.letters.map((l) => ({ ...mk(svgGeometry(l.shapes, { cx: ICX, cy: ICY, k: 1 })) }))
  const LET = { top: -(ly0 - ICY), bottom: -(ly1 - ICY), h: ly1 - ly0, w: lx1 - lx0, xh: base - nTop }
  // the ×: two bars
  const barGeo = new THREE.PlaneGeometry(1, 1)
  const bars = [mk(barGeo), mk(barGeo)]
  const permC = seededOrder(cool.length, 13)
  const permI = seededOrder(letters.length, 17)
  const col = new THREE.Color()

  const lockups = (T) => T.shots.filter((s) => s.type === 'lockup')

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const sh = lockups(T).find((s) => t >= s.start - 0.4 && t < s.end + 0.02)
      root.visible = !!sh
      if (!sh) return
      const p = sh.p
      const u = t - sh.start
      col.set(ctx.col(p.logoColor))

      // ---------------- layout, in cooltura SVG units; S = view units per unit
      const xs = XH * p.xSize // the × is this tall (and wide)
      const gap = XH * 0.62 * p.gap
      const iS = (XH * p.intiSize) / LET.xh // intimissimi scale: its x-height on cooltura's
      const cW = WORDMARK_SIZE.width
      const iW = LET.w * iS
      const L = cW + gap + xs + gap + iW
      const short = Math.min(view.w, view.h)
      const S = Math.min((short * 0.84) / L, (view.w * 0.8) / L) * p.scale
      root.scale.setScalar(S)
      root.position.set(0, 0, 0)
      const xC = -L / 2 + cW / 2
      const xX = -L / 2 + cW + gap + xs / 2
      const xI = L / 2 - iW / 2
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

      // ---------------- ×
      const xe = seg(u, p.xAt, p.xDur, p.xEase)
      const thick = XH * 0.042 * p.xWeight
      bars.forEach((b, i) => {
        const len = xs * Math.SQRT2 * xe
        b.mesh.position.set(xX, 0, 0)
        b.mesh.rotation.set(0, 0, (i ? -45 : 45) * DEG + (1 - xe) * p.xSpin * DEG)
        b.mesh.scale.set(Math.max(1e-4, len), thick, 1)
        fxMask(b.mesh, false)
        finish(b, clamp(xe * 3), (p.outBlur / 100) * XH * (fadeBlur / Math.max(1, p.outBlur)))
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

      // ---------------- intimissimi: the letters rise, left → right
      const ie = ease(p.iEase)
      const travelI = LET.h * iS * (p.iY / 100)
      letters.forEach((l, j) => {
        const t0 = p.iAt + rank(p.iOrder, j, letters.length, permI) * p.iStagger
        const k = clamp((u - t0) / Math.max(1e-4, p.iDur))
        const e = ie(k)
        l.mesh.visible = k > 0
        if (k <= 0) return
        l.mesh.position.set(xI, -travelI * (1 - e), 0)
        l.mesh.scale.setScalar(iS)
        if (p.iMask) fxMask(l.mesh, true, -1e5, LET.bottom * iS - 0.8, 1e5, LET.top * iS + 0.8)
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
