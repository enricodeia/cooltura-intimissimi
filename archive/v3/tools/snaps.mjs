// Frame-to-frame check: renders every frame (small) and prints the frames whose
// change from the previous one is much larger than the change around them (a snap).
//   node tools/snaps.mjs [--aspect 9:16] [--intro A] [--fps 30]
import { args, openPage } from './shot.mjs'
const o = args()
const { browser, page, errors } = await openPage({ aspect: o.aspect || '9:16', query: 'capture' + (o.intro ? '&intro=' + o.intro : '') })
try {
  const res = await page.evaluate(async (fps) => {
    const { engine } = window.__ci
    const W = 108
    const H = Math.round(W / engine.view.aspect)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d', { willReadFrequently: true })
    const n = Math.round(engine.duration * fps)
    engine.exporting = true
    engine.setBuffer(engine.W * 0.25, engine.H * 0.25)
    let prev = null
    const diffs = []
    for (let i = 0; i < n; i++) {
      const t = i / fps
      await engine.prepare(t)
      engine.renderAt(t)
      g.drawImage(engine.canvas, 0, 0, W, H)
      const d = g.getImageData(0, 0, W, H).data
      if (prev) {
        let s = 0
        for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2])
        diffs.push(s / (W * H * 3))
      } else diffs.push(0)
      prev = d
    }
    engine.exporting = false
    return diffs
  }, Number(o.fps || 30))
  const fps = Number(o.fps || 30)
  const flagged = []
  for (let i = 2; i < res.length - 2; i++) {
    const around = [res[i - 2], res[i - 1], res[i + 1], res[i + 2]].sort((a, b) => a - b)
    const ref = (around[1] + around[2]) / 2
    if (res[i] > 6 && res[i] > ref * 3 + 2) flagged.push(`${(i / fps).toFixed(2)}s diff ${res[i].toFixed(1)} (around ${ref.toFixed(1)})`)
  }
  console.log('frames', res.length, '| max diff', Math.max(...res).toFixed(1))
  console.log(flagged.length ? 'SNAPS\n' + flagged.join('\n') : 'no snaps')
} finally {
  if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].slice(0, 10).join('\n'))
  await browser.close()
}
