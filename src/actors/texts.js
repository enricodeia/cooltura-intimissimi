// Every block of type on the timeline (the words of intro B, the two sentences,
// "The best part?", "We're just getting started."): kinetic type in the HUD,
// laid out on the frame's short side so 9:16 and 16:9 read the same. The reveal
// starts with the block; the unreveal is timed from its end (a sentence leaves
// as the carousel after it arrives). Titles are set in capitals ("Maiuscolo").
//
// A "statement" block can push its last line out: the line sits in a masked
// window as wide as the paragraph, and the rest of the sentence comes in from the
// right and pushes it out to the left (one strip of text through the window).

import { Kinetic, phaseOf } from '../lib/kinetic.js'
import { leadEdgeX, trailEdgeX, carouselKeys } from './carousel.js'
import { caseOf } from './shared.js'
import { ease, clamp } from '../core/util.js'

export { caseOf }


/** Swept by a carousel: every unit leaves when the first card's edge reaches it (right to left). */
function sweepTimes(kt, outPh, x, cap, sweep) {
  const groups = kt.groupsX(outPh.split)
  const times = groups.map(([, x1]) => {
    const vx = x + x1 * cap + sweep.lead
    for (let i = 0; i < sweep.samples.length; i++) if (sweep.samples[i][1] <= vx) return Math.max(outPh.at, sweep.samples[i][0] - 0.06)
    return null
  })
  // the ones it never reaches (it stops in the middle) carry on the same cascade
  const reached = times.filter((v) => v !== null)
  let tLast = reached.length ? Math.max(...reached) : Math.max(outPh.at, sweep.samples[0][0])
  const cadence = Math.max(0.02, outPh.stagger || 0.04)
  groups
    .map((g, i) => [g[1], i])
    .filter(([, i]) => times[i] === null)
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => (times[i] = tLast += cadence))
  return times
}

/**
 * Lay out + pose one block from shot parameters.
 *   start: when the reveal timing starts · end: what the unreveal is timed from
 *   box: optional { x, y } override of the anchor (view units)
 * → { cap, info, x, y, inEnd, outEnd } (or null when nothing shows)
 */
