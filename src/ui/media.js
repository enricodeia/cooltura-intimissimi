// The videos in the panel: the catalog of the clips (media/v4/clips.json), a list as posters in order,
// one video as a poster, the library they are picked from (a sheet over the stage) and the sentences of
// the clip that speaks, each one to listen to. The lists of options 1 and 2 use the same posters.
//
// The data contract (the model's: read here, never changed):
//   lists   slugs. 'v4/x' = 'v4/x.mp4'; a bare 'x' = 'v3/feed/x.mp4' when it exists, else 'v3/grid/x.mp4'
//           (pool 'grid': always the grid's). pool '*' = the V4 clips + the grid, 'grid' = the grid, any
//           other string = the feed's videos starting with it. talk: the positions that speak (1-based),
//           or the name of the param holding the one who comes forward (the wheel's 'hero'). min: how few
//           it may hold (default 1; 0 = empty allowed).
//   video   one slug the same way (a bare one is a creator of the grid, as the framed creator reads it),
//           or a full key (older saves: 'v4/hero-alice.mp4', 'v3/hero.mp4').
//   phrase  virtual (its own key is never written). clip = { list, index } (a 1-based position, or the
//           param holding it) | { key }; keys = the params a sentence writes ({ from, to, text, from2?, to2? }).

import { icon, h, esc } from './icons.js'

export const MEDIA = new Set(['videos', 'video', 'phrase'])

const ital = (v, dg = 1) => (Number(v) || 0).toFixed(dg).replace('.', ',')
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const span = (a, b) => Math.max(0, (Number(b) || 0) - (Number(a) || 0))
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const AND = typeof Intl !== 'undefined' && Intl.ListFormat ? new Intl.ListFormat('it', { type: 'conjunction' }) : { format: (a) => a.join(' e ') }

// ------------------------------------------------------------------ the catalog

