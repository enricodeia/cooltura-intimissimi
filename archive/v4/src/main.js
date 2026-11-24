// Cooltura × Intimissimi · recap studio (V3).
//   ?capture   no UI, canvas only (tools/shot.mjs, headless export)

import './style.css'
import { Store } from './model/store.js'
import { Engine, ASPECTS } from './engine/engine.js'
import { Videos } from './engine/videos.js'
import { loadFonts } from './lib/type.js'
import { createGrid } from './actors/grid.js'
import { createTexts } from './actors/texts.js'
import { createLockup } from './actors/lockup.js'
import { createNumbers } from './actors/numbers.js'
import { createCarousel, carouselKeys } from './actors/carousel.js'
import { exportVideo } from './engine/exporter.js'
import { mountUI } from './ui/app.js'

const qs = new URLSearchParams(location.search)
const capture = qs.has('capture')
document.documentElement.classList.toggle('capture', capture)

const boot = document.getElementById('boot')
const bootMsg = (m) => boot && (boot.querySelector('.boot__msg').textContent = m)

async function start() {
  const store = new Store({ persist: !capture })
  if (qs.get('aspect') && ASPECTS[qs.get('aspect')]) store.project.aspect = qs.get('aspect')
  if (qs.get('intro')) {
    store.project.intro = qs.get('intro') === 'B' ? 'B' : 'A'
    store.changed()
  }
  const canvas = document.getElementById('view')
  let engine = null
  const videos = new Videos({ onFrame: () => engine && (engine.dirty = true) })
  bootMsg('Font e video…')
  await Promise.all([loadFonts(), videos.init()])
  engine = new Engine({ canvas, store, videos })

  const grid = engine.add(createGrid(engine))
  engine.add(createNumbers(engine))
  engine.add(createCarousel(engine))
  engine.add(createTexts(engine))
  engine.add(await createLockup(engine))

  // what the current cut shows (the other carousel videos load when they are picked)
  const T = store.timeline
  const picked = T.shots.filter((s) => s.type === 'carousel').flatMap((s) => carouselKeys(videos, s.p.videos))
  const need = [...new Set([...grid.keys, ...picked])]
  await videos.preload(need, (n, total) => bootMsg(`Video ${n} / ${total}`))

  const api = {
    engine,
    store,
    videos,
    ready: false,
    get duration() {
      return engine.duration
    },
    /** One frame as a data URL at the export size of the current aspect (frame-exact videos). */
    async shot(t, type = 'image/jpeg', q = 0.9, scale = 1) {
      const was = engine.exporting
      engine.exporting = true
      engine.setBuffer(engine.W * scale, engine.H * scale)
      await engine.prepare(t)
      engine.renderAt(t)
      const url = canvas.toDataURL(type, q)
      engine.exporting = was
      if (!was) api.fit?.()
      return url
    },
    setAspect(a) {
      store.setAspect(a)
    },
    setIntro(v) {
      store.setIntro(v)
    },
    export: (o) => exportVideo(engine, o),
  }
  window.__ci = api

  if (capture) {
    engine.setBuffer(engine.W, engine.H)
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    store.on((what) => what === 'aspect' && engine.setAspect(store.project.aspect))
  } else {
    mountUI({ engine, store, api })
  }
  boot?.remove()
  engine.dirty = true
  api.ready = true
}

start().catch((err) => {
  console.error(err)
  bootMsg('Errore: ' + err.message)
  window.__ci = { error: String(err.stack || err) }
})