export function poseType(kt, ctx, p, { start, end, box = null, sizeK = 1, sweep = null, wake = null }) {
  const { t, view } = ctx
  const str = caseOf(p.text, p.caps)
  const short = Math.min(view.w, view.h)
  const margin = short * 0.075
  let cap = (p.size / 100) * short * sizeK
  // the line is measured on the short side, and never longer than the frame is wide
  const lineW = Math.min(p.measure * short, view.w - 2 * margin)
  // lines in evidence (V4): their paragraphs get the accent weight and colour
  const acc = String(p.accent ?? '')
    .split(/[^0-9]+/)
    .map((x) => parseInt(x, 10) - 1)
    .filter((x) => x >= 0)
  const paras = String(str).split('\n').length
  const weights = acc.length && paras > 1 ? Array.from({ length: paras }, (_, i) => (acc.includes(i) ? p.accentWeight ?? p.weight : p.weight)) : null
  const accent = acc.length ? { paras: new Set(acc), color: ctx.col(p.accentColor ?? p.color) } : null
  let info = kt.set({ text: str, weight: p.weight, align: p.align, measure: lineW / cap, leading: p.leading, tracking: p.tracking, weights })
  // never wider or taller than the frame allows
  const fit = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, info.width * cap), (view.h * 0.84) / Math.max(1e-3, info.height * cap))
  if (fit < 0.999) {
    cap *= fit
    info = kt.set({ text: str, weight: p.weight, align: p.align, measure: lineW / cap, leading: p.leading, tracking: p.tracking, weights })
  }
  const ax = p.align === 'left' ? -view.w / 2 + margin : p.align === 'right' ? view.w / 2 - margin : 0
  const x = box ? box.x : ax + (p.x * view.w) / 2
  const y = box ? box.y : (p.y * view.h) / 2
  const inPh = phaseOf(p, 'in', start + p.inAt)
  const outPh = p.outOn ? phaseOf(p, 'out', end + p.outAt) : null
  if (outPh && sweep) outPh.times = sweepTimes(kt, outPh, x, cap, sweep)
  kt.clipX0 = kt.clipX1 = null
  // the letters that close in (or open) never leave the frame: the spread a line can take
  const room = (ls) => {
    const half = Math.max(1e-3, ...ls.map((l) => (l.x1 - l.x0) / 2)) * cap
    return Math.max(0, (view.w / 2 - margin * 0.5) / half - 1)
  }
  inPh.spread = Math.min(inPh.spread || 0, room(info.lines))
  if (outPh) outPh.spread = Math.min(outPh.spread || 0, room(info.lines))
  // V4 · the lines in evidence come in with a phase of their own, when their line's turn comes (+ accDelay)
  let accIn = null
  if (accent && p.accOn) {
    const first = info.lines.findIndex((l) => accent.paras.has(l.para))
    if (first >= 0) {
      accIn = {
        ...inPh,
        order: p.accOrder || 'center',
        split: p.accSplit || 'chars',
        stagger: p.accStagger ?? 0.02,
        dur: p.accDur ?? inPh.dur,
        ease: p.accEase || inPh.ease,
        y: p.accY ?? inPh.y,
        blur: p.accBlur ?? inPh.blur,
        scale: p.accScale ?? 1,
        spread: Math.min(p.accSpread ?? 0, room(info.lines.filter((l) => accent.paras.has(l.para)))),
        mask: !!p.accMask,
        lineStep: 0,
        paraLocal: true,
        times: null,
      }
      accIn.at = inPh.at + kt.lineStart(first, inPh) + (p.accDelay ?? 0)
      accent.in = accIn
    }
  }
  // V4 · the paragraph builds itself in the centre: each line that arrives pushes the ones before it up, each
  // word that arrives pushes its line sideways (centred text), so what is on screen is always centred
  const arrive = (c) => (accIn && accent.paras.has(c.pi) ? accIn.at + kt.delayOf(c, accIn) : inPh.at + kt.delayOf(c, inPh))
  const bE = ease(p.buildEase || 'cubic(0.55,0,0.15,1)')
  const bK = (t0) => bE(clamp((t - t0 - (p.buildDelay ?? 0)) / Math.max(0.05, p.buildDur ?? 0.55)))
  const build = p.build || 'none'
  let dyBuild = 0
  kt.lineShift = null
  if ((build === 'lines' || build === 'both') && info.lines.length > 1) {
    const first = info.lines.map(() => Infinity)
    for (const c of kt.chars) first[c.li] = Math.min(first[c.li], arrive(c))
    let m = 0
    for (let li = 1; li < first.length; li++) m += bK(first[li])
    // only the first line → it stands in the centre; all of them → the paragraph does
    dyBuild = (-(info.lines.length - 1 - m) * info.lineHeight) / 2
  }
  if ((build === 'words' || build === 'both') && p.align === 'center') {
    const wFirst = new Map()
    for (const c of kt.chars) wFirst.set(c.wi, Math.min(wFirst.get(c.wi) ?? Infinity, arrive(c)))
    kt.lineShift = info.lines.map((ln, li) => {
      const ws = kt.words.map((w, wi) => ({ ...w, wi })).filter((w) => w.li === li)
      if (ws.length < 2) return 0
      let xr = ws[0].x1
      for (let j = 1; j < ws.length; j++) xr += bK(wFirst.get(ws[j].wi) ?? 0) * (ws[j].x1 - ws[j - 1].x1)
      return ln.cx - (ln.x0 + xr) / 2
    })
  }
  // V4 · the block breathes: a slow push in over its length
  const breath = p.drift ? 1 + p.drift * clamp((t - start) / Math.max(0.2, end - start)) : 1
  // in the wake of the carousel before it: only what is right of its last card shows (they never overlap)
  if (wake && t < inPh.at + kt.phaseLength(inPh)) {
    inPh.mask = true
    kt.clipX0 = (wake(t) - x) / cap
    kt.clipX1 = 1e5
  }
  const inEnd = inPh.at + kt.phaseLength(inPh)
  const outEnd = outPh ? outPh.at + kt.phaseLength(outPh) : Infinity
  const on = t >= inPh.at - 0.05 && t <= outEnd + 0.05
  kt.group.visible = on
  if (!on) return null
  kt.group.position.set(x, y + dyBuild * cap * breath, 0)
  kt.group.scale.setScalar(cap * breath)
  kt.pose(t, {
    in: inPh,
    out: outPh,
    from: ctx.col(p.fromColor),
    to: ctx.col(p.color),
    accent,
    motion: p.motion,
    fps: ctx.fps,
    px: cap * breath * ctx.pxPerUnit,
  })
  return { cap, info, x, y, inEnd, outEnd }
}