let CAT = null
let loading = null
/** media/v4/clips.json, once (an empty catalog when it is not there: names from the slugs, no sentences). */
export function loadCatalog(base) {
  if (!loading)
    loading = fetch(base + 'v4/clips.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((j) => (CAT = j && typeof j === 'object' ? j : {}))
  return loading
}
export const catalogReady = () => !!CAT
export const entryOf = (key) => (key && CAT ? CAT[key] || null : null)

// ------------------------------------------------------------------ values → media keys

const has = (videos, k) => (videos.manifest[k] !== undefined ? k : null)
/** A value of a list → its media key (null: not in the library). */
export function keyOfItem(videos, v, pool) {
  if (!v) return null
  const s = String(v)
  if (s.endsWith('.mp4')) return has(videos, s)
  if (s.startsWith('v4/')) return has(videos, s + '.mp4')
  if (pool === 'grid') return has(videos, `v3/grid/${s}.mp4`)
  return has(videos, `v3/feed/${s}.mp4`) || has(videos, `v3/grid/${s}.mp4`)
}
/** The value of one video → its media key, as the framed creator reads it (machina/plan.js heroKeyOf). */
export function keyOfOne(videos, v) {
  if (!v) return null
  const s = String(v)
  if (s.endsWith('.mp4')) return s
  return s.startsWith('v4/') ? s + '.mp4' : `v3/grid/${s}.mp4`
}
/** The 0-based position of the one who comes forward (the param holds it 1-based; the wheel clamps it). */
export const heroIndex = (P, k, n) => Math.max(0, Math.min(n - 1, Math.round(Number(P[k]) || 1) - 1))

// ------------------------------------------------------------------ names

const PREFIX = /^(open|hero|comm|venice|aria|ext|nude|ul)-/
function slugName(key) {
  const slug = String(key || '')
    .replace(/^.*\//, '')
    .replace(/\.\w+$/, '')
  const n = slug
    .replace(PREFIX, '')
    .split('-')
    .filter(Boolean)
    .map((w) => (w === 'spark' ? '· Spark' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
  return n || slug || 'Video'
}
/** 'Rebecca Maurino · terrazza' (the catalog's), else from the file name. */
export const nameOf = (key) => entryOf(key)?.name || slugName(key)
/** Only the person: 'Rebecca Maurino · terrazza' → 'Rebecca Maurino'. */
export const personOf = (key) => nameOf(key).split(' · ')[0]
const frasi = (n) => `${n} ${n === 1 ? 'frase' : 'frasi'}`
/** 'Aria · con voce, 3 frasi' */
export function metaOf(key) {
  const e = entryOf(key)
  if (!e) return ''
  const n = e.voice ? e.phrases?.length || 0 : 0
  return [e.campaign, n ? `con voce, ${frasi(n)}` : ''].filter(Boolean).join(' · ')
}
const describe = (key) => [nameOf(key), metaOf(key)].filter(Boolean).join(' · ')
const thumbOf = (videos, key) => (key ? videos.base + (entryOf(key)?.thumb || `thumbs/${key.replace(/\.mp4$/, '.jpg')}`) : '')

// ------------------------------------------------------------------ what a control picks from

/** The library of a control: [{ value, key, e }], one per value (extra: values to show even outside the pool). */
export function poolOf(videos, spec, extra = []) {
  const one = spec.t === 'video'
  const pool = spec.pool
  const keyOf = (v) => (one ? keyOfOne(videos, v) : keyOfItem(videos, v, pool))
  const keys = (prefix) => videos.keys(prefix).sort()
  const values = []
  if (pool === '*') values.push(...keys('v4/').map((k) => k.slice(0, -4)), ...keys('v3/grid/').map((k) => k.slice(8, -4)))
  else if (pool === 'grid') values.push(...keys('v3/grid/').map((k) => k.slice(8, -4)))
  else values.push(...keys('v3/feed/' + (pool || '')).map((k) => k.slice(8, -4)))
  values.push(...extra.filter(Boolean))
  const out = new Map()
  for (const value of values) {
    const key = keyOf(value)
    if (!key || out.has(value) || (one && [...out.values()].some((it) => it.key === key))) continue
    out.set(value, { value, key, e: entryOf(key) })
  }
  return [...out.values()]
}

// ------------------------------------------------------------------ who speaks (the 'phrase' contract)

/** The clip a 'phrase' spec listens to: { key, value, k, i?, n?, one? } (key null: no video there). */
export function speakerClip(spec, P, specOf, videos) {
  const c = spec.clip || {}
  if (c.key) {
    const s = specOf(c.key)
    const value = P[c.key] || s?.d
    return { k: c.key, value, key: keyOfOne(videos, value), one: true }
  }
  const list = Array.isArray(P[c.list]) ? P[c.list] : []
  const fixed = typeof c.index === 'number'
  const i = fixed ? Math.round(c.index) - 1 : heroIndex(P, c.index, list.length)
  const value = i >= 0 ? list[i] : undefined
  return { k: c.list, i, n: i + 1, value, key: value ? keyOfItem(videos, value, specOf(c.list)?.pool) : null }
}
export const phraseSpecs = (fxs) => (fxs || []).flatMap((f) => f.params.filter((p) => p.t === 'phrase'))
const hasSecond = (ph) => Number(ph.to2) > (Number(ph.from2) || 0) + 0.01
const twoWindows = (spec) => !!(spec.keys?.from2 && spec.keys?.to2)
/**
 * The sentences a picker offers for a clip: all of them, or, when the block has no second window (the deck's
 * second card), the ones it can play whole (a sentence that cuts a pause has its one-window version in the
 * catalog); none of those: all, heard up to their first window.
 */
export function phrasesFor(spec, key) {
  const e = entryOf(key)
  const all = (e?.voice && e.phrases) || []
  if (twoWindows(spec)) return all
  const whole = all.filter((ph) => !hasSecond(ph))
  return whole.length ? whole : all
}
/** The sentence a picker takes when its clip changes: the first one it offers. */
export const firstPhrase = (spec, key) => phrasesFor(spec, key)[0] || null
/** The windows of a sentence as the block plays it. */
const windowsOf = (spec, ph) => (hasSecond(ph) && twoWindows(spec) ? [[ph.from, ph.to], [ph.from2, ph.to2]] : [[ph.from, ph.to]])
/** What choosing a sentence writes: from, to, text, and the second window when the block has one. */
export function phraseWrites(spec, ph) {
  const k = spec.keys || {}
  const o = {}
  if (k.from) o[k.from] = ph.from
  if (k.to) o[k.to] = ph.to
  if (k.text) o[k.text] = ph.text
  if (k.from2) o[k.from2] = ph.from2 ?? 0
  if (k.to2) o[k.to2] = ph.to2 ?? 0
  return o
}

/** The same creator with her own voice (same name in the catalog; her campaign first): its key, or null. */
export function voicedTwin(key) {
  const e = entryOf(key)
  if (!e || e.voice || !CAT) return null
  const same = Object.entries(CAT).filter(([k, x]) => x.voice && x.name === e.name && x.phrases?.length && k.startsWith('v4/'))
  if (!same.length) return null
  return (same.find(([, x]) => x.campaign === e.campaign) || same[0])[0]
}

// ------------------------------------------------------------------ the one-line summaries of the folders

/** '5 video · parla Chiara Chelo', '4 video · parlano Chiara e Rebecca', 'griglia: tutti i video'. */
export function listSummary(spec, P, videos) {
  const cur = Array.isArray(P[spec.k]) ? P[spec.k] : []
  if (spec.pool === 'grid') return `griglia: ${cur.length ? cur.length + ' video' : 'tutti i video'}`
  if (!cur.length) return spec.min === 0 ? 'tutti i video' : 'nessun video'
  let who = []
  if (typeof spec.talk === 'string') who = [heroIndex(P, spec.talk, cur.length)]
  else if (Array.isArray(spec.talk)) who = spec.talk.map((n) => Math.round(n) - 1).filter((i) => i >= 0 && i < cur.length)
  const keys = who.map((i) => keyOfItem(videos, cur[i], spec.pool))
  const names = keys.map((k, j) => personOf(k || cur[who[j]]))
  const first = names.map((n) => n.split(' ')[0])
  // a position that speaks with a clip that has no voice says so
  const say = (list) => list.map((n, j) => (catalogReady() && !entryOf(keys[j])?.voice ? `${n} (senza voce)` : n))
  const out = !names.length ? '' : names.length === 1 ? `parla ${say(names)[0]}` : `parlano ${AND.format(say(new Set(first).size === first.length ? first : names))}`
  return [`${cur.length} video`, out].filter(Boolean).join(' · ')
}
export const oneSummary = (spec, P, videos) => nameOf(keyOfOne(videos, P[spec.k] || spec.d))
/**
 * 'Frase: «Con questo reggiseno…» 3,7 s' as { main, tail }: the folder cuts the sentence to its width,
 * never the length.
 */
export function phraseSummary(spec, P, videos, specOf) {
  const sp = speakerClip(spec, P, specOf, videos)
  if (!sp.key) return ''
  if (catalogReady() && !entryOf(sp.key)?.voice) return 'Questo video non ha la sua voce'
  const k = spec.keys || {}
  const dur = span(P[k.from], P[k.to]) + (k.from2 && k.to2 ? span(P[k.from2], P[k.to2]) : 0)
  const text = String(P[k.text] ?? '')
    .trim()
    .replace(/\s*\n\s*/g, ' ')
  return { main: text ? `Frase: «${text}»` : 'Frase', tail: `${ital(dur)} s` }
}

// ------------------------------------------------------------------ small things

/** Space and Enter on a button here are the button's, not the film's play key. */
function ownKeys(el) {
  el.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('button')) e.stopPropagation()
  })
}
const rectsOf = (els) => new Map(els.map((el) => [el, el.getBoundingClientRect()]))
/** Each element glides from where it was (FLIP). */
function flip(before, els, dur = 280) {
  if (reduced()) return
  for (const el of els) {
    const a = before.get(el)
    if (!a || !el.isConnected) continue
    const b = el.getBoundingClientRect()
    const dx = a.left - b.left
    const dy = a.top - b.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
  }
}

// ------------------------------------------------------------------ listening to a sentence (one at a time)

let player = null
let run = null
/** Stop the sentence that plays (if any). */
export function stopListening() {
  const r = run
  if (!r) return
  run = null
  cancelAnimationFrame(r.raf)
  try {
    player.pause()
  } catch {}
  r.onEnd?.()
}
export const listeningTo = () => run?.id ?? null
/** Play exactly these windows of an audio file (clip seconds), one after the other, then stop. */
function listen(id, src, parts, { onTick, onEnd } = {}) {
  stopListening()
  const windows = parts.filter(([a, b]) => b > a + 0.01)
  if (!windows.length) return
  if (!player) {
    player = Object.assign(new Audio(), { preload: 'auto' })
    player.addEventListener('error', () => stopListening())
  }
  const el = player
  const r = { id, parts: windows, i: 0, raf: 0, onTick, onEnd, total: windows.reduce((s, [a, b]) => s + b - a, 0) }
  run = r
  const url = new URL(src, location.href).href
  if (el.src !== url) el.src = url
  const tick = () => {
    if (run !== r) return
    let t = el.currentTime
    if (t >= r.parts[r.i][1] - 0.004 || el.ended) {
      if (++r.i >= r.parts.length) return stopListening()
      t = el.currentTime = r.parts[r.i][0]
    }
    const done = r.parts.slice(0, r.i).reduce((s, [a, b]) => s + b - a, 0) + Math.max(0, Math.min(t, r.parts[r.i][1]) - r.parts[r.i][0])
    r.onTick?.(Math.min(1, done / r.total))
    r.raf = requestAnimationFrame(tick)
  }
  const go = () => {
    if (run !== r) return
    el.currentTime = r.parts[0][0]
    el.play().then(
      () => run === r && tick(),
      () => run === r && stopListening(),
    )
  }
  if (el.readyState >= 1) go()
  else el.addEventListener('loadedmetadata', go, { once: true })
}

// ------------------------------------------------------------------ the library (a sheet over the stage)

const FILTERS = [
  ['all', 'Tutti'],
  ['voice', 'Con voce'],
  ['Aria', 'Aria'],
  ['Nude Look', 'Nude Look'],
  ['Ultralight', 'Ultralight'],
  ['Esternabilità', 'Esternabilità'],
]
const CAMPAIGNS = ['Aria', 'Nude Look', 'Ultralight', 'Esternabilità']
const passes = (f, it) => f === 'all' || (f === 'voice' ? !!it.e?.voice : it.e?.campaign === f)
const byName = (a, b) => nameOf(a.key).localeCompare(nameOf(b.key), 'it') || a.key.localeCompare(b.key)

/**
 * One library for the whole panel. open({ title, sub, nowKey, items, focusValue, marks, onPick, multi,
 * returnFocus }): marks() → Map(value → { text, now?, off?, title? }); onPick(item, { keep }) (keep: ⇧ or
 * ⌘ click with multi, the sheet stays open). Esc, the close key or a click outside closes it; the focus
 * stays inside while it is open and goes back where it was.
 */
export function createLibrary(videos) {
  let opts = null
  let filter = 'all'
  let cards = new Map()
  let back = null
  let closing = 0
  let hoverT = 0
  let live = null
  const dlg = h('dialog', { class: 'lib', 'aria-labelledby': 'lib-title' })
  dlg.innerHTML = `<header class="lib__head">
      <span class="lib__now" aria-hidden="true"></span>
      <div class="lib__titles"><h2 class="lib__title" id="lib-title"></h2><p class="lib__sub"></p></div>
      <button type="button" class="lib__close" title="Chiudi (Esc)" aria-label="Chiudi la libreria">${icon('xmark')}</button>
    </header>
    <div class="lib__bar">
      <div class="lib__filters" role="group" aria-label="Quali video"></div>
      <label class="search lib__search">${icon('search', 'search__ico')}<input type="text" role="searchbox" placeholder="Cerca un nome" aria-label="Cerca un nome" spellcheck="false" autocomplete="off" />
        <button type="button" class="search__clear" title="Cancella" aria-label="Cancella la ricerca" hidden>${icon('xmark')}</button></label>
    </div>
    <div class="lib__scroll"><div class="lib__body"></div><p class="lib__empty" hidden></p></div>`
  document.body.appendChild(dlg)
  const $ = (s) => dlg.querySelector(s)
  const body = $('.lib__body')
  const filtersEl = $('.lib__filters')
  const input = $('.lib__search input')
  const clear = $('.lib__search .search__clear')
  const empty = $('.lib__empty')
  const scroller = $('.lib__scroll')

  // ---- the hover: the clip plays muted in its poster (a video made on enter, gone on leave)
  function unpreview() {
    clearTimeout(hoverT)
    if (!live) return
    const v = live
    live = null
    v.pause()
    v.removeAttribute('src')
    v.load()
    v.remove()
  }
  function preview(card) {
    unpreview()
    const v = document.createElement('video')
    v.className = 'lib__vid'
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    v.setAttribute('aria-hidden', 'true')
    v.src = videos.base + card._it.key
    v.addEventListener('playing', () => v.classList.add('is-on'), { once: true })
    card.querySelector('.lib__poster').appendChild(v)
    live = v
    v.play().catch(() => {})
  }

  /** twin: another card would read the same (the framed take and her grid clip): its length tells them apart. */
  function card(it, twin = false) {
    const name = nameOf(it.key)
    const n = it.e?.voice ? it.e.phrases?.length || 0 : 0
    const meta = [it.e?.campaign, n ? frasi(n) : '', twin && it.e?.dur ? `${ital(it.e.dur)} s` : ''].filter(Boolean).join(' · ')
    // 'Rebecca Maurino · la festa': the person, then what this clip is (it goes to the next line whole)
    const [person, ...rest] = name.split(' · ')
    const detail = rest.length ? ` <span class="lib__detail">· ${esc(rest.join(' · '))}</span>` : ''
    const b = h('button', { type: 'button', class: 'lib__item' })
    b.innerHTML = `<span class="lib__poster"><img alt="" loading="lazy" decoding="async" draggable="false" src="${esc(thumbOf(videos, it.key))}" />${
      n ? `<span class="lib__voice">${icon('mic')}<span>Con voce</span></span>` : ''
    }<span class="lib__mark" hidden></span></span><span class="lib__name">${esc(person)}${detail}</span><span class="lib__meta">${esc(meta || ' ')}</span>`
    b._it = it
    b._label = [name, it.e?.campaign, n ? `con voce, ${frasi(n)}` : '', twin && it.e?.dur ? `${ital(it.e.dur)} s` : ''].filter(Boolean).join(' · ')
    b.setAttribute('aria-label', b._label)
    b.addEventListener('pointerenter', () => {
      clearTimeout(hoverT)
      hoverT = setTimeout(() => preview(b), 110)
    })
    b.addEventListener('pointerleave', () => {
      if (live?.closest('.lib__item') === b || !live) unpreview()
    })
    return b
  }

  function groups() {
    // sections only for the whole library; a filter or a search: one grid, the voices first
    if (filter !== 'all' || input.value.trim()) return [[null, () => true]]
    return [
      ['Con voce', (it) => !!it.e?.voice],
      ...CAMPAIGNS.map((c) => [c, (it) => !it.e?.voice && it.e?.campaign === c]),
      ['Altri', (it) => !it.e?.voice && !CAMPAIGNS.includes(it.e?.campaign)],
    ]
  }
  function draw() {
    unpreview()
    const q = norm(input.value.trim())
    const ok = (it) => passes(filter, it) && (!q || norm(`${nameOf(it.key)} ${it.e?.campaign || ''}`).includes(q))
    body.textContent = ''
    let shown = 0
    for (const [title, test] of groups()) {
      const list = opts.items.filter((it) => test(it) && ok(it))
      if (!list.length) continue
      list.sort(title ? byName : (a, b) => !!b.e?.voice - !!a.e?.voice || byName(a, b))
      const sec = h('section', { class: 'lib__group' })
      if (title) sec.appendChild(h('h3', { class: 'lib__h' }, `<span>${esc(title)}</span><em>${list.length}</em>`))
      const grid = h('div', { class: 'lib__grid' })
      for (const it of list) grid.appendChild(cards.get(it.value))
      sec.appendChild(grid)
      body.appendChild(sec)
      shown += list.length
    }
    empty.hidden = shown > 0
    empty.textContent = q ? `Nessun video per “${input.value.trim()}”` : 'Nessun video qui'
    clear.hidden = !input.value
  }
  function drawFilters() {
    filtersEl.textContent = ''
    const total = opts.items.length
    for (const [f, label] of FILTERS) {
      const n = opts.items.filter((it) => passes(f, it)).length
      // a filter that leaves nothing, or everything, is not one
      if (f !== 'all' && (!n || n === total)) continue
      const b = h('button', { type: 'button', class: 'lib__f', 'data-f': f }, `<span>${esc(label)}</span><em>${n}</em>`)
      b.addEventListener('click', () => {
        filter = f
        markFilters()
        draw()
        scroller.scrollTop = 0
      })
      filtersEl.appendChild(b)
    }
    filtersEl.hidden = filtersEl.children.length < 2
    markFilters()
  }
  function markFilters() {
    for (const b of filtersEl.children) {
      const on = b.dataset.f === filter
      b.classList.toggle('is-on', on)
      b.setAttribute('aria-pressed', String(on))
    }
  }
  /** The badges: the one being changed ("Ora"), the ones already in the list ("n. 2"). */
  function mark() {
    if (!opts) return
    const m = opts.marks?.() || new Map()
    for (const [v, c] of cards) {
      const k = m.get(v)
      const badge = c.querySelector('.lib__mark')
      badge.hidden = !k
      badge.textContent = k?.text || ''
      c.classList.toggle('is-now', !!k?.now)
      c.classList.toggle('is-used', !!k && !k.now)
      c.setAttribute('aria-disabled', String(!!k?.off))
      c.title = k?.title || ''
      c.setAttribute('aria-label', c._label + (k ? ' · ' + (k.title || k.text) : ''))
    }
    const sub = typeof opts.sub === 'function' ? opts.sub() : opts.sub
    $('.lib__sub').textContent = sub || ''
  }

  function open(o) {
    clearTimeout(closing)
    closing = 0
    if (!dlg.open) back = document.activeElement
    opts = o
    $('.lib__title').textContent = o.title
    const now = $('.lib__now')
    now.hidden = !o.nowKey
    now.innerHTML = o.nowKey ? `<img alt="" draggable="false" src="${esc(thumbOf(videos, o.nowKey))}" />` : ''
    const sig = (it) => `${nameOf(it.key)}|${it.e?.campaign || ''}|${it.e?.voice ? 1 : 0}`
    const seen = new Map()
    for (const it of o.items) seen.set(sig(it), (seen.get(sig(it)) || 0) + 1)
    cards = new Map(o.items.map((it) => [it.value, card(it, seen.get(sig(it)) > 1)]))
    if (!o.items.some((it) => passes(filter, it))) filter = 'all'
    drawFilters()
    input.value = ''
    draw()
    mark()
    if (!dlg.open) dlg.showModal()
    dlg.classList.remove('is-on')
    void dlg.offsetWidth
    dlg.classList.add('is-on')
    input.focus({ preventScroll: true })
    // the one in use, in view
    const cur = o.focusValue != null ? cards.get(o.focusValue) : null
    scroller.scrollTop = 0
    if (cur?.isConnected) {
      const r = cur.getBoundingClientRect()
      const s = scroller.getBoundingClientRect()
      if (r.bottom > s.bottom - 16) scroller.scrollTop += r.top - s.top - s.height / 2 + r.height / 2
    }
  }
  function close() {
    if (!dlg.open || closing) return
    unpreview()
    dlg.classList.remove('is-on')
    closing = setTimeout(() => {
      closing = 0
      if (dlg.open) dlg.close()
    }, reduced() ? 0 : 150)
  }
  dlg.addEventListener('close', () => {
    unpreview()
    const to = typeof opts?.returnFocus === 'function' ? opts.returnFocus() : back
    opts = null
    cards = new Map()
    body.textContent = ''
    ;(to?.isConnected ? to : back?.isConnected ? back : null)?.focus({ preventScroll: true })
  })
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault()
    close()
  })
  $('.lib__close').addEventListener('click', close)
  // a click outside the sheet (on its backdrop) closes it
  dlg.addEventListener('pointerdown', (e) => {
    if (e.target !== dlg) return
    const r = dlg.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close()
  })
  input.addEventListener('input', draw)
  clear.addEventListener('click', () => {
    input.value = ''
    draw()
    input.focus()
  })
  body.addEventListener('click', (e) => {
    const c = e.target.closest('.lib__item')
    if (!c || !opts || closing || c.getAttribute('aria-disabled') === 'true') return
    const keep = !!opts.multi && (e.shiftKey || e.metaKey || e.ctrlKey)
    opts.onPick(c._it, { keep })
    if (keep && opts) mark()
    else close()
  })

  // ---- keys: Tab stays inside; arrows move between the posters; ↓ or Enter from the search goes to them
  const focusables = () => [...dlg.querySelectorAll('button:not([hidden]), input')].filter((x) => x.getClientRects().length && !x.closest('[hidden]'))
  const items = () => [...body.querySelectorAll('.lib__item')]
  function step(from, key) {
    const all = items()
    const i = all.indexOf(from)
    if (key === 'ArrowLeft') return all[i - 1]
    if (key === 'ArrowRight') return all[i + 1]
    // up / down: the nearest poster in the row above / below
    const a = from.getBoundingClientRect()
    let best = null
    let bd = Infinity
    for (const c of all) {
      if (c === from) continue
      const b = c.getBoundingClientRect()
      const dy = key === 'ArrowDown' ? b.top - a.bottom : a.top - b.bottom
      if (dy < -1) continue
      const d = dy * 4 + Math.abs(b.left - a.left)
      if (d < bd) {
        bd = d
        best = c
      }
    }
    return best
  }
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const f = focusables()
      if (!f.length) return
      const i = f.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault()
        f[0].focus()
      }
      return
    }
    if (e.target === input && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      const all = items()
      if (!all.length) return
      e.preventDefault()
      e.stopPropagation()
      // Enter with one result left picks it
      if (e.key === 'Enter' && all.length === 1) all[0].click()
      else all[0].focus()
      return
    }
    const c = e.target.closest?.('.lib__item')
    if (c && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const to = step(c, e.key)
      if (to) to.focus()
      else if (e.key === 'ArrowUp') input.focus()
    }
  })

  return {
    open,
    close,
    isOpen: () => dlg.open && !closing,
    /** The badges again (the cut changed under the sheet: ⌘Z). */
    refresh: () => dlg.open && opts && mark(),
  }
}

