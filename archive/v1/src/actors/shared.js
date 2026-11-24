// Layout shared between actors: sizes are derived from the visible frame
// (view.w × view.h world units), so every aspect ratio keeps the whole
// composition inside the frame.

import * as THREE from 'three'
import { CAM_D } from '../engine/engine.js'
import { clamp } from '../core/util.js'

/** The opening video card: nearly full frame, 9:16, white margin around. */
export function heroCard(view, p) {
  const m = p.margin ?? 0.055
  let h = view.h * (1 - 2 * m)
  let w = (h * 9) / 16
  const maxW = view.w * (1 - 2 * m)
  if (w > maxW) {
    w = maxW
    h = (w * 16) / 9
  }
  return { w, h, r: (p.radius ?? 0.06) * w }
}

/** The wall: tile size, sphere radius, where its front sits. */
export function wallMetrics(view, p) {
  const tileW = clamp(view.w / 3.35, 1.25, 2.2) * (p.tile ?? 1)
  const tileH = (tileW * 16) / 9
  const k = tileW / 1.68
  const gap = (p.gap ?? 0.13) * k
  const R = (p.bulge ?? 12) * k
  const z0 = -2.6
  return { tileW, tileH, gap, R, z0, k, center: new THREE.Vector3(0, 0, z0 - R) }
}

/** Camera z from which a tile at the wall's front fills the hero card. */
export function heroCamZ(view, wall, card) {
  return wall.z0 + (wall.tileW * CAM_D) / card.w
}

// The phone, in its own units (decimetres, an iPhone 15 Pro): 0.716 × 1.476.
export const PHONE = { w: 0.716, h: 1.476, t: 0.083, r: 0.118, sw: 0.664, sh: 1.424, sr: 0.092 }

/**
 * Where the phone stands in each phase.
 *  build:  centred, facing us (the outline is a drawing)
 *  side:   right of the frame, tilted (numbers on the left)
 *  front:  close to the camera, low, so the island and the top of the screen show
 */
export function phoneLayout(view, p = {}) {
  const size = p.phoneSize ?? 1
  const portrait = view.aspect < 0.9
  const buildH = Math.min(view.h * 0.64, (view.w * 0.62 * PHONE.h) / PHONE.w) * size
  const sideH = (portrait ? Math.min(view.h * 0.46, (view.w * 0.4 * PHONE.h) / PHONE.w) : Math.min(view.h * 0.7, (view.w * 0.3 * PHONE.h) / PHONE.w)) * size
  const sideW = (sideH * PHONE.w) / PHONE.h
  const sideX = portrait ? view.w / 2 - sideW / 2 - view.w * 0.04 : view.w * 0.2 + sideW * 0.1
  // left column for the numbers: from the left margin to just short of the (tilted, so narrower) phone
  const colL = -view.w / 2 + view.w * (portrait ? 0.065 : 0.09)
  const colR = sideX - sideW * 0.46 - view.w * (portrait ? 0.03 : 0.06)
  return {
    build: { s: buildH / PHONE.h, x: 0, y: 0 },
    side: { s: sideH / PHONE.h, x: sideX, y: portrait ? -view.h * 0.02 : 0 },
    col: { x0: colL, x1: colR, w: colR - colL },
    portrait,
  }
}

/** Dispose every geometry / material / texture under an object. */
export function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose?.()
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of ms) {
      for (const v of Object.values(m.uniforms || {})) v?.value?.isTexture && v.value.userData?.own && v.value.dispose()
      m.map?.userData?.own && m.map.dispose()
      m.dispose?.()
    }
  })
}

/** Rebuild-on-change cache: memo(key, build, dispose). */
export function makeMemo() {
  const slots = new Map()
  return (slot, key, build, dispose) => {
    const cur = slots.get(slot)
    if (cur && cur.key === key) return cur.value
    if (cur) dispose?.(cur.value)
    const value = build()
    slots.set(slot, { key, value })
    return value
  }
}

/** World-space plane from a plane given in an object's local space (for clipping masks). */
const _n = new THREE.Vector3()
const _p = new THREE.Vector3()
const _m3 = new THREE.Matrix3()
export function planeFromLocal(plane, object, nx, ny, nz, px, py, pz) {
  _m3.getNormalMatrix(object.matrixWorld)
  _n.set(nx, ny, nz).applyMatrix3(_m3).normalize()
  _p.set(px, py, pz).applyMatrix4(object.matrixWorld)
  plane.setFromNormalAndCoplanarPoint(_n, _p)
  return plane
}
