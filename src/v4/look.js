// V4's ground: warm ivory paper with a soft window light across it (the
// background's beams, low), and the wine flood of the results: an iris from the
// centre on "AMAZING.", held through the five numbers, then the paper comes back
// up from the bottom on "Let's go beyond numbers".

import { LOOK, PALETTE } from './model.js'
import { seg, clamp } from '../core/util.js'

export function createLook(engine) {
  return {
    update(ctx) {
      const { t, T } = ctx
      const look = { ...LOOK.defaults, ...engine.store.project.look }
      const bg = ctx.bg
      bg.a = PALETTE.paper
      bg.b = PALETTE.wine
      bg.mix = 0
      bg.mode = 'fade'
      bg.soft = 0.16
      bg.rays = look.light
      bg.raysColor = '#ffd8c4'
      bg.haze = 0.32
      bg.width = 1.25
      bg.sway = 1
      const rs = T.shots.find((s) => s.type === 'results')
      if (!rs || !rs.p.floodOn) return
      const k = T.shots.find((s) => s.type === 'kpis' && s.start >= rs.start)
      const end = k ? k.end : rs.end
      const tIn = rs.start + rs.p.floodAt
      bg.b = ctx.col(rs.p.floodColor)
      const back = seg(t, end - 0.3, 0.75, 'cubic(0.65,0,0.25,1)')
      if (back <= 0) {
        // the wine rises from the bottom (its front is soft and slightly wavy)
        bg.mode = 'wipe'
        bg.angle = Math.PI / 2
        bg.soft = 0.16
        bg.mix = seg(t, tIn, rs.p.floodDur, 'cubic(0.55,0,0.2,1)')
      } else {
        // the paper comes back from the bottom, a soft front
        bg.a = ctx.col(rs.p.floodColor)
        bg.b = PALETTE.paper
        bg.mode = 'wipe'
        bg.angle = Math.PI / 2
        bg.soft = 0.22
        bg.mix = back
      }
      // no window light on the wine
      const onWine = t >= tIn && t < end + 0.45 ? 1 - clamp(back) : 0
      bg.rays = look.light * (1 - onWine)
    },
  }
}
