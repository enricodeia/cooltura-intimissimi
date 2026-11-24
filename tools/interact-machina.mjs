// The V5 editor ("La nota", machina.html) driven like a user: resize blocks, edit parameters,
// undo, play, change format, the global look. Prints what happened.
import { chromium } from 'playwright'
import { ensureServer } from './shot.mjs'
await ensureServer()
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`))
await page.goto('http://localhost:5410/machina.html')
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForFunction(() => window.__ci?.ready === true, null, { timeout: 120000 })
const dur = () => page.evaluate(() => ({ total: window.__ci.duration, shots: Object.fromEntries(window.__ci.store.timeline.shots.map((s) => [s.id, s.dur])) }))
const box = async (sel) => await page.locator(sel).boundingBox()
console.log('edition', await page.evaluate(() => window.__ci.edition), '| switch', await page.locator('.top__eds .asp').allInnerTexts())

let d0 = await dur()
let b = await box('.blk--shot[data-id="campaigns"]')
await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2)
await page.mouse.down()
await page.mouse.move(b.x + b.width + 60, b.y + b.height / 2, { steps: 8 })
await page.mouse.up()
let d1 = await dur()
console.log('ripple  campaigns', d0.shots.campaigns, '→', d1.shots.campaigns, '| total', d0.total.toFixed(2), '→', d1.total.toFixed(2))
b = await box('.blk--shot[data-id="stat-b"]')
await page.mouse.move(b.x + 3, b.y + b.height / 2)
await page.mouse.down()
await page.mouse.move(b.x - 30, b.y + b.height / 2, { steps: 6 })
await page.mouse.up()
let d2 = await dur()
console.log('roll    stat-a', d1.shots['stat-a'], '→', d2.shots['stat-a'], '| stat-b', d1.shots['stat-b'], '→', d2.shots['stat-b'], '| total', d2.total.toFixed(2))
b = await box('.blk--scene[data-id="beyond"]')
await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2)
await page.mouse.down()
await page.mouse.move(b.x + b.width + 80, b.y + b.height / 2, { steps: 6 })
await page.mouse.up()
console.log('scene   beyond total →', (await dur()).total.toFixed(2))
await page.click('[data-fit]')
console.log('fit     total →', (await dur()).total.toFixed(3))
await page.click('.blk--shot[data-id="creators"]')
console.log('select  creators → panel', JSON.stringify(await page.inputValue('.insp__name')), '| sections', await page.locator('#inspector .fx').count())
await page.fill('.ctl[data-k="value"] input', '312')
await page.locator('.ctl[data-k="value"] input').blur()
console.log('text    value →', await page.evaluate(() => window.__ci.store.timeline.shot('creators').p.value))
await page.click('.blk--shot[data-id="aria"]')
// the picker: the + tile opens the library, the first video not in the list is added
await page.locator('#inspector .vl__add').first().click()
await page.locator('.lib__item:not(.is-used):not([aria-disabled="true"])').first().click()
console.log('videos  aria →', await page.evaluate(() => window.__ci.store.timeline.shot('aria').p.videos.length), 'videos')
await page.click('.blk--shot[data-id="insight"]')
await page.fill('.ctl[data-k="pushText"] input', 'to drive record sales.')
await page.locator('.ctl[data-k="pushText"] input').blur()
console.log('text    push →', await page.evaluate(() => window.__ci.store.timeline.shot('insight').p.pushText))
await page.keyboard.press('2')
console.log('intro   2 →', await page.evaluate(() => window.__ci.store.project.intro + ' ' + window.__ci.store.timeline.shots.slice(0, 4).map((s) => s.id).join(',')))
await page.keyboard.press('1')
let n = 0
while (await page.evaluate(() => window.__ci.store.undoStack.length)) {
  await page.keyboard.press('Meta+z')
  if (++n > 40) break
}
const d5 = await dur()
console.log('undo ×' + n, '→ total', d5.total.toFixed(2), '| campaigns', d5.shots.campaigns, '| value', await page.evaluate(() => window.__ci.store.timeline.shot('creators').p.value), '| intro', await page.evaluate(() => window.__ci.store.project.intro))
// the global look: nothing selected → "La linea e l’asterisco"
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
console.log('look    panel', JSON.stringify(await page.locator('#inspector .fx__title span').first().innerText()), '| controls', await page.locator('#inspector .ctl').count())
for (const t of [1.5, 4.0, 5.4, 8.0, 10.0, 12.6, 14.0, 19.0, 24.0, 28.5]) {
  const r = await page.evaluate(
    (t) =>
      new Promise((res) => {
        const e = window.__ci.engine
        e.seek(t)
        e.play()
        let frames = 0
        const t0 = performance.now()
        const tick = () => {
          frames++
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick)
          else {
            e.pause()
            res({ fps: frames / ((performance.now() - t0) / 1000), advanced: e.time - t })
          }
        }
        requestAnimationFrame(tick)
      }),
    t,
  )
  console.log('play    from', t, '→', r.fps.toFixed(1), 'fps, clock advanced', r.advanced.toFixed(2), 's in 1.5 s')
}
await page.screenshot({ path: 'exports/shots/ui-machina-wide.png' })
await page.keyboard.press('Shift+Digit1')
await page.waitForTimeout(800)
console.log('aspect  ⇧1 →', await page.evaluate(() => [window.__ci.store.project.aspect, window.__ci.engine.canvas.width + '×' + window.__ci.engine.canvas.height].join(' ')))
await page.keyboard.press('Shift+Digit4')
await page.waitForTimeout(400)
if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].slice(0, 20).join('\n'))
await browser.close()
