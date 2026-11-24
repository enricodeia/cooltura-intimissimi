// V5 · cooltura* × intimissimi on the paper (world space: the camera arrives on
// it and leaves it). Same composition and reveal as option 1 (the × in the
// centre, drawn with the stroke of intimissimi's frame; the two logotypes as
// wide as each other; cooltura letter by letter from the right, intimissimi from
// the left inside its frame), with one difference: the asterisk of cooltura* is
// not drawn here. It is the pen: it leaves the logo at the start
// (machina/actor.js draws it).

import * as THREE from 'three'
import { wordmark, WORDMARK_SIZE, WORDMARK_STAR, loadIntimissimi, svgGeometry, intiMetrics, lockupMetrics } from '../lib/brand.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { rank } from '../lib/kinetic.js'
import { seg, clamp, ease, DEG, seededOrder } from '../core/util.js'

const WCX = WORDMARK_SIZE.width / 2
const WCY = WORDMARK_SIZE.height / 2
const XH = 27.2 // cooltura x-height (the "c"), SVG units
const XH_MID = 22 // its middle, SVG y (down)
const BASE = 34.7 // cooltura baseline, SVG y (down)

let INTI = null // { letters, frameShapes, M (intiMetrics) }

/** Load the intimissimi artwork once (the layout needs its measures). */
export async function initLockup() {
  if (INTI) return INTI
  const inti = await loadIntimissimi()
  INTI = { letters: inti.letters, frameShapes: inti.frameShapes, M: intiMetrics(inti) }
  return INTI
}

/**
 * Where everything of the lockup is, in world units, centred on (cx, cy)
 * (cy = the middle of cooltura's x-height). Needs initLockup().
 */
export function lockupLayout(view, p, cx, cy) {
  const G = lockupMetrics(p, INTI.M)
  const xs = G.xs
  const gap = G.gap
  const iS = G.iS
  const cW = G.cW
  // symmetric about the ×
  const Lt = 2 * Math.max(G.left, G.right)
  const short = Math.min(view.w, view.h)
  const S = Math.min((short * 0.8) / Lt, (view.w * 0.8) / Lt) * p.scale
  const xC = G.xC
  const xX = 0
  const xI = G.xI
  const yC = XH_MID - WCY
  const W = (lx, ly) => [cx + lx * S, cy + ly * S]
  const [sx, sy] = W(xC + (WORDMARK_STAR.x - WCX), yC - (WORDMARK_STAR.y - WCY))
  const [gx] = W(xC + WCX + gap / 2, 0)
  const baseY = cy + (yC - (BASE - WCY)) * S
  const floorY = baseY - XH * p.floor * S
  return {
    S,
    cx,
    cy,
    xs,
    gap,
    iS,
    G,
    Lt,
    xC,
    xX,
    xI,
    yC,
    star: { x: sx, y: sy, d: WORDMARK_STAR.size * S },
    gapX: gx,
    baseY,
    floorY,
    hookR: XH * p.hookR * S,
    box: { x0: cx - (Lt / 2) * S, x1: cx + (Lt / 2) * S, y0: floorY, y1: cy + (yC + WCY + 1) * S },
  }
}

/** The star glyph of the wordmark, centred on its own centre, 1 unit = 1 SVG unit (diameter ≈ 10). */
export function starGeometry() {
  const g = wordmark().find((x) => x.ch === '*')
  return svgGeometry(g.shapes, { cx: WORDMARK_STAR.x, cy: WORDMARK_STAR.y, k: 1 })
}
export const STAR_D = WORDMARK_STAR.size

export class LockupView {
  constructor(parent) {
    this.root = new THREE.Group()
    this.root.visible = false
    parent.add(this.root)
    this.maskInv = new THREE.Matrix4()
    const mk = (geo) => {
      const mat = fxMaterial({ maskInv: this.maskInv })
      const mesh = fxMesh(geo, mat)
      this.root.add(mesh)
      return { mesh, mat }
    }
    const glyphs = wordmark()
    this.nCool = glyphs.length
    this.cool = glyphs.map((g, j) => (g.ch === '*' ? { star: true, j, box: g.box } : { ...mk(svgGeometry(g.shapes, { cx: WCX, cy: WCY, k: 1 })), box: g.box, j }))
    this.letters = INTI.letters.map((l) => mk(svgGeometry(l.shapes, { cx: INTI.M.ICX, cy: INTI.M.ICY, k: 1 })))
    this.frame = mk(svgGeometry(INTI.frameShapes, { cx: INTI.M.FR.cx, cy: INTI.M.FR.cy, k: 1 }))
    const bar = new THREE.PlaneGeometry(1, 1)
    this.bars = [mk(bar), mk(bar)]
    this.permC = seededOrder(this.cool.length, 13)
    this.permI = seededOrder(this.letters.length, 17)
    this.col = new THREE.Color()
    this.star = { y: 0, op: 0, blur: 0, mask: [0, 0, 0, 0] } // the star's own reveal (the pen copies it while it rests in the logo)
  }

