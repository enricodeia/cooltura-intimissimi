// The numbers, on a clean white page.
//  · Four totals in one aligned column (numbers in violet, what they count in
//    ink): every figure is a counter that reveals itself (reels rolling up
//    through a mask, blurred by their own speed, settling sharp), row after
//    row. They leave upwards.
//  · "From content to communities" comes up word by word, then parts: "From
//    content" to the left, "to communities" to the right, and the number of
//    comments counts up in the gap (a touch below the centre), "commenti" under it.
//  · The comments arrive under it as notifications, faster and faster; the
//    camera follows them down, then runs away in a speed blur (the transition
//    to "Beyond numbers.").

import * as THREE from 'three'
import { Kinetic, phaseOf } from '../lib/kinetic.js'
import { Counter } from '../lib/counter.js'
import { fxMaterial, fxMesh, fxBlur } from '../engine/fxlayer.js'
import { canvasTexture } from '../lib/materials.js'
import { drawCommentCard } from '../lib/draw2d.js'
import { COMMENTS } from '../data/comments.js'
import { seg, clamp, lerp, ease } from '../core/util.js'

export function createNumbers(engine) {
  const hud = engine.hud
  // ---------------------------------------------------------------- four totals
  const rows = [0, 1, 2, 3].map(() => ({ num: new Counter(hud), lab: new Kinetic(hud) }))
  // ---------------------------------------------------------------- the flow (everything the camera follows down)
  const flow = new THREE.Group()
  hud.add(flow)
  const halves = [new Kinetic(flow), new Kinetic(flow)]
  const cNum = new Counter(flow)
  const cLab = new Kinetic(flow)
  const cardMaskInv = new THREE.Matrix4()
  const cards = []
  function card(i, style) {
    if (cards[i] && cards[i].style === style) return cards[i]
    if (cards[i]) {
      flow.remove(cards[i].mesh)
      cards[i].tex.dispose()
      cards[i].mat.dispose()
      cards[i].mesh.geometry.dispose()
    }
    const d = drawCommentCard(COMMENTS[i % COMMENTS.length], style)
    const tex = canvasTexture(d.canvas)
    const mat = fxMaterial({ map: tex, maskInv: cardMaskInv })
    // the plane has the canvas's proportions: one uniform scale, so the blur is round
    const mesh = fxMesh(new THREE.PlaneGeometry(1, d.h / d.w), mat)
    flow.add(mesh)
    cards[i] = { mesh, mat, tex, style, aspect: d.h / d.w, cardFrac: d.cw / d.w, chFrac: d.ch / d.h }
    return cards[i]
  }
  const kinetics = [...rows.flatMap((r) => [r.num, r.lab]), ...halves, cNum, cLab]

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const st = T.shot('stats')
      const cm = T.shot('communities')
      const co = T.shot('comments')
      const short = Math.min(view.w, view.h)
      const portrait = view.aspect < 0.9
      const pxU = ctx.pxPerUnit
      for (const k of kinetics) k.group.visible = false
      flow.visible = false

      // ================================================================ the four totals
      if (t >= st.start - 0.3 && t <= st.end + 0.4) {
        const p = st.p
        const side = p.labelPos === 'side' || (p.labelPos === 'auto' && !portrait)
        const capN = short * 0.1 * p.size * (portrait ? 1 : 1.18)
        const capL = capN * (side ? 0.34 : 0.3)
        const vals = [p.v1, p.v2, p.v3, p.v4].map(String)
        const labs = [p.l1, p.l2, p.l3, p.l4].map(String)
        let numW = 0
        let labW = 0
        rows.forEach((r, k) => {
          r.num.set({ value: vals[k], weight: p.weight, align: 'left', spins: p.spins, step: p.spinStep })
          const info = r.lab.set({ text: labs[k], weight: p.labelWeight, align: 'left' })
          numW = Math.max(numW, r.num.width * capN)
          labW = Math.max(labW, info.width * capL)
        })
        const gapX = capN * 0.42
        const totalW = side ? numW + gapX + labW : Math.max(numW, labW)
        const pitch = (side ? capN * 1.62 : capN * 1.0 + capN * 0.36 + capL + capN * 0.62) * p.rowGap
        const fit = Math.min(1, (view.w * 0.86) / totalW, (view.h * 0.82) / (pitch * 3 + capN + (side ? 0 : capL + capN * 0.36)))
        const cN = capN * fit
        const cL = capL * fit
        const pit = pitch * fit
        const x0 = (-totalW * fit) / 2
        const blockH = pit * 3 + cN + (side ? 0 : cL + cN * 0.36)
        const yTop = blockH / 2 // top of the first number
        const outAt = (k) => st.end - p.exLead + k * p.exStagger
        rows.forEach((r, k) => {
          const at = st.start + p.cAt + k * p.rowStagger
          const base = yTop - cN - k * pit // number baseline
          r.num.group.position.set(x0, base + cN / 2, 0)
          r.num.group.scale.setScalar(cN)
          r.num.pose(t, {
            at,
            dur: p.cDur,
            stagger: p.digitStagger,
            order: p.dOrder,
            ease: p.cEase,
            blur: p.cBlur,
            motion: p.motion,
            color: ctx.col(p.color),
            px: cN * pxU,
            fps: ctx.fps,
            out: { at: outAt(k), dur: p.exDur, stagger: 0.015, order: 'start', ease: p.exEase, y: p.exY, blur: p.exBlur, opacity: 0, mask: p.exMask },
          })
          // what it counts: beside it on the baseline, or under it
          const lx = side ? x0 + (numW + gapX) * fit : x0
          const lbase = side ? base : base - cN * 0.36 - cL
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
      }

      // ================================================================ communities + comments (one flow)
      if (t < cm.start - 0.3 || t > co.end + 0.3) return
      flow.visible = true
      const p = cm.p
      const q = co.p

      // ---------------- the scroll: the camera follows the notifications, then runs (blur transition)
      const style = q.style === 'dark' ? 'dark' : 'light'
      const n = Math.round(q.count)
      const cw = q.cardW * short * (portrait ? 1 : 0.62)
      const tPop = []
      let acc = co.start + q.popAt
      for (let k = 0; k < n; k++) {
        tPop.push(acc)
        acc += q.every * Math.pow(q.accel, k)
      }

      // ---------------- the phrase in two halves
      const words = String(p.text).trim().split(/\s+/)
      const cut = Math.max(1, Math.min(words.length - 1, Math.round(p.splitAfter)))
      const texts = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')]
      let capP = (p.size / 100) * short
      const iL = halves[0].set({ text: texts[0], weight: p.weight, align: 'right', tracking: p.tracking })
      const iR = halves[1].set({ text: texts[1], weight: p.weight, align: 'left', tracking: p.tracking })
      const margin = short * 0.07
      const room = view.w - 2 * margin
      // the whole phrase on one line, centred, never wider than the frame
      capP *= Math.min(1, room / ((iL.width + 0.42 + iR.width) * capP))
      const spaceW = capP * 0.42
      // the number of comments
      const capC = short * 0.1 * p.numSize
      cNum.set({ value: String(p.value), weight: p.numWeight, align: 'center', spins: p.spins, step: 2 })
      const numW = cNum.width * capC
      const yNum = -p.numY * short // a touch below the centre
      const capCL = capC * 0.28
      const yLab = yNum - capC / 2 - capC * 0.34 - capCL / 2
      // where the halves go: either side of the number, or (no room: 9:16) above it to the left and under it to the right
      const lw = iL.width * capP
      const rw = iR.width * capP
      const inLine = lw + rw + numW * p.apartGap + capP * 1.2 < room
      const ap = seg(t, cm.start + p.apartAt, p.apartDur, p.apartEase)
      const phraseW = lw + spaceW + rw
      const fromL = { x: -phraseW / 2 + lw, y: 0 }
      const fromR = { x: -phraseW / 2 + lw + spaceW, y: 0 }
      let toL
      let toR
      if (inLine) {
        toL = { x: -(numW * p.apartGap) / 2 - capP * 0.6, y: yNum - capC / 2 + capP / 2 }
        toR = { x: (numW * p.apartGap) / 2 + capP * 0.6, y: yNum - capC / 2 + capP / 2 }
      } else {
        toL = { x: -view.w / 2 + margin + lw, y: yNum + capC / 2 + capP * 1.6 }
        toR = { x: view.w / 2 - margin - rw, y: yLab - capCL / 2 - capP * 1.7 }
      }
      const inPh = phaseOf(p, 'in', cm.start + p.inAt)
      const nL = halves[0].counts?.words || 1
      const style0 = { from: ctx.col(p.fromColor), to: ctx.col(p.color), motion: p.motion, fps: ctx.fps, px: capP * pxU }
      ;[0, 1].forEach((i) => {
        const kt = halves[i]
        const a = i ? fromR : fromL
        const b = i ? toR : toL
        kt.group.position.set(lerp(a.x, b.x, ap), lerp(a.y, b.y, ap), 0)
        kt.group.scale.setScalar(capP)
        // one phrase: the right half's words follow the left half's in the stagger
        const ph = { ...inPh, at: inPh.at + (i ? nL * inPh.stagger : 0) }
        kt.pose(t, { ...style0, in: ph, out: null })
      })

      // ---------------- the number of comments + its subtitle
      cNum.group.position.set(0, yNum, 0)
      cNum.group.scale.setScalar(capC)
      const cAt = cm.start + p.cAt
      cNum.pose(t, { at: cAt, dur: p.cDur, stagger: p.digitStagger, order: 'end', ease: p.cEase, blur: p.cBlur, motion: 1, color: ctx.col(p.numColor), px: capC * pxU, fps: ctx.fps, out: null })
      cLab.set({ text: String(p.label), weight: 400, align: 'center' })
      cLab.group.position.set(0, yLab, 0)
      cLab.group.scale.setScalar(capCL)
      cLab.pose(t, {
        in: { at: cAt + p.lAt, dur: 0.75, stagger: 0.03, order: 'start', split: 'chars', ease: 'ci.reveal', x: 0, y: 110, rot: 0, depth: 0, scale: 1, blur: 25, opacity: 0, mask: true },
        out: null,
        from: ctx.col(p.labelColor),
        to: ctx.col(p.labelColor),
        motion: 0.6,
        fps: ctx.fps,
        px: capCL * pxU,
      })

      // ---------------- the notifications under it
      const gap = q.gap * short
      // under the number (and under "to communities" when it went below it)
      let yCur = Math.min(yLab - capCL / 2, inLine ? Infinity : toR.y - capP / 2) - q.firstGap * short
      const slots = []
      for (let k = 0; k < n; k++) {
        const c = card(k, style)
        const ch = (cw / c.cardFrac) * c.aspect * c.chFrac // the card's own height
        slots.push({ c, y: yCur - ch / 2, ch })
        yCur -= ch + gap
      }
      const bottom = -view.h / 2 + q.bottom * view.h
      const need = (k) => Math.max(0, bottom - (slots[k].y - slots[k].ch / 2))
      const fE = ease(q.followEase)
      let scroll = 0
      let prev = 0
      for (let k = 0; k < n; k++) {
        const s = need(k)
        scroll += (s - prev) * fE(clamp((t - tPop[k] - q.popDur * 0.15) / q.followDur))
        prev = Math.max(prev, s)
      }
      // the run: everything goes up fast and blurs (the cut to "Beyond numbers.")
      const tDive = co.end - q.diveDur
      const dE = ease(q.diveEase)
      const run = (tt) => q.diveDist * view.h * dE(clamp((tt - tDive) / q.diveDur))
      const total = (tt) => scroll + run(tt)
      flow.position.y = total(t)
      const h = 0.5 / ctx.fps
      const vel = (run(t + h) - run(t - h)) / (2 * h)
      const diveK = clamp((t - tDive) / q.diveDur)
      ctx.fx.blurY += ((vel * 0.5) / ctx.fps / view.h) * q.speedBlur
      const fadeOut = seg(t, tDive + q.diveDur * 0.35, q.diveDur * 0.65, 'power2.in')
      const fadeBlur = (q.fadeBlur / 100) * fadeOut
      // the phrase and the number leave with the flow, blurring out with the run
      for (const kt of [halves[0], halves[1], cNum, cLab]) {
        if (diveK > 0) {
          kt.group.traverse((o) => {
            const u = o.material?.uniforms
            if (u && o.visible) u.uOpacity.value *= 1 - fadeOut
          })
        }
      }
      const pE = ease(q.popEase)
      slots.forEach((sl, k) => {
        const c = sl.c
        const a = clamp((t - tPop[k]) / q.popDur)
        const aPrev = clamp((t - 1 / ctx.fps - tPop[k]) / q.popDur)
        const on = a > 0 && fadeOut < 0.999
        c.mesh.visible = on
        if (!on) return
        const e = pE(a)
        const dy = -(q.popY / 100) * sl.ch * (1 - e)
        const dyPrev = -(q.popY / 100) * sl.ch * (1 - pE(aPrev))
        const s = lerp(q.popScale, 1, e)
        const planeW = (cw / c.cardFrac) * s
        c.mesh.position.set(0, sl.y + dy, 0)
        c.mesh.scale.setScalar(planeW)
        c.mat.uniforms.uOpacity.value = pE(clamp(a / 0.6)) * (1 - fadeOut)
        // blur as it lands + motion blur of its own rise and of the run
        const blur = (q.popBlur / 100) * sl.ch * (1 - e) + fadeBlur * sl.ch
        const smear = (dy - dyPrev) * q.motion
        const toLocal = 1 / planeW
        fxBlur(c.mesh, blur * toLocal, 0, smear * toLocal, planeW * pxU)
      })
      for (let k = n; k < cards.length; k++) cards[k].mesh.visible = false
      void lerp
    },

    late() {
      for (const k of kinetics) k.late()
    },
  }
}
