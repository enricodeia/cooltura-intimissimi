// The four numbers, on a clean white page, set as a table: the figures
// right-aligned on one axis, what they count (capitals, tracked) on their
// baseline beside them. Every figure is a counter that reveals itself (reels
// rolling up through a mask, blurred by their own speed, settling sharp,
// violet → ink), row after row. They leave upwards.

import { Kinetic } from '../lib/kinetic.js'
import { Counter } from '../lib/counter.js'
import { caseOf } from './shared.js'

export function createNumbers(engine) {
  const hud = engine.hud
  const rows = [0, 1, 2, 3].map(() => ({ num: new Counter(hud), lab: new Kinetic(hud) }))
  const kinetics = rows.flatMap((r) => [r.num, r.lab])

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const st = T.shot('stats')
      for (const k of kinetics) k.group.visible = false
      if (!st || t < st.start - 0.3 || t > st.end + 0.4) return
      const short = Math.min(view.w, view.h)
      const portrait = view.aspect < 0.9
      const pxU = ctx.pxPerUnit
      const p = st.p
      const side = p.labelPos !== 'below'
      const capN = short * (p.size / 100)
      const capL = short * (p.labelSize / 100) * (portrait ? 1.35 : 1)
      const vals = [p.v1, p.v2, p.v3, p.v4].map(String)
      const labs = [p.l1, p.l2, p.l3, p.l4].map((s) => caseOf(s, p.labelCaps))
      let numW = 0
      let labW = 0
      rows.forEach((r, k) => {
        r.num.set({ value: vals[k], weight: p.weight, align: side ? 'right' : 'left', spins: p.spins, step: p.spinStep })
        const info = r.lab.set({ text: labs[k], weight: p.labelWeight, align: 'left', tracking: p.labelTracking ?? 0.01 })
        numW = Math.max(numW, r.num.width * capN)
        labW = Math.max(labW, info.width * capL)
      })
      const gut = capN * p.gutter
      const pitch = side ? capN * p.rowGap : capN * (1 + 0.32) + capL + capN * (p.rowGap - 1)
      const totalW = side ? numW + gut + labW : Math.max(numW, labW)
      const blockH = pitch * 3 + capN + (side ? 0 : capN * 0.32 + capL)
      const fit = Math.min(1, (view.w * 0.86) / totalW, (view.h * 0.8) / blockH)
      const cN = capN * fit
      const cL = capL * fit
      const pit = pitch * fit
      const x0 = (-totalW * fit) / 2
      const axis = side ? x0 + numW * fit : x0 // figures end here (side) or start here (below)
      const yTop = (blockH * fit) / 2 // top of the first figure
      const outAt = (k) => st.end - p.exLead + k * p.exStagger
      rows.forEach((r, k) => {
        const at = st.start + p.cAt + k * p.rowStagger
        const base = yTop - cN - k * pit // figure baseline
        r.num.group.position.set(axis, base + cN / 2, 0)
        r.num.group.scale.setScalar(cN)
        r.num.pose(t, {
          at,
          dur: p.cDur,
          stagger: p.digitStagger,
          order: p.dOrder,
          ease: p.cEase,
          blur: p.cBlur,
          motion: p.motion,
          fromColor: ctx.col(p.fromColor),
          color: ctx.col(p.color),
          px: cN * pxU,
          fps: ctx.fps,
          out: { at: outAt(k), dur: p.exDur, stagger: 0.015, order: 'start', ease: p.exEase, y: p.exY, blur: p.exBlur, opacity: 0, mask: p.exMask },
        })
        // what it counts: on the figure's baseline beside it, or under it
        const lx = side ? axis + gut * fit : x0
        const lbase = side ? base : base - cN * 0.32 - cL
        r.lab.group.position.set(lx, lbase + cL / 2, 0)
        r.lab.group.scale.setScalar(cL)
        r.lab.pose(t, {
          in: { at: at + p.lAt, dur: p.lDur, stagger: p.lStagger, order: 'start', split: p.lSplit, ease: p.lEase, x: 0, y: p.lY, rot: 0, depth: 0, scale: 1, blur: p.lBlur, opacity: 0, mask: true },
          out: { at: outAt(k) + 0.03, dur: p.exDur, stagger: 0.02, order: 'start', split: p.lSplit, ease: p.exEase, x: 0, y: p.exY, rot: 0, depth: 0, scale: 1, blur: p.exBlur, opacity: 0, mask: p.exMask },
          from: ctx.col(p.labelColor),
          to: ctx.col(p.labelColor),
          motion: p.motion * 0.6,
          fps: ctx.fps,
          px: cL * pxU,
        })
      })
    },

    late() {
      for (const k of kinetics) k.late()
    },
  }
}
