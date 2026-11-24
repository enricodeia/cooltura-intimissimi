// The four numbers of the opening: flat, violet, in front of the videos. They
// live in the HUD (view units, whatever the camera does). The first one comes in
// zooming out; each next one turns in like a wheel, digit by digit, about X or
// Y; the subtitle changes through a mask; Instagram and TikTok flank the "2".
// The last number spins out and shrinks as the videos gather into the pile.

import * as THREE from 'three'
import { buildText, freeText } from '../lib/type.js'
import { instagramIcon, tiktokIcon, svgGeometry } from '../lib/brand.js'
import { solidMaterial } from '../lib/materials.js'
import { makeMemo, openingLayout, planeFromLocal, hudMaterial } from './shared.js'
import { seg, lerp, clamp, ease, DEG } from '../core/util.js'

const RD = 0.72 // drum radius, in cap heights
const IG_STOPS = ['#ffd15c', '#f77a1c', '#d62976', '#5b51d8']

export function createStats(engine) {
  const root = new THREE.Group()
  engine.hud.add(root)
  const memo = makeMemo()
  // label mask: two world planes, re-aimed every frame once the camera has moved (late)
  const clip = [new THREE.Plane(), new THREE.Plane()]
  let mask = null
  // number mask: digits turning in from below come up out of the baseline, never over the subtitle
  const numClip = [new THREE.Plane()]
  let numMask = null

  // ---- Instagram + TikTok as in V1: extruded, brand colours, behind the first number.
  // They live in the HUD too; a depth clear just before them keeps their own
  // faces in order while they stay in front of the videos.
  const ig = instagramIcon()
  const tk = tiktokIcon()
  const ICON_ORDER = 90
  const clearer = new THREE.Mesh(new THREE.PlaneGeometry(1e-3, 1e-3), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
  clearer.frustumCulled = false
  clearer.renderOrder = ICON_ORDER - 1
  clearer.onBeforeRender = (renderer) => renderer.clearDepth()
  root.add(clearer)
  const igMat = solidMaterial({ front: '#ffffff', side: '#8174f2', gradient: { stops: IG_STOPS, box: [-ig.w / ig.h / 2, -0.5, ig.w / ig.h, 1], dir: [0.5, 0.5] } })
  const igMesh = new THREE.Mesh(svgGeometry(ig.shapes, { cx: ig.w / 2, cy: ig.h / 2, k: 1 / ig.h, depth: 0.2, bevel: 0.018 }), igMat)
  const igGroup = new THREE.Group()
  igGroup.add(igMesh)
  const tkGeo = svgGeometry(tk.shapes, { cx: tk.w / 2, cy: tk.h / 2, k: 1 / tk.h, depth: 0.16, bevel: 0.016 })
  const tkThin = svgGeometry(tk.shapes, { cx: tk.w / 2, cy: tk.h / 2, k: 1 / tk.h, depth: 0.05, bevel: 0.01 })
  const tkMat = solidMaterial({ front: '#111114', side: '#3a3a44' }) // the note is black on a light page (TikTok's own light version)
  const tkCyan = solidMaterial({ front: '#25f4ee', side: '#12a8a4' })
  const tkRed = solidMaterial({ front: '#fe2c55', side: '#b01436' })
  const tkMain = new THREE.Mesh(tkGeo, tkMat)
  const tkC = new THREE.Mesh(tkThin, tkCyan)
  const tkR = new THREE.Mesh(tkThin, tkRed)
  tkC.position.set(-0.045, 0.04, -0.09)
  tkR.position.set(0.045, -0.04, -0.13)
  const tkGroup = new THREE.Group()
  tkGroup.add(tkR, tkC, tkMain)
  for (const m of [igMesh, tkMain, tkC, tkR]) m.renderOrder = ICON_ORDER
  root.add(igGroup, tkGroup)
  const iconMats = [igMat, tkMat, tkCyan, tkRed]

  const slots = []
  function slot(i) {
    if (!slots[i]) {
      const s = { num: new THREE.Group(), lab: new THREE.Group(), mat: hudMaterial(), labMat: hudMaterial('#0b0b0c') }
      s.labMat.clippingPlanes = clip
      s.mat.clippingPlanes = numClip
      root.add(s.num, s.lab)
      slots[i] = s
    }
    return slots[i]
  }

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('wall')
      const stats = sc.shots.filter((s) => s.type === 'stat')
      const stack = T.shot('stack')
      const first = stats[0]
      const last = stats[stats.length - 1]
      const outDur = Math.min(0.6, stack.dur * 0.5)
      const visible = !!first && t > first.start - 0.3 && t < stack.start + outDur + 0.02
      root.visible = visible
      mask = null
      numMask = null
      if (!visible) return
      const Lo = openingLayout(view, sc.p, stats)
      const yC = Lo.yN + Lo.capN / 2 // the number's vertical centre

      slots.forEach((s, i) => i >= stats.length && ((s.num.visible = false), (s.lab.visible = false)))
      const widths = []

      stats.forEach((sh, k) => {
        const p = sh.p
        const s = slot(k)
        const value = String(p.value)
        const blk = memo(
          'n' + k,
          `${value}|${p.weight}`,
          () => {
            const b = buildText(value, { weight: p.weight, cap: 1, by: 'chars', pivot: 'center', material: s.mat })
            b.units.forEach((u) => (u.mesh.renderOrder = 101))
            s.num.add(b.group)
            return b
          },
          (b) => {
            s.num.remove(b.group)
            freeText(b)
          },
        )
        const lab = memo(
          'l' + k,
          `${p.label}|${p.labelWeight}`,
          () => {
            const b = buildText(String(p.label), { weight: p.labelWeight, cap: 1, by: 'all', pivot: 'baseline', material: s.labMat })
            b.units.forEach((u) => (u.mesh.renderOrder = 101))
            s.lab.add(b.group)
            return b
          },
          (b) => {
            s.lab.remove(b.group)
            freeText(b)
          },
        )
        widths[k] = blk.width
        s.mat.color.set(ctx.col(p.color))
        s.labMat.color.set(ctx.col(p.labelColor))

        const prev = stats[k - 1]
        const next = stats[k + 1]
        // the wheel: in with this shot's roll, out with the next shot's (one rigid drum)
        const roll = (o) => ({ t0: o.start - o.p.rollDur / 2, dur: o.p.rollDur, st: o.p.digitStagger, e: ease(o.p.rollEase), A: o.p.angle * DEG, axis: o.p.axis })
        const inP = prev ? roll(sh) : null
        const outP = next ? roll(next) : null
        const n = blk.units.length
        const tStart = inP ? inP.t0 : sh.start - 0.3
        const tEnd = outP ? outP.t0 + outP.dur + outP.st * n : stack.start + outDur
        const on = t >= tStart && t <= tEnd
        s.num.visible = s.lab.visible = on
        if (!on) return

        // ---- the number
        let scale = Lo.capN * p.size
        let alpha = 1
        let ry = 0
        if (!prev) {
          // zoom out: from big and clear to its size
          const z = seg(t, sh.start - 0.08, p.zoomDur, p.zoomEase)
          scale *= lerp(p.zoomFrom, 1, z)
          alpha = clamp((t - sh.start + 0.08) / (p.zoomDur * 0.4))
        }
        if (!next) {
          // the last one spins out and shrinks as the videos gather
          const o = seg(t, stack.start, outDur, 'power3.in')
          scale *= 1 - o * 0.65
          ry = o * Math.PI * 0.48 // edge-on as it goes: never shown from the back
          alpha *= 1 - seg(t, stack.start + outDur * 0.35, outDur * 0.65, 'power2.in')
        }
        // the mask is open while the first number zooms out (it is bigger than its place then)
        numMask = !prev && t < sh.start + p.zoomDur ? -1e3 : Lo.yN - Lo.capN * 0.07
        s.num.position.set(0, yC, 0)
        s.num.scale.setScalar(Math.max(scale, 1e-4))
        s.num.rotation.set(0, ry, 0)
        blk.units.forEach((u, j) => {
          let phi = 0
          let axis = 'x'
          if (inP && t < inP.t0 + inP.dur + inP.st * n) {
            phi = -(1 - inP.e(clamp((t - inP.t0 - j * inP.st) / inP.dur))) * inP.A
            axis = inP.axis
          } else if (outP && t >= outP.t0) {
            phi = outP.e(clamp((t - outP.t0 - j * outP.st) / outP.dur)) * outP.A
            axis = outP.axis
          }
          const m = u.mesh
          const a = Math.abs(phi)
          m.visible = a < 1.5
          if (!m.visible) return
          if (axis === 'y') {
            m.position.set(u.x - RD * Math.sin(phi), u.y, -RD * (1 - Math.cos(phi)))
            m.rotation.set(0, -phi, 0)
          } else {
            m.position.set(u.x, u.y + RD * Math.sin(phi), -RD * (1 - Math.cos(phi)))
            m.rotation.set(-phi, 0, 0)
          }
        })
        // the digits fade as they turn edge-on (one material per number: the most turned digit sets it)
        s.mat.opacity = alpha

        // ---- the subtitle: up through a mask, the old one out before the new one comes in
        const labCap = Lo.capL * p.labelSize
        const step = labCap * 2.2
        let dy = 0
        if (inP) dy -= (1 - seg(t, inP.t0 + inP.dur * 0.4, 0.62, 'power3.out')) * step
        else dy -= (1 - seg(t, sh.start + 0.25, 0.7, 'power3.out')) * step
        if (outP) dy += seg(t, outP.t0, 0.42, 'power3.in') * step
        else dy += seg(t, stack.start, 0.45, 'power3.in') * step
        s.lab.position.set(0, Lo.yL + labCap * 0.5 + dy, 0)
        s.lab.scale.setScalar(labCap)
        mask = { lo: Lo.yL - labCap * 0.4, hi: Lo.yL + labCap * 1.35 }
      })

      // ---- Instagram + TikTok behind the first number (V1's placement and motion, smooth eases)
      const fp = first.p
      igGroup.visible = tkGroup.visible = clearer.visible = false
      if (fp.iconsOn) {
        const capN = Lo.capN * fp.size
        const size = capN * 0.66 * fp.iconSize
        const outAt = stats[1] ? stats[1].start - stats[1].p.rollDur / 2 - 0.22 : stack.start
        const dx = Math.min(view.w * 0.31, capN * 1.05)
        const spin = fp.iconFloat
        const place = (g, i, x, y) => {
          const a = seg(t, first.start + fp.zoomDur * 0.45 + i * 0.12, 0.8, 'power3.out')
          const o = seg(t, outAt + i * 0.07, 0.4, 'power3.in')
          const sz = size * a * (1 - o)
          g.visible = sz > 0.002
          if (!g.visible) return
          clearer.visible = true
          g.position.set(x, y + Math.sin(t * 1.7 + i * 2.1) * 0.05, -0.75)
          g.scale.setScalar(sz)
          g.rotation.set(Math.sin(t * 1.1 + i) * 0.14 * spin, Math.sin(t * 1.5 + i * 1.7) * 0.55 * spin + (1 - a) * 2.2, (i ? -1 : 1) * 0.12)
        }
        place(igGroup, 0, -dx, yC + capN * 0.62)
        place(tkGroup, 1, dx, yC - capN * 0.3)
        for (const m of iconMats) m.uniforms.uOpacity.value = 1
      }
    },

    late() {
      if (numMask !== null) planeFromLocal(numClip[0], engine.hud, 0, 1, 0, 0, numMask, 0)
      if (!mask) return
      planeFromLocal(clip[0], engine.hud, 0, 1, 0, 0, mask.lo, 0)
      planeFromLocal(clip[1], engine.hud, 0, -1, 0, 0, mask.hi, 0)
    },
  }
}
