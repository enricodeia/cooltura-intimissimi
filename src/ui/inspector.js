// The panel on the right: the selected block, its timing, and every parameter it has, under three small
// headings in the order you read a block: Contenuti (WHAT it shows: texts, videos, how many), Motion (HOW it
// moves: entrances, exits, timing, eases, camera), Aspetto e posizione (how it LOOKS and where it sits: type,
// colours, sizes, layout). Under each heading every effect is a folder, closed by default: one row with its
// icon, its name, a one-line summary of its key values, a rose dot when something differs from the start and
// its switch. A click opens it (remembered per block type in this browser); a search at the top finds a
// control by its label and opens its folder. With nothing selected: the music and the voices (V4), the look
// of the whole film, the keys.
// Controls are the Cooltura site's (the glass panel): ruler sliders on a tray with a dot on the default,
// double-click to go back to it; sliding segments; switches; swatches.

import { icon, h, esc } from './icons.js'
import { effectsOf, sceneEffects, defaultProject, SHOT_TYPES, SCENE_TYPES, PALETTE, SWATCHES, MIN_DUR, LOOK, EDITION } from '../model/project.js'
import { EASES, ease, CUSTOM_EASES, bezierOf } from '../core/util.js'
import {
  MEDIA, loadCatalog, entryOf, personOf, keyOfOne, createLibrary, listControl, oneControl, phraseControl, phraseSpecs, speakerClip, firstPhrase,
  phraseWrites, stopListening, listSummary, oneSummary, phraseSummary,
} from './media.js'

// the beat tracker (optional: the panel snaps the cut itself when it is not there)
const BEATS = import.meta.glob('../engine/beats.js')

const SWATCH_LABEL = { lime: 'Lime', lavender: 'Lavanda', violet: 'Viola', orange: 'Arancio', white: 'Bianco', paper: 'Carta', ink: PALETTE.wine ? 'Prugna' : 'Nero', mute: 'Grigio', hair: 'Grigio chiaro', wine: 'Vino', rose: 'Rosa', blush: 'Cipria', nude: 'Nude', lilac: 'Lilla' }
const INK = '#efe9ea' // the panel's ink: the ease curves are drawn on its dark trays
const MINUS = '−'

const easeLabel = (n) => (CUSTOM_EASES[n] ? `${CUSTOM_EASES[n].label}` : n)

// ------------------------------------------------------------------ the sound, as the UI names it (shared with the timeline and the top bar)

/** Who speaks in a V4 clip ('v4/hero-chiara.mp4' → 'Chiara Chelo'): the catalog's name, else these, else the file's. */
const SPEAKERS = { 'open-sara': 'Sara Tibo', 'hero-alice': 'Alice Muzza', 'hero-chiara': 'Chiara Chelo', 'comm-corinne': 'Corinne Pino', 'venice-chiara': 'Chiara Chelo', 'venice-duo': 'Chiara Chelo', 'venice-walk': 'tre amiche', 'venice-gemels': 'Le Gemels', 'venice-cuccuru': 'Francesca Cuccuru', 'venice-dance': 'la festa', 'venice-rebecca': 'Rebecca Maurino' }
export function speakerOf(key) {
  if (entryOf(String(key || ''))?.name) return personOf(String(key))
  const slug = String(key || '')
    .replace(/^.*\//, '')
    .replace(/\.\w+$/, '')
  if (SPEAKERS[slug]) return SPEAKERS[slug]
  const name = slug
    .replace(/^(open|hero|comm|venice|aria|ext|nude|ul)-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return name || 'voce'
}

/** What plays: the original score or a song from disk, its tempo and how sure the tempo is. */
export function trackOf(audio) {
  if (!audio) return null
  const g = audio.grid()
  const c = audio.custom
  return {
    song: !!c,
    name: c ? String(c.name || 'Brano').replace(/\.[a-z0-9]{2,5}$/i, '') : 'Colonna originale',
    bpm: g ? Math.round(g.bpm) : null,
    sure: g ? (g.confidence ?? 1) >= 0.4 : false,
    grid: g,
    length: c ? (c.duration ?? c.buffer?.duration ?? null) : null,
  }
}

/** The sound's state for the UI, through fn(what): 'busy' only when a render lasts (the quick re-mix after an edit does not flash). */
export function watchAudio(audio, fn) {
  let busy = false
  let timer = 0
  audio.on((what) => {
    if (what === 'status') {
      clearTimeout(timer)
      if (audio.status === 'rendering') timer = setTimeout(() => ((busy = true), fn('busy')), 450)
      else if (busy) {
        busy = false
        fn('busy')
      }
    }
    fn(what)
  })
  return () => busy || (audio.status === 'rendering' && !audio.mix)
}

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ------------------------------------------------------------------ numbers the Italian way (comma, true minus)

const parseNum = (s) => Number(String(s).trim().replace(/−/g, '-').replace(',', '.'))
function fmtNum(v, dg, trim = false) {
  if (!Number.isFinite(v)) return ''
  let s = Math.abs(v).toFixed(dg)
  if (trim && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return (v < 0 && Number(s) !== 0 ? MINUS : '') + s.replace('.', ',')
}
const digits = (step) => {
  const s = Number(step) || 0.01
  return s >= 1 ? 0 : s >= 0.1 ? 1 : s >= 0.01 ? 2 : 3
}

// ------------------------------------------------------------------ what a parameter is about

const CATS = [
  { id: 'content', label: 'Contenuti', icon: 'cat-content' },
  { id: 'motion', label: 'Motion', icon: 'cat-motion' },
  { id: 'look', label: 'Aspetto e posizione', icon: 'cat-look' },
]
const CONTENT_KEYS = new Set(['count', 'extra', 'labelOn'])
const LOOK_KEYS = new Set([
  'scale', 'intiWidth', 'frameOn', 'xSize', 'xWeight', 'gap', 'floor', 'hookR', 'caps', 'weight', 'size', 'tracking', 'leading', 'align',
  'measure', 'x', 'y', 'mode', 'cardH', 'radius', 'spacing', 'lean', 'centerY', 'corner', 'tilt', 'phoneH', 'restTop', 'finish', 'style',
  'under', 'margin', 'rowSpread', 'rowFill', 'gutter', 'rowGap', 'rows', 'heroH', 'frameGap', 'width', 'branch', 'colGap', 'labelCaps',
  'numberSide', 'grain', 'vignette', 'plainZero', 'lineColor', 'lineWidth', 'penColor', 'penSize', 'motionBlur',
])
const LOOK_RE = /(Size|Weight|Tracking|Leading|Measure|Color|Caps|Pos|Side|Width|Corner|Radius|Gap)$/
/** A spec's own `cat` ('content' | 'motion' | 'look') wins; else the heuristic. */
function catOf(p) {
  if (p.cat === 'content' || p.cat === 'motion' || p.cat === 'look') return p.cat
  if (p.t === 'text' || p.t === 'videos' || CONTENT_KEYS.has(p.k)) return 'content'
  if (p.t === 'color' || LOOK_KEYS.has(p.k) || LOOK_RE.test(p.k)) return 'look'
  return 'motion'
}

// ------------------------------------------------------------------ the summary of a closed folder

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
const LEAD = /^(il|la|lo|le|i|gli|l'|un|una|da|verso|posizione)\s+/i
const SOFT = new Set(['del', 'della', 'dello', 'dei', 'delle', 'di', 'da', 'dal', 'dalla', 'a', 'al', 'alla', 'in', 'per', 'con', 'tra', 'su', 'sul', 'sulla', 'lettere', 'iniziale', 'finale'])
/** 'Corpo (altezza maiuscole, % del lato corto)' → 'Corpo', 'Posizione Y (…)' → 'Y', 'Spaziatura lettere (em)' → 'Spaziatura'. */
function shortLabel(label) {
  const s = String(label)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/:\s*/g, ' ')
    .replace(/’/g, "'")
    .trim()
    .replace(LEAD, '')
  const w = s.split(/\s+/)
  let out = w[0] || ''
  if (w[1] && !SOFT.has(w[1].toLowerCase()) && w[1].length <= 12) out += ' ' + w[1]
  return out.charAt(0).toUpperCase() + out.slice(1)
}
const UNIT = { '%': ' %', s: ' s', '°': '°', dB: ' dB' }
const IMPORTANCE = [
  [/^(size|bigSize)$|Size$/, 9],
  [/Split$/, 9],
  [/^tracking$|Tracking$/, 8],
  [/Dur$/, 8],
  [/Ease$/, 7],
  [/^y$|Y$/, 7],
  [/Stagger$/, 6],
  [/^weight$|Weight$/, 5],
  [/^x$|X$/, 5],
  [/At$/, 5],
]
function weightOf(p) {
  for (const [re, w] of IMPORTANCE) if (re.test(p.k)) return w
  return p.t === 'ease' ? 6 : p.t === 'select' ? 4 : p.t === 'num' ? 3 : p.t === 'color' ? 1 : 0
}
const oneLine = (v) =>
  String(v ?? '')
    .trim()
    .replace(/\s*\n\s*/g, ' / ')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function valueText(p, v) {
  if (p.t === 'num') return `${shortLabel(p.label)} ${fmtNum(Number(v), digits(p.step), true)}${p.unit ? (UNIT[p.unit] ?? ' ' + p.unit) : ''}`
  if (p.t === 'select') {
    const o = p.opts.find(([k]) => String(k) === String(v))
    return o ? String(o[1]).split(/[:(]/)[0].replace(/^(Montserrat|Neue Machina)\s+/, '').trim() : String(v)
  }
  if (p.t === 'ease') {
    const s = String(v)
    return CUSTOM_EASES[s] ? CUSTOM_EASES[s].label.split(' · ')[0] : s.startsWith('cubic(') ? 'Curva su misura' : s
  }
  if (p.t === 'color') return SWATCH_LABEL[v] || (String(v).startsWith('#') ? 'Colore libero' : String(v))
  if (p.t === 'bool') return `${shortLabel(p.label)} ${v ? 'sì' : 'no'}`
  return ''
}
/**
 * The sentence of a voice folder ("Frase: «…» 3,7 s"), else the texts of a folder, else its videos ("5 video ·
 * parla Chiara Chelo") and its key values (what differs from the start first). media: { videos, specOf }.
 */
function summaryOf(params, P, defs, media = null) {
  const phr = media && params.find((p) => p.t === 'phrase')
  const said = phr ? phraseSummary(phr, P, media.videos, media.specOf) : ''
  if (said) return said
  const texts = params.filter((p) => p.t === 'text').map((p) => oneLine(P[p.k])).filter(Boolean)
  if (texts.length) return texts.join(' · ')
  const parts = []
  const vids = params.filter((p) => p.t === 'videos' || p.t === 'video')
  for (const p of vids)
    parts.push(!media ? `${(P[p.k] || []).length} video` : p.t === 'video' ? oneSummary(p, P, media.videos) : listSummary(p, P, media.videos))
  // the position of the one who speaks is said by the list ("parla …"), not as a number
  const talk = new Set(vids.map((p) => (typeof p.talk === 'string' ? p.talk : null)).filter(Boolean))
  const pool = params.filter((p) => !MEDIA.has(p.t) && p.t !== 'text' && !talk.has(p.k) && (p.t !== 'bool' || !same(P[p.k], defs[p.k])))
  // the best ranked first, each text once (two eases "Curva su misura" say it once), then in reading order
  const seen = new Set()
  pool
    .map((p, i) => ({ p, i, s: (same(P[p.k], defs[p.k]) ? 0 : 100) + weightOf(p) - i * 0.001, t: valueText(p, P[p.k]) }))
    .sort((a, b) => b.s - a.s)
    .filter((x) => x.t && !seen.has(x.t) && seen.add(x.t))
    .slice(0, vids.length ? 2 : 3)
    .sort((a, b) => a.i - b.i)
    .forEach((x) => parts.push(x.t))
  // a folder of switches only: their state
  if (!parts.length)
    params
      .filter((p) => p.t === 'bool')
      .slice(0, 3)
      .forEach((p) => parts.push(valueText(p, P[p.k])))
  return parts.filter(Boolean).join(' · ')
}

// ------------------------------------------------------------------ folders: open or closed, remembered in this browser

const FOLD_KEY = 'cooltura-intimissimi.ui.folders'
const folds = (() => {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}') || {}
  } catch {
    return {}
  }
})()
function remember(key, open) {
  if (open) folds[key] = 1
  else delete folds[key]
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify(folds))
  } catch {}
}
let uid = 0

