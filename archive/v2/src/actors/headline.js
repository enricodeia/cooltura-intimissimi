// "LA FORZA DELLE NOSTRE CAMPAGNE IN NUMERI": all capitals, semibold, on white.
// The camera is still falling when the title comes up from below. Each word (or
// letter, or line) stands up from a tilt on X while it turns from violet,
// transparent, to ink; it leaves upwards line by line.

import * as THREE from 'three'
import { buildText } from '../lib/type.js'
import { flatMaterial } from '../lib/materials.js'
import { makeMemo } from './shared.js'
import { clamp, ease, DEG } from '../core/util.js'

const cA = new THREE.Color()
const cB = new THREE.Color()

export function createHeadline(engine) {
  const root = new THREE.Group()
  engine.scene.add(root)
  const memo = makeMemo()

  return {
    update(ctx) {
      const { t, T, view } = ctx
      const b = T.shot('headline')
      const p = b.p
      const t0 = b.start - p.lead
      const visible = t >= t0 && t < b.end
      root.visible = visible
      if (!visible) return
      const text = p.caps ? String(p.text).toLocaleUpperCase('it-IT') : String(p.text)
      const cap = Math.min(view.w * 0.082, view.h * 0.085) * p.size
      const maxW = view.w * 0.84
      const blk = memo(
        'h',
        `${text}|${p.weight}|${p.split}|${p.tracking}|${cap.toFixed(3)}|${maxW.toFixed(2)}`,
        () => {
          const k = buildText(text, { weight: p.weight, cap, by: p.split, maxWidth: maxW, leading: 1.32, pivot: 'baseline', tracking: p.tracking, material: () => flatMaterial('#0b0b0c') })
          root.add(k.group)
          return k
        },
        (k) => {
          root.remove(k.group)
          k.dispose()
        },
      )
      const nLines = blk.lines.length
      const inE = ease(p.inEase)
      const outE = ease(p.outEase)
      const outDur = Math.min(p.outDur, b.dur * 0.4)
      const out0 = b.end - outDur - (nLines - 1) * p.outStagger
      cA.set(ctx.col(p.fromColor))
      cB.set(ctx.col(p.toColor))
      // the block itself is still arriving while the first units appear
      const arrive = ease('power3.out')(clamp((t - t0) / (p.inDur + 0.45)))
      root.position.set(0, -(1 - arrive) * view.h * 0.36, 0)
      blk.units.forEach((u, i) => {
        const e = inE(clamp((t - t0 - i * p.stagger) / p.inDur))
        const lin = clamp((t - t0 - i * p.stagger) / (p.inDur * 0.75))
        const o = outE(clamp((t - out0 - u.line * p.outStagger) / outDur))
        const m = u.mesh
        m.position.set(u.x, u.y - (1 - e) * p.rise * cap + o * cap * 2.2, 0)
        m.rotation.x = (1 - e) * p.tilt * DEG - o * 70 * DEG
        m.material.color.copy(cA).lerp(cB, lin)
        m.material.opacity = Math.min(1, lin * 1.4) * (1 - o)
        m.visible = m.material.opacity > 0.003
      })
    },
  }
}
