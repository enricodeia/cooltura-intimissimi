// ONE AMBITION. → ONE PARTNERSHIP.: the word after "ONE" turns like a cube (the
// old one goes over the top edge, the new one comes up from below, letter by
// letter), on the beat. "ONE AMBITION." stands in the centre of the frame; the
// longer word that comes in pushes ONE to the left, so "ONE PARTNERSHIP." is in
// the centre too (the push: its own delay, length and ease; "La riga si ricentra"
// 1 = always centred, 0 = ONE never moves and the row is centred between the two).
// In a row in wide frames, in a column in narrow ones (each line centred).

import { Kinetic } from '../lib/kinetic.js'
import { caseOf } from '../actors/shared.js'
import { ph } from './common.js'
import { ease, clamp, lerp } from '../core/util.js'

export function createFlip(engine) {
  const blocks = new Map() // shot id → { fixed, words: Kinetic[] }
  const get = (id, n) => {
    let b = blocks.get(id)
    if (!b) blocks.set(id, (b = { fixed: new Kinetic(engine.hud), words: [] }))
    while (b.words.length < n) b.words.push(new Kinetic(engine.hud))
    return b
  }
  const hideAll = (b) => {
    b.fixed.group.visible = false
    for (const w of b.words) w.group.visible = false
  }
  return {
    update(ctx) {
      const { t, T, view } = ctx
      const live = new Set()
      for (const sh of T.shots) {
        if (sh.type !== 'flip') continue
        live.add(sh.id)
        const p = sh.p
        const list = String(p.words || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        const b = get(sh.id, list.length)
        hideAll(b)
        if (t < sh.start - 0.6 || t > sh.end + 0.3 || !list.length) continue
        const short = Math.min(view.w, view.h)
        const margin = short * 0.075
        let cap = (p.size / 100) * short
        const fi = b.fixed.set({ text: caseOf(p.fixed, p.caps), weight: p.weight, align: 'left', tracking: p.tracking })
        const wi = list.map((w, i) => b.words[i].set({ text: caseOf(w, p.caps), weight: p.weight2, align: 'left', tracking: p.tracking }))
        const gap = 0.42 // caps between ONE and the word
        const wMax = Math.max(...wi.map((i) => i.width))
        const stack = p.layout === 'stack' || (p.layout === 'auto' && view.aspect < 0.9)
        const need = stack ? Math.max(fi.width, wMax) : fi.width + gap + wMax
        cap = Math.min(cap, (view.w - 2 * margin) / Math.max(1e-3, need))
        const px = cap * ctx.pxPerUnit

        // ---------------- timing
        const tIn = sh.start + p.inAt
        const tOut = sh.end - p.outLead
        const flipAt = (k) => sh.start + p.flipAt + (k - 1) * p.flipEvery // word k comes in (k ≥ 1)
        const up = p.dir !== 'down'
        // which word is in front at t, for the re-centring: a smooth index that follows the push (the word
        // comes up, then drives ONE to the left)
        const pushE = ease(p.pushEase || p.flipEase)
        const pushDur = p.pushDur ?? p.flipDur
        let cur = 0
        for (let k = 1; k < list.length; k++) cur += pushE(clamp((t - flipAt(k) - (p.pushDelay ?? 0)) / pushDur))
        const widthAt = (c) => {
          const i = Math.min(list.length - 1, Math.floor(c))
          const j = Math.min(list.length - 1, i + 1)
          return lerp(wi[i].width, wi[j].width, c - i)
        }
        const avgW = wi.reduce((a, i) => a + i.width, 0) / wi.length
        const wNow = lerp(avgW, widthAt(cur), p.glide ?? 0)

        // ---------------- layout
        let fx, fy, wx, wy
        if (stack) {
          const lh = cap * 1.18
          fx = (-fi.width * cap) / 2
          fy = lh / 2
          wy = -lh / 2
          wx = null // each word centred on itself
        } else {
          const total = fi.width + gap + wNow
          fx = (-total * cap) / 2
          fy = 0
          wx = fx + (fi.width + gap) * cap
          wy = 0
        }
        const PX = ((p.posX ?? 0) * view.w) / 2
        const PY = ((p.posY ?? 0) * view.h) / 2
        fx += PX
        fy += PY
        if (wx !== null) wx += PX
        wy += PY
        b.fixed.group.position.set(fx, fy, 0)
        b.fixed.group.scale.setScalar(cap)
        const out = ph(tOut, p.outDur, { stagger: p.outStagger, ease: p.outEase, y: p.outY, blur: p.outBlur, mask: false })
        b.fixed.pose(t, {
          in: ph(tIn, p.inDur, { stagger: p.inStagger, ease: p.inEase, y: p.inY, blur: p.inBlur, mask: true }),
          out,
          from: ctx.col(p.fromColor),
          to: ctx.col(p.color),
          motion: 0.7,
          fps: ctx.fps,
          px,
        })
        list.forEach((w, k) => {
          const K = b.words[k]
          const x = wx ?? (-wi[k].width * cap) / 2 + ((p.posX ?? 0) * view.w) / 2
          K.group.position.set(x, wy, 0)
          K.group.scale.setScalar(cap)
          const turnIn = ph(k === 0 ? tIn + 0.08 : flipAt(k), k === 0 ? p.inDur : p.flipDur, {
            stagger: k === 0 ? p.inStagger : p.flipStagger,
            ease: k === 0 ? p.inEase : p.flipEase,
            y: k === 0 ? p.inY : 0,
            rot: k === 0 ? 0 : up ? 90 : -90,
            depth: k === 0 ? 0 : p.depth,
            blur: k === 0 ? p.inBlur : 10,
            mask: k === 0,
          })
          const last = k === list.length - 1
          const turnOut = last
            ? out
            : ph(flipAt(k + 1), p.flipDur, { stagger: p.flipStagger, ease: p.flipEase, rot: up ? -90 : 90, depth: p.depth, blur: 10, mask: false })
          K.pose(t, { in: turnIn, out: turnOut, from: ctx.col(p.fromColor), to: ctx.col(p.color2 || p.color), motion: 0.7, fps: ctx.fps, px })
        })
      }
      for (const [id, b] of blocks) if (!live.has(id)) hideAll(b)
    },
    late() {
      for (const b of blocks.values()) {
        b.fixed.late()
        for (const w of b.words) w.late()
      }
    },
  }
}
