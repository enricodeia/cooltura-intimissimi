// The first data beat, in front of the wall: 3D numbers that turn like a wheel
// (each digit rides a drum about the X or the Y axis), a subtitle that changes
// through a mask, and the two platform glyphs in 3D behind the first number.

import * as THREE from 'three'
import { buildText, widthInCaps } from '../lib/type.js'
import { solidMaterial, flatMaterial } from '../lib/materials.js'
import { instagramIcon, tiktokIcon, svgGeometry } from '../lib/brand.js'
import { makeMemo } from './shared.js'
import { seg, lerp, clamp, ease, DEG } from '../core/util.js'

const IG_STOPS = ['#ffd15c', '#f77a1c', '#d62976', '#5b51d8']

export function createStats(engine) {
  const root = new THREE.Group()
  engine.scene.add(root)
  const memo = makeMemo()
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)]

  // ---- platform glyphs (unit height, centred)
  const ig = instagramIcon()
  const tk = tiktokIcon()
  const igMat = solidMaterial({ front: '#ffffff', side: '#8174f2', gradient: { stops: IG_STOPS, box: [-ig.w / ig.h / 2, -0.5, ig.w / ig.h, 1], dir: [0.5, 0.5] } })
  const igMesh = new THREE.Mesh(svgGeometry(ig.shapes, { cx: ig.w / 2, cy: ig.h / 2, k: 1 / ig.h, depth: 0.2, bevel: 0.018 }), igMat)
  const igGroup = new THREE.Group()
  igGroup.add(igMesh)
  const tkGeo = svgGeometry(tk.shapes, { cx: tk.w / 2, cy: tk.h / 2, k: 1 / tk.h, depth: 0.16, bevel: 0.016 })
  const tkThin = svgGeometry(tk.shapes, { cx: tk.w / 2, cy: tk.h / 2, k: 1 / tk.h, depth: 0.05, bevel: 0.01 })
  const tkMat = solidMaterial({ front: '#ffffff', side: '#9a9aa6' })
  const tkCyan = solidMaterial({ front: '#25f4ee', side: '#12a8a4' })
  const tkRed = solidMaterial({ front: '#fe2c55', side: '#b01436' })
  const tkGroup = new THREE.Group()
  const tkMain = new THREE.Mesh(tkGeo, tkMat)
  const tkC = new THREE.Mesh(tkThin, tkCyan)
  const tkR = new THREE.Mesh(tkThin, tkRed)
  tkC.position.set(-0.045, 0.04, -0.09)
  tkR.position.set(0.045, -0.04, -0.13)
  tkGroup.add(tkR, tkC, tkMain)
  root.add(igGroup, tkGroup)

  const slots = [] // one per stat shot, built on demand

  function slot(i) {
    if (!slots[i]) {
      const s = { num: new THREE.Group(), lab: new THREE.Group(), mat: solidMaterial(), labMat: flatMaterial('#ffffff') }
      s.labMat.clippingPlanes = clip
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
      const first = stats[0]
      const last = stats[stats.length - 1]
      const visible = !!first && t > first.start - 0.05 && t < last.end + 0.05
      root.visible = visible
      if (!visible) return

      // capitals as tall as the frame allows; long values shrink to fit the width
      const capMax = Math.min(view.h * 0.17, view.w * 0.3)
      const capOf = (v) => Math.min(capMax, (view.w * 0.84) / widthInCaps(String(v), 800))
      const capBase = capMax
      const cy = view.h * 0.035
      const labCapBase = Math.min(view.h * 0.026, (view.w * 0.8) / Math.max(...stats.map((s) => widthInCaps(String(s.p.label), 400))))

      slots.forEach((s, i) => i >= stats.length && ((s.num.visible = false), (s.lab.visible = false)))

      stats.forEach((sh, k) => {
        const p = sh.p
        const s = slot(k)
        const cap = capOf(p.value) * p.size
        const value = String(p.value)
        const blk = memo(
          'n' + k,
          `${value}|${p.depth}`,
          () => {
            const b = buildText(value, { weight: 800, cap: 1, by: 'chars', depth: p.depth, pivot: 'center', material: s.mat, segs: 12 })
            s.num.add(b.group)
            return b
          },
          (b) => {
            s.num.remove(b.group)
            b.units.forEach((u) => u.mesh.geometry.dispose())
          },
        )
        const labCap = labCapBase * p.labelSize
        const lab = memo(
          'l' + k,
          `${p.label}`,
          () => {
            const b = buildText(String(p.label), { weight: 400, cap: 1, by: 'all', pivot: 'baseline', material: s.labMat })
            s.lab.add(b.group)
            return b
          },
          (b) => {
            s.lab.remove(b.group)
            b.units.forEach((u) => u.mesh.geometry.dispose())
          },
        )
        s.mat.userData.setColors(ctx.col(p.color), ctx.col(p.side))
        s.labMat.color.set(ctx.col(p.labelColor))

        const prev = stats[k - 1]
        const next = stats[k + 1]
        // transition in (uses this shot's roll) and out (uses the next shot's roll, so the wheel is rigid)
        const inP = prev ? { t0: sh.start - p.rollDur / 2, dur: p.rollDur, st: p.digitStagger, e: ease(p.rollEase), A: p.angle * DEG, axis: p.axis } : null
        const outP = next ? { t0: next.start - next.p.rollDur / 2, dur: next.p.rollDur, st: next.p.digitStagger, e: ease(next.p.rollEase), A: next.p.angle * DEG, axis: next.p.axis } : null
        const n = blk.units.length
        const tStart = inP ? inP.t0 : sh.start
        const tEnd = outP ? outP.t0 + outP.dur + outP.st * n : sh.end
        const on = t >= tStart && t <= tEnd
        s.num.visible = on
        s.lab.visible = on
        if (!on) return

        // ---- number
        let scale = cap
        let ry = Math.sin(t * 1.15 + k) * 0.15 * p.sway
        const rx = Math.sin(t * 0.83 + 1.3 + k) * 0.06 * p.sway
        if (!prev) {
          const a = seg(t, sh.start, Math.min(0.7, sh.dur * 0.6), 'back.out(1.5)')
          scale *= a
          ry += (1 - seg(t, sh.start, Math.min(0.8, sh.dur * 0.7), 'expo.out')) * -1.1
        }
        if (!next) {
          const o = seg(t, sh.end - Math.min(0.45, sh.dur * 0.4), Math.min(0.45, sh.dur * 0.4), 'power3.in')
          scale *= 1 - o
          ry += o * 2.4
        }
        s.num.position.set(0, cy + capBase * 0.2, 0)
        s.num.scale.setScalar(Math.max(scale, 1e-4))
        s.num.rotation.set(rx, ry, 0)
        const rD = 0.78 // drum radius, in cap heights
        blk.units.forEach((u, j) => {
          let phi = 0
          let axis = 'x'
          if (inP && t < inP.t0 + inP.dur + inP.st * n) {
            const e = inP.e(clamp((t - inP.t0 - j * inP.st) / inP.dur))
            phi = -(1 - e) * inP.A
            axis = inP.axis
          } else if (outP && t >= outP.t0) {
            const e = outP.e(clamp((t - outP.t0 - j * outP.st) / outP.dur))
            phi = e * outP.A
            axis = outP.axis
          }
          const m = u.mesh
          const vis = Math.abs(phi) < 1.52
          m.visible = vis
          if (!vis) return
          if (axis === 'y') {
            m.position.set(u.x - rD * Math.sin(phi), u.y, -rD * (1 - Math.cos(phi)))
            m.rotation.set(0, -phi, 0)
          } else {
            m.position.set(u.x, u.y + rD * Math.sin(phi), -rD * (1 - Math.cos(phi)))
            m.rotation.set(-phi, 0, 0)
          }
        })

        // ---- subtitle: up through a mask
        const ly = cy + capBase * 0.2 - capBase / 2 - capBase * 0.24 - labCap
        let dy = 0
        const step = labCap * 2.3
        // the old subtitle is gone before the incoming number sweeps through its place; the new one follows it in
        if (inP) dy -= (1 - seg(t, inP.t0 + inP.dur * 0.55, inP.dur * 0.75, 'power3.out')) * step
        else dy -= (1 - seg(t, sh.start + 0.18, 0.6, 'expo.out')) * step
        if (outP) dy += seg(t, outP.t0 - outP.dur * 0.1, outP.dur * 0.5, 'power3.in') * step
        else dy -= seg(t, sh.end - Math.min(0.4, sh.dur * 0.35), Math.min(0.4, sh.dur * 0.35), 'power3.in') * step
        s.lab.position.set(0, ly + labCap * 0.5 + dy, 0.2)
        s.lab.scale.setScalar(labCap)
        if (k === 0 || on) {
          clip[0].constant = -(ly - labCap * 0.5)
          clip[1].constant = ly + labCap * 1.35
        }
      })

      // ---- Instagram + TikTok behind the first number
      const P = sc.p
      const iconsOn = P.iconsOn && first
      igGroup.visible = tkGroup.visible = false
      if (iconsOn) {
        const size = capBase * 0.74 * P.iconSize
        const next = stats[1]
        const outAt = next ? next.start - next.p.rollDur / 2 - 0.3 : first.end - 0.4
        const place = (g, i, x, y) => {
          const a = seg(t, first.start + 0.22 + i * 0.1, 0.55, 'back.out(1.7)')
          const o = seg(t, outAt + i * 0.07, 0.26, 'power3.in')
          const s = size * a * (1 - o)
          g.visible = s > 0.002
          if (!g.visible) return
          g.position.set(x, y + Math.sin(t * 1.7 + i * 2.1) * 0.05, -0.75)
          g.scale.setScalar(s)
          g.rotation.set(Math.sin(t * 1.1 + i) * 0.14 * P.iconSpin, Math.sin(t * 1.5 + i * 1.7) * 0.55 * P.iconSpin + (1 - a) * 2.2, (i ? -1 : 1) * 0.12)
        }
        const dx = Math.min(view.w * 0.31, capBase * 1.05)
        place(igGroup, 0, -dx, cy + capBase * 0.2 + capBase * 0.62)
        place(tkGroup, 1, dx, cy + capBase * 0.2 - capBase * 0.3)
        if (P.brandColors) {
          igMat.uniforms.uGrad.value = 1
          tkMat.userData.setColors('#ffffff', '#9a9aa6')
          tkC.visible = tkR.visible = true
        } else {
          igMat.uniforms.uGrad.value = 0
          igMat.userData.setColors(ctx.col('lavender'), ctx.col('violet'))
          tkMat.userData.setColors(ctx.col('lavender'), ctx.col('violet'))
          tkC.visible = tkR.visible = false
        }
      }
    },
  }
}
