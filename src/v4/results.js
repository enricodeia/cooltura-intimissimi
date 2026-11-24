// 03 · The results.
//   THE RESULTS?  light, tracked, alone on the paper; on the beat AMAZING. rises from
//                 the bottom with the wine (look.js: the colour rises from the bottom too);
//                 the type turns paper as the wine reaches it
//   the KPIs      rise from below the frame one per beat, the reels of their figures
//                 rolling as they come up, and settle in columns (four in a row in wide
//                 frames, two by two in narrow ones), fine rules growing between them;
//                 they hold, then leave upwards, column after column (the reels roll out
//                 through their windows), and the paper comes back from the bottom.
// The figures are text fields in the panel: the ones of the reports, never invented.

import * as THREE from 'three'
import { Kinetic } from '../lib/kinetic.js'
import { Counter } from '../lib/counter.js'
import { fxMaterial, fxMesh } from '../engine/fxlayer.js'
import { caseOf } from '../actors/shared.js'
import { ph } from './common.js'
import { ease, clamp, lerp, mixHex, seg } from '../core/util.js'

/** Where the rising colour's front is (view y), as the background shader draws its wipe from the bottom. */
export function floodFront(view, mix, soft = 0.16) {
  return lerp(-0.5 - soft - 0.07, 0.5 + soft + 0.07, mix) * view.h
}

