// Every block of type on the timeline ("Creators.", "Beyond numbers.", the two
// statements, "The best part?", "We're just getting started."): kinetic type in
// the HUD, laid out on the frame's short side so 9:16 and 16:9 read the same.
// The reveal starts with the block; the unreveal is timed from its end (a
// statement leaves as the carousel after it arrives).

import { Kinetic, phaseOf } from '../lib/kinetic.js'
import { leadEdgeX, carouselKeys } from './carousel.js'

/**
 * Lay out + pose one block from shot parameters.
 *   start: when the reveal timing starts · end: what the unreveal is timed from
 *   box: optional { x, y } override of the anchor (view units)
 * → { cap, info, x, y, inEnd, outEnd } (or null when nothing shows)
 */
export function poseType(kt, ctx, p, { start, end, box = null, sizeK = 1, sweep = null }) {
  const { t, view } = ctx
  const short = Math.min(view.w, view.h)
  const margin = short * 0.075
  let cap = (p.size / 100) * short * sizeK
  // the line is measured on the short side, and never longer than the frame is wide
  const lineW = Math.min(p.measure * short, view.w - 2 * margin)
  let info = kt.set({ text: String(p.text ?? ''), weight: p.weight, align: p.align, measure: lineW / cap, leading: p.leading, tracking: p.tracking })
  // never wider or taller than the frame allows
  const fit = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, info.width * cap), (view.h * 0.84) / Math.max(1e-3, info.height * cap))
  if (fit < 0.999) {
    cap *= fit
    info = kt.set({ text: String(p.text ?? ''), weight: p.weight, align: p.align, measure: lineW / cap, leading: p.leading, tracking: p.tracking })
  }
  const ax = p.align === 'left' ? -view.w / 2 + margin : p.align === 'right' ? view.w / 2 - margin : 0
  const x = box ? box.x : ax + (p.x * view.w) / 2
  const y = box ? box.y : (p.y * view.h) / 2
  const inPh = phaseOf(p, 'in', start + p.inAt)
  const outPh = p.outOn ? phaseOf(p, 'out', end + p.outAt) : null
  // swept by a carousel: every unit leaves when the first card's edge reaches it (right to
  // left); the ones it never reaches (it stops in the middle) carry on the same cascade
  if (outPh && sweep) {
    const groups = kt.groupsX(outPh.split)
    const cap0 = cap
    const times = groups.map(([, x1]) => {
      const vx = x + x1 * cap0 + sweep.lead
      for (let i = 0; i < sweep.samples.length; i++) if (sweep.samples[i][1] <= vx) return Math.max(outPh.at, sweep.samples[i][0] - 0.06)
      return null
    })
    const reached = times.filter((v) => v !== null)
    let tLast = reached.length ? Math.max(...reached) : Math.max(outPh.at, sweep.samples[0][0])
    const cadence = Math.max(0.02, outPh.stagger || 0.04)
    groups
      .map((g, i) => [g[1], i])
      .filter(([, i]) => times[i] === null)
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => (times[i] = tLast += cadence))
    outPh.times = times
  }
  const inEnd = inPh.at + kt.phaseLength(inPh)
  const outEnd = outPh ? outPh.at + kt.phaseLength(outPh) : Infinity
  const on = t >= inPh.at - 0.05 && t <= outEnd + 0.05
  kt.group.visible = on
  if (!on) return null
  kt.group.position.set(x, y, 0)
  kt.group.scale.setScalar(cap)
  kt.pose(t, {
    in: inPh,
    out: outPh,
    from: ctx.col(p.fromColor),
    to: ctx.col(p.color),
    motion: p.motion,
    fps: ctx.fps,
    px: cap * ctx.pxPerUnit,
  })
  return { cap, info, x, y, inEnd, outEnd }
}

export function createTexts(engine) {
  const blocks = new Map() // shot id → Kinetic
  const sweeps = new Map() // shot id → sampled edge of the carousel after it
  const get = (id) => {
    let k = blocks.get(id)
    if (!k) blocks.set(id, (k = new Kinetic(engine.hud)))
    return k
  }
  return {
    update(ctx) {
      const { T, view } = ctx
      const live = new Set()
      for (const sh of T.shots) {
        if (sh.type !== 'text') continue
        live.add(sh.id)
        // a statement followed by a carousel is swept away by its first card
        const next = T.next(sh)
        let sweep = null
        if (next && next.type === 'carousel' && sh.p.outSweep !== false) {
          const N = Math.max(1, carouselKeys(engine.videos, next.p.videos).length)
          const key = `${next.start}|${next.end}|${JSON.stringify(next.p)}|${view.w}|${view.h}`
          let sw = sweeps.get(sh.id)
          if (!sw || sw.key !== key) {
            const samples = []
            const t0 = next.start + next.p.inAt
            for (let i = 0; i <= 160; i++) {
              const tt = t0 + (i / 160) * (next.p.inDur + 0.4)
              samples.push([tt, leadEdgeX(next, view, tt, N)])
            }
            sweeps.set(sh.id, (sw = { key, samples }))
          }
          sweep = { samples: sw.samples, lead: Math.min(view.w, view.h) * 0.16 }
        }
        poseType(get(sh.id), ctx, sh.p, { start: sh.start, end: sh.end, sweep })
      }
      // blocks of the intro that is not in the film
      for (const [id, k] of blocks) if (!live.has(id)) k.group.visible = false
    },
    late() {
      for (const k of blocks.values()) k.late()
    },
  }
}
