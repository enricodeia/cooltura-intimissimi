// Cooltura × Intimissimi · recap studio.
//   ?capture   no UI, canvas only (tools/shot.mjs, headless export)

import './style.css'
import { Store } from './model/store.js'
import { Engine, ASPECTS } from './engine/engine.js'
import { Videos } from './engine/videos.js'
import { loadFonts } from './lib/type.js'
import { createLockup } from './actors/lockup.js'
import { createWall } from './actors/wall.js'
import { createStats } from './actors/stats.js'
import { createPhone } from './actors/phone.js'
import { createViews } from './actors/views.js'
import { createHeadline } from './actors/headline.js'
import { createCampaigns } from './actors/campaigns.js'
import { createProud } from './actors/proud.js'
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
  const canvas = document.getElementById('view')
  let engine = null
  const videos = new Videos({ onFrame: () => engine && (engine.dirty = true) })
  bootMsg('Font e video…')
  await Promise.all([loadFonts(), videos.init()])
  engine = new Engine({ canvas, store, videos })

  engine.add(await createLockup(engine))
  const wall = engine.add(createWall(engine))
  engine.add(createStats(engine))
  const phone = engine.add(createPhone(engine))
  engine.add(createViews(engine))
  engine.add(createHeadline(engine))
  engine.add(createCampaigns(engine))
  engine.add(createProud(engine))

  const need = ['hero.mp4', ...wall.keys, ...phone.keys]
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
