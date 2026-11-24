// A counter that reveals itself: every digit is a reel of digits that rolls up
// through a mask and settles on its own figure (the right-hand ones turn more,
// as an odometer counting up), with a motion blur that follows the speed of the
// reel and a soft blur that clears as it lands. Other glyphs (. M K % + X) rise
// into place with their neighbours. Tabular digits: the number never jiggles.
// FX layer, block space in cap heights (like Kinetic).

import * as THREE from 'three'
import { getFace, glyphGeometry, glyphEpoch } from './type.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { rank, rankSpan } from './kinetic.js'
import { ease, clamp, lerp, mod, seededOrder } from '../core/util.js'

const PITCH = 1.45 // reel step, in cap heights
const BAND = [-0.14, 1.14] // the window, around the baseline

export class Counter {
  constructor(parent) {
    this.group = new THREE.Group()
    this.group.visible = false
    parent.add(this.group)
    this.maskInv = new THREE.Matrix4()
    this.slots = []
    this.key = ''
    this.width = 0
    this.col = new THREE.Color()
    this.colFrom = new THREE.Color()
  }

  /** value: the final string ('9.8M+', '+XX%'); spins: steps of the first reel, step: extra per reel. */
  set({ value = '0', weight = 400, align = 'left', spins = 7, step = 2, down = false, digitAlign = 'center', tracking = 0, kern = false } = {}) {
    const str = String(value)
    const key = [str, weight, align, spins, step, down, digitAlign, tracking, kern, glyphEpoch()].join('|')
    if (key === this.key) return this
    this.dispose()
    this.key = key
    const face = getFace(weight)
    const em = 1 / face.cap
    const dw = Math.max(...'0123456789'.split('').map((d) => face.glyph(d).adv))
    let x = 0
    const raw = []
    let reelNo = 0
    const nDigits = (str.match(/\d/g) || []).length
    for (const ch of str) {
      const isDigit = /\d/.test(ch)
      // kern (V4): each digit takes its own width (the 311 sits tight, as set type), the reel rolls through it centred
      const w = (isDigit && !kern ? dw : face.glyph(ch).adv) * em
      raw.push({ ch, x, w, isDigit, reel: isDigit ? reelNo++ : -1 })
      x += w + tracking * em
    }
    if (raw.length) x -= tracking * em
    this.width = x
    const ox = align === 'center' ? -x / 2 : align === 'right' ? -x : 0
    for (const r of raw) {
      const slot = { ...r, x: ox + r.x, items: [] }
      const add = (ch, k) => {
        const geo = glyphGeometry(face, ch)
        if (!geo) return
        const mat = fxMaterial({ maskInv: this.maskInv })
        const mesh = fxMesh(geo, mat)
        mesh.scale.setScalar(em)
        this.group.add(mesh)
        slot.items.push({ mesh, mat, k, adv: face.glyph(ch).adv * em })
      }
      if (r.isDigit) {
        // the reel: from (final - n) up to the final digit; the right-hand reels turn more
        const n = Math.max(1, Math.round(spins + step * (nDigits - 1 - r.reel)))
        const f = Number(r.ch)
        slot.n = n
        // down: a countdown that lands on the figure (a ranking climbing to #1)
        for (let k = 0; k <= n; k++) add(String(mod(down ? f + n - k : f - n + k, 10)), k)
      } else {
        slot.n = 0
        add(r.ch, 0)
      }
      this.slots.push(slot)
    }
    this.perm = seededOrder(this.slots.length, 11)
    this.em = em
    this.digitAlign = digitAlign
    return this
  }

