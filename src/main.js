// Cooltura × Intimissimi · recap studio (option 1 on index.html, option 2 "La nota" on machina.html;
// the second half of the film, from the comments to the end, is the same actors in both).
//   ?capture   no UI, canvas only (tools/shot.mjs, headless export)

import './style.css'
import { Store } from './model/store.js'
import { Engine, ASPECTS } from './engine/engine.js'
import { Videos } from './engine/videos.js'
import { loadFonts, setGlyphAlternates } from './lib/type.js'
import { createGrid } from './actors/grid.js'
import { createTexts } from './actors/texts.js'
import { createLockup } from './actors/lockup.js'
import { createNumbers } from './actors/numbers.js'
import { createCarousel, carouselKeys } from './actors/carousel.js'
import { createPhone } from './actors/phone.js'
import { createSwipe } from './actors/swipe.js'
import { exportVideo } from './engine/exporter.js'
import { mountUI } from './ui/app.js'
import { EDITION, LOOK } from './model/project.js'

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
  await Promise.all([loadFonts(undefined, EDITION.font || 'machina'), videos.init()])
  engine = new Engine({ canvas, store, videos })

  let need
  const T = store.timeline
  // the continuum (both editions): the phone and the comments, the sentences, the Aria wheel, the Externability cards
  const continuum = () => {
    const phone = engine.add(createPhone(engine))
    engine.add(createCarousel(engine))
    const swipe = engine.add(createSwipe(engine))
    engine.add(createTexts(engine))
    // what the current cut shows (the other videos load when they are picked)
    const picked = T.shots.filter((s) => s.type === 'carousel').flatMap((s) => carouselKeys(videos, s.p.videos))
    return [...phone.keysFor(T), ...swipe.keysFor(T), ...picked]
  }
  let sound = null
  if (EDITION.id === 'rev') {
    // V4 · Brief V2: its own actors (v4/) and its sound (the score + the creators' voices)
    const { mountV4 } = await import('./v4/index.js')
    const r = await mountV4(engine)
    need = r.need
    sound = r.audio
  } else if (EDITION.id === 'machina') {
    // option 2 · La nota: one actor draws the take up to the numbers, then the continuum
    const { createMachina } = await import('./machina/actor.js')
    const film = engine.add(await createMachina(engine))
    need = [...new Set([...film.keysFor(T), ...continuum()])]
  } else {
    // the zero without its slash (Neue Machina ss12), from the global look
    engine.add({ update: () => setGlyphAlternates(({ ...LOOK.defaults, ...store.project.look }).plainZero ? { 0: 'zero.ss12' } : {}) })
    const grid = engine.add(createGrid(engine))
    engine.add(createNumbers(engine))
    const rest = continuum()
    engine.add(await createLockup(engine))
    need = [...new Set([...grid.keys, ...rest])]
  }
  await videos.preload(need, (n, total) => bootMsg(`Video ${n} / ${total}`))
  // the mix renders in the background (a play pressed before it is ready starts the sound when it is);
  // a song loaded last time comes back (it replaces the score)
  if (sound) sound.restore().then((had) => had || sound.render().catch((e) => console.warn('[audio]', e)))

  const api = {
    edition: EDITION.id,
    engine,
    store,
    videos,
    audio: sound,
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