/**
 * A sentence whose last line is pushed out by the rest of it. Three blocks:
 * the head (its own lines), the tail (the last `pushWords` words, one line) and
 * the push (`pushText`, one line, in the tail's place). The tail and the push
 * share a window as wide as the paragraph: the push comes in from its right edge
 * and drives the tail out through its left edge, as one strip.
 */
export function poseStatement(K, ctx, p, { start, end, sweep = null }) {
  const { t, view } = ctx
  const words = caseOf(p.text, p.caps).trim().split(/\s+/)
  const pushing = p.pushOn && String(p.pushText || '').trim() && words.length > 1
  if (!pushing) {
    K.tail.group.visible = K.push.group.visible = false
    return poseType(K.head, ctx, p, { start, end, sweep })
  }
  const nT = Math.max(1, Math.min(words.length - 1, Math.round(p.pushWords)))
  const head = words.slice(0, words.length - nT).join(' ')
  const tail = words.slice(words.length - nT).join(' ')
  const more = caseOf(p.pushText, p.caps).trim()
  const short = Math.min(view.w, view.h)
  const margin = short * 0.075
  const lineW = Math.min(p.measure * short, view.w - 2 * margin)
  const setAll = (cap) => {
    const ih = K.head.set({ text: head, weight: p.weight, align: p.align, measure: lineW / cap, leading: p.leading, tracking: p.tracking })
    const it = K.tail.set({ text: tail, weight: p.weight, align: p.align, leading: p.leading, tracking: p.tracking })
    const ip = K.push.set({ text: more, weight: p.weight, align: p.align, leading: p.leading, tracking: p.tracking })
    return { ih, it, ip }
  }
  let cap = (p.size / 100) * short
  let I = setAll(cap)
  const lh = I.ih.lineHeight // baseline to baseline, in caps
  const H = () => I.ih.height + lh // the paragraph: the head's lines + the tail's
  const widest = () => Math.max(I.ih.width, I.it.width, I.ip.width)
  const fit = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, widest() * cap), (view.h * 0.84) / Math.max(1e-3, H() * cap))
  if (fit < 0.999) {
    cap *= fit
    I = setAll(cap)
  }
  const ax = p.align === 'left' ? -view.w / 2 + margin : p.align === 'right' ? view.w / 2 - margin : 0
  const x = ax + (p.x * view.w) / 2
  const y = (p.y * view.h) / 2
  const Hc = H()
  const yHead = y + (Hc / 2 - I.ih.height / 2) * cap
  const yTail = y + (-Hc / 2 + 0.5) * cap
  // the window (block x, caps): as wide as the paragraph's longest line
  const M = widest() * p.pushWindow
  const pad = 0.12
  const w0 = (p.align === 'center' ? -M / 2 : p.align === 'right' ? -M : 0) - pad
  const w1 = w0 + M + 2 * pad
  const span = (info) => (p.align === 'center' ? [-info.width / 2, info.width / 2] : p.align === 'right' ? [-info.width, 0] : [0, info.width])
  const [, a1] = span(I.it)
  const [b0] = span(I.ip)
  const D = Math.max(a1 - w0, w1 - b0) + 0.08 // how far the strip travels, caps
  const inPh = phaseOf(p, 'in', start + p.inAt)
  const nHead = I.ih.lines.length
  const outPh = p.outOn ? phaseOf(p, 'out', end + p.outAt) : null
  const tPush = start + p.pushAt
  const pushIn = { at: tPush, dur: p.pushDur, stagger: 0, order: 'start', split: 'lines', ease: p.pushEase, x: D * 100, y: 0, rot: 0, depth: 0, scale: 1, blur: 0, opacity: 1, mask: true }
  // the line pushed out goes a little further, so it has left the window before the strip slows down
  const pushOut = { ...pushIn, x: -(D + Math.max(1.5, D * 0.14)) * 100 }
  // the tail arrives as the line after the head's last one
  const tailIn = { ...inPh, at: inPh.at + (inPh.split === 'lines' ? nHead * inPh.stagger : 0) }
  const style = { from: ctx.col(p.fromColor), to: ctx.col(p.color), motion: p.motion, fps: ctx.fps, px: cap * ctx.pxPerUnit }
  const slide = { ...style, motion: p.motion * 0.3 } // the push: a light smear, the words stay readable
  const place = (kt, yy) => {
    kt.group.position.set(x, yy, 0)
    kt.group.scale.setScalar(cap)
  }
  // ---- the head
  const outHead = outPh ? { ...outPh } : null
  if (outHead && sweep) outHead.times = sweepTimes(K.head, outHead, x, cap, sweep)
  K.head.clipX0 = K.head.clipX1 = null
  const headEnd = outHead ? outHead.at + K.head.phaseLength(outHead) : Infinity
  K.head.group.visible = t >= inPh.at - 0.05 && t <= headEnd + 0.05
  if (K.head.group.visible) {
    place(K.head, yHead)
    K.head.pose(t, { ...style, in: inPh, out: outHead })
  }
  // ---- the tail: in with the paragraph, out through the window's left edge
  K.tail.clipX0 = w0
  K.tail.clipX1 = w1
  K.tail.group.visible = t >= tailIn.at - 0.05 && t <= tPush + p.pushDur + 0.05
  if (K.tail.group.visible) {
    place(K.tail, yTail)
    K.tail.pose(t, { ...(t >= tPush ? slide : style), in: tailIn, out: pushOut })
  }
  // ---- the push: in through the window's right edge, then out with the rest
  K.push.clipX0 = w0
  K.push.clipX1 = w1
  const outPush = outPh ? { ...outPh } : null
  if (outPush && sweep) outPush.times = sweepTimes(K.push, outPush, x, cap, sweep)
  const pushEnd = outPush ? outPush.at + K.push.phaseLength(outPush) : Infinity
  K.push.group.visible = t >= tPush - 0.05 && t <= pushEnd + 0.05
  if (K.push.group.visible) {
    place(K.push, yTail)
    K.push.pose(t, { ...(t < tPush + p.pushDur ? slide : style), from: ctx.col(p.color), in: pushIn, out: outPush })
  }
  return { cap, x, y }
}

