// The studio shell: top bar (format, sound, history, export), the stage with its
// transport, the effects panel and the timeline. With sound (V4): the audio pill in
// the top bar, a song dropped anywhere on the window becomes the music.

import { icon, h, esc } from './icons.js'
import { mountTimeline } from './timeline.js'
import { mountInspector, trackOf, watchAudio } from './inspector.js'
import { ASPECTS } from '../engine/engine.js'
import { INTROS, EDITION, EDITIONS } from '../model/project.js'
import { exportVideo, download } from '../engine/exporter.js'
import { fmtTime, clamp } from '../core/util.js'

export function mountUI({ engine, store, api }) {
  const top = document.getElementById('topbar')
  const stage = document.getElementById('stage')
  const fit = document.getElementById('stage-fit')
  const canvas = document.getElementById('view')
  const transport = document.getElementById('transport')
  const audio = engine.audio
  document.getElementById('app').classList.toggle('has-audio', !!audio)

  // ------------------------------------------------------------ toast
  const toastEl = h('div', { class: 'toast', role: 'status' })
  document.body.appendChild(toastEl)
  let toastT = 0
  function toast(msg) {
    toastEl.textContent = msg
    toastEl.classList.add('is-on')
    clearTimeout(toastT)
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2800)
  }

  // ------------------------------------------------------------ top bar
  top.innerHTML = `
    <div class="top__brand">
      <span class="top__mark">cooltura<i>*</i></span><span class="top__x">×</span><span class="top__client">intimissimi</span>
      <span class="top__proj">Recap studio</span>
    </div>
    <div class="top__eds" role="group" aria-label="Edizione del film">
      ${EDITIONS.map((e) => `<a class="asp${e.id === EDITION.id ? ' is-on' : ''}" href="${e.page}${location.search}" title="Apri ${e.label}">${e.label}</a>`).join('')}
    </div>
    ${
      Object.keys(INTROS).length > 1
        ? `<div class="top__intro" role="group" aria-label="Intro (tasti 1 e 2)">
      ${Object.entries(INTROS)
        .map(([k, label], i) => `<button type="button" class="asp" data-intro="${k}" title="${label} · tasto ${i + 1}"><b>${i + 1}</b><span>Intro ${k}</span></button>`)
        .join('')}
    </div>`
        : ''
    }
    <div class="top__aspects" role="group" aria-label="Formato di uscita">
      ${Object.entries(ASPECTS)
        .map(([k, a]) => `<button type="button" class="asp" data-aspect="${k}" title="${a.hint} · ${a.w} × ${a.h}"><i style="aspect-ratio:${a.w}/${a.h}"></i><span>${k}</span></button>`)
        .join('')}
    </div>
    <div class="top__actions">
      ${
        audio
          ? `<div class="aud" data-aud>
        <button type="button" class="aud__main" data-aud-open>${icon('music', 'aud__ico')}<span data-aud-label>Colonna originale</span></button>
        <button type="button" class="aud__mute" data-mute title="Audio sì · no (M)" aria-label="Audio sì · no">${icon('volume')}</button>
      </div>`
          : ''
      }
      <button type="button" class="btn btn--icon" data-undo title="Annulla (⌘Z)">${icon('undo')}</button>
      <button type="button" class="btn btn--icon" data-redo title="Ripeti (⇧⌘Z)">${icon('redo')}</button>
      <button type="button" class="btn btn--ghost" popovertarget="menu-project">${icon('folder')}<span>Progetto</span></button>
      <button type="button" class="btn btn--primary" data-export>${icon('export')}<span>Esporta MP4</span></button>
    </div>
    <div id="menu-project" popover class="menu">
      <button type="button" data-copy>${icon('copy')}<span>Copia il progetto (JSON)</span></button>
      <button type="button" data-paste>${icon('paste')}<span>Incolla un progetto (JSON)…</span></button>
      <button type="button" data-restore>${icon('layer')}<span>Rimetti blocchi eliminati e ordine originale</span></button>
      <button type="button" data-reset>${icon('undo')}<span>Ripristina il film originale</span></button>
      ${
        audio
          ? `<button type="button" data-track>${icon('upload')}<span>Carica un brano…</span></button>
      <button type="button" data-score>${icon('wave')}<span>Torna alla colonna originale</span></button>`
          : `<button type="button" data-storyboard>${icon('film')}<span>Storyboard V2 (disegni a mano)</span></button>`
      }
    </div>`

  const aspBtns = [...top.querySelectorAll('[data-aspect]')]
  aspBtns.forEach((b) => b.addEventListener('click', () => store.setAspect(b.dataset.aspect)))
  const introBtns = [...top.querySelectorAll('[data-intro]')]
  const setIntro = (v) => {
    if (store.project.intro === v) return
    store.setIntro(v)
    // the cut moved: keep the playhead on the same moment of the film after the intro
    toast(`${INTROS[v]} (tasto ${v === 'A' ? 1 : 2})`)
  }
  introBtns.forEach((b) => b.addEventListener('click', () => setIntro(b.dataset.intro)))
  const undoBtn = top.querySelector('[data-undo]')
  const redoBtn = top.querySelector('[data-redo]')
  undoBtn.addEventListener('click', () => store.undo())
  redoBtn.addEventListener('click', () => store.redo())
  const menu = top.querySelector('#menu-project')
  top.querySelector('[data-storyboard]')?.addEventListener('click', () => {
    menu.hidePopover()
    window.open('./storyboard.html', '_blank', 'noopener')
  })
  // V4: the sound. The pill says what plays (the score, a song, "Preparo l’audio…", "Audio spento") and opens
  // the music panel; its small button mutes (M too). A song from disk replaces the score.
  const aud = top.querySelector('[data-aud]')
  const audLabel = aud?.querySelector('[data-aud-label]')
  const muteBtn = top.querySelector('[data-mute]')
  let lastSong = audio?.custom?.buffer || null
  let loading = false // a song being read from here: "Preparo l’audio…" at once, not after the debounce
  const audioBusy = audio ? watchAudio(audio, (what) => onAudio(what)) : () => false
  function onAudio(what) {
    syncAud()
    if (what !== 'track') return
    // a new song or back to the score (not a move of the song's start)
    const song = audio.custom?.buffer || null
    if (song === lastSong) return
    lastSong = song
    const t = trackOf(audio)
    // a song that arrives without being loaded here is the one kept in this browser (main.js restores it)
    toast(t.song ? `${loading ? 'Brano' : 'Brano ripreso'}: ${t.name} · ${t.bpm ? t.bpm + ' BPM' : 'tempo non trovato'}` : 'Colonna originale')
  }
  function syncAud() {
    if (!aud) return
    const t = trackOf(audio)
    const busy = audioBusy() || loading
    const err = audio.status === 'error'
    audLabel.textContent = audio.muted ? 'Audio spento' : busy ? 'Preparo l’audio…' : err ? 'Audio non disponibile' : t.name
    aud.classList.toggle('is-muted', audio.muted)
    aud.classList.toggle('is-busy', busy && !audio.muted)
    aud.classList.toggle('is-song', t.song)
    muteBtn.innerHTML = icon(audio.muted ? 'mute' : 'volume')
    muteBtn.setAttribute('aria-pressed', String(audio.muted))
    aud.querySelector('[data-aud-open]').title = `${t.name}${t.bpm ? ' · ' + t.bpm + ' BPM' : ''} · Musica e voci`
  }
  muteBtn?.addEventListener('click', () => audio.setMuted(!audio.muted))
  aud?.querySelector('[data-aud-open]').addEventListener('click', () => inspector.showMusic())

  const isAudioFile = (f) => /^audio\//.test(f.type) || /\.(mp3|wav|wave|m4a|aac|flac|ogg|oga|opus|aif|aiff|caf)$/i.test(f.name)
  /** A song from disk becomes the music (decoded, levelled, its tempo found; kept in this browser). */
  async function useTrack(file) {
    if (!audio || !file) return
    if (!isAudioFile(file)) return toast(`“${file.name}” non è un file audio (MP3, WAV, M4A, AIFF…)`)
    toast(`Leggo “${file.name}” e ne cerco il tempo…`)
    loading = true
    syncAud()
    try {
      await audio.loadTrack(file)
    } catch (e) {
      console.warn('[audio] track', e)
      toast('Non riesco a leggere questo file audio')
      audio.invalidate(0) // back to the mix that was playing
    } finally {
      loading = false
      syncAud()
    }
  }
  function pickTrack() {
    const inp = h('input', { type: 'file', accept: 'audio/*' })
    inp.addEventListener('change', () => useTrack(inp.files?.[0]))
    inp.click()
  }
  top.querySelector('[data-track]')?.addEventListener('click', () => {
    menu.hidePopover()
    pickTrack()
  })
  top.querySelector('[data-score]')?.addEventListener('click', () => {
    menu.hidePopover()
    audio.clearTrack()
  })
  if (audio) {
    // an audio file dropped anywhere on the window: a hint over everything while it is dragged
    const drop = h('div', { class: 'drop', 'aria-hidden': 'true' }, `<div class="drop__box">${icon('music', 'drop__ico')}<b>Rilascia il brano</b><span>Diventa la musica del film: poi “Metti il montaggio a tempo col brano”</span></div>`)
    document.body.appendChild(drop)
    let depth = 0
    let idle = 0
    const files = (e) => [...(e.dataTransfer?.types || [])].includes('Files')
    const hide = () => {
      depth = 0
      drop.classList.remove('is-on')
    }
    window.addEventListener('dragenter', (e) => {
      if (!files(e)) return
      e.preventDefault()
      depth++
      drop.classList.add('is-on')
    })
    window.addEventListener('dragover', (e) => {
      if (!files(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      drop.classList.add('is-on')
      clearTimeout(idle)
      idle = setTimeout(hide, 500) // a drag cancelled outside the window never says so
    })
    window.addEventListener('dragleave', (e) => {
      if (!files(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) drop.classList.remove('is-on')
    })
    window.addEventListener('drop', (e) => {
      if (!files(e)) return
      e.preventDefault()
      clearTimeout(idle)
      hide()
      const list = [...(e.dataTransfer.files || [])]
      useTrack(list.find(isAudioFile) || list[0])
    })
    syncAud()
  }
  top.querySelector('[data-copy]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(store.project, null, 2)).catch(() => {})
    menu.hidePopover()
    toast('Progetto copiato negli appunti')
  })
  top.querySelector('[data-restore]').addEventListener('click', () => {
    store.restoreStructure()
    menu.hidePopover()
    toast('Blocchi e ordine originali, valori tenuti (⌘Z per tornare indietro)')
  })
  top.querySelector('[data-reset]').addEventListener('click', () => {
    store.reset()
    menu.hidePopover()
    toast('Film originale ripristinato (⌘Z per tornare indietro)')
  })

  // ------------------------------------------------------------ stage
  transport.innerHTML = `
    <button type="button" class="btn btn--icon" data-prev title="Shot precedente (↑)">${icon('prev')}</button>
    <button type="button" class="btn btn--play" data-play title="Play / pausa (spazio)">${icon('play')}</button>
    <button type="button" class="btn btn--icon" data-next title="Shot successivo (↓)">${icon('next')}</button>
    <div class="tc"><b data-tc>00:00.00</b><span data-total>/ 00:30.00</span></div>
    <div class="now" data-now></div>
    <div class="tr__spacer"></div>
    <button type="button" class="btn btn--icon is-on" data-loop title="Loop (L)">${icon('loop')}</button>
    <div class="res" data-res></div>`
  const playBtn = transport.querySelector('[data-play]')
  const tcEl = transport.querySelector('[data-tc]')
  const totalEl = transport.querySelector('[data-total]')
  const nowEl = transport.querySelector('[data-now]')
  const resEl = transport.querySelector('[data-res]')
  const loopBtn = transport.querySelector('[data-loop]')
  playBtn.addEventListener('click', () => engine.toggle())
  loopBtn.addEventListener('click', () => {
    engine.loop = !engine.loop
    loopBtn.classList.toggle('is-on', engine.loop)
  })
  const jump = (dir) => {
    const T = store.timeline
    const cur = T.at(Math.min(engine.time, T.duration - 1e-4))
    let target
    if (dir < 0) target = engine.time - cur.start > 0.12 ? cur : T.shots[Math.max(0, cur.index - 1)]
    else target = T.shots[Math.min(T.shots.length - 1, cur.index + 1)]
    engine.seek(target.start + 1e-3)
    store.select({ kind: 'shot', id: target.id })
  }
  transport.querySelector('[data-prev]').addEventListener('click', () => jump(-1))
  transport.querySelector('[data-next]').addEventListener('click', () => jump(1))
  canvas.addEventListener('click', () => {
    const cur = store.timeline.at(Math.min(engine.time, engine.duration - 1e-4))
    if (cur) store.select({ kind: 'shot', id: cur.id })
  })

  function fitStage() {
    if (engine.exporting) return
    const r = stage.getBoundingClientRect()
    const availW = r.width - 48
    const availH = r.height - transport.offsetHeight - 40
    const a = engine.view.aspect
    let w = availW
    let hh = w / a
    if (hh > availH) {
      hh = availH
      w = hh * a
    }
    w = Math.max(80, Math.floor(w))
    hh = Math.max(80, Math.floor(hh))
    canvas.style.width = w + 'px'
    canvas.style.height = hh + 'px'
    fit.style.width = w + 'px'
    fit.style.height = hh + 'px'
    const k = Math.min(window.devicePixelRatio || 1, engine.W / w)
    engine.setBuffer(w * k, hh * k)
    const A = ASPECTS[engine.aspectKey]
    resEl.textContent = `${A.w} × ${A.h}`
  }
  api.fit = fitStage
  new ResizeObserver(fitStage).observe(stage)

  function syncTop() {
    aspBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.aspect === store.project.aspect))
    introBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.intro === (store.project.intro === 'B' ? 'B' : 'A')))
    undoBtn.disabled = !store.undoStack.length
    redoBtn.disabled = !store.redoStack.length
  }
  function syncTime() {
    tcEl.textContent = fmtTime(engine.time)
    const T = store.timeline
    const cur = T.at(Math.min(engine.time, T.duration - 1e-4))
    nowEl.innerHTML = cur ? `<i style="background:${cur.scene.hue}"></i>${esc(cur.scene.label)} · <b>${esc(cur.name)}</b>` : ''
  }
  function syncPlay() {
    playBtn.innerHTML = icon(engine.playing ? 'pause' : 'play')
    playBtn.classList.toggle('is-on', engine.playing)
  }
  store.on((what) => {
    if (what === 'aspect') {
      engine.setAspect(store.project.aspect)
      fitStage()
    }
    if (what === 'intro') {
      // play the new intro from the start
      engine.seek(0)
    }
    if (what === 'project' || what === 'history' || what === 'aspect' || what === 'intro') {
      syncTop()
      totalEl.textContent = '/ ' + fmtTime(store.timeline.duration)
      if (engine.time > store.timeline.duration) engine.seek(store.timeline.duration)
      syncTime()
    }
  })
  engine.on((what) => {
    if (what === 'time') syncTime()
    if (what === 'play') syncPlay()
  })

  // ------------------------------------------------------------ panels
  const timeline = mountTimeline(document.getElementById('timeline'), { engine, store, onMusic: () => inspector.showMusic() })
  const inspector = mountInspector(document.getElementById('inspector'), { engine, store, onDelete: () => deleteSelection(), toast, pickTrack })

  /** Delete the selected block (a shot, or a scene with its shots). ⌘Z brings it back. */
  function deleteSelection() {
    const sel = store.selection
    if (!sel) return
    const T = store.timeline
    if (sel.kind === 'shot') {
      const sh = T.shot(sel.id)
      if (!sh) return
      if (store.isBound(sh.id)) return toast(`“${sh.name}” fa parte di “${sh.scene.label}”: seleziona la scena per eliminarla`)
      if (store.removeShot(sh.id)) toast(`Eliminato “${sh.name}” · ⌘Z per annullare`)
    } else {
      const sc = T.scene(sel.id)
      if (sc && store.removeScene(sc.id)) toast(`Eliminata la scena “${sc.label}” · ⌘Z per annullare`)
    }
  }

  // ------------------------------------------------------------ paste JSON
  const pasteDlg = h(
    'dialog',
    { class: 'dlg' },
    `<form method="dialog"><h3>Incolla un progetto</h3><p>Il JSON copiato da “Copia il progetto”. Viene applicato così com’è.</p>
     <textarea rows="10" spellcheck="false" aria-label="JSON del progetto"></textarea><div class="dlg__err" hidden></div>
     <div class="dlg__actions"><button type="submit" class="btn btn--ghost" value="cancel">Annulla</button><button type="button" class="btn btn--primary" data-apply>Applica</button></div></form>`,
  )
  document.body.appendChild(pasteDlg)
  top.querySelector('[data-paste]').addEventListener('click', () => {
    menu.hidePopover()
    pasteDlg.querySelector('textarea').value = ''
    pasteDlg.querySelector('.dlg__err').hidden = true
    pasteDlg.showModal()
  })
  pasteDlg.querySelector('[data-apply]').addEventListener('click', () => {
    const err = pasteDlg.querySelector('.dlg__err')
    try {
      const data = JSON.parse(pasteDlg.querySelector('textarea').value)
      if (!Array.isArray(data.scenes)) throw new Error('manca "scenes"')
      store.load(data)
      if (data.aspect && data.aspect !== engine.aspectKey) store.setAspect(data.aspect)
      pasteDlg.close()
      toast('Progetto applicato')
    } catch (e) {
      err.hidden = false
      err.textContent = 'JSON non valido: ' + e.message
    }
  })

  // ------------------------------------------------------------ export
  const exp = h(
    'dialog',
    { class: 'dlg dlg--export' },
    `<h3>Esporta MP4</h3>
     <div class="exp__opts">
       <div class="exp__row"><span>Formato</span><b data-fmt></b></div>
       <div class="exp__row"><span>Fotogrammi al secondo</span><div class="seg" data-fps><button type="button" data-v="30" class="is-on">30</button><button type="button" data-v="60">60</button></div></div>
       <div class="exp__row"><span>Qualità</span><div class="seg" data-ssaa><button type="button" data-v="1">Standard</button><button type="button" data-v="2" class="is-on">Alta · 2× supersampling</button></div></div>
       <div class="exp__row"><span>Bitrate</span><div class="exp__bit"><input type="range" min="8" max="40" step="1" value="20" data-bit aria-label="Bitrate" /><b data-bitv>20 Mbps</b></div></div>
     </div>
     <div class="exp__run" hidden>
       <canvas class="exp__thumb" data-thumb></canvas>
       <div class="exp__prog"><div class="exp__bar"><i data-bar></i></div><div class="exp__txt" data-txt></div></div>
     </div>
     <div class="exp__done" hidden data-done></div>
     <div class="dlg__actions">
       <button type="button" class="btn btn--ghost" data-close>Chiudi</button>
       <button type="button" class="btn btn--primary" data-go>${icon('export')}<span>Esporta</span></button>
     </div>`,
  )
  document.body.appendChild(exp)
  const pick = (root, sel) => {
    const g = exp.querySelector(sel)
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b) return
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b))
    })
    return () => Number(g.querySelector('.is-on').dataset.v)
  }
  const getFps = pick(exp, '[data-fps]')
  const getSsaa = pick(exp, '[data-ssaa]')
  const bit = exp.querySelector('[data-bit]')
  bit.addEventListener('input', () => (exp.querySelector('[data-bitv]').textContent = bit.value + ' Mbps'))
  let abort = null
  const goBtn = exp.querySelector('[data-go]')
  top.querySelector('[data-export]').addEventListener('click', () => {
    const A = ASPECTS[engine.aspectKey]
    exp.querySelector('[data-fmt]').textContent = `${engine.aspectKey} · ${A.w} × ${A.h} · ${store.timeline.duration.toFixed(2).replace('.', ',')} s${audio ? ' · con l’audio' : ''}`
    exp.querySelector('.exp__opts').hidden = false
    exp.querySelector('.exp__run').hidden = true
    exp.querySelector('[data-done]').hidden = true
    goBtn.hidden = false
    exp.showModal()
  })
  exp.querySelector('[data-close]').addEventListener('click', () => {
    abort?.abort()
    exp.close()
  })
  exp.addEventListener('cancel', () => abort?.abort())
  goBtn.addEventListener('click', async () => {
    abort = new AbortController()
    exp.querySelector('.exp__opts').hidden = true
    exp.querySelector('.exp__run').hidden = false
    exp.querySelector('[data-done]').hidden = true
    goBtn.hidden = true
    const bar = exp.querySelector('[data-bar]')
    const txt = exp.querySelector('[data-txt]')
    const thumb = exp.querySelector('[data-thumb]')
    const a = engine.view.aspect
    thumb.height = 200
    thumb.width = Math.round(200 * a)
    const tg = thumb.getContext('2d')
    try {
      const res = await exportVideo(engine, {
        fps: getFps(),
        ssaa: getSsaa(),
        bitrate: Number(bit.value),
        signal: abort.signal,
        onProgress: ({ done, total, canvas: c, elapsed }) => {
          bar.style.width = (done / total) * 100 + '%'
          const left = (elapsed / done) * (total - done)
          txt.textContent = `Fotogramma ${done} / ${total} · ancora ${Math.ceil(left)} s`
          if (done % 6 === 0 || done === total) tg.drawImage(c, 0, 0, thumb.width, thumb.height)
        },
      })
      download(res.url, res.name)
      const done = exp.querySelector('[data-done]')
      done.hidden = false
      done.innerHTML = `${icon('check')}<div><b>${res.name}</b><span>${res.W} × ${res.H} · ${res.fps} fps · ${res.frames} fotogrammi · ${(res.blob.size / 1e6).toFixed(1)} MB · ${res.seconds.toFixed(0)} s${res.saved ? '<br>Copia salvata in <code>exports/</code>' : ''}</span></div>`
      txt.textContent = 'Fatto.'
    } catch (e) {
      txt.textContent = e.name === 'AbortError' ? 'Export annullato.' : 'Errore: ' + e.message
      goBtn.hidden = false
      exp.querySelector('.exp__opts').hidden = false
    } finally {
      abort = null
      fitStage()
    }
  })

  // ------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    const el = e.target
    const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
    const mod = e.metaKey || e.ctrlKey
    // ⌘Z / ⇧⌘Z (and ⌘Y): the film's history; inside a text field they stay the field's own
    if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && !(typing && (el.type === 'text' || el.tagName === 'TEXTAREA'))) {
      e.preventDefault()
      e.shiftKey || e.key.toLowerCase() === 'y' ? store.redo() : store.undo()
      return
    }
    if (typing) {
      if (e.key === 'Escape' || e.key === 'Enter') el.blur()
      if (!(el.type === 'range' && e.key === ' ')) return
    }
    if (document.querySelector('dialog[open]') || mod) return
    const f = 1 / store.project.fps
    switch (e.key) {
      case ' ':
        e.preventDefault()
        engine.toggle()
        break
      case 'ArrowLeft':
        e.preventDefault()
        engine.pause()
        engine.seek(engine.time - (e.shiftKey ? 1 : f))
        break
      case 'ArrowRight':
        e.preventDefault()
        engine.pause()
        engine.seek(engine.time + (e.shiftKey ? 1 : f))
        break
      case 'ArrowUp':
        e.preventDefault()
        jump(-1)
        break
      case 'ArrowDown':
        e.preventDefault()
        jump(1)
        break
      case 'Home':
        engine.seek(0)
        break
      case 'End':
        engine.seek(engine.duration)
        break
      case 'Escape':
        store.select(null)
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        deleteSelection()
        break
      case 'l':
      case 'L':
        loopBtn.click()
        break
      case 'm':
      case 'M':
        if (audio) audio.setMuted(!audio.muted)
        break
      case 's':
      case 'S':
        timeline.toggleSnap()
        break
      case 'f':
      case 'F':
        timeline.fitZoom()
        break
      case '+':
      case '=':
        timeline.zoom(1.35)
        break
      case '-':
        timeline.zoom(1 / 1.35)
        break
      default: {
        // 1 / 2: the two intros · ⇧1-4: the formats
        const d = /^Digit([1-4])$/.exec(e.code)
        if (!d) break
        const n = Number(d[1])
        if (e.shiftKey) store.setAspect(Object.keys(ASPECTS)[n - 1])
        else if (n <= 2) setIntro(n === 1 ? 'A' : 'B')
      }
    }
  })

  syncTop()
  syncTime()
  syncPlay()
  totalEl.textContent = '/ ' + fmtTime(store.timeline.duration)
  fitStage()
  void clamp
}
