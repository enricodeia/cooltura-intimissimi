// Numbers left of the phone: 70M at the centre, then 9M comes up from below
// and pushes it higher, then 985.6K pushes both. Digits roll like an odometer
// inside a mask. At the end the rows leave upwards, staggered.

import * as THREE from 'three'
import { buildText, freeText, widthInCaps, layout, getFace, glyphGeometry, capRatio } from '../lib/type.js'
import { flatMaterial } from '../lib/materials.js'
import { phoneLayout, makeMemo } from './shared.js'
import { seg, clamp, ease, mod } from '../core/util.js'

/** A value as columns: digits get a reel of digits ending on theirs, other glyphs a single mesh. em = 1, baseline at y = 0, left edge at x = 0. */
function buildValue(str, mat, weight) {
  const face = getFace(weight)
  const L = layout(str, { weight })
  const word = L.lines[0].words[0]
  const group = new THREE.Group()
  const cols = []
  if (!word) return { group, cols, width: 0 }
  const pitch = capRatio(weight) * 1.42
  word.glyphs.forEach((g, j) => {
    const ch = g.ch
    const col = new THREE.Group()
    col.position.x = g.x
    group.add(col)
    if (/\d/.test(ch)) {
      const n = 5 + j * 2
      const final = Number(ch)
      for (let i = 0; i <= n; i++) {
        const d = String(mod(final - n + i, 10))
        const geo = glyphGeometry(face, d)
        if (!geo) continue
        const m = new THREE.Mesh(geo, mat)
        m.position.set((g.adv - face.glyph(d).adv) / 2, -i * pitch, 0)
        col.add(m)
      }
      cols.push({ col, reel: true, n, pitch })
    } else {
      const geo = glyphGeometry(face, ch)
      if (geo) col.add(new THREE.Mesh(geo, mat))
      cols.push({ col, reel: false, pitch })
    }
  })
  return { group, cols, width: word.width }
}

export function createViews(engine) {
  const root = new THREE.Group()
  engine.scene.add(root)
  const memo = makeMemo()
  const rows = []
  function row(i) {
    if (!rows[i]) {
      const mk = () => [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)]
      const r = { g: new THREE.Group(), mat: flatMaterial('#8174f2'), labMat: flatMaterial('#0b0b0c'), clip: mk(), clipL: mk() }
      r.mat.clippingPlanes = r.clip
      r.labMat.clippingPlanes = r.clipL
      root.add(r.g)
      rows[i] = r
    }
    return rows[i]
  }

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('phone')
      const P = sc.p
      const shots = sc.shots.filter((s) => s.type === 'view')
      const first = shots[0]
      const last = shots[shots.length - 1]
      const visible = !!first && t >= first.start - 0.05 && t < last.end + 0.02
      root.visible = visible
      rows.forEach((r, i) => (r.g.visible = visible && i < shots.length))
      if (!visible) return
      const L = phoneLayout(view, P)
      const widest = Math.max(...shots.map((s) => widthInCaps(String(s.p.value), s.p.weight)))
      const cap = Math.min(view.h * 0.1, L.col.w / widest) * P.numbersSize
      const labCap = Math.min(cap * 0.36, L.col.w / Math.max(...shots.map((s) => widthInCaps(String(s.p.label), 400))))
      const rowH = cap + cap * 0.4 + labCap
      const pitch = rowH + cap * 0.62 * P.rowGap

      // how many rows are in: each new one eases the stack up by half a pitch
      let count = 1
      const ins = shots.map((sh, k) => {
        const a = seg(t, sh.start, sh.p.enterDur, sh.p.enterEase)
        if (k > 0) count += a
        return a
      })
      const exitDur = Math.min(P.exitDur, last.dur * 0.5)
      const x0 = L.col.x0
      const yMid = L.side.y

      shots.forEach((sh, k) => {
        const p = sh.p
        const r = row(k)
        const value = String(p.value)
        const em = cap / capRatio(p.weight)
        const val = memo(
          'v' + k,
          `${value}|${p.weight}`,
          () => {
            const b = buildValue(value, r.mat, p.weight)
            r.g.add(b.group)
            return b
          },
          (b) => r.g.remove(b.group),
        )
        const lab = memo(
          'l' + k,
          String(p.label),
          () => {
            const b = buildText(String(p.label), { weight: 400, cap: 1, by: 'all', align: 'left', pivot: 'baseline', material: r.labMat })
            r.g.add(b.group)
            return b
          },
          (b) => {
            r.g.remove(b.group)
            freeText(b)
          },
        )
        r.mat.color.set(ctx.col(p.color))
        r.labMat.color.set(ctx.col(p.labelColor))
        const a = ins[k]
        const on = t >= sh.start
        r.g.visible = on
        if (!on) return

        const out = seg(t, last.end - exitDur + k * P.exitStagger - (shots.length - 1) * P.exitStagger, exitDur, P.exitEase)
        // row centre: the stack stays centred as rows come in; a new row rises from below
        const yRow = yMid + ((count - 1) / 2 - k) * pitch - (1 - a) * pitch * 0.55 + out * view.h * 0.75
        const top = yRow + rowH / 2
        const base = top - cap // baseline of the value
        r.g.position.set(x0, 0, 0)
        val.group.position.set(0, base, 0)
        val.group.scale.setScalar(em)
        const E = ease(p.enterEase)
        val.cols.forEach((c, j) => {
          const e = E(clamp((t - sh.start - j * p.charStagger) / (p.enterDur + (c.reel && p.odometer ? 0.3 : 0))))
          if (c.reel && p.odometer) c.col.position.y = e * c.n * c.pitch
          else if (c.reel) c.col.position.y = c.n * c.pitch - (1 - e) * c.pitch
          else c.col.position.y = -(1 - e) * c.pitch
        })
        const le = seg(t, sh.start + 0.18, p.enterDur, p.enterEase)
        // one-line label: its block is centred on the cap height, so its baseline sits half a cap under the origin
        const labBase = base - cap * 0.4 - labCap
        lab.group.position.set(0, labBase + labCap * 0.5 - (1 - le) * labCap * 2.4, 0)
        lab.group.scale.setScalar(labCap)
        r.mat.opacity = r.labMat.opacity = 1 - seg(out, 0.35, 0.65)
        // masks travel with the row: one for the value (the reels roll inside it), one for the label
        r.clip[0].constant = -(base - cap * 0.06)
        r.clip[1].constant = top + cap * 0.08
        r.clipL[0].constant = -(labBase - labCap * 0.4)
        r.clipL[1].constant = labBase + labCap * 1.35
      })
    },
  }
}
