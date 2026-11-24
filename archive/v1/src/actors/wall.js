// The video wall. One video (Nicole Pieretto) opens full frame; the camera pulls
// back and it turns out to be one tile of a wall of creator videos laid on a
// large sphere ("bombato"). Tiles pop from the centre outwards, the rows start
// turning in alternate directions, the lights go down behind the numbers, and
// at the end every tile flies into one pile: the pile becomes the phone screen.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { heroCard, wallMetrics, heroCamZ, phoneLayout, PHONE } from './shared.js'
import { CAM_D } from '../engine/engine.js'
import { seg, lerp, clamp, ease, hash, mod, wrapSym, DEG } from '../core/util.js'

export const ROWS = 7
export const COLS = 17
export const HERO = 'hero.mp4'
/** Media time of the hero video: it runs unbroken from the opening to the phone's feed. */
export const heroTime = (t, T) => Math.max(0, t - T.shot('hero').start)

export function createWall(engine) {
  const videos = engine.videos
  // the wall's videos, ordered so the hero's own slot in the pattern is Nicole Pieretto
  const all = videos.keys('grid/').sort()
  const nic = all.findIndex((k) => k.includes('nicole-pieretto'))
  const SLOT = mod(Math.floor(COLS / 2) + 5, all.length)
  if (nic >= 0) [all[nic], all[SLOT]] = [all[SLOT], all[nic]]

  const group = new THREE.Group()
  engine.scene.add(group)
  const geo = new THREE.PlaneGeometry(1, 1)
  const tiles = []
  const mid = Math.floor(ROWS / 2)
  for (let r = -mid; r <= mid; r++) {
    for (let i = 0; i < COLS; i++) {
      const isHero = r === 0 && i === Math.floor(COLS / 2)
      const key = isHero ? HERO : all[mod(i + r * 11 + 5, all.length)]
      const mat = tileMaterial(videos.tex(key))
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      group.add(mesh)
      tiles.push({ mesh, mat, r, i, key, isHero, seed: hash(r * 31 + i * 7 + 3), layer: tiles.length })
    }
  }
  const offsets = new Map(all.map((k, n) => [k, hash(n * 5.3 + 1) * 5]))

  const pos = new THREE.Vector3()
  const v = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const qStack = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const Z = new THREE.Vector3(0, 0, 1)

  return {
    keys: all,
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('wall')
      const P = sc.p
      const hero = T.shot('hero')
      const reveal = T.shot('reveal')
      const stack = T.shot('stack')
      const stats = sc.shots.filter((s) => s.type === 'stat')
      const visible = t >= hero.start && t < stack.end
      group.visible = visible
      if (!visible) return

      const W = wallMetrics(view, P)
      const card = heroCard(view, hero.p)
      const openDur = Math.min(hero.p.openDur, hero.dur)

      // ---- camera: close on the hero tile, then the pull back
      const dolly = seg(t, reveal.start, reveal.dur * reveal.p.dollyEnd, reveal.p.dollyEase)
      ctx.camera.position.z = lerp(heroCamZ(view, W, card), CAM_D, dolly)

      // ---- rows: speed ramps up from standstill, then constant
      const ts = reveal.start + reveal.dur * reveal.p.spinFrom
      const ramp = Math.max(0.05, reveal.end - ts)
      const travel = t <= ts ? 0 : t < ts + ramp ? (t - ts) ** 2 / (2 * ramp) : ramp / 2 + (t - ts - ramp)

      // ---- lights down behind the numbers, back up as the tiles gather
      const s0 = stats[0]
      const dimP = P.dimOn && s0 ? seg(t, s0.start - 0.08, P.dimDur, 'power2.inOut') : 0
      const undim = seg(t, stack.start, stack.dur * 0.7, 'power2.inOut')
      const dim = 1 - (1 - P.dim * dimP * (1 - undim)) ** 2.2 // perceptual: the mix happens in linear light
      const blur = P.blur * dimP * (1 - undim)
      ctx.bg.a = ctx.col('paper')
      ctx.bg.b = ctx.col('ink')
      ctx.bg.mode = 'fade'
      ctx.bg.mix = Math.max(dimP, seg(t, stack.start, stack.dur * 0.5, 'power2.inOut'))

      // ---- the pile the tiles collapse into = the phone's screen in its build pose
      const L = phoneLayout(view, T.scene('phone').p)
      const scrW = PHONE.sw * L.build.s
      const scrH = PHONE.sh * L.build.s
      const scrR = PHONE.sr * L.build.s
      const zStack = (PHONE.t / 2) * L.build.s + 0.01
      const stackU = (t - stack.start) / stack.dur
      const stacking = t >= stack.start
      const sEase = ease(stack.p.stackEase)
      const settle = seg(stackU, 0.58, 0.4, 'power3.inOut')

      const dMax = Math.hypot(view.w * 0.62, view.h * 0.62)
      const popE = ease(reveal.p.popEase)
      const tileR = P.corner * W.tileW
      const used = new Set()

      for (const tile of tiles) {
        const lat = (tile.r * (W.tileH + W.gap)) / W.R
        const cl = Math.cos(lat)
        const dLon = (W.tileW + W.gap) / (W.R * cl)
        const span = COLS * dLon
        const dir = P.alternate ? (tile.r % 2 === 0 ? 1 : -1) : 1
        const base = (tile.i - (COLS - 1) / 2) * dLon + (Math.abs(tile.r) % 2) * 0.5 * dLon
        const lon = wrapSym(base + (dir * P.speed * travel) / (W.R * cl), span)
        const d0 = Math.hypot(base * W.R * cl, lat * W.R) // distance from the hero tile before the rows move

        // sphere pose
        pos.set(W.center.x + W.R * Math.sin(lon) * cl, W.center.y + W.R * Math.sin(lat), W.center.z + W.R * Math.cos(lon) * cl)
        quat.setFromEuler(euler.set(-lat, lon, 0, 'YXZ'))

        let s = 1
        let zoom = 1
        let w = W.tileW
        let h = W.tileH
        let rad = tileR
        if (tile.isHero) {
          const o = seg(t, hero.start, openDur, hero.p.openEase)
          s = o
          zoom = (1 + hero.p.punch * (1 - o)) / Math.max(o, 1e-3) // the frame opens, the picture inside holds still
          rad = lerp((card.r * W.tileW) / card.w, tileR, dolly)
        } else {
          const delay = reveal.start + reveal.dur * (reveal.p.staggerFrom + reveal.p.staggerSpan * clamp(d0 / dMax))
          s = popE(clamp((t - delay) / reveal.p.popDur))
          rad = tileR * Math.min(1, s)
        }

        let us = 0
        if (stacking) {
          // the pile forms first (near tiles, then far ones); the hero video lands on top of it last, from the front
          const st = stack.p.stackStagger
          us = tile.isHero ? sEase(clamp((stackU - 0.42) / 0.58)) : sEase(clamp((stackU - clamp(d0 / (dMax * 1.6)) * st) / Math.max(0.05, 0.86 - st)))
          const zEnd = zStack + tile.layer * 0.0012
          v.set(pos.x, pos.y, pos.z - zEnd)
          v.applyAxisAngle(Z, stack.p.swirl * us * 1.2 * (tile.r % 2 === 0 ? 1 : -1))
          const lift = Math.sin(Math.PI * us) * (tile.isHero ? 1.9 : 0.9) // tiles swing towards the camera on their way
          pos.set(v.x * (1 - us), v.y * (1 - us), zEnd + v.z * (1 - us) + lift)
          const fan = tile.isHero ? 0 : (tile.seed - 0.5) * 2 * stack.p.fan * DEG * (1 - settle)
          qStack.setFromAxisAngle(Z, fan)
          quat.slerp(qStack, us)
          w = lerp(W.tileW, scrW, us)
          h = lerp(W.tileH, scrH, us)
          rad = lerp(rad, scrR, us)
        }
        if (tile.isHero) tile.layer = tiles.length + 2 // always the top card

        const show = s > 0.012 && (us > 0 || Math.abs(lon) < 1.25)
        tile.mesh.visible = show
        if (!show) continue
        tile.mesh.position.copy(pos)
        tile.mesh.quaternion.copy(quat)
        tile.mesh.scale.set(w * s, h * s, 1)
        const u = tile.mat.uniforms
        u.uSize.value.set(w * s, h * s)
        u.uRadius.value = rad
        u.uZoom.value = zoom
        u.uDim.value = tile.isHero && !stacking ? dim : dim * (1 - us)
        u.uBlur.value = blur * (1 - us)
        used.add(tile.key)
      }

      for (const key of used) {
        if (key === HERO) videos.want(HERO, heroTime(t, T))
        else videos.want(key, t + (offsets.get(key) || 0))
      }
    },
  }
}
