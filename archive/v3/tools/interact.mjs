// Drives the studio like a user: resize blocks, edit a parameter, undo, play. Prints what happened.
import { chromium } from 'playwright'
import { ensureServer } from './shot.mjs'
await ensureServer()
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`))
await page.goto('http://localhost:5410/')
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForFunction(() => window.__ci?.ready === true, null, { timeout: 120000 })
const dur = () => page.evaluate(() => ({ total: window.__ci.duration, shots: Object.fromEntries(window.__ci.store.timeline.shots.map((s) => [s.id, s.dur])) }))
const box = async (sel) => (await page.locator(sel).boundingBox())

let d0 = await dur()
// 1. ripple: drag the right edge of "campaigns" (5 campaigns) 60 px to the right
let b = await box('.blk--shot[data-id="campaigns"]')
await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2)
await page.mouse.down()
await page.mouse.move(b.x + b.width + 60, b.y + b.height / 2, { steps: 8 })
await page.mouse.up()
let d1 = await dur()
console.log('ripple  campaigns', d0.shots['campaigns'], '→', d1.shots['campaigns'], '| total', d0.total.toFixed(2), '→', d1.total.toFixed(2))
// 2. roll: drag the left edge of "communities" 30 px left
b = await box('.blk--shot[data-id="communities"]')
await page.mouse.move(b.x + 3, b.y + b.height / 2)
await page.mouse.down()
await page.mouse.move(b.x - 30, b.y + b.height / 2, { steps: 6 })
await page.mouse.up()
let d2 = await dur()
console.log('roll    stats', d1.shots['stats'], '→', d2.shots['stats'], '| communities', d1.shots['communities'], '→', d2.shots['communities'], '| total', d2.total.toFixed(2))
// 3. scene stretch
b = await box('.blk--scene[data-id="beyond"]')
await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2)
await page.mouse.down()
await page.mouse.move(b.x + b.width + 80, b.y + b.height / 2, { steps: 6 })
await page.mouse.up()
let d3 = await dur()
console.log('scene   beyond total', d2.total.toFixed(2), '→', d3.total.toFixed(2))
// 4. fit to 30
await page.click('[data-fit]')
let d4 = await dur()
console.log('fit     total →', d4.total.toFixed(3))
// 5. select + edit a parameter in the panel
await page.click('.blk--shot[data-id="creators"]')
const title = await page.inputValue('.insp__name')
await page.locator('.ctl[data-k="nSplit"] .seg button').nth(1).click()
const split = await page.evaluate(() => window.__ci.store.timeline.shot('creators').p.nSplit)
const sections = await page.locator('#inspector .fx').count()
console.log('select  creators → panel title', JSON.stringify(title), '| sections', sections, '| split →', split)
await page.fill('.ctl[data-k="value"] input', '312')
await page.locator('.ctl[data-k="value"] input').blur()
console.log('text    value →', await page.evaluate(() => window.__ci.store.timeline.shot('creators').p.value))
// carousel: add a video from the panel
await page.click('.blk--shot[data-id="aria"]')
await page.locator('#inspector .vid:not(.is-on)').first().click()
console.log('videos  aria →', await page.evaluate(() => window.__ci.store.timeline.shot('aria').p.videos.length), 'videos')
// intro B by key, then back
await page.keyboard.press('2')
console.log('intro   2 →', await page.evaluate(() => window.__ci.store.project.intro + ' ' + window.__ci.store.timeline.shots.slice(0, 4).map((s) => s.id).join(',')))
await page.keyboard.press('1')
console.log('intro   1 →', await page.evaluate(() => window.__ci.store.project.intro + ' ' + window.__ci.store.timeline.shots[0].id))
// 6. undo all the way
let n = 0
while (await page.evaluate(() => window.__ci.store.undoStack.length)) {
  await page.keyboard.press('Meta+z')
  n++
  if (n > 40) break
}
let d5 = await dur()
console.log('undo ×' + n, '→ total', d5.total.toFixed(2), '| campaigns', d5.shots['campaigns'], '| value', await page.evaluate(() => window.__ci.store.timeline.shot('creators').p.value), '| intro', await page.evaluate(() => window.__ci.store.project.intro))
// 7. playback speed in the preview
for (const t of [3.2, 6.5, 9, 13.2, 19, 26]) {
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
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick)
          else {
            e.pause()
            res({ fps: frames / ((performance.now() - t0) / 1000), advanced: e.time - t })
          }
        }
        requestAnimationFrame(tick)
      }),
    t,
  )
  console.log('play    from', t, '→', r.fps.toFixed(1), 'fps, clock advanced', r.advanced.toFixed(2), 's in 2 s')
}
// 8. aspect switch by keyboard (⇧4 = 16:9)
await page.keyboard.press('Shift+Digit4')
await page.waitForTimeout(600)
console.log('aspect  →', await page.evaluate(() => [window.__ci.store.project.aspect, window.__ci.engine.canvas.width + '×' + window.__ci.engine.canvas.height].join(' ')))
await page.screenshot({ path: 'exports/shots/ui-wide.png' })
if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].slice(0, 20).join('\n'))
await browser.close()
