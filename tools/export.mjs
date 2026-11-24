// Export the film headlessly through the app's own exporter (same code as the Export button).
//   node tools/export.mjs [--intro A|B] [--aspect 9:16] [--fps 30] [--ssaa 2] [--bitrate 20] [--from 0 --to 5]
import { args, openPage } from './shot.mjs'
const o = args()
const { browser, page, errors } = await openPage({ aspect: o.aspect || '16:9', query: 'capture' + (o.intro ? '&intro=' + o.intro : '') })
try {
  const t0 = Date.now()
  let last = 0
  await page.exposeFunction('__progress', (done, total) => {
    if (done - last >= 150 || done === total) {
      last = done
      console.log(`  frame ${done} / ${total}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
    }
  })
  // V4: the default song loads after boot; wait for it (and for its mix) before exporting
  await page.evaluate(async () => {
    const a = window.__ci.audio
    if (!a) return
    for (let i = 0; i < 200 && !((a.custom || !a.defaultTrack) && a.status === 'ready' && a.mix); i++) await new Promise((r) => setTimeout(r, 100))
  })
  const res = await page.evaluate(
    async (opt) => {
      const r = await window.__ci.export({ ...opt, onProgress: ({ done, total }) => window.__progress(done, total) })
      return { name: r.name, frames: r.frames, codec: r.codec, W: r.W, H: r.H, fps: r.fps, saved: r.saved, mb: r.blob.size / 1e6, seconds: r.seconds }
    },
    { fps: Number(o.fps || 30), ssaa: Number(o.ssaa || 1), bitrate: Number(o.bitrate || 20), from: o.from !== undefined ? Number(o.from) : undefined, to: o.to !== undefined ? Number(o.to) : undefined },
  )
  console.log(JSON.stringify(res))
} finally {
  if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].slice(0, 20).join('\n'))
  await browser.close()
}
