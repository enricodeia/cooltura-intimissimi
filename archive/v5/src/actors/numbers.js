// The numbers, on a clean white page.
//  · Four totals set as a table: the figures (Instrument Serif) right-aligned
//    on one axis, what they count (Instrument Sans) on their baseline beside
//    them. Every figure is a counter that reveals itself (reels rolling up
//    through a mask, blurred by their own speed, settling sharp, violet → ink),
//    row after row. They leave upwards.
//  · "From content to communities" comes up word by word, then parts ("From
//    content" to the left, "to communities" to the right; two lines that open up
//    and down in narrow frames) and the number of comments counts up in the gap,
//    "commenti" under it.
//  · The comments pour in: the number rises to make room and the notifications
//    come out from under it, each new one pushing the others down, faster and
//    faster, until they stream (blurred by their own speed) and everything falls
//    away in a speed blur (the transition to "Beyond numbers.").

import * as THREE from 'three'
import { Kinetic, phaseOf } from '../lib/kinetic.js'
import { Counter } from '../lib/counter.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { canvasTexture } from '../lib/materials.js'
import { drawCommentCard } from '../lib/draw2d.js'
import { COMMENTS } from '../data/comments.js'
import { seg, clamp, lerp, ease } from '../core/util.js'

export function createNumbers(engine) {
  const hud = engine.hud
  // ---------------------------------------------------------------- four totals
  const rows = [0, 1, 2, 3].map(() => ({ num: new Counter(hud), lab: new Kinetic(hud) }))
  // ---------------------------------------------------------------- the flow (everything that falls away at the end)
  const flow = new THREE.Group()
  hud.add(flow)
  const halves = [new Kinetic(flow), new Kinetic(flow)]
  const cNum = new Counter(flow)
  const cLab = new Kinetic(flow)
  const cardMaskInv = new THREE.Matrix4()
  // one texture per comment (the flood repeats them), one mesh per card
  const textures = new Map()
  function art(i, style) {
    const key = (i % COMMENTS.length) + '|' + style
    let a = textures.get(key)
    if (!a) {
      const d = drawCommentCard(COMMENTS[i % COMMENTS.length], style)
      a = { tex: canvasTexture(d.canvas), aspect: d.h / d.w, cardFrac: d.cw / d.w, chFrac: d.ch / d.h }
      textures.set(key, a)
    }
    return a
  }
  const cards = []
  function card(i, style) {
    const a = art(i, style)
    let c = cards[i]
    if (c && c.a === a) return c
    if (c) {
      flow.remove(c.mesh)
      c.mat.dispose()
      c.mesh.geometry.dispose()
    }
    const mat = fxMaterial({ map: a.tex, maskInv: cardMaskInv })
    // the plane has the canvas's proportions: one uniform scale, so the blur is round
    const mesh = fxMesh(new THREE.PlaneGeometry(1, a.aspect), mat)
    flow.add(mesh)
    c = cards[i] = { mesh, mat, a }
    return c
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
        const side = p.labelPos !== 'below'
        const capN = short * (p.size / 100)
        const capL = short * (p.labelSize / 100) * (portrait ? 1.35 : 1)
        const vals = [p.v1, p.v2, p.v3, p.v4].map(String)
        const labs = [p.l1, p.l2, p.l3, p.l4].map(String)
        let numW = 0
        let labW = 0
        rows.forEach((r, k) => {
          r.num.set({ value: vals[k], weight: p.weight, align: side ? 'right' : 'left', spins: p.spins, step: p.spinStep })
          const info = r.lab.set({ text: labs[k], weight: p.labelWeight, align: 'left', tracking: 0.01 })
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
      }

      // ================================================================ communities + comments (one flow)
      if (t < cm.start - 0.3 || t > co.end + 0.3) return
      flow.visible = true
      const p = cm.p
      const q = co.p

      // ---------------- the phrase in two halves
      const words = String(p.text).trim().split(/\s+/)
      const cut = Math.max(1, Math.min(words.length - 1, Math.round(p.splitAfter)))
      const texts = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')]
      const iL = halves[0].set({ text: texts[0], weight: p.weight, align: 'center', tracking: p.tracking })
      const iR = halves[1].set({ text: texts[1], weight: p.weight, align: 'center', tracking: p.tracking })
      const margin = short * 0.075
      const room = view.w - 2 * margin
      // the number of comments (a touch below the centre) and "commenti" under it
      const capC = short * (p.numSize / 100)
      cNum.set({ value: String(p.value), weight: p.numWeight, align: 'center', spins: p.spins, step: 2 })
      const numW = cNum.width * capC
      const yNum = -p.numY * short
      const labInfo = cLab.set({ text: String(p.label), weight: p.labelWeight, align: 'center', tracking: 0.01 })
      const capCL = Math.min(short * (p.labelSize / 100) * (portrait ? 1.35 : 1), (room * 0.8) / Math.max(1, labInfo.width))
      const yLab = yNum - capC / 2 - capC * 0.3 - capCL / 2
      // one line that parts around the number (wide frames), or two lines that open up and down (narrow ones)
      const base = (p.size / 100) * short
      const inLine = (iL.width + iR.width) * base + numW * p.apartGap + base * 1.2 < room
      let capP
      let fromL
      let fromR
      let toL
      let toR
      if (inLine) {
        capP = base
        const lw = iL.width * capP
        const rw = iR.width * capP
        const phraseW = lw + capP * 0.32 + rw
        const yB = yNum - capC / 2 + capP / 2 // on the number's baseline
        fromL = { x: -phraseW / 2 + lw / 2, y: 0 }
        fromR = { x: phraseW / 2 - rw / 2, y: 0 }
        toL = { x: -(numW * p.apartGap) / 2 - capP * 0.6 - lw / 2, y: yB }
        toR = { x: (numW * p.apartGap) / 2 + capP * 0.6 + rw / 2, y: yB }
      } else {
        capP = Math.min(base * p.stackScale, room / Math.max(iL.width, iR.width, 1e-3))
        const lw = iL.width * capP
        const rw = iR.width * capP
        const lead = capP * 1.55
        const gapP = capP * 0.95
        fromL = { x: 0, y: lead / 2 }
        fromR = { x: 0, y: -lead / 2 }
        toL = { x: -view.w / 2 + margin + lw / 2, y: yNum + capC / 2 + gapP + capP / 2 }
        toR = { x: view.w / 2 - margin - rw / 2, y: yLab - capCL / 2 - gapP - capP / 2 }
      }
      const ap = seg(t, cm.start + p.apartAt, p.apartDur, p.apartEase)

      // ---------------- the group rises to make room for the comments
      const groupTop = Math.max(yNum + capC / 2, inLine ? -Infinity : toL.y + capP / 2)
      const groupBottom = Math.min(yLab - capCL / 2, inLine ? Infinity : toR.y - capP / 2)
      const liftTo = view.h / 2 - q.top * view.h - groupTop
      const lift = Math.max(0, liftTo) * seg(t, co.start + q.liftAt, q.liftDur, q.liftEase)

      const inPh = phaseOf(p, 'in', cm.start + p.inAt)
      const nL = halves[0].counts?.words || 1
      const style0 = { from: ctx.col(p.fromColor), to: ctx.col(p.color), motion: p.motion, fps: ctx.fps, px: capP * pxU }
      ;[0, 1].forEach((i) => {
        const kt = halves[i]
        const a = i ? fromR : fromL
        const b = i ? toR : toL
        kt.group.position.set(lerp(a.x, b.x, ap), lerp(a.y, b.y, ap) + lift, 0)
        kt.group.scale.setScalar(capP)
        // one phrase: the right half's words follow the left half's in the stagger
        const ph = { ...inPh, at: inPh.at + (i ? nL * inPh.stagger : 0) }
        kt.pose(t, { ...style0, in: ph, out: null })
      })

      // ---------------- the number of comments + its subtitle
      cNum.group.position.set(0, yNum + lift, 0)
      cNum.group.scale.setScalar(capC)
      const cAt = cm.start + p.cAt
      cNum.pose(t, { at: cAt, dur: p.cDur, stagger: p.digitStagger, order: 'end', ease: p.cEase, blur: p.cBlur, motion: 1, fromColor: ctx.col(p.numFrom), color: ctx.col(p.numColor), px: capC * pxU, fps: ctx.fps, out: null })
      cLab.group.position.set(0, yLab + lift, 0)
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

      // ---------------- the comments: out from under the number, each new one pushes the others down
      const style = q.style === 'dark' ? 'dark' : 'light'
      const n = Math.round(q.count)
      const cw = q.cardW * short * (portrait ? 1.5 : 1)
      const gap = q.gap * short
      const tPop = []
      let acc = co.start + q.popAt
      for (let k = 0; k < n; k++) {
        tPop.push(acc)
        acc += Math.max(q.minEvery, q.every * Math.pow(q.accel, k))
      }
      const slotTop = groupBottom + lift - q.firstGap * short // where a new notification comes out
      const pE = ease(q.popEase)
      const uE = ease(q.pushEase)
      const hs = []
      for (let k = 0; k < n; k++) {
        const a = art(k, style)
        hs.push((cw / a.cardFrac) * a.aspect * a.chFrac) // the card's own height
      }
      // how far card k has been pushed down at time tt (by every card that came after it)
      const depthOf = (k, tt) => {
        let d = 0
        for (let j = k + 1; j < n; j++) {
          if (tt <= tPop[j]) break
          d += (hs[j] + gap) * uE(clamp((tt - tPop[j]) / q.pushDur))
        }
        return d
      }
      // a new one slides down out of the slot exactly as the others are pushed (same curve, same time): the column moves as one
      const yOf = (k, tt) => {
        const enter = 1 - uE(clamp((tt - tPop[k]) / q.pushDur))
        const e = pE(clamp((tt - tPop[k]) / q.popDur))
        return slotTop - hs[k] / 2 - depthOf(k, tt) + enter * (hs[k] + gap) - (q.popY / 100) * hs[k] * (1 - e)
      }

      // ---------------- the end: everything falls away, blurred by its speed
      const tDive = co.end - q.diveDur
      const dE = ease(q.diveEase)
      const run = (tt) => q.diveDist * view.h * dE(clamp((tt - tDive) / q.diveDur))
      flow.position.y = -run(t)
      const hh = 0.5 / ctx.fps
      const vel = (run(t + hh) - run(t - hh)) / (2 * hh)
      ctx.fx.blurY += ((vel * 0.5) / ctx.fps / view.h) * q.speedBlur
      const fadeOut = seg(t, tDive + q.diveDur * 0.35, q.diveDur * 0.65, 'power2.in')
      const fadeBlur = (q.fadeBlur / 100) * fadeOut
      if (t > tDive) {
        for (const kt of [halves[0], halves[1], cNum, cLab]) {
          kt.group.traverse((o) => {
            const u = o.material?.uniforms
            if (u && o.visible) u.uOpacity.value *= 1 - fadeOut
          })
        }
      }
      const dt = 1 / ctx.fps
      const bottomEdge = -view.h / 2 + run(t) - 0.2 // the frame's bottom, in flow space
      for (let k = 0; k < n; k++) {
        const c = card(k, style)
        const a = clamp((t - tPop[k]) / q.popDur)
        const y = a > 0 ? yOf(k, t) : 0
        const on = a > 0 && fadeOut < 0.999 && y + hs[k] / 2 > bottomEdge
        c.mesh.visible = on
        if (!on) continue
        const e = pE(a)
        const yPrev = yOf(k, t - dt)
        const s = lerp(q.popScale, 1, e)
        const planeW = (cw / c.a.cardFrac) * s
        c.mesh.position.set(0, y, 0)
        c.mesh.scale.setScalar(planeW)
        c.mat.uniforms.uOpacity.value = pE(clamp(a / 0.6)) * (1 - fadeOut)
        // they come out from under the number: nothing shows above the slot (mask in flow space)
        fxMask(c.mesh, true, -1e5, -1e5, 1e5, slotTop)
        // blur as it lands + motion blur of its own speed (the stream) + the fall
        const blur = (q.popBlur / 100) * hs[k] * (1 - e) + fadeBlur * hs[k]
        const smear = (y - yPrev) * q.motion
        const toLocal = 1 / planeW
        fxBlur(c.mesh, blur * toLocal, 0, smear * toLocal, planeW * pxU)
      }
      for (let k = n; k < cards.length; k++) if (cards[k]) cards[k].mesh.visible = false
    },

    late() {
      for (const k of kinetics) k.late()
      if (flow.visible) {
        flow.updateWorldMatrix(true, false)
        cardMaskInv.copy(flow.matrixWorld).invert()
      }
    },
  }
}