// ------------------------------------------------------------------ the cut on the beat

/** The same contract as engine/beats.js snapCuts: each time to the nearest beat (a bar where bars[i]), in order, `min` apart. */
function snapCutsHere(times, grid, { bars = [], min = 0.25 } = {}) {
  const beat = grid.beat
  const b0 = grid.beat0 || 0
  const dk = Math.round(((grid.downbeat0 ?? b0) - b0) / beat)
  const T = (k) => b0 + k * beat
  const out = []
  let prev = -Infinity
  let prevK = -Infinity
  times.forEach((t, i) => {
    const lo = Math.max(prevK + 1, Math.ceil((prev + min - b0) / beat - 1e-9), 0)
    let k = -1
    if (bars[i]) {
      const m = Math.round((t - T(dk)) / (4 * beat))
      for (const mm of [m, m + 1, m - 1]) {
        const kk = dk + 4 * mm
        if (kk >= lo && Math.abs(T(kk) - t) < 2 * beat && (k < 0 || Math.abs(T(kk) - t) < Math.abs(T(k) - t))) k = kk
      }
    }
    if (k < 0) k = Math.max(lo, Math.round((t - b0) / beat))
    prev = T(k)
    prevK = k
    out.push(Math.round(prev * 1e6) / 1e6)
  })
  return out
}
const validCuts = (out, n, min) => Array.isArray(out) && out.length === n && out.every(Number.isFinite) && out.every((t, i) => i < 2 || t - out[i - 1] >= min - 1e-6) && out[1] >= min - 1e-6

// ------------------------------------------------------------------ the bezier editor under an ease

