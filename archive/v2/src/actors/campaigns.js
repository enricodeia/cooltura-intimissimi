// The three campaigns, stacked in the middle of the frame: each row rises into
// place and its value counts up from zero (tabular digits: the number never
// jiggles, digits it does not need yet stay blank), top to bottom, on one
// smooth curve. Names under the values. They leave to the left as the colour
// comes in from the right for the roadmap.

import * as THREE from 'three'
import { buildText, freeText, getFace, glyphGeometry, capRatio, widthInCaps } from '../lib/type.js'
import { flatMaterial } from '../lib/materials.js'
import { makeMemo } from './shared.js'
import { seg, clamp, ease, lerp } from '../core/util.js'

/** "17.9M" → { pre: '', int: 17.9, dec: 1, sep: '.', post: 'M' } */
function parseValue(str) {
  const m = /^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/.exec(String(str).trim())
  if (!m) return null
  const num = m[2]
  const sep = num.includes(',') ? ',' : '.'
  const dec = num.includes(sep) ? num.split(sep)[1].length : 0
  return { pre: m[1], value: Number(num.replace(',', '.')), dec, sep, post: m[3] }
}

/** Slots for the final string: digits get the widest digit's advance (tabular), the rest their own. */
function counterLayout(str, weight) {
  const face = getFace(weight)
  const dw = Math.max(...'0123456789'.split('').map((d) => face.glyph(d).adv))
  const slots = []
  let x = 0
  for (const ch of String(str)) {
    const isDigit = /\d/.test(ch)
    const w = isDigit ? dw : face.glyph(ch).adv
    slots.push({ x, w, digit: isDigit, ch })
    x += w
  }
  return { slots, width: x, face }
}

export function createCampaigns(engine) {
  const root = new THREE.Group()
  engine.scene.add(root)
  const memo = makeMemo()
  const rows = [0, 1, 2].map(() => {
    const g = new THREE.Group()
    const val = new THREE.Group()
    const name = new THREE.Group()
    g.add(val, name)
    root.add(g)
    return { g, val, name, mat: flatMaterial('#8174f2'), nameMat: flatMaterial('#0b0b0c'), meshes: [] }
  })

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const b = T.shot('campaigns')
      const p = b.p
      const lead = 0.18 // the first row is already rising while the title's last line leaves
      const visible = t >= b.start - lead && t < b.end + 0.02
      root.visible = visible
      if (!visible) return

      const data = [
        [p.v1, p.n1],
        [p.v2, p.n2],
        [p.v3, p.n3],
      ]
      const widest = Math.max(...data.map((d) => widthInCaps(String(d[0]), p.weight) * 1.06))
      const cap = Math.min(view.h * 0.09, (view.w * 0.78) / widest)
      const em = cap / capRatio(p.weight)
      const nameCap = cap * 0.25
      const rowH = cap + cap * 0.34 + nameCap
      const pitch = Math.min(rowH + cap * 0.95, (view.h * 0.82 - rowH) / 2)
      const countE = ease(p.countEase)
      const riseE = ease(p.riseEase)
      const outDur = Math.min(p.outDur, b.dur * 0.4)
      const out0 = b.end - outDur - 2 * p.outStagger
      const outE = ease(p.outEase)

      rows.forEach((r, k) => {
        const [v, n] = data[k]
        const str = String(v)
        const lay = memo('c' + k, `${str}|${p.weight}`, () => counterLayout(str, p.weight))
        // one mesh per slot; its glyph changes as the number counts
        while (r.meshes.length < lay.slots.length) {
          const m = new THREE.Mesh(new THREE.BufferGeometry(), r.mat)
          r.val.add(m)
          r.meshes.push(m)
        }
        r.meshes.forEach((m, i) => (m.visible = i < lay.slots.length))
        const name = memo(
          'n' + k,
          String(n),
          () => {
            const blk = buildText(String(n), { weight: 560, cap: 1, by: 'all', pivot: 'baseline', tracking: 0.12, material: r.nameMat })
            r.name.add(blk.group)
            return blk
          },
          (blk) => {
            r.name.remove(blk.group)
            freeText(blk)
          },
        )
        void name
        r.mat.color.set(ctx.col(p.color))
        r.nameMat.color.set(ctx.col(p.nameColor))

        const tk = b.start - lead + 0.04 + k * p.stagger
        const rise = riseE(clamp((t - tk) / p.riseDur))
        const count = countE(clamp((t - tk - 0.05) / p.countDur))
        const o = outE(clamp((t - out0 - k * p.outStagger) / outDur))
        const yTop = pitch * (1 - k) + rowH / 2
        const yBase = yTop - cap
        r.g.position.set(-o * view.w * 1.15, -(1 - rise) * cap * 0.55, 0)
        r.mat.opacity = r.nameMat.opacity = rise * (1 - seg(o, 0.5, 0.5))
        r.g.visible = t >= tk

        // the counter
        const pv = parseValue(str)
        let shown = str
        if (pv) {
          const cur = (pv.value * count).toFixed(pv.dec).replace('.', pv.sep)
          shown = pv.pre + cur + pv.post
        }
        // right-align the shown string inside the final layout's slots (blank leading digits)
        const pad = lay.slots.length - shown.length
        const x0 = -lay.width / 2
        lay.slots.forEach((sl, i) => {
          const m = r.meshes[i]
          const ch = i - pad >= 0 ? shown[i - pad] : ''
          const geo = ch && ch !== ' ' ? glyphGeometry(lay.face, ch) : null
          m.visible = !!geo
          if (!geo) return
          m.geometry = geo
          const adv = lay.face.glyph(ch).adv
          m.position.set((x0 + sl.x + (sl.w - adv) / 2) * em, yBase, 0)
          m.scale.setScalar(em)
        })
        // the name under it
        const yName = yBase - cap * 0.34 - nameCap
        r.name.position.set(0, yName + nameCap * 0.5, 0)
        r.name.scale.setScalar(nameCap)
      })
    },
  }
}
