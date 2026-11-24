// Layout shared between actors: sizes are derived from the visible frame
// (view.w × view.h world units), so every aspect ratio keeps the whole
// composition inside the frame.

import * as THREE from 'three'
import { widthInCaps } from '../lib/type.js'

/** The opening video card: nearly full frame, 9:16, white margin around. */
export function openCard(view, margin = 0.04) {
  let h = view.h * (1 - 2 * margin)
  let w = (h * 9) / 16
  const maxW = view.w * (1 - 2 * margin)
  if (w > maxW) {
    w = maxW
    h = (w * 16) / 9
  }
  return { w, h }
}

/**
 * The opening's composition, in view units (the frame is view.w × view.h around 0):
 * the number and its subtitle sit low; the videos rest on the number, which
 * overlaps their bottom edge (the video is behind the number).
 *   yL label baseline · yN number baseline · capN / capL cap heights
 *   yB where the videos' bottom edge sits · yT the highest they go
 */
export function openingLayout(view, P, stats) {
  const widestN = Math.max(1, ...stats.map((s) => widthInCaps(String(s.p.value), s.p.weight)))
  const capN = Math.min(view.h * 0.21, (view.w * 0.84) / widestN) * (P.numberSize ?? 1)
  const widestL = Math.max(1, ...stats.map((s) => widthInCaps(String(s.p.label), s.p.labelWeight)))
  const capL = Math.min(view.h * 0.027, (view.w * 0.8) / widestL)
  const yL = -view.h / 2 + view.h * (P.bottom ?? 0.085)
  const yN = yL + capL + Math.max(capL * 1.3, capN * 0.17)
  const yB = yN + capN * (1 - (P.overlap ?? 0.45))
  const yT = view.h / 2 - view.h * 0.055
  return { capN, capL, yN, yL, yB, yT }
}

// The phone, in its own units (decimetres, an iPhone 15 Pro): 0.716 × 1.476.
export const PHONE = { w: 0.716, h: 1.476, t: 0.083, r: 0.118, sw: 0.664, sh: 1.424, sr: 0.092 }

/**
 * Where the phone stands in each phase.
 *  center: in the middle of the frame (the pile of videos becomes its screen)
 *  side:   right of the frame, tilted (numbers on the left)
 *  col:    the column left of it, for the numbers
 */
export function phoneLayout(view, p = {}) {
  const size = p.phoneSize ?? 1
  const portrait = view.aspect < 0.9
  const centerH = Math.min(view.h * 0.56, (view.w * 0.58 * PHONE.h) / PHONE.w) * size
  const sideH = (portrait ? Math.min(view.h * 0.46, (view.w * 0.4 * PHONE.h) / PHONE.w) : Math.min(view.h * 0.7, (view.w * 0.3 * PHONE.h) / PHONE.w)) * size
  const sideW = (sideH * PHONE.w) / PHONE.h
  const sideX = portrait ? view.w / 2 - sideW / 2 - view.w * 0.04 : view.w * 0.2 + sideW * 0.1
  // left column for the numbers: from the left margin to just short of the (tilted, so narrower) phone
  const colL = -view.w / 2 + view.w * (portrait ? 0.065 : 0.09)
  const colR = sideX - sideW * 0.46 - view.w * (portrait ? 0.03 : 0.06)
  return {
    center: { s: centerH / PHONE.h, x: 0, y: 0 },
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

/** Flat type material for the HUD: always on top of the 3D (no depth), fades with opacity. */
export function hudMaterial(color = '#8174f2') {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide })
}