export function createTexts(engine) {
  const blocks = new Map() // shot id → Kinetic (or { head, tail, push })
  const sweeps = new Map() // shot id → sampled edge of the carousel after it
  const get = (id, multi) => {
    let k = blocks.get(id)
    if (!k) {
      k = multi ? { head: new Kinetic(engine.hud), tail: new Kinetic(engine.hud), push: new Kinetic(engine.hud) } : new Kinetic(engine.hud)
      blocks.set(id, k)
    }
    return k
  }
  const each = (k, fn) => (k.head ? [k.head, k.tail, k.push].forEach(fn) : fn(k))
  return {
    update(ctx) {
      const { T, view } = ctx
      const live = new Set()
      for (const sh of T.shots) {
        if (sh.type !== 'text' && sh.type !== 'statement') continue
        live.add(sh.id)
        // a sentence followed by a carousel is swept away by its first card
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
        // a sentence after a carousel can come in its wake (only right of its last card)
        const prev = T.prev(sh)
        let wake = null
        if (prev && prev.type === 'carousel' && sh.p.inWake) {
          const N = Math.max(1, carouselKeys(engine.videos, prev.p.videos).length)
          wake = (tt) => (tt < prev.end + 0.02 ? trailEdgeX(prev, view, tt, N) + Math.min(view.w, view.h) * 0.02 : -1e5)
        }
        if (sh.type === 'statement') poseStatement(get(sh.id, true), ctx, sh.p, { start: sh.start, end: sh.end, sweep })
        else poseType(get(sh.id), ctx, sh.p, { start: sh.start, end: sh.end, sweep, wake })
      }
      // blocks of the intro that is not in the film
      for (const [id, k] of blocks) if (!live.has(id)) each(k, (b) => (b.group.visible = false))
    },
    late() {
      for (const k of blocks.values()) each(k, (b) => b.late())
    },
  }
}
