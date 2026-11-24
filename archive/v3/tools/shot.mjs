// Render frames with headless Chrome (real GPU, real H.264) and save them.
//
//   node tools/shot.mjs --t 0.5,1.2,3             frames at these times
//   node tools/shot.mjs --from 5 --to 10 --n 8    8 frames across a range
//   node tools/shot.mjs --shot stat-2 --n 6       6 frames across one shot (by id)
// Options: --aspect 9:16|3:4|1:1|16:9  --scale 0.5  --sheet (contact sheet)  --cols 6  --out dir  --set id.key=value,...
// Prints the files + any console / page errors.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = Number(process.env.CI_PORT || 5410)
const BASE = `http://localhost:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function args(argv = process.argv.slice(2)) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) o[a.slice(2)] = true
    else {
      o[a.slice(2)] = next
      i++
    }
  }
  return o
}

async function up() {
  try {
    return (await fetch(BASE + '/index.html')).ok
  } catch {
    return false
  }
}
export async function ensureServer() {
  if (await up()) return
  const p = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, detached: true, stdio: 'ignore' })
  p.unref()
  for (let i = 0; i < 80; i++) {
    await sleep(400)
    if (await up()) return
  }
  throw new Error('dev server did not start on ' + PORT)
}

export async function openPage({ aspect = '9:16', query = 'capture', width = 1280, height = 900 } = {}) {
  await ensureServer()
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'],
  })
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`))
  await page.goto(`${BASE}/?${query}&aspect=${encodeURIComponent(aspect)}`)
  // ready, a boot error, or a page error (a module that does not parse never sets __ci)
  for (let i = 0; ; i++) {
    const s = await page.evaluate(() => (window.__ci ? window.__ci.ready === true || !!window.__ci.error : false))
    if (s || errors.some((e) => e.startsWith('[pageerror]'))) break
    if (i > 600) throw new Error('page not ready after 120 s')
    await sleep(200)
  }
  if (!(await page.evaluate(() => !!window.__ci))) {
    await browser.close()
    throw new Error('boot failed\n' + errors.join('\n'))
  }
  const err = await page.evaluate(() => window.__ci.error || null)
  if (err) errors.push('[boot] ' + err)
  return { browser, page, errors }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = args()
  const { browser, page, errors } = await openPage({ aspect: o.aspect || '9:16', query: 'capture' + (o.intro ? '&intro=' + o.intro : '') })
  try {
    if (o.set) {
      const kv = String(o.set)
        .split(',')
        .map((x) => x.split('='))
      await page.evaluate((kv) => {
        const { store } = window.__ci
        for (const [path, raw] of kv) {
          const [id, key] = path.split('.')
          let v = raw
          try {
            v = JSON.parse(raw)
          } catch {}
          if (key === 'dur') store.setDur(id, Number(v))
          else if (store.findShot(id)) store.setParam('shot', id, key, v)
          else if (store.findScene(id)) store.setParam('scene', id, key, v)
          else if (id === 'look') store.setParam('look', null, key, v)
        }
      }, kv)
    }
    const info = await page.evaluate(() => ({ duration: window.__ci.duration, shots: window.__ci.store.timeline.shots.map((s) => ({ id: s.id, start: s.start, end: s.end })) }))
    let times
    if (o.t) times = String(o.t).split(',').map(Number)
    else {
      let from = Number(o.from ?? 0)
      let to = Number(o.to ?? info.duration)
      if (o.shot) {
        const ids = String(o.shot).split(',')
        const a = info.shots.find((s) => s.id === ids[0])
        const b = info.shots.find((s) => s.id === ids[ids.length - 1])
        if (!a || !b) throw new Error('no shot ' + o.shot + ' in ' + info.shots.map((s) => s.id).join(' '))
        from = a.start
        to = b.end
      }
      const n = Number(o.n || 6)
      times = Array.from({ length: n }, (_, i) => from + ((to - from) * (n === 1 ? 0 : i / (n - 1))) * (i === n - 1 ? 0.999 : 1))
    }
    const dir = path.resolve(o.out || path.join(ROOT, 'exports', 'shots'))
    fs.mkdirSync(dir, { recursive: true })
    const scale = Number(o.scale || 0.5)
    const frames = []
    for (const t of times) {
      const url = await page.evaluate(([tt, sc]) => window.__ci.shot(tt, 'image/jpeg', 0.9, sc), [t, scale])
      const file = path.join(dir, `f_${t.toFixed(2).padStart(6, '0')}.jpg`)
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
      frames.push({ t, url, file })
    }
    if (o.sheet) {
      const cols = Number(o.cols || Math.min(frames.length, 6))
      const sheet = await page.evaluate(
        async ([list, cols]) => {
          const imgs = await Promise.all(
            list.map(
              (f) =>
                new Promise((res) => {
                  const im = new Image()
                  im.onload = () => res(im)
                  im.src = f.url
                }),
            ),
          )
          const w = imgs[0].width
          const h = imgs[0].height
          const cw = Math.min(w, Math.floor(1900 / cols))
          const ch = Math.round((cw * h) / w)
          const rows = Math.ceil(imgs.length / cols)
          const c = document.createElement('canvas')
          c.width = cols * (cw + 6) + 6
          c.height = rows * (ch + 28) + 6
          const g = c.getContext('2d')
          g.fillStyle = '#1b1b1f'
          g.fillRect(0, 0, c.width, c.height)
          g.font = '15px monospace'
          imgs.forEach((im, i) => {
            const x = 6 + (i % cols) * (cw + 6)
            const y = 6 + Math.floor(i / cols) * (ch + 28)
            g.drawImage(im, x, y, cw, ch)
            g.fillStyle = '#c0ff33'
            g.fillText(list[i].t.toFixed(2) + ' s', x + 2, y + ch + 18)
          })
          return c.toDataURL('image/jpeg', 0.88)
        },
        [frames.map((f) => ({ t: f.t, url: f.url })), cols],
      )
      const file = path.join(dir, `sheet_${o.name || 'frames'}.jpg`)
      fs.writeFileSync(file, Buffer.from(sheet.split(',')[1], 'base64'))
      console.log('sheet', file)
    } else for (const f of frames) console.log(f.file)
  } finally {
    if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].slice(0, 20).join('\n'))
    await browser.close()
  }
}