// ------------------------------------------------------------------ a list: posters in order

/**
 * The 'videos' control. ctx: { videos, lib, get, P, apply(changes) } (apply: one undo step, the voice
 * follows the clip that speaks). Click a poster: change it; drag it or ← →: move it; ×: remove it; +: add
 * one. With talk = a param ('hero'): a microphone on each poster, the lit one comes forward and speaks.
 */
export function listControl(spec, ctx) {
  const { videos, lib } = ctx
  const pool = spec.pool
  const min = Number.isFinite(spec.min) ? spec.min : 1
  const talkKey = typeof spec.talk === 'string' ? spec.talk : null
  const fixed = Array.isArray(spec.talk) ? spec.talk.map((n) => Math.round(n) - 1) : []
  const wrap = h('div', { class: 'vl-wrap' })
  const grid = h('div', { class: 'vl', role: 'list', 'aria-label': spec.label })
  const add = h('button', { type: 'button', class: 'vl__add', title: 'Aggiungi un video', 'aria-label': 'Aggiungi un video' }, icon('plus'))
  const cap = h('div', { class: 'vl__cap' })
  const meta = h('span', { class: 'ctl__count' })
  grid.appendChild(add)
  wrap.append(grid, cap)
  ownKeys(wrap)
  let chips = []
  let capAt = null // the poster the caption is about (hover or focus), null = who speaks
  let suppress = false // the click that ends a drag is not a click

  const list = () => {
    const v = ctx.get()
    return Array.isArray(v) ? v : []
  }
  const keyAt = (v) => keyOfItem(videos, v, pool)
  const heroAt = (n) => (talkKey ? heroIndex(ctx.P(), talkKey, n) : -1)
  const speaks = (i, n) => (talkKey ? i === heroAt(n) : fixed.includes(i))

  // ---------------- edits (each one undo step; the one who comes forward follows her video)
  function change(next, hero) {
    const o = { [spec.k]: next }
    if (talkKey && hero !== undefined && hero + 1 !== Math.round(Number(ctx.P()[talkKey]))) o[talkKey] = hero + 1
    ctx.apply(o)
  }
  function move(from, to) {
    const cur = [...list()]
    if (from === to || to < 0 || to >= cur.length) return false
    const h0 = heroAt(cur.length)
    cur.splice(to, 0, cur.splice(from, 1)[0])
    let hh = h0
    if (h0 === from) hh = to
    else if (from < h0 && to >= h0) hh = h0 - 1
    else if (from > h0 && to <= h0) hh = h0 + 1
    change(cur, talkKey ? hh : undefined)
    return true
  }
  function remove(i) {
    const cur = [...list()]
    if (cur.length <= min || i < 0 || i >= cur.length) return false
    const h0 = heroAt(cur.length)
    cur.splice(i, 1)
    const hh = i < h0 ? h0 - 1 : i === h0 ? Math.min(h0, cur.length - 1) : h0
    change(cur, talkKey ? Math.max(0, hh) : undefined)
    return true
  }
  function replace(i, it) {
    const cur = [...list()]
    if (i >= cur.length) {
      if (!cur.includes(it.value)) cur.push(it.value)
    } else {
      const j = cur.indexOf(it.value)
      if (j === i) return
      // already in the list: the two swap places
      if (j >= 0) [cur[i], cur[j]] = [cur[j], cur[i]]
      else cur[i] = it.value
    }
    change(cur)
  }
  function append(it) {
    const cur = [...list()]
    if (cur.includes(it.value)) return
    cur.push(it.value)
    change(cur)
  }
  const animated = (fn) => {
    const before = rectsOf([...chips, add])
    const done = fn()
    flip(before, [...chips, add])
    return done
  }

  function openLib(i) {
    const cur = list()
    const replacing = i >= 0 && i < cur.length
    const items = poolOf(videos, spec)
    const nowKey = replacing ? keyAt(cur[i]) : null
    lib.open({
      title: replacing ? `Cambia il video n. ${i + 1}` : 'Aggiungi un video',
      sub: () => (replacing ? `Ora: ${describe(nowKey)}` : `Va in fondo, al n. ${list().length + 1} · ⇧ clic per aggiungerne più di uno`),
      nowKey,
      items,
      focusValue: replacing ? cur[i] : null,
      multi: !replacing,
      marks: () => {
        const m = new Map()
        list().forEach((v, j) => {
          if (replacing && j === i) m.set(v, { text: 'Ora', now: true, title: 'È questo' })
          else if (!m.has(v)) m.set(v, { text: `n. ${j + 1}`, off: !replacing, title: replacing ? `È già al n. ${j + 1}: clic per scambiarli` : `È già nella lista, al n. ${j + 1}` })
        })
        return m
      },
      onPick: (it) => animated(() => (replacing ? replace(i, it) : append(it))),
      returnFocus: () => (replacing ? chips[i]?.querySelector('.vl__face') : add),
    })
  }

  // ---------------- a poster
  function makeChip() {
    const el = h('div', { class: 'vl__chip', role: 'listitem' })
    el.innerHTML = `<button type="button" class="vl__face"><img alt="" draggable="false" decoding="async" /><span class="vl__n"></span></button>${
      talkKey ? `<button type="button" class="vl__mic"></button>` : `<span class="vl__mic vl__mic--badge" hidden></span>`
    }<button type="button" class="vl__x">${icon('xmark')}</button>`
    return el
  }
  function paint(el, i, v, n) {
    const key = keyAt(v)
    const name = key ? nameOf(key) : String(v)
    const voice = !!entryOf(key)?.voice
    const img = el.querySelector('img')
    const src = thumbOf(videos, key)
    if (img.getAttribute('src') !== src) src ? img.setAttribute('src', src) : img.removeAttribute('src')
    el.classList.toggle('is-missing', !key)
    el.querySelector('.vl__n').textContent = String(i + 1)
    const face = el.querySelector('.vl__face')
    face.setAttribute('aria-label', `n. ${i + 1} · ${name}${key ? '' : ' (non trovato)'} · cambia`)
    face.title = `${name}\nClic: cambialo · trascinalo o ← →: spostalo · ⌫: toglilo`
    const x = el.querySelector('.vl__x')
    x.hidden = n <= min
    x.title = 'Toglilo dalla lista'
    x.setAttribute('aria-label', `Togli ${name}`)
    const on = speaks(i, n)
    el.classList.toggle('is-hero', !!talkKey && on)
    const mic = el.querySelector('.vl__mic')
    const ico = icon(voice ? 'mic' : 'mic-off')
    if (mic._ico !== ico) {
      mic.innerHTML = ico
      mic._ico = ico
    }
    mic.classList.toggle('is-on', on)
    mic.classList.toggle('is-silent', !voice)
    if (talkKey) {
      mic.setAttribute('aria-pressed', String(on))
      const label = on ? `${name} viene avanti e parla` : `Fai venire avanti e parlare ${name}`
      mic.title = label + (voice ? '' : ' · questo video non ha la sua voce')
      mic.setAttribute('aria-label', mic.title)
    } else {
      mic.hidden = !on
      mic.title = on ? (voice ? 'Parla' : 'Parla, ma questo video non ha la sua voce') : ''
    }
  }
  function capText(i) {
    const cur = list()
    if (i == null || i >= cur.length) {
      if (!cur.length) return min === 0 ? 'Nessuno scelto: tutti i video' : 'Nessun video'
      const who = talkKey ? [heroAt(cur.length)] : fixed.filter((j) => j < cur.length)
      if (!who.length) return 'Passa sopra un video per il suo nome'
      const one = (j) => {
        const k = keyAt(cur[j])
        return `<b>${esc(nameOf(k))}</b> (n. ${j + 1})${entryOf(k)?.voice ? '' : ', senza la sua voce'}`
      }
      const lead = talkKey ? 'Viene avanti e parla' : who.length > 1 ? 'Parlano' : 'Parla'
      return `${lead}: ${AND.format(who.map(one))}`
    }
    const k = keyAt(cur[i])
    return [`n. ${i + 1}`, `<b>${esc(k ? nameOf(k) : String(cur[i]))}</b>`, esc(metaOf(k) || (k ? '' : 'non trovato'))].filter(Boolean).join(' · ')
  }
  const showCap = () => {
    const html = capText(capAt)
    if (cap._html !== html) cap.innerHTML = cap._html = html
  }

  // ---------------- the posters on screen = the list (kept by value: their images do not reload)
  function sync() {
    const cur = list()
    const n = cur.length
    meta.textContent = n ? `${n} video` : min === 0 ? 'tutti' : 'nessuno'
    const seen = new Map()
    const ids = cur.map((v) => {
      const c = (seen.get(v) || 0) + 1
      seen.set(v, c)
      return `${v}#${c}`
    })
    const had = new Map(chips.map((c) => [c._id, c]))
    const act = document.activeElement
    const host = chips.find((c) => c.contains(act))
    const next = ids.map((id) => {
      let c = had.get(id)
      if (c) had.delete(id)
      else c = makeChip()
      c._id = id
      return c
    })
    for (const c of had.values()) c.remove()
    next.forEach((c, i) => {
      if (grid.children[i] !== c) grid.insertBefore(c, grid.children[i] || add)
    })
    chips = next
    chips.forEach((c, i) => paint(c, i, cur[i], n))
    if (host?.isConnected && act && document.activeElement !== act) act.focus({ preventScroll: true })
    if (capAt != null && capAt >= n) capAt = null
    showCap()
  }

  // ---------------- clicks
  grid.addEventListener('click', (e) => {
    if (e.target.closest('.vl__add')) return openLib(-1)
    const chip = e.target.closest('.vl__chip')
    if (!chip) return
    const i = chips.indexOf(chip)
    if (e.target.closest('.vl__x')) {
      const focusNext = chip.contains(document.activeElement)
      animated(() => remove(i))
      if (focusNext) (chips[Math.min(i, chips.length - 1)]?.querySelector('.vl__face') || add).focus({ preventScroll: true })
      return
    }
    if (talkKey && e.target.closest('button.vl__mic')) {
      if (i !== heroAt(list().length) || Math.round(Number(ctx.P()[talkKey])) !== i + 1) ctx.apply({ [talkKey]: i + 1 })
      return
    }
    if (e.target.closest('.vl__face')) {
      if (suppress) return
      openLib(i)
    }
  })
  // ← → move the poster, ⌫ removes it (never the block: the panel keeps those keys)
  grid.addEventListener('keydown', (e) => {
    const chip = e.target.closest('.vl__chip')
    if (!chip) {
      // ⌫ on the + right after removing the last posters: never the block's delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }
    const i = chips.indexOf(chip)
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.closest('.vl__face') && !e.metaKey && !e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      const face = chip.querySelector('.vl__face')
      animated(() => move(i, i + (e.key === 'ArrowLeft' ? -1 : 1)))
      face.focus({ preventScroll: true })
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      if (animated(() => remove(i))) (chips[Math.min(i, chips.length - 1)]?.querySelector('.vl__face') || add).focus({ preventScroll: true })
    }
  })
  // the caption follows the pointer and the focus
  grid.addEventListener('pointerover', (e) => {
    const chip = e.target.closest('.vl__chip')
    const i = chip ? chips.indexOf(chip) : null
    if (i !== capAt) {
      capAt = i
      showCap()
    }
  })
  grid.addEventListener('pointerleave', () => {
    if (grid.contains(document.activeElement)) return
    capAt = null
    showCap()
  })
  grid.addEventListener('focusin', (e) => {
    const chip = e.target.closest('.vl__chip')
    capAt = chip ? chips.indexOf(chip) : null
    showCap()
  })
  grid.addEventListener('focusout', (e) => {
    if (grid.contains(e.relatedTarget)) return
    capAt = null
    showCap()
  })

  // ---------------- drag to reorder: the poster follows the pointer, the others make room
  let drag = null
  grid.addEventListener('pointerdown', (e) => {
    const face = e.target.closest('.vl__face')
    if (!face || e.button !== 0 || drag) return
    const chip = face.parentElement
    drag = { chip, face, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, from: chips.indexOf(chip), at: chips.indexOf(chip) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
  })
  function begin(e) {
    drag.on = true
    drag.slots = chips.map((c) => c.getBoundingClientRect())
    drag.box = grid.getBoundingClientRect()
    const r = drag.slots[drag.from]
    drag.grab = { x: e.clientX - r.left, y: e.clientY - r.top }
    drag.chip.classList.add('is-drag')
    grid.classList.add('is-sorting')
    document.body.classList.add('is-moving')
    try {
      drag.face.setPointerCapture(drag.id)
    } catch {}
  }
  function layoutShift() {
    const { from, at } = drag
    chips.forEach((c, j) => {
      if (c === drag.chip) return
      let k = j
      if (from < at && j > from && j <= at) k = j - 1
      else if (from > at && j >= at && j < from) k = j + 1
      const a = drag.slots[j]
      const b = drag.slots[k]
      c.style.transform = k === j ? '' : `translate(${b.left - a.left}px, ${b.top - a.top}px)`
    })
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return
      begin(e)
    }
    e.preventDefault()
    // the slot nearest to the pointer
    let best = drag.at
    let bd = Infinity
    drag.slots.forEach((s, j) => {
      const d = (e.clientX - (s.left + s.width / 2)) ** 2 + (e.clientY - (s.top + s.height / 2)) ** 2
      if (d < bd) {
        bd = d
        best = j
      }
    })
    if (best !== drag.at) {
      drag.at = best
      layoutShift()
    }
    // the poster follows the pointer inside the row (a little slack, never out of its folder)
    const home = drag.slots[drag.from]
    const g = drag.box
    const x = Math.min(g.right - home.width + 4, Math.max(g.left - 4, e.clientX - drag.grab.x))
    const y = Math.min(g.bottom - home.height + 4, Math.max(g.top - 4, e.clientY - drag.grab.y))
    drag.chip.style.transform = `translate(${x - home.left}px, ${y - home.top}px)`
  }
  function end(commit) {
    const d = drag
    drag = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
    if (!d?.on) return
    suppress = true
    setTimeout(() => (suppress = false), 0)
    const before = rectsOf(chips)
    for (const c of chips) {
      c.style.transition = 'none'
      c.style.transform = ''
    }
    d.chip.classList.remove('is-drag')
    grid.classList.remove('is-sorting')
    document.body.classList.remove('is-moving')
    if (commit && d.at !== d.from) move(d.from, d.at)
    flip(before, chips, 300)
    requestAnimationFrame(() => chips.forEach((c) => (c.style.transition = '')))
  }
  const onUp = (e) => drag && e.pointerId === drag.id && end(true)
  const onCancel = (e) => drag && e.pointerId === drag.id && end(false)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !drag?.on) return
    e.preventDefault()
    e.stopPropagation()
    end(false)
  }

  sync()
  return { el: wrap, meta, sync }
}

