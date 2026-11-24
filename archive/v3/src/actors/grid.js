// Campaigns. One video scales up on white; the camera pulls back as "311" turns
// in like a cube, letter by letter, over "Creators". "5 campaigns": the row of
// videos slides out from behind it. "One shared vision": every other row grows
// out of the centre onto a flat grid (rows drifting in alternate directions),
// the number leaves, and the central line opens: its videos part to the sides,
// the rows above and below step apart, and the words come up in the gap, from
// violet at 0 to ink. Then the videos leave from the centre outwards.
//
// The videos are never treated: no dimming, no blur, no tint, exactly their pixels.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { Kinetic } from '../lib/kinetic.js'
import { poseType } from './texts.js'
import { openingLayout, openCard } from './shared.js'
import { CAM_D, VIEW_H } from '../engine/engine.js'
import { seg, lerp, clamp, mod, wrapSym } from '../core/util.js'

export const HERO = 'v3/hero.mp4'
const HERO_SLUG = 'aria-alice-muzza'
const H = 1 // tile height, world units
const W = (H * 9) / 16
const M = 9 // columns either side of the centre

let _h = 0
const strHash = (s) => {
  _h = 2166136261
  for (let i = 0; i < s.length; i++) _h = Math.imul(_h ^ s.charCodeAt(i), 16777619)
  return (_h >>> 0) / 4294967296
}
/** Media time of a grid video at film time t (each one starts at its own point). */
export const tileTime = (key, t) => t + 0.3 + strHash(key) * 3.8

/** ∫ of a smoothstep ramp that starts at a and lasts L (0 before; then grows at slope 1). */
function rampInt(t, a, L) {
  if (t <= a) return 0
  const x = (t - a) / L
  if (x >= 1) return L / 2 + (t - a - L)
  return L * (x * x * x - (x * x * x * x) / 2)
}

