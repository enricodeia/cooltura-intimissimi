// The timeline: a magnetic track of shots under their scenes (as in CapCut's
// main track), a ruler with the playhead, per-shot thumbnails and, with sound (V4),
// an audio lane: the waveform of the mix, its bars and beats, the voices.
//   click a block        select it → its contents, motion and look open in the panel
//   drag a block         move it: a shot before another shot, a scene before another scene
//                        (a shot that is part of its scene's choreography moves with the scene)
//   drag its right edge  change its duration, everything after ripples
//   drag its left edge   move the cut with the shot before (the film keeps its length)
//   drag a scene's edge  stretch the whole scene, shots keep their proportions
//                        (with the magnet on, an edge lands on the music's beat within 0.12 s,
//                        else on the 0.05 s grid)
//   ⌫ (in app.js)        delete the selected block
//   ruler / empty lane   scrub · the audio lane → the music panel

import { icon, h, esc } from './icons.js'
import { trackOf, speakerOf, watchAudio } from './inspector.js'
import { effectsOf, MIN_DUR } from '../model/project.js'
import { clamp } from '../core/util.js'

const HEAD_W = 76
const PAD_R = 72
const THUMB_H = 150
const BEAT_SNAP = 0.12 // s: an edge this close to a beat lands on it
const UI_FONT = '-apple-system, BlinkMacSystemFont, "Inter", sans-serif'
// the chrome's ink on its dark panels (canvas)
const ink = (a) => `rgba(239,233,234,${a})`
const f2 = (v) => v.toFixed(2).replace('.', ',')