export function createResults(engine) {
  const hud = engine.hud
  const q = new Kinetic(hud)
  const a = new Kinetic(hud)
  const cols = [0, 1, 2, 3, 4].map(() => ({ num: new Counter(hud), lab: new Kinetic(hud) }))
  const ruleGeo = new THREE.PlaneGeometry(1, 1)
  const rules = [0, 1, 2, 3].map(() => {
    const m = fxMesh(ruleGeo, fxMaterial({}))
    m.visible = false
    hud.add(m)
    return m
  })
  const all = [q, a, ...cols.flatMap((c) => [c.num, c.lab])]

  const floodAt = (T, t, view) => {
    const rs = T.shots.find((s) => s.type === 'results')
    if (!rs || !rs.p.floodOn) return { front: -Infinity, on: false }
    const mix = seg(t, rs.start + rs.p.floodAt, rs.p.floodDur, 'cubic(0.55,0,0.2,1)')
    return { front: floodFront(view, mix), on: mix > 0, p: rs.p }
  }

  function poseQA(ctx, sh) {
    const { t, view, T } = ctx
    const p = sh.p
    const short = Math.min(view.w, view.h)
    const margin = short * 0.075
    const F = floodAt(T, t, view)
    // ink on the paper, the paper's colour once the wine has risen past it
    const onWine = (y, base) => (F.on ? mixHex(ctx.col(base), ctx.col(p.onColor), clamp((F.front - y) / (view.h * 0.06))) : ctx.col(base))
    let qCap = (p.qSize / 100) * short
    let aCap = (p.aSize / 100) * short
    const qi = q.set({ text: caseOf(p.q, p.caps), weight: p.qWeight, align: 'center', tracking: p.qTracking })
    const ai = a.set({ text: caseOf(p.a, p.caps), weight: p.aWeight, align: 'center', tracking: p.aTracking })
    qCap = Math.min(qCap, (view.w - 2 * margin) / Math.max(1e-3, qi.width))
    aCap = Math.min(aCap, (view.w - 2 * margin) / Math.max(1e-3, ai.width))
    const tA = sh.start + p.aAt
    const eA = ease(p.aEase)(clamp((t - tA) / p.aDur))
    const gap = aCap * 0.36
    const y0 = ((p.posY ?? 0) * view.h) / 2
    // the question first alone in the centre, then it makes room for the answer rising under it
    const qY = y0 + lerp(0, (aCap + gap) / 2, ease('cubic(0.6,0,0.2,1)')(clamp((t - tA + 0.1) / 0.55)))
    const aRest = qY - qCap / 2 - gap - aCap / 2
    const aY = aRest - (1 - eA) * p.aRise * view.h
    const tOut = sh.end - p.outLead
    // pushed up and out by the numbers rising from below
    const lift = ease('cubic(0.5,0,0.7,0.4)')(clamp((t - tOut) / 0.5)) * view.h * 0.3
    q.group.position.set(0, qY + lift, 0)
    q.group.scale.setScalar(qCap)
    q.pose(t, {
      in: ph(sh.start + p.qAt, 0.62, { split: 'chars', stagger: 0.02, y: 100, blur: 24, mask: true }),
      out: ph(tOut, 0.36, { stagger: 0.008, ease: 'ci.exit', y: -110, blur: 30, mask: true }),
      from: ctx.col('rose'),
      to: onWine(qY, p.qColor ?? 'ink'),
      motion: 0.6,
      fps: ctx.fps,
      px: qCap * ctx.pxPerUnit,
    })
    const k = lerp(1.06, 1, eA)
    a.group.position.set(0, aY + lift * 1.15, 0)
    a.group.scale.setScalar(aCap * k)
    a.pose(t, {
      // it rises with the wine and its letters close in from the centre (tracking-in), within the frame
      in: ph(tA, p.aDur, { stagger: 0.016, order: 'center', ease: p.aEase, blur: 30, opacity: 0, mask: false, spread: Math.min(p.aSpread ?? 0, Math.max(0, (view.w / 2 - margin * 0.5) / Math.max(1e-3, (ai.width / 2) * aCap * k) - 1)) }),
      out: ph(tOut + 0.05, 0.4, { stagger: 0.01, ease: 'ci.exit', y: -90, blur: 36 }),
      from: ctx.col('blush'),
      to: onWine(aY, 'ink'),
      motion: 0.9,
      fps: ctx.fps,
      px: aCap * k * ctx.pxPerUnit,
    })
  }

  function poseKpis(ctx, sh) {
    const { t, view } = ctx
    const p = sh.p
    const portrait = view.aspect < 0.9
    const short = Math.min(view.w, view.h)
    const items = [
      [p.v1, p.l1],
      [p.v2, p.l2],
      [p.v3, p.l3],
      [p.v4, p.l4],
      ...(p.fifthOn ? [[p.v5, p.l5]] : []),
    ]
      .map(([v, l]) => [String(v ?? '').trim(), caseOf(l, true)])
      .filter(([v]) => v)
    const N = items.length
    if (!N) return
    const perRow = portrait ? 2 : N
    const rowsN = Math.ceil(N / perRow)
    const totalW = p.width * view.w
    const colW = totalW / perRow
    // the figures: one size for all, as big as the columns allow
    let capN = (p.size / 100) * short
    let capL = (p.labelSize / 100) * short * (portrait ? 1.25 : 1)
    const W = items.map(([v, l], i) => {
      cols[i].num.set({ value: v, weight: p.weight, align: 'left', spins: p.spins, step: 2, tracking: p.tracking })
      const li = cols[i].lab.set({ text: l, weight: p.labelWeight, align: 'left', tracking: p.labelTracking })
      return { n: cols[i].num.width, l: li.width }
    })
    capN = Math.min(capN, (colW * 0.84) / Math.max(1e-3, ...W.map((w) => w.n)))
    capL = Math.min(capL, (colW * 0.9) / Math.max(1e-3, ...W.map((w) => w.l)))
    const gapNL = capN * p.labelGap
    const cellH = capN + gapNL + capL
    const rowPitch = cellH * 1.9
    const yC = ((p.posY ?? 0) * view.h) / 2
    const tK = (i) => sh.start + p.kAt + i * p.every
    const tOut = sh.end - p.outLead
    const riseE = ease(p.riseEase)
    const from = ctx.col(p.fromColor)
    const colN = ctx.col(p.color)
    const colL = ctx.col(p.labelColor)
    // the wave (V4, "ola"): once every counter has landed, a small swell of scale runs across the columns, left
    // to right (reading order), each one up and back down on the same ease; the whole run lasts waveTotal
    const cIn = (i) => ({ at: tK(i), dur: p.cDur, stagger: 0.05, order: 'end' })
    const landed = Math.max(...items.map((_, i) => tK(i) + cols[i].num.length(cIn(i))))
    const tW = landed + (p.waveDelay ?? 0.06)
    const each = Math.min(p.waveEach ?? 0.75, p.waveTotal ?? 1.5)
    const sW = N > 1 ? Math.max(0, ((p.waveTotal ?? 1.5) - each) / (N - 1)) : 0
    const wE = ease(p.waveEase || 'cubic(0.65,0,0.35,1)')
    const waveK = (i) => {
      if (!p.waveOn) return 0
      const u = (t - tW - i * sW) / each
      if (u <= 0 || u >= 1) return 0
      return u < 0.5 ? wE(u * 2) : wE((1 - u) * 2)
    }
    items.forEach(([v, l], i) => {
      const r = Math.floor(i / perRow)
      const inRow = Math.min(perRow, N - r * perRow)
      const c = i - r * perRow
      const x = -((inRow - 1) * colW) / 2 + c * colW
      const yRow = yC + ((rowsN - 1) * rowPitch) / 2 - r * rowPitch
      const top = yRow + cellH / 2
      const e = riseE(clamp((t - tK(i)) / p.riseDur))
      const rise = (1 - e) * p.rise * view.h
      const drift = Math.max(0, t - tK(i) - p.riseDur) * view.h * 0.006
      const sc = lerp(p.fromScale, 1, e)
      // the wave scales the whole column (figure + label) about its centre
      const wv = 1 + (p.waveAmp ?? 0.08) * waveK(i)
      const pX = x
      const pY = yRow + drift - rise * 0.92
      const at = (px, py) => [pX + (px - pX) * wv, pY + (py - pY) * wv]
      const nW = W[i].n * capN * sc
      const out = { at: tOut + i * p.outStagger, dur: p.outDur, stagger: 0.02, order: 'start', ease: p.outEase, y: -112, blur: 30, opacity: 0, mask: true }
      const N_ = cols[i].num
      N_.group.position.set(...at(x - nW / 2, top - (capN * sc) / 2 - rise + drift), 0)
      N_.group.scale.setScalar(capN * sc * wv)
      N_.pose(t, { ...cIn(i), ease: p.cEase, blur: p.cBlur ?? 30, motion: p.cMotion ?? 1, fromColor: from, color: colN, px: capN * sc * wv * ctx.pxPerUnit, fps: ctx.fps, out })
      const L_ = cols[i].lab
      L_.group.position.set(...at(x - (W[i].l * capL) / 2, top - capN - gapNL - capL / 2 - rise * 0.85 + drift), 0)
      L_.group.scale.setScalar(capL * wv)
      L_.pose(t, {
        // quick and sharp: it slides up through its mask, no fade (V4)
        in: ph(tK(i) + p.labelAt, 0.45, { split: 'words', stagger: 0.035, y: 100, blur: 6, opacity: 1, mask: true }),
        out: ph(tOut + i * p.outStagger + 0.03, p.outDur, { split: 'words', stagger: 0.02, ease: p.outEase, y: -100, blur: 22, mask: true }),
        from: colL,
        to: colL,
        motion: 0.6,
        fps: ctx.fps,
        px: capL * ctx.pxPerUnit,
      })
      // the rule on its left (not before the first of a row): grows from the bottom as it arrives, leaves to the top
      const ri = i - 1
      if (p.rules && c > 0 && rules[ri]) {
        const m = rules[ri]
        const hR = capN * p.ruleH
        const g = ease('cubic(0.3,0.6,0.2,1)')(clamp((t - tK(i) - 0.05) / 0.55))
        const o = ease('ci.exit')(clamp((t - tOut - i * p.outStagger) / (p.outDur + 0.1)))
        const len = hR * g * (1 - o)
        if (len > 1e-4) {
          m.visible = true
          const yMid = yRow + drift
          const y0 = yMid - hR / 2 + hR * o // grows up from the bottom, leaves through the top
          m.position.set(x - colW / 2, y0 + len / 2, 0)
          m.scale.set(1.4 / ctx.pxPerUnit, len, 1)
          m.material.uniforms.uColor.value.set(ctx.col(p.ruleColor))
          m.material.uniforms.uOpacity.value = 0.55
        }
      }
    })
  }

  return {
    update(ctx) {
      const { t, T } = ctx
      for (const k of all) k.group.visible = false
      for (const m of rules) m.visible = false
      const r = T.shots.find((s) => s.type === 'results' && t >= s.start - 0.3 && t < s.end + 0.6)
      if (r) poseQA(ctx, r)
      const k = T.shots.find((s) => s.type === 'kpis' && t >= s.start - 0.3 && t < s.end + 0.3)
      if (k) poseKpis(ctx, k)
    },
    late() {
      for (const k of all) k.late()
    },
  }
}