export function createGrid(engine) {
  const videos = engine.videos
  const all = videos
    .keys('v3/grid/')
    .filter((k) => !k.includes(HERO_SLUG))
    .sort()
  const group = new THREE.Group()
  group.visible = false
  engine.scene.add(group)
  const geo = new THREE.PlaneGeometry(1, 1)

  // ---------------------------------------------------------------- the grid (rebuilt when its shape changes)
  let built = ''
  let tiles = []
  function build(P) {
    const rows = Math.max(3, Math.min(11, Math.round(P.rows) | 1))
    const key = `${rows}`
    if (key === built) return
    built = key
    for (const t of tiles) {
      group.remove(t.mesh)
      t.mat.dispose()
    }
    tiles = []
    const mid = (rows - 1) / 2
    for (let r = -mid; r <= mid; r++) {
      for (let j = -M; j <= M; j++) {
        const isHero = r === 0 && j === 0
        const vkey = isHero ? HERO : all[mod(j * 7 + r * 11 + 3, all.length)]
        const mat = tileMaterial(videos.tex(vkey))
        const mesh = new THREE.Mesh(geo, mat)
        mesh.visible = false
        group.add(mesh)
        tiles.push({ mesh, mat, r, j, k: Math.abs(j), side: Math.sign(j), key: vkey, isHero, mid })
      }
    }
  }

  // ---------------------------------------------------------------- the number + its subtitle (HUD)
  const nums = { creators: new Kinetic(engine.hud), campaigns: new Kinetic(engine.hud) }
  const labs = { creators: new Kinetic(engine.hud), campaigns: new Kinetic(engine.hud) }
  const vision = new Kinetic(engine.hud)
  const blocks = [...Object.values(nums), ...Object.values(labs), vision]

  return {
    get keys() {
      return [HERO, ...all]
    },
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('campaigns')
      const P = sc.p
      const S1 = T.shot('creators')
      const S2 = T.shot('campaigns')
      const S3 = T.shot('vision')
      const S4 = T.shot('vision-out')
      const p1 = S1.p
      const p2 = S2.p
      const p3 = S3.p
      const p4 = S4.p
      const visible = t >= S1.start - 0.15 && t < S4.end + 0.05
      group.visible = visible
      for (const b of blocks) b.group.visible = false
      if (t < S1.start - 0.6 || t > S4.end + 1.5) return
      build(P)
      const g = P.gap * H
      const pitchX = W + g
      const pitchY = H + g
      const span = (2 * M + 1) * pitchX
      const Lo = openingLayout(view, P, [S1, S2])

      // ---------------- camera: one target per beat (log distance, so zooms feel even)
      const card1 = openCard(view, p1.margin)
      const cam = (d, cy) => ({ ld: Math.log(d), cy })
      const anchored = (hs, bottomY) => {
        const d = (H * CAM_D) / hs
        return cam(d, -H / 2 - (bottomY * d) / CAM_D)
      }
      const hs2 = Math.min((Lo.yT - Lo.yB) * 0.98, view.w * 0.64 * (16 / 9))
      const hs3 = Math.min(hs2 * 0.6, view.w * 0.34 * (16 / 9))
      const C1 = cam((H * CAM_D) / card1.h, 0)
      const C2 = anchored(hs2, Lo.yB)
      const C3 = anchored(hs3, Lo.yB)
      const D4 = (P.gridView * pitchY * CAM_D) / VIEW_H
      const C4 = cam(D4, 0)
      let ld = C1.ld
      let cy = C1.cy
      const step = (C, t0, d, e) => {
        const k = seg(t, t0, d, e)
        ld = lerp(ld, C.ld, k)
        cy = lerp(cy, C.cy, k)
      }
      step(C2, S1.start + p1.camAt, p1.camDur, p1.camEase)
      step(C3, S2.start + p2.rowAt - 0.05, p2.camDur, p2.camEase)
      step(C4, S3.start + p3.gridAt, p3.camDur, p3.camEase)
      const D = Math.exp(ld)
      if (visible) ctx.camera.position.set(0, cy, D)
      const halfW = ((view.w / 2) * D) / CAM_D // visible half width at the grid, world
      const halfH = ((view.h / 2) * D) / CAM_D

      // ---------------- schedules
      const heroScale = lerp(p1.from, 1, seg(t, S1.start, p1.scaleDur, p1.scaleEase))
      const unfoldQ = (q) => seg(t, S2.start + p2.rowAt + (q - 1) * p2.rowStagger, p2.rowDur, p2.rowEase)
      const driftStart = S3.start + p3.gridAt + 0.2
      const drift = (P.speed > 0 ? P.speed : 0) * rampInt(t, driftStart, 1.2)
      const tOpen = S3.start + p3.openAt
      const openE = seg(t, tOpen, p3.openDur, p3.openEase)
      const tileR = P.corner * W
      const used = new Set()
      const maxDist = Math.hypot(halfW, halfH) + W

      for (const tile of tiles) {
        const m = tile.mesh
        let x = tile.j * pitchX
        let y = tile.r * pitchY
        let z = 0
        let s = 1
        let zoom = 1
        let rad = tileR
        if (tile.isHero) {
          s = heroScale
          zoom = Math.pow(Math.max(s, 0.05), -p1.parallax) // the picture grows a little less than its frame
          rad = lerp(p1.radius * W, tileR, seg(t, S1.start + p1.camAt, p1.camDur, p1.camEase))
          // the line opens: the first video gives way at the centre
          s *= 1 - seg(t, tOpen, p3.openDur * 0.6, 'ci.exit')
        } else if (tile.r === 0) {
          // the row: each card slides out from behind its neighbour (it never passes it)
          let acc = 0
          let last = 0
          for (let q = 1; q <= tile.k; q++) {
            last = unfoldQ(q)
            acc += last
          }
          if (last <= 0) {
            m.visible = false
            continue
          }
          x = tile.side * pitchX * acc
          z = -(0.04 + 0.004 * tile.k) * (1 - last)
          // the line opens like a curtain: every card slides out to its side together (nothing overlaps)
          x += tile.side * (halfW + W) * openE * 1.05
        } else {
          // every other row grows out of the centre, by distance
          const d0 = Math.hypot(tile.j * pitchX, tile.r * pitchY) / Math.max(1e-3, maxDist)
          s = seg(t, S3.start + p3.gridAt + clamp(d0) * p3.gridSpan, p3.gridDur, p3.gridEase)
          const dir = tile.r % 2 === 0 || !P.alternate ? 1 : -1
          x = wrapSym(tile.j * pitchX + dir * drift, span)
          y += Math.sign(tile.r) * p3.spread * H * openE
        }
        // out: from the centre of the frame outwards
        const dOut = Math.hypot(x, y - cy) / Math.max(1e-3, maxDist)
        s *= 1 - seg(t, S4.start + p4.tilesAt + clamp(dOut) * p4.tilesSpan, p4.tilesDur, p4.tilesEase)
        const w = W * s
        const h = H * s
        const onScreen = Math.abs(x) - w / 2 < halfW + 0.02 && Math.abs(y - cy) - h / 2 < halfH + 0.02
        m.visible = visible && s > 0.002 && onScreen
        if (!m.visible) continue
        const u = tile.mat.uniforms
        m.position.set(x, y, z)
        m.scale.set(w, h, 1)
        u.uSize.value.set(w, h)
        u.uRadius.value = rad * s
        u.uZoom.value = zoom
        u.uDim.value = 0
        u.uBlur.value = 0
        used.add(tile.key)
      }
      for (const key of used) videos.want(key, key === HERO ? Math.max(0, t - S1.start) : tileTime(key, t))

      // ---------------- the number (cube in chars) and the subtitle
      const numPose = (kt, sh, outPh) => {
        const p = sh.p
        const capN = Lo.capN * p.size
        kt.set({ text: String(p.value), weight: p.weight, align: 'center' })
        kt.group.position.set(0, Lo.yN + capN / 2, 0)
        kt.group.scale.setScalar(capN)
        const inPh = { at: sh.start + p.nAt, dur: p.nDur, stagger: p.nStagger, order: p.nOrder, split: p.nSplit, ease: p.nEase, x: 0, y: 0, rot: p.nRot, depth: p.nDepth, scale: 1, blur: p.nBlur, opacity: 0, mask: false }
        kt.pose(t, { in: inPh, out: outPh, from: ctx.col(p.color), to: ctx.col(p.color), motion: 0.6, fps: ctx.fps, px: capN * ctx.pxPerUnit })
      }
      const labPose = (kt, sh, outAt) => {
        const p = sh.p
        const capL = Lo.capL * p.labelSize
        kt.set({ text: String(p.label), weight: p.labelWeight, align: 'center' })
        kt.group.position.set(0, Lo.yL + capL / 2, 0)
        kt.group.scale.setScalar(capL)
        const inPh = { at: sh.start + p.lAt, dur: p.lDur, stagger: p.lStagger, order: 'start', split: p.lSplit, ease: p.lEase, x: 0, y: p.lY, rot: 0, depth: 0, scale: 1, blur: p.lBlur, opacity: 0, mask: p.lMask }
        const outPh = { at: outAt, dur: 0.5, stagger: p.lStagger * 0.7, order: 'start', split: p.lSplit, ease: 'ci.exit', x: 0, y: -p.lY, rot: 0, depth: 0, scale: 1, blur: p.lBlur, opacity: 0, mask: p.lMask }
        kt.pose(t, { in: inPh, out: outPh, from: ctx.col(p.labelColor), to: ctx.col(p.labelColor), motion: 0.6, fps: ctx.fps, px: capL * ctx.pxPerUnit })
      }
      if (t < S3.end) {
        // 311 leaves turning up as 5 turns in (the next shot's own cube), 5 leaves at the grid
        const cubeOut = (sh) => ({ at: sh.start + sh.p.nAt, dur: sh.p.nDur, stagger: sh.p.nStagger, order: sh.p.nOrder, split: sh.p.nSplit, ease: sh.p.nEase, x: 0, y: 0, rot: -sh.p.nRot, depth: sh.p.nDepth, scale: 1, blur: sh.p.nBlur, opacity: 0, mask: false })
        const lastOut = { at: S3.start + p3.numOutAt, dur: p3.numOutDur, stagger: p3.numOutStagger, order: 'start', split: p2.nSplit, ease: p3.numOutEase, x: 0, y: 0, rot: p3.numOutRot, depth: p2.nDepth, scale: 1, blur: p2.nBlur, opacity: 0, mask: false }
        numPose(nums.creators, S1, cubeOut(S2))
        numPose(nums.campaigns, S2, lastOut)
        labPose(labs.creators, S1, S2.start + p2.lAt - 0.12)
        labPose(labs.campaigns, S2, S3.start + p3.numOutAt)
      }

      // ---------------- "One shared vision" in the opened line
      const gapView = ((H + 2 * g + 2 * p3.spread * H) * CAM_D) / D // the opened band, view units
      const capMax = gapView * 0.3
      const want = (p3.size / 100) * Math.min(view.w, view.h)
      poseType(vision, ctx, p3, { start: S3.start, end: S4.end, sizeK: Math.min(1, capMax / Math.max(1e-3, want)) })
    },

    late() {
      for (const b of blocks) b.late()
    },
  }
}