export function mountTimeline(el, { engine, store, onMusic = () => {} }) {
  const audio = engine.audio
  el.innerHTML = `
    <div class="tl__bar">
      <div class="tl__title">${icon('film')}<span>Timeline</span></div>
      <div class="tl__total" data-total></div>
      <button class="btn btn--ghost" data-fit title="Scala tutti gli shot in proporzione perché il film duri esattamente quanto l’obiettivo">${icon('fit-time')}<span>Adatta a</span></button>
      <label class="tl__target" title="Durata obiettivo del film (il segno tratteggiato sul righello)"><input type="number" min="5" max="180" step="0.5" data-target aria-label="Durata obiettivo" /><span>s</span></label>
      <div class="tl__hint">Trascina un blocco per spostarlo · i bordi per la durata · ⌫ per eliminarlo</div>
      <div class="tl__spacer"></div>
      <button class="btn btn--icon is-on" data-snap title="${audio ? 'Snap: i bordi sul battere della musica, o a 0,05 s (S)' : 'Snap a 0,05 s (S)'}">${icon('magnet')}</button>
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
        ${audio ? `<div class="tl__head tl__head--audio">${icon('music')}<span>Audio</span></div>` : ''}
      </div>
      <div class="tl__scroll" data-scroll>
        <div class="tl__content" data-content>
          <canvas class="tl__ruler" data-ruler></canvas>
          <div class="tl__lane tl__lane--scenes" data-scenes></div>
          <div class="tl__lane tl__lane--shots" data-shots></div>
          ${audio ? `<div class="tl__lane tl__lane--audio" data-audio title="Musica e voci · clic per il pannello"><canvas class="tl__wave" data-wave></canvas><span class="tl__track" data-lane-track></span></div>` : ''}
          <div class="tl__playhead" data-playhead><i></i></div>
          <div class="tl__drop" data-drop hidden></div>
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
  const audioLane = $('[data-audio]')
  const waveCv = $('[data-wave]')
  const trackEl = $('[data-lane-track]')
  const playhead = $('[data-playhead]')
  const tip = $('[data-tip]')
  const dropEl = $('[data-drop]')
  const totalEl = $('[data-total]')
  const targetEl = $('[data-target]')
  const fmtGoal = (g) => (Number.isInteger(g) ? String(g) : g.toFixed(2).replace(/0$/, '').replace('.', ','))
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
      const b = h('div', { class: 'blk blk--scene', 'data-id': sc.id, 'data-kind': 'scene', style: `--hue:${sc.hue}` }, `<span class="blk__name">${esc(sc.label)}</span><span class="blk__dur"></span><i class="blk__h blk__h--r" data-edge="r"></i>`)
      scenesLane.appendChild(b)
      blocks.set('scene:' + sc.id, { el: b, kind: 'scene' })
    }
    for (const sh of T.shots) {
      const fx = effectsOf(sh.src)
      const chips = fx
        .slice(0, 4)
        .map((f) => `<span class="blk__chip" title="${esc(f.label)}">${icon(f.icon || 'sliders')}</span>`)
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
      b.el.querySelector('.blk__dur').textContent = f2(sc.dur) + ' s'
    }
    for (const sh of T.shots) {
      const b = blocks.get('shot:' + sh.id)
      if (!b) continue
      const w = Math.max(4, sh.dur * pps - 2)
      b.el.style.left = sh.start * pps + 'px'
      b.el.style.width = w + 'px'
      b.el.classList.toggle('is-narrow', w < 58)
      b.el.classList.toggle('is-tight', w < 150) // the effect chips only where they do not sit on the duration
      b.el.querySelector('.blk__name').textContent = sh.name
      b.el.querySelector('.blk__dur').textContent = f2(sh.dur) + ' s'
      paintStrip(sh.id, w)
    }
    const d = T.duration
    const goal = store.project.target || 30
    const off = Math.abs(d - goal) > 0.005
    totalEl.innerHTML = `${icon('stopwatch')}<b>${f2(d)} s</b>${off ? `<em>${d > goal ? '+' : '−'}${f2(Math.abs(d - goal))} rispetto a ${fmtGoal(goal)} s</em>` : `<em>${fmtGoal(goal)} s esatti</em>`}`
    if (document.activeElement !== targetEl) targetEl.value = String(goal)
    totalEl.classList.toggle('is-off', off)
    drawRuler()
    drawAudio()
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

  /** A canvas as wide as the content (its pixel width capped where Chrome stops drawing). */
  function sized(cv, W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1, 32000 / W)
    const cw = Math.round(W * dpr)
    const ch = Math.round(H * dpr)
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw
      cv.height = ch
    }
    cv.style.width = W + 'px'
    cv.style.height = H + 'px'
    const g = cv.getContext('2d')
    g.setTransform(cw / W, 0, 0, ch / H, 0, 0)
    g.clearRect(0, 0, W, H)
    return g
  }

  function drawRuler() {
    const T = store.timeline
    const W = Math.ceil(T.duration * pps) + PAD_R
    const H = 26
    const g = sized(ruler, W, H)
    const minor = pps >= 160 ? 0.1 : pps >= 60 ? 0.5 : 1
    const label = pps >= 110 ? 0.5 : pps >= 34 ? 1 : pps >= 16 ? 2 : 5
    g.font = `10px ${UI_FONT}`
    g.textBaseline = 'top'
    const n = Math.ceil((T.duration + 4) / minor)
    for (let i = 0; i <= n; i++) {
      const t = i * minor
      const x = Math.round(t * pps) + 0.5
      const isSec = Math.abs(t - Math.round(t)) < 1e-6
      const isLabel = Math.abs(t / label - Math.round(t / label)) < 1e-6
      g.strokeStyle = t > T.duration + 1e-6 ? ink(0.05) : isSec ? ink(0.3) : ink(0.13)
      g.beginPath()
      g.moveTo(x, isSec ? 14 : 19)
      g.lineTo(x, H)
      g.stroke()
      if (isLabel && t <= T.duration + 1e-6) {
        g.fillStyle = ink(0.48)
        g.fillText(Number.isInteger(t) ? t + 's' : t.toFixed(1).replace('.', ','), x + 3, 3)
      }
    }
    // the music's grid (the score's or the song's): a dot on every beat, a mark on every bar
    const grid = audio?.grid()
    if (grid) {
      if (grid.beat * pps >= 5) {
        g.fillStyle = ink(0.32)
        for (const t of audio.beatsIn(0, T.duration)) g.fillRect(Math.round(t * pps) - 1, H - 3, 2, 2)
      }
      g.fillStyle = ink(0.62)
      for (const t of audio.beatsIn(0, T.duration, true)) g.fillRect(Math.round(t * pps) - 1, H - 6, 2, 5)
    }
    // the target mark
    const x30 = Math.round((store.project.target || 30) * pps) + 0.5
    g.strokeStyle = ink(0.55)
    g.setLineDash([2, 3])
    g.beginPath()
    g.moveTo(x30, 0)
    g.lineTo(x30, H)
    g.stroke()
    g.setLineDash([])
  }

  // ------------------------------------------------------------ the audio lane (V4)

  const audioBusy = audio ? watchAudio(audio, (what) => onAudio(what)) : () => false
  function onAudio(what) {
    if (what === 'mix' || what === 'track' || what === 'status') drawAudio()
    if (what === 'track') drawRuler()
    if (what === 'track' || what === 'status' || what === 'busy' || what === 'mute') syncTrack()
  }
  function syncTrack() {
    if (!trackEl) return
    const t = trackOf(audio)
    const busy = audioBusy()
    trackEl.classList.toggle('is-busy', busy)
    trackEl.innerHTML = busy
      ? `${icon('music')}<b>Preparo l’audio…</b>`
      : `${icon(audio.muted ? 'mute' : 'music')}<b>${esc(t.name)}</b>${t.bpm ? `<em>${t.bpm} BPM</em>` : t.song ? '<em>tempo non trovato</em>' : ''}`
  }

  function drawAudio() {
    if (!audio || !waveCv) return
    const T = store.timeline
    const W = Math.ceil(T.duration * pps) + PAD_R
    const H = audioLane.clientHeight || 52
    const g = sized(waveCv, W, H)
    // bars: hairlines across the lane · beats: ticks at its foot
    const grid = audio.grid()
    if (grid) {
      if (grid.beat * pps >= 5) {
        g.fillStyle = ink(0.14)
        for (const t of audio.beatsIn(0, T.duration)) g.fillRect(Math.round(t * pps), H - 4, 1, 4)
      }
      g.fillStyle = ink(0.07)
      for (const t of audio.beatsIn(0, T.duration, true)) g.fillRect(Math.round(t * pps), 0, 1, H)
    }
    // the waveform of the mix (music + voices), symmetric and softened over three columns
    const cols = Math.max(1, Math.round(T.duration * pps))
    const wf = audio.waveform(cols)
    if (wf) {
      const n = wf.cols
      const a = new Float32Array(n)
      for (let c = 0; c < n; c++) a[c] = (wf.hi[c] - wf.lo[c]) / 2
      const cy = H / 2
      const amp = H / 2 - 7
      const px = (wf.duration * pps) / n
      const at = (c) => Math.min(1, ((a[Math.max(0, c - 1)] + 2 * a[c] + a[Math.min(n - 1, c + 1)]) / 4) * 1.35)
      g.fillStyle = audio.status === 'rendering' ? ink(0.13) : ink(0.27)
      g.beginPath()
      g.moveTo(0, cy)
      for (let c = 0; c < n; c++) g.lineTo(c * px, cy - Math.max(0.5, at(c) * amp))
      for (let c = n - 1; c >= 0; c--) g.lineTo(c * px, cy + Math.max(0.5, at(c) * amp))
      g.closePath()
      g.fill()
    }
    // the voices: who speaks, where (the music goes down under them)
    let voices = []
    try {
      voices = audio.planOf(T, store.project).voices || []
    } catch {}
    g.font = `500 10.5px ${UI_FONT}`
    g.textBaseline = 'middle'
    for (const v of voices) {
      const x0 = v.at * pps
      const w = Math.max(4, Math.min(v.to - v.from, T.duration - v.at) * pps)
      if (w <= 0) continue
      g.fillStyle = ink(0.08)
      g.strokeStyle = ink(0.34)
      g.lineWidth = 1
      g.beginPath()
      g.roundRect(x0 + 0.5, 5.5, w - 1, H - 11, 7)
      g.fill()
      g.stroke()
      // "voce · Chiara Chelo", or only the name, or nothing: what fits in the window
      const who = speakerOf(v.key)
      const label = [`voce · ${who}`, who].find((l) => g.measureText(l).width + 14 <= w - 10)
      if (label) {
        g.fillStyle = 'rgba(14,13,15,0.78)'
        g.beginPath()
        g.roundRect(x0 + 5, 9, g.measureText(label).width + 14, 17, 8.5)
        g.fill()
        g.fillStyle = ink(0.86)
        g.fillText(label, x0 + 12, 17.5)
      }
    }
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
  $('[data-fit]').addEventListener('click', () => store.fitTo(store.project.target || 30))
  targetEl.addEventListener('change', () => store.setTarget(targetEl.value))
  targetEl.addEventListener('keydown', (e) => e.stopPropagation())

  // ------------------------------------------------------------ pointer: select, resize, scrub

  const q = (v) => (snap ? Math.round(v * 20) / 20 : Math.round(v * 100) / 100)
  const timeAt = (clientX) => (clientX - content.getBoundingClientRect().left) / pps
  /** The music's beat within BEAT_SNAP of film time t (magnet on, a known grid), else null. */
  function beatNear(t) {
    if (!snap || !audio?.grid()) return null
    let best = null
    for (const b of audio.beatsIn(t - BEAT_SNAP, t + BEAT_SNAP)) if (Math.abs(b - t) <= BEAT_SNAP && (best === null || Math.abs(b - t) < Math.abs(best - t))) best = b
    return best === null ? null : Math.round(best * 1000) / 1000
  }
  function beatTag(t) {
    const g = audio.grid()
    const k = (t - g.downbeat0) / (g.beat * 4)
    return `<em class="tl__beat">${icon('music')}${Math.abs(k - Math.round(k)) < 1e-3 ? 'inizio battuta' : 'a tempo'}</em>`
  }

  function showTip(e, html) {
    tip.hidden = false
    tip.innerHTML = html
    const r = el.getBoundingClientRect()
    tip.style.left = clamp(e.clientX - r.left + 14, 8, r.width - 190) + 'px'
    tip.style.top = e.clientY - r.top - 34 + 'px'
  }

  content.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    // the audio lane: the music panel
    if (e.target.closest('[data-audio]')) return onMusic()
    const blk = e.target.closest('.blk')
    const edge = e.target.closest('.blk__h')?.dataset.edge
    if (blk && edge) return startResize(e, blk, edge)
    if (blk) return startPress(e, blk)
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

  // ------------------------------------------------------------ move: drag a block, drop it before another one

  function startPress(e, blk) {
    const kind = blk.dataset.kind
    const id = blk.dataset.id
    store.select({ kind, id })
    const T = store.timeline
    const item = kind === 'scene' ? T.scene(id) : T.shot(id)
    if (e.detail === 2) {
      engine.seek(item.start + 1e-3)
      return
    }
    const x0 = e.clientX
    const y0 = e.clientY
    const bound = kind === 'shot' && store.isBound(id)
    let dragging = false
    let target = null // { before: id | null, scene: id | null, x }
    // where it can go: before any other block of its lane, or at the end
    const others = (kind === 'scene' ? T.scenes : T.shots).filter((x) => x.id !== id)
    const slots = others.map((x) => ({ before: x.id, scene: null, t: x.start, name: kind === 'scene' ? x.label : x.name }))
    const last = (kind === 'scene' ? T.scenes : T.shots).at(-1)
    slots.push({ before: null, scene: kind === 'shot' ? others.at(-1)?.scene.id ?? item.scene.id : null, t: last.end, name: null })
    const lane = kind === 'scene' ? scenesLane : shotsLane
    const nameOf = (x) => esc(kind === 'scene' ? x.label : x.name)
    const move = (ev) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return
        if (bound) {
          showTip(ev, `${icon('lock')} <b>${esc(item.name)}</b> fa parte di “${esc(item.scene.label)}”: trascina la scena`)
          return
        }
        dragging = true
        engine.pause()
        blk.classList.add('is-moving')
        document.body.classList.add('is-moving')
      }
      // auto-scroll near the edges
      const r = scroll.getBoundingClientRect()
      if (ev.clientX < r.left + 40) scroll.scrollLeft -= 12
      else if (ev.clientX > r.right - 40) scroll.scrollLeft += 12
      blk.style.transform = `translate(${ev.clientX - x0}px, -3px)`
      const t = timeAt(ev.clientX) // the nearest cut to the pointer
      target = slots.reduce((a, s) => (Math.abs(s.t - t) < Math.abs(a.t - t) ? s : a), slots[0])
      // dropping it right where it is changes nothing
      const here = target.before === (kind === 'scene' ? T.scenes : T.shots)[(item.index ?? T.scenes.indexOf(item)) + 1]?.id || (target.before === null && last.id === id)
      dropEl.hidden = !!here
      dropEl.classList.toggle('is-scene', kind === 'scene')
      dropEl.style.left = target.t * pps + 'px'
      dropEl.style.top = lane.offsetTop + 'px'
      dropEl.style.height = lane.offsetHeight + 'px'
      showTip(ev, here ? `<b>${nameOf(item)}</b> resta dov’è` : `<b>${nameOf(item)}</b> → ${target.name ? `prima di ${esc(target.name)}` : 'alla fine'}`)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      tip.hidden = true
      dropEl.hidden = true
      document.body.classList.remove('is-moving')
      blk.classList.remove('is-moving')
      blk.style.transform = ''
      if (!dragging || !target) return
      if (kind === 'scene') store.moveScene(id, target.before)
      else store.moveShot(id, target.before, target.scene)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

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
        const raw = total + (ev.clientX - x0) / pps
        const b = beatNear(sc.start + raw)
        const nd = Math.max(MIN_DUR * start.length, b !== null ? b - sc.start : q(raw))
        store.scaleScene(id, nd, start)
        showTip(ev, `<b>${esc(sc.label)}</b> ${f2(total)} → ${f2(store.timeline.scene(id).dur)} s${b !== null ? beatTag(b) : ''}`)
      }
    } else if (edge === 'r') {
      const sh = T.shot(id)
      const d0 = sh.dur
      apply = (ev) => {
        const raw = d0 + (ev.clientX - x0) / pps
        const b = beatNear(sh.start + raw)
        const nd = Math.max(MIN_DUR, b !== null ? Math.round((b - sh.start) * 1000) / 1000 : q(raw))
        store.setDur(id, nd)
        showTip(ev, `<b>${esc(sh.name)}</b> ${f2(d0)} → ${f2(nd)} s <em>${nd >= d0 ? '+' : '−'}${f2(Math.abs(nd - d0))}</em>${b !== null ? beatTag(b) : ''}`)
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
        const raw = sh.start + (ev.clientX - x0) / pps
        const b = beatNear(raw)
        const cutAt = b !== null ? b : q(raw)
        store.rollCut(id, cutAt - sh.start, start)
        const now = store.timeline.shot(id)
        showTip(ev, `taglio a <b>${f2(now.start)} s</b> · ${esc(prev.name)} ${f2(store.timeline.shots[sh.index - 1].dur)} · ${esc(sh.name)} ${f2(now.dur)}${b !== null ? beatTag(b) : ''}`)
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
  syncTrack()
  queueThumbs(900)

  return { fitZoom, toggleSnap, zoom: (k) => setPps(pps * k), refreshThumbs: () => queueThumbs(100) }
}

export { HEAD_W }
