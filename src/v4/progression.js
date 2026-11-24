// 02 · Campaigns / Creators: one number that keeps growing.
//   2 PLATFORMS   the first creator grows from the centre and fills the frame
//                 (her own voice: "Ciao ragazzi…"), the camera pulls back and a
//                 second one slides in beside her (TikTok · Instagram)
//   5 CAMPAIGNS   three more arrive from the right as a train that closes up
//   311 CREATORS  the row becomes the bottom of a wall of creators that grows
//                 upwards and sideways while the camera keeps pulling back
// The figure under the videos rolls 2 → 5 → 311 (reels through a mask), its word
// turns like a cube (PLATFORMS → CAMPAIGNS → CREATORS). Type always on the paper.
// In narrow frames the five sit three over two (a brick wall).

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { Kinetic } from '../lib/kinetic.js'
import { Counter } from '../lib/counter.js'
import { fxMaterial, fxMesh } from '../engine/fxlayer.js'
import { svgGeometry, tiktokIcon, instagramIcon } from '../lib/brand.js'
import { caseOf } from '../actors/shared.js'
import { keyOf, keysOf, voicedTime, ph } from './common.js'
import { seg, clamp, lerp, ease, hash } from '../core/util.js'

const A = 9 / 16

export function createProgression(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  engine.hud.add(root)
  const geo = new THREE.PlaneGeometry(1, 1)
  const tiles = []
  const tile = (i) => {
    if (!tiles[i]) {
      const mat = tileMaterial(videos.placeholder)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      root.add(mesh)
      tiles[i] = { mesh, mat }
    }
    return tiles[i]
  }
  const nums = [new Counter(engine.hud), new Counter(engine.hud), new Counter(engine.hud)]
  const labs = [new Kinetic(engine.hud), new Kinetic(engine.hud), new Kinetic(engine.hud)]
  // the platforms' glyphs, white, in the corner of the first two videos
  const glyph = (ic) => {
    const g = svgGeometry(ic.shapes, { cx: ic.w / 2, cy: ic.h / 2, k: 1 / Math.max(ic.w, ic.h) })
    const mesh = fxMesh(g, fxMaterial({ color: '#ffffff' }))
    engine.hud.add(mesh)
    mesh.visible = false
    return mesh
  }
  const icons = [glyph(tiktokIcon()), glyph(instagramIcon())]
  // the wall: every creator of the four folders, the row's five excluded
  const pool = videos.keys('v3/grid/')

  const shotsOf = (T) => ({ a: T.shots.find((s) => s.type === 'platforms'), b: T.shots.find((s) => s.type === 'campaigns'), c: T.shots.find((s) => s.type === 'creators') })

  return {
    keysFor(T) {
      const { a, b } = shotsOf(T)
      return [...keysOf(videos, a?.p.videos), ...keysOf(videos, b?.p.videos)]
    },
    update(ctx) {
      const { t, T, view } = ctx
      for (const x of tiles) if (x) x.mesh.visible = false
      for (const k of [...nums, ...labs]) k.group.visible = false
      for (const m of icons) m.visible = false
      const { a, b, c } = shotsOf(T)
      if (!a || !b || !c) return
      const t0 = a.start
      const t1 = c.end
      if (t < t0 - 0.05 || t > t1 + 0.05) return
      const portrait = view.aspect < 0.9
      const short = Math.min(view.w, view.h)
      const margin = view.h * 0.07
      const g = short * (portrait ? 0.025 : 0.022) // gap between videos

      // ---------------- the type under the videos
      const capN = Math.min(view.h * (portrait ? 0.085 : 0.12), view.w * 0.2)
      const capL = short * (portrait ? 0.03 : 0.024)
      const gapNL = Math.max(capL * 1.7, capN * 0.22)
      const blockH = capN + gapNL + capL
      const labBase = -view.h / 2 + margin
      const numBase = labBase + capL + gapNL
      const regTop = view.h / 2 - margin
      const regBot = numBase + capN + view.h * 0.05
      const regH = regTop - regBot
      const regCY = (regTop + regBot) / 2

      // ---------------- the stages' slots (view units: centre x, y and height)
      const W2 = Math.min((regH * A), (view.w * 0.86 - g) / 2)
      const H2 = W2 / A
      const pair = [-(W2 + g) / 2, (W2 + g) / 2].map((x) => ({ x, y: regCY, h: H2 }))
      let five
      let W5
      if (portrait) {
        W5 = Math.min((view.w * 0.9 - 2 * g) / 3, ((regH - g) / 2) * A)
        const H5 = W5 / A
        const yT = regCY + (H5 + g) / 2
        const yB = regCY - (H5 + g) / 2
        five = [
          { x: -(W5 + g), y: yT },
          { x: 0, y: yT },
          { x: W5 + g, y: yT },
          { x: -(W5 + g) / 2, y: yB },
          { x: (W5 + g) / 2, y: yB },
        ].map((s) => ({ ...s, h: W5 / A }))
      } else {
        W5 = Math.min((view.w * 0.9 - 4 * g) / 5, regH * A)
        five = [-2, -1, 0, 1, 2].map((k) => ({ x: k * (W5 + g), y: regCY, h: W5 / A }))
      }
      const H5 = W5 / A
      const pitchX = W5 + g
      const pitchY = H5 + g

      // ---------------- timing
      const pa = a.p
      const pb = b.p
      const pc = c.p
      const growK = ease(pa.growEase)(clamp((t - t0) / Math.max(1e-3, pa.growDur)))
      const pull = seg(t, t0 + pa.pullAt, pa.pullDur, pa.pullEase)
      const rowE = ease(pb.rowEase)
      const tRow = b.start + pb.rowAt
      const tGrid = c.start + pc.gridAt
      const gridK = seg(t, tGrid, pc.gridDur, pc.gridEase)
      const tOut = c.end - pc.outLead
      // the camera: pulls back about the bottom of the row's region as the wall grows
      const rowsUp = portrait ? 3 : 2
      const wallH = (rowsUp + (portrait ? 2 : 1)) * pitchY
      const s1 = Math.min(1, (regH * 1.02) / wallH)
      const cam = lerp(1, s1, gridK)
      const anchor = { x: 0, y: regBot }
      const toCam = (x, y) => ({ x: anchor.x + (x - anchor.x) * cam, y: anchor.y + (y - anchor.y) * cam })

      // ---------------- the opening card: from the centre to full height, then into the pair
      const open = (() => {
        let h = view.h * 0.92
        let w = h * A
        if (w > view.w * 0.92) {
          w = view.w * 0.92
          h = w / A
        }
        return { x: 0, y: 0, h }
      })()
      const lerpSlot = (p, q, k) => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), h: lerp(p.h, q.h, k) })

      const keysA = keysOf(videos, pa.videos)
      const keysB = keysOf(videos, pb.videos)
      const row = [...keysA.slice(0, 2), ...keysB.slice(0, 3)]
      const outK = (x, y) => {
        // leaving: from the centre out, shrinking a little and going
        const d = Math.hypot(x / view.w, (y - regCY) / view.h)
        return seg(t, tOut + d * 0.35, 0.42, 'ci.exit')
      }
      const draw = (i, key, s, opacity, mediaT, tight = false) => {
        if (!key || s.h <= 1e-3 || opacity <= 0.002) return
        const w = s.h * A
        if (s.x - w / 2 > view.w / 2 || s.x + w / 2 < -view.w / 2 || s.y - s.h / 2 > view.h / 2 || s.y + s.h / 2 < -view.h / 2) return
        const T_ = tile(i)
        T_.mesh.visible = true
        T_.mesh.position.set(s.x, s.y, 0)
        T_.mesh.scale.set(w, s.h, 1)
        const u = T_.mat.uniforms
        u.map.value = videos.want(key, Math.max(0, mediaT), tight)
        u.uSize.value.set(w, s.h)
        u.uRadius.value = w * 0.07
        u.uOpacity.value = opacity
        u.uDim.value = 0
        u.uBlur.value = 0
        u.uZoom.value = 1
        u.uShift.value.set(0, 0)
        T_.mat.transparent = opacity < 0.999
      }

      // the row's five (the first two from the platforms, three from the campaigns)
      for (let i = 0; i < row.length; i++) {
        let s
        if (i === 0) {
          const start = { x: 0, y: 0, h: open.h * pa.from }
          s = lerpSlot(lerpSlot(start, open, growK), pair[0], pull)
        } else if (i === 1) {
          const off = { x: view.w / 2 + W2 * 0.8, y: pair[1].y, h: H2 }
          s = lerpSlot(off, pair[1], pull)
          if (pull <= 0) continue
        } else {
          const k = i - 2
          const e = rowE(clamp((t - tRow - k * pb.rowStagger) / pb.rowDur))
          if (e <= 0) continue
          const off = { x: view.w / 2 + W5 * (1.2 + k * 0.9), y: five[i].y, h: H5 }
          s = lerpSlot(off, five[i], e)
        }
        // into the five: the pair closes up as the train arrives
        if (i < 2) s = lerpSlot(s, five[i], rowE(clamp((t - tRow) / pb.rowDur)))
        const P = toCam(s.x, s.y)
        s = { x: P.x, y: P.y, h: s.h * cam }
        const o = outK(s.x, s.y)
        s.h *= 1 - 0.12 * o
        s.y += o * view.h * 0.03
        const mediaT = i === 0 && pa.voiceOn ? voicedTime(pa, a.start, t) : videos.cleanStart(row[i], 3.2, 0.4 + i * 0.6) + (t - t0)
        draw(i, row[i], s, 1 - o, mediaT, i === 0 && pa.voiceOn)
        // the platforms' glyphs on the first two, once they stand side by side
        if (i < 2 && pa.icons) {
          const on = clamp((pull - 0.6) / 0.4) * (1 - rowE(clamp((t - tRow) / (pb.rowDur * 0.5))))
          if (on > 0.01) {
            const m = icons[i]
            const sz = s.h * A * 0.13
            m.visible = true
            m.position.set(s.x - (s.h * A) / 2 + sz * 0.95, s.y + s.h / 2 - sz * 0.95, 0)
            m.scale.setScalar(sz)
            m.material.uniforms.uOpacity.value = on
          }
        }
      }

      // ---------------- the wall: rows above (and around) the five, popping in from the row out
      if (gridK > 0) {
        let n = 0
        const cols = Math.ceil(view.w / (2 * pitchX * s1)) + 2
        // the rows: the five's own (their cells excluded), then the ones above, brick-laid
        const R = portrait
          ? [
              { y: five[0].y, half: false, skip: (c) => Math.abs(c) <= 1, still: true },
              { y: five[3].y, half: true, skip: (c) => c === -1 || c === 0, still: true },
              ...[1, 2, 3].map((k) => ({ y: five[0].y + k * pitchY, half: k % 2 === 1, skip: () => false })),
            ]
          : [{ y: regCY, half: false, skip: (c) => Math.abs(c) <= 2, still: true }, ...[1, 2].map((k) => ({ y: regCY + k * pitchY, half: k % 2 === 1, skip: () => false }))]
        R.forEach((row, ri) => {
          const drift = row.still ? 0 : (ri % 2 ? 1 : -1) * pc.speed * Math.max(0, t - tGrid) * pitchX
          for (let cI = -cols; cI <= cols; cI++) {
            if (row.skip(cI)) continue
            const P = toCam((cI + (row.half ? 0.5 : 0)) * pitchX + drift, row.y)
            const d = Math.hypot(P.x / view.w, (P.y - regBot) / view.h)
            const pop = ease('ci.reveal')(clamp((t - tGrid - d * pc.gridDur * 0.55) / (pc.gridDur * 0.5)))
            if (pop <= 0) continue
            const o = outK(P.x, P.y)
            const key = pool[Math.floor(hash(ri * 131 + cI * 17 + 7) * pool.length)]
            const s = { x: P.x, y: P.y + o * view.h * 0.03, h: H5 * cam * lerp(0.6, 1, pop) * (1 - 0.12 * o) }
            draw(5 + n++, key, s, pop * (1 - o), t - t0 + hash(cI + ri * 7) * 3)
          }
        })
      }

      // ---------------- the figure and its word
      const px = capN * ctx.pxPerUnit
      const color = ctx.col('ink')
      const from = ctx.col('rose')
      const vals = [pa.value, pb.value, pc.value].map(String)
      const words = [pa.label, pb.label, pc.label].map((s) => caseOf(s, true))
      const tN = [a.start + pa.nAt, b.start + pb.nAt, c.start + pc.nAt]
      nums.forEach((N, k) => {
        N.set({ value: vals[k], weight: '500', align: 'center', spins: k === 2 ? 6 : 3, step: 2 })
        N.group.position.set(0, numBase + capN / 2, 0)
        N.group.scale.setScalar(capN)
        const outAt = k < 2 ? tN[k + 1] : tOut + 0.08
        N.pose(t, {
          at: tN[k],
          dur: k === 2 ? 0.95 : 0.6,
          stagger: 0.06,
          order: 'end',
          ease: 'ci.emph',
          blur: 30,
          motion: 1,
          fromColor: from,
          color,
          px,
          fps: ctx.fps,
          out: { at: outAt, dur: k < 2 ? 0.36 : 0.42, stagger: 0.02, order: 'start', ease: 'ci.exit', y: -112, blur: 30, opacity: 0, mask: true },
        })
      })
      labs.forEach((L, k) => {
        const info = L.set({ text: words[k], weight: '500', align: 'left', tracking: 0.26 })
        L.group.position.set((-info.width * capL) / 2, labBase + capL / 2, 0)
        L.group.scale.setScalar(capL)
        const tin = k === 0 ? ph(tN[0] + 0.1, 0.62, { stagger: 0.02, y: 100, blur: 24, mask: true }) : ph(tN[k] + 0.04, 0.5, { stagger: 0.014, ease: 'cubic(0.6,0,0.2,1)', rot: 90, depth: 0.5, blur: 8 })
        const tout = k < 2 ? ph(tN[k + 1] + 0.04, 0.5, { stagger: 0.014, ease: 'cubic(0.6,0,0.2,1)', rot: -90, depth: 0.5, blur: 8 }) : ph(tOut + 0.1, 0.4, { stagger: 0.01, ease: 'ci.exit', y: -100, blur: 24, mask: true })
        L.pose(t, { in: tin, out: tout, from, to: ctx.col('mute'), motion: 0.6, fps: ctx.fps, px: capL * ctx.pxPerUnit })
      })
    },
    late() {
      for (const k of [...nums, ...labs]) k.late()
    },
  }
}