  /** u = seconds since the reveal started. */
  pose(ctx, g, p, u, visible) {
    this.root.visible = visible
    if (!visible) {
      // the pen copies the star while it rests in the logo: with the logo off it is off too,
      // never the value left by another frame (after the logo, a replay showed it over "Creators.")
      this.star.on = false
      this.star.op = 0
      return
    }
    const S = g.S
    this.root.position.set(g.cx, g.cy, 0)
    this.root.scale.setScalar(S)
    this.col.set(ctx.col(p.logoColor))
    const px = S * ctx.pxPerWorld
    const finish = (m, op, blurUnits, localScale = 1) => {
      m.mat.uniforms.uColor.value.copy(this.col)
      m.mat.uniforms.uOpacity.value = op
      m.mesh.visible = op > 0.002
      fxBlur(m.mesh, blurUnits / localScale, 0, 0, px * localScale)
    }
    // ×
    const xe = seg(u, p.xAt, p.xDur, p.xEase)
    const thick = g.G.thick
    this.bars.forEach((b, i) => {
      b.mesh.position.set(g.xX, 0, 0)
      b.mesh.rotation.set(0, 0, (i ? -45 : 45) * DEG)
      b.mesh.scale.set(Math.max(1e-4, g.xs * Math.SQRT2 * xe), thick, 1)
      fxMask(b.mesh, false)
      finish(b, clamp(xe * 3), 0)
    })
    // cooltura
    const ce = ease(p.cEase)
    const travelC = WORDMARK_SIZE.height * (p.cY / 100)
    const maskLo = g.yC + (WCY - 36.4)
    const maskHi = g.yC + (WCY + 1.2)
    this.cool.forEach((gl) => {
      const t0 = p.cAt + rank(p.cOrder, gl.j, this.nCool, this.permC) * p.cStagger
      const k = clamp((u - t0) / Math.max(1e-4, p.cDur))
      const e = ce(k)
      const blur = (p.cBlur / 100) * WORDMARK_SIZE.height * (1 - e)
      if (gl.star) {
        // world-space copy for the pen: offset, opacity, blur, mask rect
        this.star.y = -travelC * (1 - e) * S
        this.star.op = k > 0 ? ce(clamp(k / 0.7)) : 0
        this.star.blur = blur * S
        this.star.mask = [g.cx - 1e4, g.cy + maskLo * S, g.cx + 1e4, g.cy + maskHi * S]
        this.star.on = k > 0
        return
      }
      gl.mesh.visible = k > 0
      if (k <= 0) return
      gl.mesh.position.set(g.xC, g.yC - travelC * (1 - e), 0)
      fxMask(gl.mesh, true, -1e5, maskLo, 1e5, maskHi)
      finish(gl, ce(clamp(k / 0.7)), blur)
    })
    // intimissimi: its frame comes up, the letters rise inside it
    const ie = ease(p.iEase)
    const LET = INTI.M.LET
    const [ox, oy] = g.G.letOff
    this.frame.mesh.visible = g.G.frameOn
    if (g.G.frameOn) {
      const fe = seg(u, p.fAt ?? 0.16, p.fDur ?? 0.55, 'sine.inOut')
      this.frame.mesh.position.set(g.xI, 0, 0)
      this.frame.mesh.scale.setScalar(g.iS)
      fxMask(this.frame.mesh, false)
      finish(this.frame, fe, (1 - fe) * XH * 0.12, g.iS)
    }
    const travelI = LET.h * g.iS * (p.iY / 100)
    this.letters.forEach((l, j) => {
      const t0 = p.iAt + rank(p.iOrder, j, this.letters.length, this.permI) * p.iStagger
      const k = clamp((u - t0) / Math.max(1e-4, p.iDur))
      const e = ie(k)
      l.mesh.visible = k > 0
      if (k <= 0) return
      l.mesh.position.set(g.xI + ox, oy - travelI * (1 - e), 0)
      l.mesh.scale.setScalar(g.iS)
      fxMask(l.mesh, true, -1e5, oy + LET.bottom * g.iS - 0.8, 1e5, oy + LET.top * g.iS + 0.8)
      finish(l, ie(clamp(k / 0.7)), (p.iBlur / 100) * LET.h * g.iS * 1.6 * (1 - e), g.iS)
    })
  }

  late() {
    if (!this.root.visible) return
    this.root.updateWorldMatrix(true, false)
    this.maskInv.copy(this.root.matrixWorld).invert()
  }
}
