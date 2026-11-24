// The timeline: a magnetic track of shots under their scenes (as in CapCut's
// main track), a ruler with the playhead, per-shot thumbnails.
//   click a block        select it → its effects open in the panel on the right
//   drag its right edge  change its duration, everything after ripples
//   drag its left edge   move the cut with the shot before (the film keeps its length)
//   drag a scene's edge  stretch the whole scene, shots keep their proportions
//   ruler / empty lane   scrub

import { icon, h } from './icons.js'
import { effectsOf, sceneEffects, MIN_DUR } from '../model/project.js'
import { clamp } from '../core/util.js'

const HEAD_W = 76
const PAD_R = 72
const THUMB_H = 150

export function mountTimeline(el, { engine, store }) {
  el.innerHTML = `
    <div class="tl__bar">
      <div class="tl__title">${icon('film')}<span>Timeline</span></div>
      <div class="tl__total" data-total></div>
      <button class="btn btn--ghost" data-fit title="Scala tutti gli shot in proporzione perché il film duri esattamente 30 s">${icon('fit-time')}<span>Adatta a 30 s</span></button>
      <div class="tl__hint">Trascina i bordi di un blocco per cambiarne la durata · clic per aprirne gli effetti</div>
      <div class="tl__spacer"></div>
      <button class="btn btn--icon is-on" data-snap title="Snap a 0,05 s (S)">${icon('magnet')}</button>
      <button class="btn btn--icon" data-zoomfit title="Tutto il film (F)">${icon('fit')}</button>
      <button class="btn btn--icon" data-zoomout title="Zoom −">${icon('zoom-out')}</button>
      <input type="range" class="tl__zoom" min="0" max="1" step="0.001" value="0" data-zoom aria-label="Zoom timeline" />
      <button class="btn btn--icon" data-zoomin title="Zoom +">${icon('zoom-in')}</button>
    </div>
    <div class="tl__body">
      <div class="tl__heads">
        <div class="tl__head tl__head--ruler"></div>
        <div class="tl__head tl__head--scenes">Scene</div>
        <div class="tl__head tl__head--shots">Shot</div>
      </div>
      <div class="tl__scroll" data-scroll>
        <div class="tl__content" data-content>
          <canvas class="tl__ruler" data-ruler></canvas>
          <div class="tl__lane tl__lane--scenes" data-scenes></div>
          <div class="tl__lane tl__lane--shots" data-shots></div>
          <div class="tl__playhead" data-playhead><i></i></div>
        </div>
      </div>
    </div>
    <div class="tl__tip" data-tip hidden></div>`

  const $ = (s) => el.querySelector(s)
  const scroll = $('[data-scroll]')
  const content = $('[data-content]')
  const ruler = $('[data-ruler]')
  const scenesLane = $('[data-scenes]')
  const shotsLane = $('[data-shots]')
  const playhead = $('[data-playhead]')
  const tip = $('[data-tip]')
  const totalEl = $('[data-total]')
  const zoomEl = $('[data-zoom]')

  let pps = 40
  let snap = true
  let fitPps = 40
  const blocks = new Map() // id → { el, strip, kind }
  const thumbs = new Map() // shot id → [canvas, canvas, canvas]

  // ------------------------------------------------------------ blocks

  function build() {
    scenesLane.innerHTML = ''
    shotsLane.innerHTML = ''
    blocks.clear()
    const T = store.timeline
    for (const sc of T.scenes) {
      const b = h('div', { class: 'blk blk--scene', 'data-id': sc.id, 'data-kind': 'scene', style: `--hue:${sc.hue}` }, `<span class="blk__name">${sc.label}</span><span class="blk__dur"></span><i class="blk__h blk__h--r" data-edge="r"></i>`)
      scenesLane.appendChild(b)
      blocks.set('scene:' + sc.id, { el: b, kind: 'scene' })
    }
    for (const sh of T.shots) {
      const fx = effectsOf(sh.src)
      const chips = fx
        .slice(0, 4)
        .map((f) => `<span class="blk__chip" title="${f.label}">${icon(f.icon || 'sliders')}</span>`)
        .join('')
      const b = h(
        'div',
        { class: 'blk blk--shot', 'data-id': sh.id, 'data-kind': 'shot', style: `--hue:${sh.scene.hue}` },
        `<canvas class="blk__strip"></canvas><div class="blk__shade"></div>
         <span class="blk__name"></span><span class="blk__dur"></span><span class="blk__chips">${chips}</span>
         <i class="blk__h blk__h--l" data-edge="l"></i><i class="blk__h blk__h--r" data-edge="r"></i>`,
      )
      shotsLane.appendChild(b)
      blocks.set('shot:' + sh.id, { el: b, kind: 'shot', strip: b.querySelector('.blk__strip') })
    }
    layout()
  }

  function layout() {
    const T = store.timeline
    const W = Math.ceil(T.duration * pps) + PAD_R
    content.style.width = W + 'px'
    for (const sc of T.scenes) {
      const b = blocks.get('scene:' + sc.id)
      if (!b) continue
      b.el.style.left = sc.start * pps + 'px'
      b.el.style.width = Math.max(4, sc.dur * pps - 2) + 'px'
      b.el.querySelector('.blk__dur').textContent = sc.dur.toFixed(2) + ' s'
    }
    for (const sh of T.shots) {
      const b = blocks.get('shot:' + sh.id)
      if (!b) continue
      const w = Math.max(4, sh.dur * pps - 2)
      b.el.style.left = sh.start * pps + 'px'
      b.el.style.width = w + 'px'
      b.el.classList.toggle('is-narrow', w < 58)
      b.el.querySelector('.blk__name').textContent = sh.name
      b.el.querySelector('.blk__dur').textContent = sh.dur.toFixed(2) + ' s'
      paintStrip(sh.id, w)
    }
    const d = T.duration
    const off = Math.abs(d - 30) > 0.005
    totalEl.innerHTML = `${icon('stopwatch')}<b>${d.toFixed(2)} s</b>${off ? `<em>${d > 30 ? '+' : '−'}${Math.abs(d - 30).toFixed(2)} rispetto a 30 s</em>` : '<em>30 s esatti</em>'}`
    totalEl.classList.toggle('is-off', off)
    drawRuler()
    placePlayhead()
    select()
  }

  function select() {
    const sel = store.selection
    for (const [key, b] of blocks) b.el.classList.toggle('is-sel', !!sel && key === sel.kind + ':' + sel.id)
    // the scene of the selected shot is marked too
    if (sel?.kind === 'shot') {
      const sh = store.timeline.shot(sel.id)
      if (sh) blocks.get('scene:' + sh.scene.id)?.el.classList.add('is-parent')
    }
    for (const [key, b] of blocks) if (b.kind === 'scene' && !(sel?.kind === 'shot' && store.timeline.shot(sel.id)?.scene.id === key.slice(6))) b.el.classList.remove('is-parent')
  }

  // ------------------------------------------------------------ ruler + playhead

  function drawRuler() {
    const T = store.timeline
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.ceil(T.duration * pps) + PAD_R
    const H = 26
    ruler.width = W * dpr
    ruler.height = H * dpr
    ruler.style.width = W + 'px'
    ruler.style.height = H + 'px'
    const g = ruler.getContext('2d')
    g.scale(dpr, dpr)
    g.clearRect(0, 0, W, H)
    const minor = pps >= 160 ? 0.1 : pps >= 60 ? 0.5 : 1
    const label = pps >= 110 ? 0.5 : pps >= 34 ? 1 : pps >= 16 ? 2 : 5
    g.font = '10px ui-monospace, "SF Mono", Menlo, monospace'
    g.textBaseline = 'top'
    const n = Math.ceil((T.duration + 4) / minor)
    for (let i = 0; i <= n; i++) {
      const t = i * minor
      const x = Math.round(t * pps) + 0.5
      const isSec = Math.abs(t - Math.round(t)) < 1e-6
      const isLabel = Math.abs(t / label - Math.round(t / label)) < 1e-6
      g.strokeStyle = t > T.duration + 1e-6 ? 'rgba(255,255,255,0.08)' : isSec ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.16)'
      g.beginPath()
      g.moveTo(x, isSec ? 14 : 19)
      g.lineTo(x, H)
      g.stroke()
      if (isLabel && t <= T.duration + 1e-6) {
        g.fillStyle = 'rgba(232,231,227,0.6)'
        g.fillText(Number.isInteger(t) ? t + 's' : t.toFixed(1), x + 3, 3)
      }
    }
    // the 30 s mark
    const x30 = Math.round(30 * pps) + 0.5
    g.strokeStyle = '#c0ff33'
    g.setLineDash([3, 3])
    g.beginPath()
    g.moveTo(x30, 0)
    g.lineTo(x30, H)
    g.stroke()
    g.setLineDash([])
  }

  function placePlayhead() {
    playhead.style.transform = `translateX(${engine.time * pps}px)`
    const T = store.timeline
    const cur = T.at(Math.min(engine.time, T.duration - 1e-4))
    for (const [key, b] of blocks) if (b.kind === 'shot') b.el.classList.toggle('is-live', key === 'shot:' + cur?.id)
  }

  function follow() {
    if (!engine.playing) return
    const x = engine.time * pps
    const left = scroll.scrollLeft
    const w = scroll.clientWidth
    if (x > left + w - 80) scroll.scrollLeft = x - 80
    else if (x < left) scroll.scrollLeft = Math.max(0, x - 40)
  }

  // ------------------------------------------------------------ zoom

  function computeFit() {
    fitPps = Math.max(8, (scroll.clientWidth - PAD_R - 4) / Math.max(1, store.timeline.duration))
  }
  const MAXP = 340
  function setPps(v, anchorX = null) {
    const before = pps
    pps = clamp(v, fitPps * 0.999, MAXP)
    const k = Math.log(pps / fitPps) / Math.log(MAXP / fitPps)
    zoomEl.value = String(clamp(k))
    const ax = anchorX ?? scroll.clientWidth / 2
    const tAt = (scroll.scrollLeft + ax) / before
    layout()
    scroll.scrollLeft = tAt * pps - ax
  }
  zoomEl.addEventListener('input', () => setPps(fitPps * Math.pow(MAXP / fitPps, Number(zoomEl.value))))
  $('[data-zoomin]').addEventListener('click', () => setPps(pps * 1.35))
  $('[data-zoomout]').addEventListener('click', () => setPps(pps / 1.35))
  $('[data-zoomfit]').addEventListener('click', () => fitZoom())
  function fitZoom() {
    computeFit()
    setPps(fitPps)
    scroll.scrollLeft = 0
  }
  scroll.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setPps(pps * Math.exp(-e.deltaY * 0.01), e.clientX - scroll.getBoundingClientRect().left)
    },
    { passive: false },
  )
  const snapBtn = $('[data-snap]')
  function toggleSnap() {
    snap = !snap
    snapBtn.classList.toggle('is-on', snap)
  }
  snapBtn.addEventListener('click', toggleSnap)
  $('[data-fit]').addEventListener('click', () => store.fitTo(30))

  // ------------------------------------------------------------ pointer: select, resize, scrub

  const q = (v) => (snap ? Math.round(v * 20) / 20 : Math.round(v * 100) / 100)
  const timeAt = (clientX) => (clientX - content.getBoundingClientRect().left) / pps

  function showTip(e, html) {
    tip.hidden = false
    tip.innerHTML = html
    const r = el.getBoundingClientRect()
    tip.style.left = clamp(e.clientX - r.left + 14, 8, r.width - 190) + 'px'
    tip.style.top = e.clientY - r.top - 34 + 'px'
  }

  content.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const blk = e.target.closest('.blk')
    const edge = e.target.closest('.blk__h')?.dataset.edge
    if (blk && edge) return startResize(e, blk, edge)
    if (blk) {
      store.select({ kind: blk.dataset.kind, id: blk.dataset.id })
      if (e.detail === 2) {
        const T = store.timeline
        const item = blk.dataset.kind === 'scene' ? T.scene(blk.dataset.id) : T.shot(blk.dataset.id)
        engine.seek(item.start + 1e-3)
      }
      return
    }
    // ruler or empty lane: scrub
    const was = engine.playing
    engine.pause()
    const move = (ev) => engine.seek(clamp(timeAt(ev.clientX), 0, engine.duration))
    move(e)
    content.setPointerCapture(e.pointerId)
    const up = () => {
      content.removeEventListener('pointermove', move)
      content.removeEventListener('pointerup', up)
      content.removeEventListener('pointercancel', up)
      if (was) engine.play()
    }
    content.addEventListener('pointermove', move)
    content.addEventListener('pointerup', up)
    content.addEventListener('pointercancel', up)
  })

  function startResize(e, blk, edge) {
    e.preventDefault()
    const kind = blk.dataset.kind
    const id = blk.dataset.id
    store.select({ kind, id })
    const T = store.timeline
    const x0 = e.clientX
    store.begin()
    document.body.classList.add('is-resizing')
    blk.classList.add('is-drag')
    let apply
    if (kind === 'scene') {
      const sc = T.scene(id)
      const start = sc.shots.map((s) => s.dur)
      const total = sc.dur
      apply = (ev) => {
        const nd = Math.max(MIN_DUR * start.length, q(total + (ev.clientX - x0) / pps))
        store.scaleScene(id, nd, start)
        showTip(ev, `<b>${sc.label}</b> ${total.toFixed(2)} → ${store.timeline.scene(id).dur.toFixed(2)} s`)
      }
    } else if (edge === 'r') {
      const sh = T.shot(id)
      const d0 = sh.dur
      apply = (ev) => {
        const nd = Math.max(MIN_DUR, q(d0 + (ev.clientX - x0) / pps))
        store.setDur(id, nd)
        showTip(ev, `<b>${sh.name}</b> ${d0.toFixed(2)} → ${nd.toFixed(2)} s <em>${nd >= d0 ? '+' : '−'}${Math.abs(nd - d0).toFixed(2)}</em>`)
      }
    } else {
      const sh = T.shot(id)
      const prev = T.shots[sh.index - 1]
      if (!prev) {
        store.commit()
        document.body.classList.remove('is-resizing')
        blk.classList.remove('is-drag')
        return
      }
      const start = { a: prev.dur, b: sh.dur }
      apply = (ev) => {
        const cutAt = q(sh.start + (ev.clientX - x0) / pps)
        store.rollCut(id, cutAt - sh.start, start)
        const now = store.timeline.shot(id)
        showTip(ev, `taglio a <b>${now.start.toFixed(2)} s</b> · ${prev.name} ${store.timeline.shots[sh.index - 1].dur.toFixed(2)} · ${sh.name} ${now.dur.toFixed(2)}`)
      }
    }
    const move = (ev) => apply(ev)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.classList.remove('is-resizing')
      blk.classList.remove('is-drag')
      tip.hidden = true
      store.commit()
      queueThumbs()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // ------------------------------------------------------------ thumbnails

  let queue = []
  let thumbTimer = 0
  function paintStrip(id, w) {
    const b = blocks.get('shot:' + id)
    const set = thumbs.get(id)
    if (!b?.strip) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const H = b.el.clientHeight || 78
    const c = b.strip
    const cw = Math.max(2, Math.round(w * dpr))
    const ch = Math.round(H * dpr)
    if (c.width !== cw || c.height !== ch) {
      c.width = cw
      c.height = ch
    }
    const g = c.getContext('2d')
    g.clearRect(0, 0, cw, ch)
    if (!set || !set.some(Boolean)) return
    const a = engine.view.aspect
    const tw = Math.max(ch * a, 8)
    const n = Math.max(1, Math.round(cw / tw))
    const step = cw / n
    for (let i = 0; i < n; i++) {
      const pick = set[Math.min(set.length - 1, Math.floor(((i + 0.5) / n) * set.length))] || set.find(Boolean)
      if (!pick) continue
      // cover-fit each cell
      const sAspect = pick.width / pick.height
      const cAspect = step / ch
      let sw = pick.width
      let sh = pick.height
      if (sAspect > cAspect) sw = pick.height * cAspect
      else sh = pick.width / cAspect
      g.drawImage(pick, (pick.width - sw) / 2, (pick.height - sh) / 2, sw, sh, i * step, 0, step + 0.5, ch)
    }
  }

  function queueThumbs(delay = 500) {
    clearTimeout(thumbTimer)
    thumbTimer = setTimeout(() => {
      queue = []
      for (const sh of store.timeline.shots) [0.22, 0.52, 0.82].forEach((f, i) => queue.push({ id: sh.id, i, t: sh.start + sh.dur * f }))
      pump()
    }, delay)
  }
  let pumping = false
  function pump() {
    if (pumping) return
    pumping = true
    const stepFn = () => {
      if (!queue.length) return (pumping = false)
      if (engine.playing || engine.exporting || document.body.classList.contains('is-resizing')) return setTimeout(stepFn, 400)
      const job = queue.shift()
      const a = engine.view.aspect
      let set = thumbs.get(job.id)
      if (!set) thumbs.set(job.id, (set = [null, null, null]))
      const c = set[job.i] || (set[job.i] = document.createElement('canvas'))
      c.height = THUMB_H
      c.width = Math.max(8, Math.round(THUMB_H * a))
      // render that moment, copy it, put the real frame back: one task, so nothing flickers on screen
      engine.renderAt(job.t)
      c.getContext('2d').drawImage(engine.canvas, 0, 0, c.width, c.height)
      engine.renderAt(engine.time)
      const sh = store.timeline.shot(job.id)
      if (sh) paintStrip(job.id, Math.max(4, sh.dur * pps - 2))
      requestAnimationFrame(stepFn)
    }
    requestAnimationFrame(stepFn)
  }

  // ------------------------------------------------------------ wiring

  let structure = ''
  const sig = () => store.timeline.shots.map((s) => s.id).join(',')
  store.on((what) => {
    if (what === 'project') {
      if (sig() !== structure) {
        structure = sig()
        build()
      } else layout()
      if (!document.body.classList.contains('is-resizing')) queueThumbs(700)
    }
    if (what === 'selection') select()
    if (what === 'aspect') {
      thumbs.clear()
      queueThumbs(300)
    }
  })
  engine.on((what) => {
    if (what === 'time') {
      placePlayhead()
      follow()
    }
  })
  new ResizeObserver(() => {
    const atFit = Math.abs(pps - fitPps) < 0.5
    computeFit()
    if (atFit || pps < fitPps) fitZoom()
    else layout()
  }).observe(scroll)

  structure = sig()
  build()
  fitZoom()
  queueThumbs(900)

  return { fitZoom, toggleSnap, zoom: (k) => setPps(pps * k), refreshThumbs: () => queueThumbs(100) }
}

export { HEAD_W }