function bezierEditor(get, set, begin, commit) {
  const NS = 'http://www.w3.org/2000/svg'
  const box = h('div', { class: 'bez' })
  const W = 200
  const Hh = 230
  const pad = 22
  const sx = (x) => pad + x * (W - pad * 2)
  const sy = (y) => Hh - pad - 22 - y * (Hh - pad * 2 - 44)
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`)
  svg.setAttribute('class', 'bez__svg')
  svg.innerHTML = `<rect class="grid" x="${sx(0)}" y="${sy(1)}" width="${sx(1) - sx(0)}" height="${sy(0) - sy(1)}" rx="6"/>
    <line class="axis" x1="${sx(0)}" y1="${sy(0.5)}" x2="${sx(1)}" y2="${sy(0.5)}"/>
    <line class="arm" data-a="1"/><line class="arm" data-a="2"/>
    <path class="curve"/>
    <circle class="knob" data-k="1" r="7"/><circle class="knob" data-k="2" r="7"/>`
  const row = h('div', { class: 'bez__row' }, '<span>cubic-bezier</span><code></code>')
  const presets = h('div', { class: 'bez__presets' })
  for (const [name, e] of Object.entries(CUSTOM_EASES)) {
    const b = h('button', { type: 'button', title: e.label }, name.replace('ci.', ''))
    b.addEventListener('click', () => set(name))
    presets.appendChild(b)
  }
  box.append(svg, row, presets)
  let v = [0.16, 1, 0.3, 1]
  const draw = () => {
    const [x1, y1, x2, y2] = v
    svg.querySelector('.curve').setAttribute('d', `M${sx(0)},${sy(0)} C${sx(x1)},${sy(y1)} ${sx(x2)},${sy(y2)} ${sx(1)},${sy(1)}`)
    const a1 = svg.querySelector('[data-a="1"]')
    const a2 = svg.querySelector('[data-a="2"]')
    a1.setAttribute('x1', sx(0)); a1.setAttribute('y1', sy(0)); a1.setAttribute('x2', sx(x1)); a1.setAttribute('y2', sy(y1))
    a2.setAttribute('x1', sx(1)); a2.setAttribute('y1', sy(1)); a2.setAttribute('x2', sx(x2)); a2.setAttribute('y2', sy(y2))
    svg.querySelector('[data-k="1"]').setAttribute('cx', sx(x1)); svg.querySelector('[data-k="1"]').setAttribute('cy', sy(y1))
    svg.querySelector('[data-k="2"]').setAttribute('cx', sx(x2)); svg.querySelector('[data-k="2"]').setAttribute('cy', sy(y2))
    row.querySelector('code').textContent = v.map((n) => Math.round(n * 100) / 100).join(', ')
  }
  const r2 = (n) => Math.round(n * 1000) / 1000
  svg.addEventListener('pointerdown', (e) => {
    const k = e.target.dataset?.k
    if (!k) return
    e.preventDefault()
    svg.setPointerCapture(e.pointerId)
    begin()
    const move = (ev) => {
      const r = svg.getBoundingClientRect()
      const px = ((ev.clientX - r.left) / r.width) * W
      const py = ((ev.clientY - r.top) / r.height) * Hh
      const x = Math.min(1, Math.max(0, (px - pad) / (W - pad * 2)))
      const y = Math.min(1.6, Math.max(-0.6, (Hh - pad - 22 - py) / (Hh - pad * 2 - 44)))
      if (k === '1') v = [r2(x), r2(y), v[2], v[3]]
      else v = [v[0], v[1], r2(x), r2(y)]
      draw()
      set(`cubic(${v.join(',')})`)
    }
    const up = () => {
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
      svg.removeEventListener('pointercancel', up)
      commit()
    }
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
    svg.addEventListener('pointercancel', up)
  })
  box._sync = () => {
    const b = bezierOf(get())
    if (b) v = [...b]
    draw()
  }
  return box
}

// ------------------------------------------------------------------ the panel

export function mountInspector(el, { engine, store, onDelete, toast = () => {}, pickTrack = () => {} }) {
  let drawn = '' // what is on screen (selection + structure): edits only refresh values
  let syncers = []
  let query = '' // the search: kept from one block to the next
  let tools = null // the search row of the block on screen
  let musicSync = null // the music panel, when it is on screen
  const audio = engine.audio
  const audioBusy = audio ? watchAudio(audio, () => musicSync?.()) : () => false

  // ---------------- the videos: one library for the panel, the catalog (names, posters, sentences)
  let lib = null
  const library = () => (lib ||= createLibrary(engine.videos))
  loadCatalog(engine.videos.base).then(() => sync())
  // the film plays: the sentence being listened to stops
  engine.on?.((what) => what === 'play' && engine.playing && stopListening())

  /** A block's effects as the video controls need them: which spec a key is, which param holds who speaks. */
  function blockOf(kind, id, fxs, getP, defs) {
    const all = fxs.flatMap((f) => f.params)
    return {
      kind,
      id,
      fxs,
      getP,
      defs,
      specOf: (k) => all.find((p) => p.k === k),
      talk: new Set(all.filter((p) => p.t === 'videos' && typeof p.talk === 'string').map((p) => p.talk)),
    }
  }
  /**
   * One undo step for an edit of a block's videos, and the voice follows: every sentence picker ('phrase')
   * whose clip now is another one gets that clip's first sentence (a clip without sentences: left as it is).
   */
  function withFollow(block, fn) {
    const specs = phraseSpecs(block.fxs)
    const speaking = () => specs.map((s) => speakerClip(s, block.getP(), block.specOf, engine.videos).key)
    const before = speaking()
    store.begin()
    try {
      fn()
      const after = speaking()
      specs.forEach((s, i) => {
        if (!after[i] || after[i] === before[i]) return
        const ph = firstPhrase(s, after[i])
        if (ph) {
          for (const [k, v] of Object.entries(phraseWrites(s, ph))) store.setParam(block.kind, block.id, k, v)
          // it was silent because the clip before had no sentence of its own: it speaks again
          if (s.keys?.on && before[i] && !firstPhrase(s, before[i])) store.setParam(block.kind, block.id, s.keys.on, true)
        } else if (s.keys?.on && block.getP()[s.keys.on]) {
          // a clip with no sentence of its own: silent (never the window of another creator's sentence on her)
          store.setParam(block.kind, block.id, s.keys.on, false)
        }
      })
    } finally {
      store.commit()
    }
  }

  function curve(canvas, name) {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = 56
    const H = 32
    canvas.width = W * dpr
    canvas.height = H * dpr
    const g = canvas.getContext('2d')
    g.scale(dpr, dpr)
    g.clearRect(0, 0, W, H)
    const f = ease(name)
    const pad = 6
    const y = (v) => H - pad - 2 - v * (H - pad * 2 - 4)
    g.strokeStyle = 'rgba(239,233,234,0.12)'
    g.beginPath()
    g.moveTo(pad, y(0))
    g.lineTo(W - pad, y(0))
    g.moveTo(pad, y(1))
    g.lineTo(W - pad, y(1))
    g.stroke()
    g.strokeStyle = INK
    g.lineWidth = 1.5
    g.lineCap = 'round'
    g.beginPath()
    for (let i = 0; i <= 40; i++) {
      const x = i / 40
      const px = pad + x * (W - pad * 2)
      const py = y(f(x))
      i ? g.lineTo(px, py) : g.moveTo(px, py)
    }
    g.stroke()
  }

  /** One parameter. `def()` is its starting value (the dot on the ruler, double-click, ↺). `block`: blockOf(…), for the videos. */
  function control(spec, kind, id, get, def, block = null) {
    const row = h('div', { class: 'ctl ctl--' + spec.t, 'data-k': spec.k })
    row._label = spec.label
    const set = (v) => store.setParam(kind, id, spec.k, v)
    let reset = () => {
      const d = def()
      if (d !== undefined && !same(get(), d)) set(typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : d)
    }
    let changedOf = null // a control that knows better than "value ≠ start" (the videos)
    const top = h('div', { class: 'ctl__top' })
    const lab = h('span', { class: 'ctl__label' }, esc(spec.label))
    const back = h('button', { type: 'button', class: 'ctl__back', title: 'Torna al valore iniziale (o doppio clic sul controllo)', 'aria-label': 'Torna al valore iniziale' }, icon('undo'))
    back.addEventListener('click', () => reset())
    top.append(lab)
    row.appendChild(top)
    let syncVal = () => {}

    if (spec.t === 'num') {
      const dg = digits(spec.step)
      const val = h('input', { class: 'ctl__val', type: 'text', inputmode: 'decimal', spellcheck: 'false', 'aria-label': spec.label })
      const unit = h('span', { class: 'ctl__unit' }, esc(spec.unit || ''))
      top.append(back, val, unit)
      const ruler = h('label', { class: 'ruler' })
      const range = h('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, 'aria-label': spec.label })
      ruler.append(range, h('span', { class: 'ruler__thumb' }), h('i', { class: 'ruler__dot' }))
      row.appendChild(ruler)
      range.addEventListener('pointerdown', () => store.begin())
      range.addEventListener('input', () => set(Number(range.value)))
      range.addEventListener('change', () => store.commit())
      ruler.addEventListener('dblclick', (e) => {
        e.preventDefault()
        store.commit()
        reset()
      })
      val.addEventListener('focus', () => val.select())
      val.addEventListener('change', () => {
        const v = Math.min(spec.max, Math.max(spec.min, parseNum(val.value)))
        if (Number.isFinite(v)) set(v)
        else syncVal()
      })
      const pOf = (v) => Math.min(1, Math.max(0, (v - spec.min) / (spec.max - spec.min)))
      syncVal = () => {
        const v = Number(get())
        if (document.activeElement !== val) val.value = Number.isFinite(v) ? fmtNum(v, dg) : ''
        if (document.activeElement !== range) range.value = String(v)
        ruler.style.setProperty('--p', pOf(v))
        const d = def()
        ruler.style.setProperty('--d', pOf(Number.isFinite(Number(d)) ? Number(d) : v))
      }
    } else if (spec.t === 'bool') {
      row.classList.add('ctl--inline')
      const sw = h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-label': spec.label }, '<i></i>')
      sw.addEventListener('click', () => set(!get()))
      top.append(back, sw)
      syncVal = () => {
        sw.classList.toggle('is-on', !!get())
        sw.setAttribute('aria-checked', String(!!get()))
      }
    } else if (spec.t === 'color') {
      top.append(back)
      const wrap = h('div', { class: 'ctl__swatches' })
      const btns = SWATCHES.map((k) => {
        const b = h('button', { class: 'swatch', type: 'button', title: SWATCH_LABEL[k] || k, 'aria-label': SWATCH_LABEL[k] || k, style: `--c:${PALETTE[k]}` })
        b.addEventListener('click', () => set(k))
        wrap.appendChild(b)
        return [k, b]
      })
      const custom = h('input', { type: 'color', class: 'swatch swatch--custom', title: 'Colore libero', 'aria-label': spec.label + ' libero' })
      custom.addEventListener('pointerdown', () => store.begin())
      custom.addEventListener('input', () => set(custom.value))
      custom.addEventListener('change', () => store.commit())
      wrap.appendChild(custom)
      row.appendChild(wrap)
      syncVal = () => {
        const v = get()
        btns.forEach(([k, b]) => b.classList.toggle('is-on', k === v))
        const isHex = String(v).startsWith('#')
        custom.classList.toggle('is-on', isHex)
        custom.value = isHex ? v : PALETTE[v] || '#ffffff'
      }
    } else if (spec.t === 'select') {
      top.append(back)
      if (spec.opts.length <= 4) {
        const seg = h('div', { class: 'seg', style: `--n:${spec.opts.length}` })
        const btns = spec.opts.map(([v, label], i) => {
          const b = h('button', { type: 'button', title: label }, `<span>${esc(label)}</span>`)
          b.addEventListener('click', () => set(v))
          seg.appendChild(b)
          return [v, b, i]
        })
        row.appendChild(seg)
        syncVal = () => {
          let on = -1
          btns.forEach(([v, b, i]) => {
            const is = String(v) === String(get())
            b.classList.toggle('is-on', is)
            if (is) on = i
          })
          seg.style.setProperty('--i', Math.max(0, on))
          seg.classList.toggle('is-none', on < 0)
        }
      } else {
        const wrap = h('div', { class: 'pick' })
        const sel = h('select', { 'aria-label': spec.label })
        spec.opts.forEach(([v, label]) => sel.appendChild(h('option', { value: v }, esc(label))))
        sel.addEventListener('change', () => set(sel.value))
        wrap.append(sel, h('span', { class: 'pick__chev' }, icon('chevron')))
        row.appendChild(wrap)
        syncVal = () => (sel.value = String(get()))
      }
    } else if (spec.t === 'ease') {
      top.append(back)
      const wrap = h('div', { class: 'ctl__ease' })
      const cv = h('canvas', { class: 'ctl__curve' })
      const pick = h('div', { class: 'pick' })
      const sel = h('select', { 'aria-label': spec.label })
      EASES.forEach((n) => sel.appendChild(h('option', { value: n }, esc(easeLabel(n)))))
      sel.appendChild(h('option', { value: '__cubic' }, 'cubic-bezier…'))
      pick.append(sel, h('span', { class: 'pick__chev' }, icon('chevron')))
      const cubic = h('input', { type: 'text', class: 'ctl__cubic', placeholder: '0.34, 1.56, 0.64, 1', 'aria-label': 'cubic-bezier' })
      sel.addEventListener('change', () => {
        if (sel.value === '__cubic') {
          cubic.hidden = false
          cubic.focus()
          set('cubic(0.34,1.56,0.64,1)')
        } else set(sel.value)
      })
      cubic.addEventListener('change', () => {
        const v = cubic.value.split(',').map((x) => Number(x.trim()))
        if (v.length === 4 && v.every(Number.isFinite)) set(`cubic(${v.join(',')})`)
      })
      wrap.append(cv, pick)
      const bez = bezierEditor(get, set, () => store.begin(), () => store.commit())
      bez.hidden = true
      cv.title = 'Modifica la curva (cubic-bezier · GSAP CustomEase)'
      cv.addEventListener('click', () => {
        bez.hidden = !bez.hidden
        if (!bez.hidden && !bezierOf(get())) set(`cubic(${bezierOf('ci.reveal').join(',')})`)
        bez._sync()
      })
      row.append(wrap, cubic, bez)
      syncVal = () => {
        const v = String(get())
        const isCubic = v.startsWith('cubic(')
        if (!isCubic && ![...sel.options].some((o) => o.value === v)) sel.insertBefore(h('option', { value: v }, esc(v)), sel.lastChild)
        sel.value = isCubic ? '__cubic' : v
        cubic.hidden = !isCubic
        if (isCubic && document.activeElement !== cubic) cubic.value = v.slice(6, -1).split(',').join(', ')
        // the thumbnail only when the curve changed (a slider drag syncs every control)
        if (cv._v !== v) {
          curve(cv, v)
          cv._v = v
        }
        if (!bez.hidden) bez._sync()
      }
    } else if (MEDIA.has(spec.t)) {
      // the videos (media.js): a list as posters, one video as a poster, the sentences of the one who speaks
      block ||= blockOf(kind, id, [], () => ({}), {})
      const ctx = {
        videos: engine.videos,
        lib: library(),
        get,
        P: block.getP,
        specOf: block.specOf,
        // one undo step, and the voice follows the clip that speaks
        apply: (changes) =>
          withFollow(block, () => {
            for (const [k, v] of Object.entries(changes)) store.setParam(kind, id, k, v)
          }),
        pause: () => engine.pause(),
        // V4: does the sentence fit its clip and its block? (the fix lengthens the block, one undo step)
        status: spec.t === 'phrase' && engine.voiceStatus ? () => engine.voiceStatus(id, spec.keys) : null,
        fix: (f) => {
          store.begin()
          try {
            store.setDur(id, f.dur)
          } finally {
            store.commit()
          }
        },
      }
      const m = spec.t === 'phrase' ? phraseControl(spec, ctx) : spec.t === 'video' ? oneControl(spec, ctx) : listControl(spec, ctx)
      if (m.meta) top.append(m.meta)
      row.appendChild(m.el)
      syncVal = m.sync
      if (spec.t === 'phrase') changedOf = () => false // virtual: its values are the voice's own controls
      else {
        top.append(back)
        // the list's protagonist ('hero') has no row of its own: it goes back with the list
        const talk = spec.t === 'videos' && typeof spec.talk === 'string' ? spec.talk : null
        reset = () =>
          withFollow(block, () => {
            const d = def()
            if (d !== undefined && !same(get(), d)) set(JSON.parse(JSON.stringify(d)))
            if (talk && block.defs[talk] !== undefined && !same(block.getP()[talk], block.defs[talk])) store.setParam(kind, id, talk, block.defs[talk])
          })
        if (talk) changedOf = () => !same(get(), def()) || !same(block.getP()[talk], block.defs[talk])
        // 'v4/hero-alice' and 'v4/hero-alice.mp4' (an older save) are the same video
        if (spec.t === 'video') changedOf = () => keyOfOne(engine.videos, get() || spec.d) !== keyOfOne(engine.videos, def() || spec.d)
      }
    } else {
      top.append(back)
      const long = spec.k === 'text' || spec.k === 'big' || spec.k === 'lead' || spec.k === 'words' || spec.k === 'voiceText'
      const box = long ? h('textarea', { rows: 2, 'aria-label': spec.label, spellcheck: 'false' }) : h('input', { type: 'text', 'aria-label': spec.label, spellcheck: 'false' })
      // a text area as tall as its lines (2 to 8): no copy hidden under a scroll
      const fit = () => long && (box.rows = Math.min(8, Math.max(2, box.value.split('\n').length)))
      box.addEventListener('focus', () => store.begin())
      box.addEventListener('input', () => {
        set(box.value)
        fit()
      })
      box.addEventListener('blur', () => store.commit())
      row.appendChild(box)
      syncVal = () => {
        if (document.activeElement !== box) box.value = String(get() ?? '')
        fit()
      }
    }
    // (not on the videos: a double click on a poster is two clicks on it, never a reset of the list)
    if (spec.t !== 'num' && !MEDIA.has(spec.t))
      row.addEventListener('dblclick', (e) => {
        if (e.target.closest('input, textarea, select, .bez')) return
        reset()
      })
    row._sync = () => {
      syncVal()
      const d = def()
      row.classList.toggle('is-changed', changedOf ? changedOf() : d !== undefined && !same(get(), d))
    }
    return row
  }

  /**
   * One effect (its parameters of one heading) as a folder: a row with its icon, name, summary, a dot when
   * changed, its switch, a chevron; the controls under it. Closed by default; `scope` keys what this
   * browser remembers (block type + heading); `label` replaces the effect's name; `block` (blockOf): the
   * videos' context (the protagonist's number has no row: the list's microphones set it).
   */
  function folder(fx, params, kind, id, getP, defs, scope, label = fx.label, block = null) {
    const key = `${EDITION.id}:${scope}:${fx.id}`
    let open = !!folds[key]
    let temp = false // opened by the search, or by focus reaching inside: not remembered
    const bodyId = `fx-body-${++uid}`
    const sec = h('section', { class: 'fx', 'data-fx': fx.id })
    const head = h('div', { class: 'fx__head' })
    const toggle = h(
      'button',
      { type: 'button', class: 'fx__toggle', 'aria-expanded': 'false', 'aria-controls': bodyId },
      `<span class="fx__icon">${icon(fx.icon || 'sliders', 'fx__ico')}</span><span class="fx__title"><span class="fx__name">${esc(label)}</span><span class="fx__sum"></span></span>`,
    )
    const sum = toggle.querySelector('.fx__sum')
    const reset = h('button', { type: 'button', class: 'fx__reset', title: 'Modificato · clic per riportare il gruppo ai valori iniziali', 'aria-label': `Riporta “${label}” ai valori iniziali` }, `<i></i>${icon('undo')}`)
    reset.addEventListener('click', () => {
      // (a sentence picker is virtual: its key is never written)
      const run = () => {
        for (const p of params) if (p.t !== 'phrase' && defs[p.k] !== undefined) store.setParam(kind, id, p.k, JSON.parse(JSON.stringify(defs[p.k])))
      }
      if (block) withFollow(block, run)
      else {
        store.begin()
        run()
        store.commit()
      }
    })
    head.append(toggle, reset)
    let sw = null
    if (fx.on) {
      sw = h('button', { class: 'switch switch--sm', role: 'switch', type: 'button', title: 'Attiva / disattiva', 'aria-label': 'Attiva ' + label }, '<i></i>')
      sw.addEventListener('click', () => store.setParam(kind, id, fx.on, !getP()[fx.on]))
      head.appendChild(sw)
    }
    head.insertAdjacentHTML('beforeend', icon('chevron', 'fx__chev'))
    const clip = h('div', { class: 'fx__clip', id: bodyId })
    const body = h('div', { class: 'fx__body' })
    clip.appendChild(body)
    const rows = params.filter((p) => p.k !== fx.on && !block?.talk.has(p.k)).map((p) => control(p, kind, id, () => getP()[p.k], () => defs[p.k], block))
    rows.forEach((r) => body.appendChild(r))
    sec.append(head, clip)

    const apply = () => {
      const on = open || temp
      sec.classList.toggle('is-open', on)
      toggle.setAttribute('aria-expanded', String(on))
    }
    head.addEventListener('click', (e) => {
      if (e.target.closest('.switch, .fx__reset')) return
      const now = open || temp
      temp = false
      open = !now
      remember(key, open)
      apply()
      syncAll()
    })
    // whatever reaches inside a closed folder opens it (Tab, find in page, a scroll into view): never a hidden control in use
    const reveal = () => {
      if (open || temp) return
      temp = true
      apply()
      syncAll()
    }
    clip.addEventListener('focusin', reveal)
    clip.addEventListener('scroll', () => {
      if (open || temp) return
      clip.scrollTop = 0
      reveal()
    })
    sec._isOpen = () => open || temp
    sec._set = (v) => {
      temp = false
      open = v
      remember(key, v)
      apply()
    }
    /** The search: terms (null = none) → shows the matching controls (all of them when the folder's name matches) and opens it. */
    sec._match = (terms) => {
      if (!terms) {
        rows.forEach((r) => (r.hidden = false))
        sec.hidden = false
        temp = false
        apply()
        return true
      }
      const all = matches(label, terms)
      let any = false
      rows.forEach((r) => {
        const hit = all || matches(r._label, terms)
        r.hidden = !hit
        any = any || hit
      })
      sec.hidden = !any
      temp = any
      apply()
      return any
    }
    sec._sync = () => {
      rows.forEach((r) => r._sync())
      const P = getP()
      let off = false
      if (sw) {
        const on = !!P[fx.on]
        sw.classList.toggle('is-on', on)
        sw.setAttribute('aria-checked', String(on))
        off = !on
        sec.classList.toggle('is-off', off)
      }
      const changed = rows.some((r) => r.classList.contains('is-changed')) || (fx.on && defs[fx.on] !== undefined && !!P[fx.on] !== !!defs[fx.on])
      sec.classList.toggle('is-changed', !!changed)
      const s = off ? 'Spento' : summaryOf(params, P, defs, block && { videos: engine.videos, specOf: block.specOf })
      // a sentence and its length ({ main, tail }): the sentence is what gets cut, never the length
      const text = typeof s === 'string' ? s : `${s.main} ${s.tail}`
      if (sum._t !== text) {
        sum._t = text
        sum.classList.toggle('is-split', typeof s !== 'string')
        if (typeof s === 'string') sum.textContent = s
        else sum.innerHTML = `<span>${esc(s.main)}</span><em>${esc(s.tail)}</em>`
        sum.title = text
      }
    }
    apply()
    return sec
  }

  /** A small heading (icon + name) over its folders. */
  function category(cat, groups) {
    const box = h('section', { class: 'cat', 'data-cat': cat.id })
    box.appendChild(h('h3', { class: 'cat__head' }, `${icon(cat.icon, 'cat__ico')}<span>${esc(cat.label)}</span>`))
    const body = h('div', { class: 'cat__body' })
    groups.forEach((g) => body.appendChild(g))
    box.appendChild(body)
    box._sync = () => groups.forEach((g) => g._sync())
    return box
  }

  /** Every effect of a block, split by heading (content → motion → look), each in effect order. */
  function categorized(fxs, kind, id, type, getP, defs) {
    const out = []
    const block = blockOf(kind, id, fxs, getP, defs)
    for (const cat of CATS) {
      const groups = []
      for (const fx of fxs) {
        const params = fx.params.filter((p) => p.k !== fx.on && catOf(p) === cat.id)
        if (params.some((p) => !block.talk.has(p.k))) groups.push(folder(fx, params, kind, id, getP, defs, `${kind}:${type}:${cat.id}`, fx.label, block))
      }
      if (groups.length) out.push(category(cat, groups))
    }
    return out
  }

  const defaultsOf = (fxs) => Object.fromEntries(fxs.flatMap((f) => f.params.map((p) => [p.k, p.d])))

  // ---------------- the search and "open all"

  function termsOf(q) {
    const alts = norm(q)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(/\s+/))
    return alts.length ? alts : null
  }
  function matches(label, terms) {
    const n = norm(label)
    return terms.some((words) => words.every((w) => n.includes(w)))
  }
  function toolsRow() {
    const row = h('div', { class: 'insp__tools' })
    row.innerHTML = `<label class="search">${icon('search', 'search__ico')}<input type="text" role="searchbox" placeholder="Cerca: corpo, spaziatura, ease…" aria-label="Cerca un controllo" spellcheck="false" autocomplete="off" />
        <button type="button" class="search__clear" title="Cancella la ricerca (Esc)" aria-label="Cancella la ricerca" hidden>${icon('xmark')}</button></label>
      <button type="button" class="insp__all" data-all></button>`
    const input = row.querySelector('input')
    const clear = row.querySelector('.search__clear')
    input.value = query
    input.addEventListener('input', () => {
      query = input.value
      applySearch()
    })
    input.addEventListener('keydown', (e) => {
      // Esc clears (a second Esc leaves the field)
      if (e.key === 'Escape' && input.value) {
        e.preventDefault()
        e.stopPropagation()
        input.value = query = ''
        applySearch()
      }
    })
    clear.addEventListener('click', () => {
      input.value = query = ''
      applySearch()
      input.focus()
    })
    row.querySelector('[data-all]').addEventListener('click', (e) => {
      const open = e.currentTarget.dataset.mode === 'open'
      for (const s of el.querySelectorAll('.fx')) if (!s.hidden) s._set(open)
      syncAll()
    })
    return row
  }
  function applySearch() {
    const terms = termsOf(query)
    el.classList.add('is-instant') // folders snap open or closed while typing: no animation
    let any = false
    for (const s of el.querySelectorAll('.fx')) any = s._match(terms) || any
    for (const c of el.querySelectorAll('.cat')) c.hidden = !!terms && ![...c.querySelectorAll('.fx')].some((s) => !s.hidden)
    const none = el.querySelector('.insp__none')
    if (none) {
      none.hidden = !terms || any
      none.textContent = `Nessun controllo per “${query.trim()}”`
    }
    if (tools) tools.querySelector('.search__clear').hidden = !query
    syncAll()
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-instant')))
  }
  function syncAll() {
    const btn = tools?.querySelector('[data-all]')
    if (!btn) return
    const secs = [...el.querySelectorAll('.fx')].filter((s) => !s.hidden)
    const allOpen = secs.length > 0 && secs.every((s) => s._isOpen())
    const mode = allOpen ? 'close' : 'open'
    if (btn.dataset.mode === mode) return
    btn.dataset.mode = mode
    btn.innerHTML = allOpen ? `${icon('close-all')}<span>Chiudi tutto</span>` : `${icon('open-all')}<span>Apri tutto</span>`
    btn.title = allOpen ? 'Chiudi tutte le cartelle' : 'Apri tutte le cartelle'
  }

  // ---------------- with nothing selected: the music and the voices, the look, the keys

  function section(label, ico, cls = '') {
    const box = h('section', { class: 'sec ' + cls })
    box.appendChild(h('h3', { class: 'cat__head' }, `${icon(ico, 'cat__ico')}<span>${esc(label)}</span>`))
    return box
  }

  function musicSection() {
    const box = section('Musica e voci', 'music', 'sec--music')
    const card = h('div', { class: 'mus', 'data-music': '' })
    card.innerHTML = `<div class="mus__now">
        <span class="mus__disc">${icon('wave')}</span>
        <div class="mus__what"><b data-name></b><span data-meta></span></div>
      </div>
      <div class="mus__state" data-state hidden></div>
      <div class="mus__actions">
        <button type="button" class="btn btn--sm" data-load>${icon('upload')}<span>Carica un brano…</span></button>
        <button type="button" class="btn btn--sm btn--quiet" data-default hidden>${icon('music')}<span>Usa ${esc(audio.defaultTrack?.title || 'il brano del montaggio')}</span></button>
        <button type="button" class="btn btn--sm btn--quiet" data-orig>${icon('undo')}<span>Torna alla colonna originale</span></button>
      </div>
      <div class="mus__rows" data-rows></div>
      <button type="button" class="btn btn--wide" data-sync>${icon('scissors')}<span>Metti il montaggio a tempo col brano</span></button>
      <p class="mus__hint" data-hint></p>`
    box.appendChild(card)
    const $ = (s) => card.querySelector(s)
    $('[data-load]').addEventListener('click', () => pickTrack())
    $('[data-orig]').addEventListener('click', () => audio.clearTrack())
    $('[data-default]').addEventListener('click', () => audio.useDefault())
    $('[data-sync]').addEventListener('click', () => cutOnTheBeat())
    const rowsEl = $('[data-rows]')

    // where the song starts (its second at the film's 0): applied on release, the mix renders once
    const off = h('div', { class: 'ctl ctl--num', 'data-k': 'offset' })
    off._label = 'Il brano parte da'
    off.innerHTML = `<div class="ctl__top"><span class="ctl__label">Il brano parte da</span><button type="button" class="ctl__back" title="Dall’inizio del brano (o doppio clic)" aria-label="Dall’inizio del brano">${icon('undo')}</button><input class="ctl__val" type="text" inputmode="decimal" spellcheck="false" aria-label="Il brano parte da (secondi)" /><span class="ctl__unit">s</span></div>
      <label class="ruler" style="--d:0"><input type="range" min="0" max="1" step="0.01" aria-label="Il brano parte da" /><span class="ruler__thumb"></span><i class="ruler__dot"></i></label>`
    const offVal = off.querySelector('.ctl__val')
    const offRange = off.querySelector('input[type=range]')
    const offRuler = off.querySelector('.ruler')
    const offMax = () => Math.max(0, (trackOf(audio).length || 0) - store.timeline.duration)
    const showOff = (v) => {
      const m = offMax()
      offRuler.style.setProperty('--p', m > 0 ? Math.min(1, v / m) : 0)
      if (document.activeElement !== offVal) offVal.value = fmtNum(v, 2)
      off.classList.toggle('is-changed', v > 0.005)
    }
    const setOff = (v) => audio.setOffset(Math.min(offMax(), Math.max(0, v)))
    offRange.addEventListener('input', () => showOff(Number(offRange.value)))
    offRange.addEventListener('change', () => setOff(Number(offRange.value)))
    offRuler.addEventListener('dblclick', (e) => {
      e.preventDefault()
      setOff(0)
    })
    off.querySelector('.ctl__back').addEventListener('click', () => setOff(0))
    offVal.addEventListener('focus', () => offVal.select())
    offVal.addEventListener('change', () => {
      const v = parseNum(offVal.value)
      if (Number.isFinite(v)) setOff(v)
      else showOff(audio.custom?.offset || 0)
    })
    rowsEl.appendChild(off)

    // the levels (global look values, so they are undone and saved with the cut)
    const look = () => ({ ...LOOK.defaults, ...store.project.look })
    const spec = (k, label) => {
      const p = LOOK.fx.params.find((x) => x.k === k)
      return p && { ...p, label }
    }
    const levels = [spec('music', 'Musica'), spec('duck', 'Sotto le voci (−dB)'), spec('voices', 'Voci')].filter(Boolean)
    const rows = levels.map((p) => control(p, 'look', null, () => look()[p.k], () => LOOK.defaults[p.k]))
    rows.forEach((r) => rowsEl.appendChild(r))
    let musicSw = null
    if (rows[0] && LOOK.defaults.musicOn !== undefined) {
      musicSw = h('button', { class: 'switch switch--sm', role: 'switch', type: 'button', title: 'Musica sì / no', 'aria-label': 'Musica sì / no' }, '<i></i>')
      musicSw.addEventListener('click', () => store.setParam('look', null, 'musicOn', !look().musicOn))
      rows[0].querySelector('.ctl__top').appendChild(musicSw)
    }

    musicSync = () => {
      if (!card.isConnected) return
      const t = trackOf(audio)
      $('[data-name]').textContent = t.name
      $('[data-name]').title = audio.custom?.name || t.name
      $('[data-meta]').textContent = t.song
        ? [t.bpm ? `${t.bpm} BPM` : 'tempo non trovato', t.bpm ? (t.sure ? 'tempo sicuro' : 'tempo incerto') : '', t.length ? fmtClock(t.length) : ''].filter(Boolean).join(' · ')
        : `${t.bpm} BPM · scritta sul montaggio`
      const st = $('[data-state]')
      const msg = audio.status === 'error' ? `Audio non disponibile${audio.error ? ': ' + audio.error : ''}` : audioBusy() ? 'Preparo l’audio…' : audio.muted ? 'Audio spento · M per riaccenderlo' : ''
      st.hidden = !msg
      st.textContent = msg
      st.classList.toggle('is-busy', audioBusy())
      $('[data-orig]').hidden = !t.song
      $('[data-default]').hidden = !audio.defaultTrack || !!audio.custom?.isDefault
      off.hidden = !t.song
      if (t.song) {
        const m = offMax()
        offRange.max = String(Math.max(0.01, m))
        offRange.disabled = m <= 0
        off.classList.toggle('is-locked', m <= 0)
        if (document.activeElement !== offRange) offRange.value = String(audio.custom.offset || 0)
        showOff(audio.custom.offset || 0)
      }
      const sync = $('[data-sync]')
      sync.disabled = !t.grid
      sync.querySelector('span').textContent = t.song ? 'Metti il montaggio a tempo col brano' : 'Metti il montaggio a tempo con la musica'
      sync.title = !t.grid
        ? 'Il tempo di questo brano non è stato trovato'
        : `Ogni taglio sul battere più vicino, ogni scena sul primo tempo della battuta (${t.bpm} BPM) · un solo ⌘Z per tornare indietro`
      $('[data-hint]').textContent = t.song
        ? songHint(t)
        : 'Trascina un file audio sulla finestra, o “Carica un brano”: il film prende il suo tempo.'
      rows.forEach((r) => r._sync())
      if (musicSw) {
        const on = !!look().musicOn
        musicSw.classList.toggle('is-on', on)
        musicSw.setAttribute('aria-checked', String(on))
        rows[0].classList.toggle('is-muted', !on)
        rows[0].classList.toggle('is-changed', rows[0].classList.contains('is-changed') || on !== !!LOOK.defaults.musicOn)
      }
    }
    const songHint = (t) => {
      const len = t.length || 0
      const film = store.timeline.duration
      return len && len < film - 0.05 ? `Il brano dura ${fmtClock(len)}, il film ${fmtNum(film, 1)} s: finisce prima, sfuma l’ultimo secondo.` : 'Il brano sfuma nell’ultimo secondo del film. Trascina un altro file per cambiarlo.'
    }
    box._sync = musicSync
    return box
  }

  /** Every cut on the nearest beat of the music, every scene on a bar's first beat (within half a bar), never a block under 0.25 s: one undo. */
  async function cutOnTheBeat() {
    const g = audio?.grid()
    if (!g) return toast('Il tempo del brano non è noto: niente da mettere a tempo')
    const T = store.timeline
    const shots = T.shots
    const ends = shots.map((s) => s.end)
    // the film's start goes first so the first block keeps its 0.25 s too (it is dropped after)
    const times = [0, ...ends]
    const bars = [false, ...shots.map((s, i) => !shots[i + 1] || shots[i + 1].scene.id !== s.scene.id)]
    const opts = { bars, min: 0.25 }
    let out = null
    try {
      const load = BEATS['../engine/beats.js']
      if (load) {
        const mod = await load()
        if (typeof mod.snapCuts === 'function') out = mod.snapCuts(times, g, opts)
      }
    } catch (e) {
      console.warn('[ui] snapCuts', e)
    }
    if (!validCuts(out, times.length, opts.min)) out = snapCutsHere(times, g, opts)
    // durations from the cut points rounded to the millisecond (rounding each duration would drift off the beat)
    const ms = (x) => Math.round(x * 1000)
    const cuts = out.slice(1)
    let prev = 0
    let moved = 0
    const durs = cuts.map((t, i) => {
      if (Math.abs(t - ends[i]) > 5e-4) moved++
      const d = (ms(t) - ms(prev)) / 1000
      prev = t
      return d
    })
    const bpm = Math.round(g.bpm)
    if (!moved) return toast(`Il montaggio è già a tempo · ${bpm} BPM`)
    store.edit(() =>
      shots.forEach((s, i) => {
        const sh = store.findShot(s.id)
        if (sh) sh.dur = Math.max(0.25, durs[i])
      }),
    )
    toast(`${moved} ${moved === 1 ? 'taglio' : 'tagli'} a tempo · ${bpm} BPM · ⌘Z per tornare indietro`)
  }

  function lookSection() {
    const box = section('Tutto il film', 'film', 'sec--look')
    const fx = LOOK.fx
    // the levels of the sound live in "Musica e voci"
    const SOUND = new Set(['musicOn', 'music', 'duck', 'voices'])
    const params = fx.params.filter((p) => p.k !== fx.on && !(audio && SOUND.has(p.k)))
    const label = params.length < fx.params.filter((p) => p.k !== fx.on).length ? 'Look' : fx.label
    const f = folder(fx, params, 'look', null, () => ({ ...LOOK.defaults, ...store.project.look }), LOOK.defaults, 'look:film:look', label)
    const body = h('div', { class: 'cat__body' })
    body.appendChild(f)
    box.appendChild(body)
    box._sync = f._sync
    return box
  }

  function keysSection() {
    const box = section('Tasti', 'keyboard', 'sec--keys')
    const K = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join('')
    const items = [
      ['Clic su un blocco della timeline', K('modifica')],
      ['Trascina un blocco · un bordo', K('sposta') + K('durata')],
      ['Play · pausa', K('spazio')],
      ['Fotogramma · secondo', K('←', '→') + K('⇧')],
      ['Blocco precedente · successivo', K('↑', '↓')],
      ['Elimina il blocco selezionato', K('⌫')],
      ['Annulla · ripeti', K('⌘Z', '⇧⌘Z')],
      ['Doppio clic su un controllo', K('valore iniziale')],
      ...(audio ? [['Audio sì · no', K('M')]] : []),
      ['Snap · tutto il film · loop', K('S', 'F', 'L')],
    ]
    box.appendChild(h('ul', { class: 'keys' }, items.map(([a, b]) => `<li><span>${a}</span>${b}</li>`).join('')))
    return box
  }

  // ---------------- render

  function render() {
    const sel = store.selection
    const T = store.timeline
    const shot = sel?.kind === 'shot' ? T.shot(sel.id) : null
    const scene = sel?.kind === 'scene' ? T.scene(sel.id) : shot?.scene || null
    const sig = `${sel?.kind}:${sel?.id}:${T.shots.map((s) => s.id).join(',')}`
    if (sig === drawn) return sync()
    const sameSel = drawn.split(':').slice(0, 2).join(':') === `${sel?.kind}:${sel?.id}`
    const keep = sameSel ? el.scrollTop : 0
    // another block on screen: the sentence being listened to is not on screen any more
    if (!sameSel) stopListening()
    drawn = sig
    el.innerHTML = ''
    syncers = []
    tools = null
    musicSync = null
    const add = (node) => {
      el.appendChild(node)
      if (node._sync) syncers.push(node._sync)
      return node
    }

    if (!shot && !scene) {
      el.classList.add('is-empty')
      if (audio) add(musicSection())
      add(lookSection())
      add(keysSection())
      sync()
      el.scrollTop = keep
      return
    }
    el.classList.remove('is-empty')

    // ---------------- header: what it is, its name, its time, delete
    const head = h('div', { class: 'insp__head' })
    const bound = shot && store.isBound(shot.id)
    const del = h(
      'button',
      { type: 'button', class: 'insp__del', title: shot ? (bound ? `Fa parte di “${shot.scene.label}”: si sposta o si elimina con la scena` : 'Elimina il blocco (⌫)') : 'Elimina la scena con i suoi blocchi (⌫)', 'aria-label': bound ? 'Bloccato nella scena' : 'Elimina' },
      icon(bound ? 'lock' : 'trash'),
    )
    del.disabled = !!bound
    del.addEventListener('click', () => onDelete?.())
    if (shot) {
      head.innerHTML = `<div class="insp__kicker"><i style="background:${shot.scene.hue}"></i><span>${esc(shot.scene.label)} · ${esc(SHOT_TYPES[shot.type].label)}</span></div>
        <input class="insp__name" type="text" aria-label="Nome del blocco" spellcheck="false" />
        <div class="insp__time">
          <label class="insp__durl">${icon('stopwatch')}<span>Durata</span><span class="insp__dur"><input type="text" inputmode="decimal" aria-label="Durata in secondi" /><em>s</em></span></label>
          <div class="insp__range"></div>
        </div>`
      head.querySelector('.insp__kicker').appendChild(del)
      const name = head.querySelector('.insp__name')
      name.addEventListener('focus', () => store.begin())
      name.addEventListener('input', () => store.edit(() => (store.findShot(shot.id).name = name.value), { live: true }))
      name.addEventListener('blur', () => store.commit())
      const dur = head.querySelector('.insp__dur input')
      dur.addEventListener('focus', () => dur.select())
      dur.addEventListener('change', () => {
        const v = parseNum(dur.value)
        if (Number.isFinite(v)) store.setDur(shot.id, Math.max(MIN_DUR, v))
      })
      head._sync = () => {
        const s = store.timeline.shot(shot.id)
        if (!s) return
        if (document.activeElement !== name) name.value = s.name
        if (document.activeElement !== dur) dur.value = fmtNum(s.dur, 2)
        head.querySelector('.insp__range').textContent = `${fmtNum(s.start, 2)} → ${fmtNum(s.end, 2)} s`
      }
    } else {
      head.innerHTML = `<div class="insp__kicker"><i style="background:${scene.hue}"></i><span>Scena</span></div><h2 class="insp__title">${esc(scene.label)}</h2>
        <div class="insp__time"><span>${scene.shots.length} ${scene.shots.length === 1 ? 'blocco' : 'blocchi'}</span><div class="insp__range"></div></div>`
      head.querySelector('.insp__kicker').appendChild(del)
      head._sync = () => {
        const s = store.timeline.scene(scene.id)
        if (s) head.querySelector('.insp__range').textContent = `${fmtNum(s.start, 2)} → ${fmtNum(s.end, 2)} s · ${fmtNum(s.dur, 2)} s`
      }
    }
    add(head)

    const parts = []
    if (shot) {
      const fxs = effectsOf(shot.src)
      // the starting values: this block's own (its number, its text), else the effect's
      const own = defaultProject().scenes.flatMap((x) => x.shots).find((x) => x.id === shot.id)?.params || {}
      const defs = { ...defaultsOf(fxs), ...own }
      parts.push(...categorized(fxs, 'shot', shot.id, shot.type, () => store.timeline.shot(shot.id)?.p || {}, defs))
    }
    const sfx = sceneEffects(scene.src)
    if (sfx.length) {
      const own = defaultProject().scenes.find((x) => x.id === scene.id)?.params || {}
      const defs = { ...defaultsOf(sfx), ...own }
      const getP = () => store.timeline.scene(scene.id)?.p || {}
      const block = blockOf('scene', scene.id, sfx, getP, defs)
      const groups = sfx.map((fx) => folder(fx, fx.params.filter((p) => p.k !== fx.on), 'scene', scene.id, getP, defs, `scene:${scene.type}:scene`, fx.label, block))
      parts.push(category({ id: 'scene', label: shot ? `Scena · ${SCENE_TYPES[scene.type].label}` : 'Effetti della scena', icon: 'layer' }, groups))
    }
    if (parts.length) {
      tools = add(toolsRow())
      parts.forEach(add)
      el.appendChild(h('p', { class: 'insp__none', hidden: true }))
    } else if (!shot) {
      add(h('div', { class: 'insp__note' }, 'Questa scena non ha parametri propri: clic su uno dei suoi blocchi. Trascinala per spostarla con tutti i suoi blocchi.'))
    }
    sync()
    if (query) applySearch()
    syncAll()
    el.scrollTop = keep
  }

  function sync() {
    for (const f of syncers) f()
    lib?.refresh()
  }

  /** The music panel on screen (the top bar's pill, the timeline's audio lane). */
  function showMusic() {
    if (!audio) return
    store.select(null)
    render()
    el.scrollTo({ top: 0, behavior: 'smooth' })
    const card = el.querySelector('.mus')
    if (card) {
      card.classList.remove('is-flash')
      void card.offsetWidth
      card.classList.add('is-flash')
    }
  }

  store.on((what) => {
    if (what === 'selection' || what === 'project' || what === 'history') render()
  })
  render()
  return { render, showMusic }
}