  /**
   * s = { at, dur, stagger, order, ease, blur (% cap), motion, from (reel start, in pitches below),
   *       color, fromColor (the colour while it rolls, settling to color), opacity, px (pixels per cap), fps,
   *       out: { at, dur, stagger, order, ease, y (%, + = down), blur, opacity, mask } | null }
   */
  pose(t, s) {
    const n = this.slots.length
    this.group.visible = n > 0
    if (!n) return
    this.col.set(s.color)
    this.colFrom.set(s.fromColor ?? s.color)
    const e = ease(s.ease)
    const h = 1 / (s.fps || 30)
    const start = s.from ?? 1.25
    const O = s.out
    const eo = O ? ease(O.ease) : null
    let shown = 0
    this.slots.forEach((slot, i) => {
      const t0 = s.at + rank(s.order, i, n, this.perm) * s.stagger
      const p = clamp((t - t0) / Math.max(1e-4, s.dur))
      const pPrev = clamp((t - h - t0) / Math.max(1e-4, s.dur))
      let oY = 0
      let oBlur = 0
      let oOp = 1
      let pO = 0
      if (O) {
        pO = clamp((t - O.at - rank(O.order, i, n, this.perm) * O.stagger) / Math.max(1e-4, O.dur))
        const k = eo(pO)
        oY = -(O.y / 100) * k
        oBlur = (O.blur || 0) * k
        oOp = lerp(1, O.opacity ?? 0, eo(clamp((pO - 0.1) / 0.9)))
      }
      // reel position, in steps: from below the window up to the final digit
      // (s.steps: one eased step per time instead of one roll, V5's "5" that counts the campaigns)
      const reel = (tt, pp) => {
        if (!s.steps || !slot.n) return lerp(-start, slot.n, e(pp))
        const d = Math.max(1e-4, s.stepDur || 0.4)
        let v = -start + start * e(clamp((tt - s.steps[0]) / d))
        for (let k = 1; k < s.steps.length && k <= slot.n; k++) v += e(clamp((tt - s.steps[k]) / d))
        return v
      }
      const r = reel(t, p)
      const rPrev = reel(t - h, pPrev)
      const vel = (r - rPrev) * PITCH // caps per frame
      const blur = (s.blur || 0) * (1 - e(p)) + oBlur
      const op = (s.opacity ?? 1) * clamp(p * 4) * oOp
      const on = t >= t0 && op > 0.002 && pO < 1
      const leaving = pO > 0
      const maskOn = !leaving || O.mask !== false
      for (const it of slot.items) {
        const y = slot.n ? (r - it.k) * PITCH : lerp(-start * PITCH, 0, e(p))
        const vy = slot.n ? vel : lerp(-start * PITCH, 0, e(p)) - lerp(-start * PITCH, 0, e(pPrev))
        const yy = y + oY
        // while it leaves only the landed figure exists (the rest of the reel is out of the window anyway)
        const vis = on && (!leaving || it.k === slot.n) && yy > BAND[0] - 1.2 - Math.abs(vy) && yy < BAND[1] + 0.2 + Math.abs(vy)
        it.mesh.visible = vis
        if (!vis) continue
        shown++
        it.mesh.position.set(slot.x + (this.digitAlign === 'left' ? 0 : (slot.w - it.adv) / 2), -0.5 + yy, 0)
        const u = it.mat.uniforms
        u.uColor.value.copy(this.colFrom).lerp(this.col, e(p))
        u.uOpacity.value = op
        // the window stays where the number lands: digits roll through it and leave through it
        if (maskOn) fxMask(it.mesh, true, slot.x - 0.25, -0.5 + BAND[0], slot.x + slot.w + 0.25, -0.5 + BAND[1])
        else fxMask(it.mesh, false)
        const toLocal = 1 / this.em
        fxBlur(it.mesh, (blur / 100) * toLocal, 0, vy * (s.motion ?? 1) * toLocal, (s.px || 100) * this.em)
      }
    })
    this.group.visible = shown > 0
  }

  /** When the counter is fully in (last reel landed), seconds after s.at. */
  length(s) {
    return rankSpan(s.order, this.slots.length) * s.stagger + s.dur
  }

  late() {
    if (!this.group.visible) return
    this.group.updateWorldMatrix(true, false)
    this.maskInv.copy(this.group.matrixWorld).invert()
  }

  dispose() {
    for (const s of this.slots)
      for (const it of s.items) {
        this.group.remove(it.mesh)
        it.mesh.geometry.dispose()
        it.mat.dispose()
      }
    this.slots = []
    this.key = ''
  }
}
