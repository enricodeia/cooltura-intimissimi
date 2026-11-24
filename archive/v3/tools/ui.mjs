// Screenshot of the studio UI (headless Chrome).
//   node tools/ui.mjs --t 12.4 --select view-70m --out exports/shots/ui.png [--w 1680 --h 1000] [--aspect 16:9] [--eval "js"]
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { args, ensureServer } from './shot.mjs'

const o = args()
await ensureServer()
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: Number(o.w || 1680), height: Number(o.h || 1000) }, deviceScaleFactor: Number(o.dpr || 1) })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`))
await page.goto(`http://localhost:${process.env.CI_PORT || 5410}/?fresh`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForFunction(() => window.__ci && (window.__ci.ready === true || window.__ci.error), null, { timeout: 120000 })
const err = await page.evaluate(() => window.__ci.error || null)
if (err) errors.push('[boot] ' + err)
else {
  if (o.aspect) await page.evaluate((a) => window.__ci.setAspect(a), o.aspect)
  if (o.select) await page.evaluate((id) => window.__ci.store.select({ kind: window.__ci.store.findShot(id) ? 'shot' : 'scene', id }), o.select)
  await page.evaluate((t) => window.__ci.engine.seek(t), Number(o.t || 0))
  if (o.eval) await page.evaluate(o.eval)
  await page.waitForTimeout(Number(o.wait || 3500))
  const file = path.resolve(o.out || 'exports/shots/ui.png')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file })
  console.log(file)
}
if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].slice(0, 20).join('\n'))
await browser.close()
