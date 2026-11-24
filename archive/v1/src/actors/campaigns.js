// The three campaigns, stacked in the middle of the frame: each value scales up
// while it turns on Y, landing with an elastic bounce (one authored curve), top
// to bottom; its name comes up from a mask underneath. They leave to the left
// as the camera moves right into Proud Moments.

import * as THREE from 'three'
import { buildText, widthInCaps } from '../lib/type.js'
import { solidMaterial, flatMaterial } from '../lib/materials.js'
import { makeMemo } from './shared.js'
import { seg, clamp, ease, DEG } from '../core/util.js'

export function createCampaigns(engine) {
  const root = new THREE.Group()
  engine.scene.add(root)
  const memo = makeMemo()
  const mat = solidMaterial()
  const rows = [0, 1, 2].map(() => {
    const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)]
    const nameMat = flatMaterial('#ffffff')
    nameMat.clippingPlanes = clip
    const g = new THREE.Group()
    const val = new THREE.Group()
    const name = new THREE.Group()
    g.add(val, name)
    root.add(g)
    return { g, val, name, nameMat, clip }
  })

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const b = T.shot('campaigns')
      const p = b.p
      const lead = 0.18 // the first value is already turning in while the title's last line leaves
      const visible = t >= b.start - lead && t < b.end + 0.02
      root.visible = visible
      if (!visible) return
      if (t >= b.start) {
        ctx.bg.a = ctx.bg.b = ctx.col('ink')
        ctx.bg.mix = 0
        ctx.bg.rays = 0
      }
      mat.userData.setColors(ctx.col(p.color), ctx.col(p.side))

      const data = [
        [p.v1, p.n1],
        [p.v2, p.n2],
        [p.v3, p.n3],
      ]
      const widest = Math.max(...data.map((d) => widthInCaps(String(d[0]), 800)))
      const cap = Math.min(view.h * 0.088, (view.w * 0.78) / widest)
      const nameCap = cap * 0.27
      const rowH = cap + cap * 0.36 + nameCap
      const pitch = Math.min(rowH + cap * 1.1, (view.h * 0.8 - rowH) / 2)
      const flipE = ease(p.flipEase)
      const outDur = Math.min(p.outDur, b.dur * 0.4)
      const out0 = b.end - outDur - 2 * p.outStagger
      const outE = ease(p.outEase)

      rows.forEach((r, k) => {
        const [v, n] = data[k]
        const val = memo(
          'v' + k,
          `${v}|${p.depth}`,
          () => {
            const blk = buildText(String(v), { weight: 800, cap: 1, by: 'all', depth: p.depth, pivot: 'center', material: mat, segs: 12 })
            r.val.add(blk.group)
            return blk
          },
          (blk) => {
            r.val.remove(blk.group)
            blk.units.forEach((u) => u.mesh.geometry.dispose())
          },
        )
        const name = memo(
          'n' + k,
          String(n),
          () => {
            const blk = buildText(String(n), { weight: 800, cap: 1, by: 'all', pivot: 'baseline', tracking: 0.09, material: r.nameMat })
            r.name.add(blk.group)
            return blk
          },
          (blk) => {
            r.name.remove(blk.group)
            blk.units.forEach((u) => u.mesh.geometry.dispose())
          },
        )
        void val
        void name
        r.nameMat.color.set(ctx.col(p.nameColor))
        const tk = b.start - lead + 0.04 + k * p.stagger
        const e = flipE(clamp((t - tk) / p.flipDur))
        const o = outE(clamp((t - out0 - k * p.outStagger) / outDur))
        const yTop = pitch * (1 - k) + rowH / 2
        const yVal = yTop - cap / 2
        r.g.position.set(-o * view.w * 1.25, 0, 0)
        r.g.rotation.y = o * 0.5
        r.val.position.set(0, yVal, 0)
        r.val.scale.setScalar(Math.max(1e-4, cap * e))
        r.val.rotation.y = (1 - e) * p.turns * DEG
        r.val.visible = t >= tk
        // the name rises out of the line under the value
        const ne = seg(t, tk + 0.16, 0.6, 'expo.out')
        const yName = yTop - cap - cap * 0.36 - nameCap / 2
        r.name.position.set(0, yName - (1 - ne) * nameCap * 2.2, 0)
        r.name.scale.setScalar(nameCap)
        r.nameMat.opacity = 0.78
        r.clip[0].constant = -(yName - nameCap * 0.62)
        r.clip[1].constant = yName + nameCap * 0.75
      })
    },
  }
}