// ------------------------------------------------------------------ one video: one poster

/** The 'video' control: one poster (click: the library), its name and campaign beside it. */
export function oneControl(spec, ctx) {
  const { videos, lib } = ctx
  const card = h('button', { type: 'button', class: 'vone' })
  card.innerHTML = `<span class="vone__poster"><img alt="" draggable="false" decoding="async" /></span><span class="vone__txt"><b></b><span></span></span><span class="vone__go">Cambia</span>`
  ownKeys(card)
  const img = card.querySelector('img')
  const value = () => ctx.get() || spec.d
  const key = () => keyOfOne(videos, value())
  card.addEventListener('click', () => {
    const items = poolOf(videos, spec, [value(), spec.d])
    const nowValue = () => items.find((it) => it.key === key())?.value ?? value()
    lib.open({
      title: spec.label,
      sub: () => `Ora: ${describe(key())}`,
      nowKey: key(),
      items,
      focusValue: nowValue(),
      marks: () => new Map([[nowValue(), { text: 'Ora', now: true, title: 'È questo' }]]),
      onPick: (it) => it.key !== key() && ctx.apply({ [spec.k]: it.value }),
      returnFocus: card,
    })
  })
  function sync() {
    const k = key()
    const src = thumbOf(videos, k)
    if (img.getAttribute('src') !== src) img.setAttribute('src', src)
    card.querySelector('b').textContent = nameOf(k)
    card.querySelector('.vone__txt span').textContent = metaOf(k) || 'Senza la sua voce'
    card.setAttribute('aria-label', `${spec.label}: ${describe(k)} · cambia`)
    card.title = 'Scegli un altro video'
  }
  sync()
  return { el: card, sync }
}

// ------------------------------------------------------------------ the sentences of the clip that speaks

/**
 * The 'phrase' control. ctx: { videos, P, specOf, apply, pause }. Each sentence of the clip that speaks
 * now: ▶ plays exactly its window(s) of the clip's own audio, a click chooses it (from, to, text and the
 * second window in one undo step). A clip without its voice: a note, and her voiced version when there is one.
 */
export function phraseControl(spec, ctx) {
  const { videos } = ctx
  const keys = spec.keys || {}
  const box = h('div', { class: 'phr' })
  const meta = h('span', { class: 'ctl__count' })
  const listEl = h('div', { class: 'phr__list', role: 'list', 'aria-label': spec.label })
  const note = h('div', { class: 'phr__note', hidden: true })
  const custom = h('p', { class: 'phr__custom', hidden: true })
  const warn = h('div', { class: 'phr__warn', hidden: true, role: 'status' })
  box.append(listEl, note, custom, warn)
  ownKeys(box)
  let drawn = null
  let rows = []
  const clip = () => speakerClip(spec, ctx.P(), ctx.specOf, videos)

  function useTwin(sp, twinKey) {
    const value = twinKey.slice(0, -4)
    if (sp.one) return ctx.apply({ [sp.k]: value })
    const cur = [...(ctx.P()[sp.k] || [])]
    const j = cur.indexOf(value)
    if (j >= 0 && j !== sp.i) [cur[sp.i], cur[j]] = [cur[j], cur[sp.i]]
    else cur[sp.i] = value
    ctx.apply({ [sp.k]: cur })
  }
  function draw(sp) {
    rows = []
    listEl.textContent = ''
    note.textContent = ''
    const phs = phrasesFor(spec, sp.key)
    listEl.hidden = !phs.length
    note.hidden = !!phs.length
    meta.textContent = sp.key ? (phs.length ? `${personOf(sp.key)} · ${frasi(phs.length)}` : personOf(sp.key)) : ''
    if (!phs.length) {
      if (!catalogReady()) note.innerHTML = '<span class="phr__why">Carico le frasi…</span>'
      else if (!sp.key) note.innerHTML = `<span class="phr__why">${icon('info')}Nessun video al n. ${sp.n} della lista</span>`
      else {
        note.innerHTML = `<span class="phr__why">${icon('mic-off')}Questo video non ha la sua voce</span>`
        const twin = voicedTwin(sp.key)
        if (twin) {
          const b = h('button', { type: 'button', class: 'btn btn--sm phr__twin', title: describe(twin) }, `${icon('mic')}<span>Usa la versione con la sua voce</span>`)
          b.addEventListener('click', () => useTwin(sp, twin))
          note.appendChild(b)
        }
      }
      return
    }
    phs.forEach((ph, j) => {
      // exactly what the block will play: one window, or two with the pause between them cut
      const parts = windowsOf(spec, ph)
      const len = parts.reduce((s, [a, b]) => s + span(a, b), 0)
      const cut = parts.length > 1 ? `<i class="phr__cut" title="Una pausa tagliata: due parti del video">${icon('scissors')}</i>` : ''
      const row = h('div', { class: 'phr__row', role: 'listitem' })
      const play = h('button', { type: 'button', class: 'phr__play' }, icon('play'))
      const pick = h(
        'button',
        { type: 'button', class: 'phr__pick', title: 'Usa questa frase' },
        `<span class="phr__txt">${esc(ph.text)}</span><span class="phr__dur">${cut}${ital(len)} s</span>`,
      )
      row.append(play, pick, h('i', { class: 'phr__bar', 'aria-hidden': 'true' }))
      const id = `${sp.key}#${j}`
      const idle = () => {
        row.classList.remove('is-playing')
        row.style.removeProperty('--prog')
        play.innerHTML = icon('play')
        play.title = 'Ascolta solo questa frase'
        play.setAttribute('aria-label', `Ascolta: ${ph.text}`)
      }
      idle()
      play.addEventListener('click', () => {
        if (listeningTo() === id) return stopListening()
        ctx.pause?.()
        listen(id, videos.base + sp.key.replace(/\.mp4$/, '.m4a'), parts, {
          onTick: (p) => row.style.setProperty('--prog', p.toFixed(4)),
          onEnd: idle,
        })
        if (listeningTo() !== id) return
        row.classList.add('is-playing')
        play.innerHTML = icon('stop')
        play.title = 'Ferma'
        play.setAttribute('aria-label', 'Ferma la frase')
      })
      pick.addEventListener('click', () => ctx.apply(phraseWrites(spec, ph)))
      listEl.appendChild(row)
      rows.push({ row, pick, ph })
    })
  }
  function sync() {
    const sp = clip()
    const id = `${catalogReady() ? 1 : 0}:${sp.key || '-' + sp.n}`
    if (id !== drawn) {
      // another clip speaks: what was playing is hers no more
      if (drawn !== null && listeningTo() && !String(listeningTo()).startsWith(`${sp.key}#`)) stopListening()
      drawn = id
      draw(sp)
    }
    const P = ctx.P()
    const near = (a, b) => Math.abs(Number(a) - b) < 0.05 + 1e-9
    let any = false
    for (const r of rows) {
      const on = near(P[keys.from], r.ph.from) && near(P[keys.to], r.ph.to)
      any = any || on
      r.row.classList.toggle('is-on', on)
      r.pick.setAttribute('aria-pressed', String(on))
    }
    custom.hidden = any || !rows.length
    if (!custom.hidden) custom.textContent = `Su misura: dal secondo ${ital(P[keys.from], 2)} al ${ital(P[keys.to], 2)} del video`
    // does it fit? (the clip's end, the block's moment): a warning, and the fix when there is one
    const st = ctx.status ? ctx.status() : null
    const sig = st ? st.text + (st.fix ? st.fix.dur : '') : ''
    if (sig !== warn.dataset.sig) {
      warn.dataset.sig = sig
      warn.textContent = ''
      warn.hidden = !st
      if (st) {
        warn.appendChild(h('span', { class: 'phr__why' }, `${icon('warn')}<span>${esc(st.text)}</span>`))
        if (st.fix && ctx.fix) {
          const b = h('button', { type: 'button', class: 'btn btn--sm' }, esc(st.fix.label))
          b.addEventListener('click', () => ctx.fix(st.fix))
          warn.appendChild(b)
        }
      }
    }
  }
  sync()
  return { el: box, meta, sync }
}
