// The panel on the right: the selected block, its timing, and its effects as
// collapsible sections (Premiere's Effect Controls). Under a shot's own effects
// sit the effects of the scene it belongs to.

import { icon, h } from './icons.js'
import { effectsOf, sceneEffects, defaultProject, SHOT_TYPES, SCENE_TYPES, PALETTE, SWATCHES, MIN_DUR } from '../model/project.js'
import { EASES, ease, CUSTOM_EASES, bezierOf } from '../core/util.js'

const SWATCH_LABEL = { lime: 'Lime', lavender: 'Lavanda', violet: 'Viola', orange: 'Arancio', white: 'Bianco', paper: 'Carta', ink: 'Nero', mute: 'Grigio' }
const open = new Map() // effect id → open?

const easeLabel = (n) => (CUSTOM_EASES[n] ? `${CUSTOM_EASES[n].label} (custom)` : n)
const prettySlug = (slug) =>
  slug
    .replace(/^(aria|ext|nude|ul)-/, '')
    .split('-')
    .map((w) => (w === 'spark' ? '· Spark' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')

/** The cubic-bezier editor under an ease control: drag the two handles (GSAP CustomEase). */
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
  svg.innerHTML = `<rect class="grid" x="${sx(0)}" y="${sy(1)}" width="${sx(1) - sx(0)}" height="${sy(0) - sy(1)}"/>
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

export function mountInspector(el, { engine, store }) {
  let drawn = '' // what is on screen (selection + structure): edits only refresh values

  function curve(canvas, name) {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = 64
    const H = 36
    canvas.width = W * dpr
    canvas.height = H * dpr
    const g = canvas.getContext('2d')
    g.scale(dpr, dpr)
    g.clearRect(0, 0, W, H)
    const f = ease(name)
    const pad = 5
    const y = (v) => H - pad - 6 - v * (H - pad * 2 - 8)
    g.strokeStyle = 'rgba(255,255,255,0.14)'
    g.beginPath()
    g.moveTo(pad, y(0))
    g.lineTo(W - pad, y(0))
    g.moveTo(pad, y(1))
    g.lineTo(W - pad, y(1))
    g.stroke()
    g.strokeStyle = '#c0ff33'
    g.lineWidth = 1.5
    g.beginPath()
    for (let i = 0; i <= 40; i++) {
      const x = i / 40
      const px = pad + x * (W - pad * 2)
      const py = y(f(x))
      i ? g.lineTo(px, py) : g.moveTo(px, py)
    }
    g.stroke()
  }

  function control(spec, kind, id, get) {
    const row = h('div', { class: 'ctl ctl--' + spec.t, 'data-k': spec.k })
    const set = (v) => store.setParam(kind, id, spec.k, v)
    const lab = h('label', { class: 'ctl__label' }, spec.label)
    row.appendChild(lab)
    if (spec.t === 'num') {
      const wrap = h('div', { class: 'ctl__num' })
      const range = h('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, 'aria-label': spec.label })
      const box = h('input', { type: 'number', min: spec.min, max: spec.max, step: spec.step, 'aria-label': spec.label })
      const unit = h('span', { class: 'ctl__unit' }, spec.unit || '')
      range.addEventListener('pointerdown', () => store.begin())
      range.addEventListener('input', () => {
        set(Number(range.value))
        box.value = range.value
      })
      range.addEventListener('change', () => store.commit())
      box.addEventListener('change', () => {
        const v = Math.min(spec.max, Math.max(spec.min, Number(box.value)))
        if (Number.isFinite(v)) set(v)
      })
      wrap.append(range, box, unit)
      row.appendChild(wrap)
      row._sync = () => {
        const v = get()
        if (document.activeElement !== box) box.value = String(Math.round(v * 1000) / 1000)
        range.value = String(v)
        range.style.setProperty('--p', ((v - spec.min) / (spec.max - spec.min)) * 100 + '%')
      }
    } else if (spec.t === 'bool') {
      const sw = h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-label': spec.label }, '<i></i>')
      sw.addEventListener('click', () => set(!get()))
      row.appendChild(sw)
      row._sync = () => {
        sw.classList.toggle('is-on', !!get())
        sw.setAttribute('aria-checked', String(!!get()))
      }
    } else if (spec.t === 'color') {
      const wrap = h('div', { class: 'ctl__swatches' })
      const btns = SWATCHES.map((k) => {
        const b = h('button', { class: 'swatch', type: 'button', title: SWATCH_LABEL[k], style: `--c:${PALETTE[k]}` })
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
      row._sync = () => {
        const v = get()
        btns.forEach(([k, b]) => b.classList.toggle('is-on', k === v))
        const isHex = String(v).startsWith('#')
        custom.classList.toggle('is-on', isHex)
        custom.value = isHex ? v : PALETTE[v] || '#ffffff'
      }
    } else if (spec.t === 'select') {
      if (spec.opts.length <= 3) {
        const seg = h('div', { class: 'seg' })
        const btns = spec.opts.map(([v, label]) => {
          const b = h('button', { type: 'button' }, label)
          b.addEventListener('click', () => set(v))
          seg.appendChild(b)
          return [v, b]
        })
        row.appendChild(seg)
        row._sync = () => btns.forEach(([v, b]) => b.classList.toggle('is-on', String(v) === String(get())))
      } else {
        const sel = h('select', { 'aria-label': spec.label })
        spec.opts.forEach(([v, label]) => sel.appendChild(h('option', { value: v }, label)))
        sel.addEventListener('change', () => set(sel.value))
        row.appendChild(sel)
        row._sync = () => (sel.value = String(get()))
      }
    } else if (spec.t === 'ease') {
      const wrap = h('div', { class: 'ctl__ease' })
      const cv = h('canvas', { class: 'ctl__curve' })
      const sel = h('select', { 'aria-label': spec.label })
      EASES.forEach((n) => sel.appendChild(h('option', { value: n }, easeLabel(n))))
      sel.appendChild(h('option', { value: '__cubic' }, 'cubic-bezier…'))
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
      wrap.append(cv, sel)
      // the curve opens a bezier editor (drag the handles): any curve becomes a GSAP CustomEase
      const bez = bezierEditor(get, set, () => store.begin(), () => store.commit())
      bez.hidden = true
      cv.title = 'Modifica la curva (cubic-bezier · GSAP CustomEase)'
      cv.addEventListener('click', () => {
        bez.hidden = !bez.hidden
        if (!bez.hidden && !bezierOf(get())) set(`cubic(${bezierOf('ci.reveal').join(',')})`)
        bez._sync()
      })
      row.append(wrap, cubic, bez)
      row._sync = () => {
        const v = String(get())
        const isCubic = v.startsWith('cubic(')
        // a value from a pasted project that is not in the list still shows (and stays selectable)
        if (!isCubic && ![...sel.options].some((o) => o.value === v)) sel.insertBefore(h('option', { value: v }, v), sel.lastChild)
        sel.value = isCubic ? '__cubic' : v
        cubic.hidden = !isCubic
        if (isCubic && document.activeElement !== cubic) cubic.value = v.slice(6, -1).split(',').join(', ')
        curve(cv, v)
        if (!bez.hidden) bez._sync()
      }
    } else if (spec.t === 'videos') {
      // the videos of a carousel: the whole campaign folder, tick to add (they arrive in this order)
      const pool = engine.videos
        .keys('v3/feed/' + (spec.pool || ''))
        .map((k) => k.slice('v3/feed/'.length, -4))
        .sort()
      const headEl = h('div', { class: 'vids__head' }, '<span></span><span>clic per aggiungere / togliere</span>')
      const list = h('div', { class: 'vids' })
      const btns = pool.map((slug) => {
        const b = h('button', { type: 'button', class: 'vid' }, `<i></i><span>${prettySlug(slug)}</span><em></em>`)
        b.addEventListener('click', () => {
          const cur = [...(get() || [])]
          const i = cur.indexOf(slug)
          if (i >= 0) {
            if (cur.length > 1) cur.splice(i, 1)
          } else cur.push(slug)
          set(cur)
        })
        list.appendChild(b)
        return [slug, b]
      })
      row.append(headEl, list)
      row._sync = () => {
        const cur = get() || []
        headEl.firstChild.textContent = `${cur.length} video su ${pool.length}`
        btns.forEach(([slug, b]) => {
          const i = cur.indexOf(slug)
          b.classList.toggle('is-on', i >= 0)
          b.querySelector('em').textContent = i >= 0 ? String(i + 1) : ''
        })
      }
    } else {
      const box = h('input', { type: 'text', 'aria-label': spec.label, spellcheck: 'false' })
      box.addEventListener('focus', () => store.begin())
      box.addEventListener('input', () => set(box.value))
      box.addEventListener('blur', () => store.commit())
      row.appendChild(box)
      row._sync = () => {
        if (document.activeElement !== box) box.value = String(get() ?? '')
      }
    }
    return row
  }

  function section(fx, kind, id, getP, defaults) {
    const key = kind + ':' + fx.id
    if (!open.has(key)) open.set(key, true)
    const sec = h('section', { class: 'fx' + (open.get(key) ? ' is-open' : '') })
    const head = h('header', { class: 'fx__head' })
    const title = h('button', { class: 'fx__title', type: 'button' }, `${icon('chevron', 'fx__chev')}${icon(fx.icon || 'sliders', 'fx__ico')}<span>${fx.label}</span>`)
    title.addEventListener('click', () => {
      open.set(key, !open.get(key))
      sec.classList.toggle('is-open', open.get(key))
    })
    head.appendChild(title)
    let sw = null
    if (fx.on) {
      sw = h('button', { class: 'switch switch--sm', role: 'switch', type: 'button', title: 'Attiva / disattiva', 'aria-label': 'Attiva ' + fx.label }, '<i></i>')
      sw.addEventListener('click', () => store.setParam(kind, id, fx.on, !getP()[fx.on]))
      head.appendChild(sw)
    }
    const reset = h('button', { class: 'fx__reset', type: 'button', title: 'Ripristina questo effetto' }, icon('undo'))
    reset.addEventListener('click', () => {
      store.begin()
      for (const p of fx.params) store.setParam(kind, id, p.k, defaults[p.k] ?? p.d)
      store.commit()
    })
    head.appendChild(reset)
    const body = h('div', { class: 'fx__body' })
    const rows = fx.params.filter((p) => p.k !== fx.on).map((p) => control(p, kind, id, () => getP()[p.k]))
    rows.forEach((r) => body.appendChild(r))
    sec.append(head, body)
    sec._sync = () => {
      rows.forEach((r) => r._sync())
      if (sw) {
        const on = !!getP()[fx.on]
        sw.classList.toggle('is-on', on)
        sw.setAttribute('aria-checked', String(on))
        sec.classList.toggle('is-off', !on)
      }
    }
    return sec
  }

  let syncers = []

  function render() {
    const sel = store.selection
    const T = store.timeline
    const shot = sel?.kind === 'shot' ? T.shot(sel.id) : null
    const scene = sel?.kind === 'scene' ? T.scene(sel.id) : shot?.scene || null
    const sig = `${sel?.kind}:${sel?.id}:${T.shots.length}`
    if (sig === drawn) return sync()
    drawn = sig
    el.innerHTML = ''
    syncers = []
    const add = (node) => {
      el.appendChild(node)
      if (node._sync) syncers.push(node._sync)
      return node
    }

    if (!shot && !scene) {
      add(
        h(
          'div',
          { class: 'insp__empty' },
          `<div class="insp__kicker">Effetti</div><h2>Seleziona un blocco</h2>
           <p>Clicca uno shot nella timeline per vedere gli effetti che ha sopra e modificarli. I bordi del blocco ne cambiano la durata.</p>`,
        ),
      )
      const look = { id: 'look', label: 'Look globale', icon: 'sliders', params: [{ k: 'grain', label: 'Grana', t: 'num', d: 0.03, min: 0, max: 0.12, step: 0.002 }, { k: 'vignette', label: 'Vignetta', t: 'num', d: 0, min: 0, max: 0.6, step: 0.01 }] }
      add(section(look, 'look', null, () => store.project.look, { grain: 0.03, vignette: 0 }))
      return sync()
    }

    // header
    const head = h('div', { class: 'insp__head' })
    if (shot) {
      head.innerHTML = `<div class="insp__kicker"><i style="background:${shot.scene.hue}"></i>${shot.scene.label} · ${SHOT_TYPES[shot.type].label}</div>
        <input class="insp__name" type="text" aria-label="Nome dello shot" spellcheck="false" />
        <div class="insp__time">
          <label>Durata<span class="insp__dur"><input type="number" step="0.05" min="${MIN_DUR}" aria-label="Durata in secondi" /><em>s</em></span></label>
          <div class="insp__range"></div>
        </div>`
      const name = head.querySelector('.insp__name')
      name.addEventListener('focus', () => store.begin())
      name.addEventListener('input', () => store.edit(() => (store.findShot(shot.id).name = name.value), { live: true }))
      name.addEventListener('blur', () => store.commit())
      const dur = head.querySelector('.insp__dur input')
      dur.addEventListener('change', () => store.setDur(shot.id, Number(dur.value)))
      head._sync = () => {
        const s = store.timeline.shot(shot.id)
        if (!s) return
        if (document.activeElement !== name) name.value = s.name
        if (document.activeElement !== dur) dur.value = s.dur.toFixed(2)
        head.querySelector('.insp__range').textContent = `${s.start.toFixed(2)} → ${s.end.toFixed(2)} s`
      }
    } else {
      head.innerHTML = `<div class="insp__kicker"><i style="background:${scene.hue}"></i>Scena</div><h2 class="insp__title">${scene.label}</h2>
        <div class="insp__time"><span>${scene.shots.length} shot</span><div class="insp__range"></div></div>`
      head._sync = () => {
        const s = store.timeline.scene(scene.id)
        if (s) head.querySelector('.insp__range').textContent = `${s.start.toFixed(2)} → ${s.end.toFixed(2)} s · ${s.dur.toFixed(2)} s`
      }
    }
    add(head)

    if (shot) {
      const fxs = effectsOf(shot.src)
      // "reset" goes back to this shot's own starting values (e.g. its number), not the generic ones
      const own = defaultProject().scenes.flatMap((x) => x.shots).find((x) => x.id === shot.id)?.params || {}
      const defaults = { ...Object.fromEntries(fxs.flatMap((f) => f.params.map((p) => [p.k, p.d]))), ...own }
      add(h('div', { class: 'insp__group' }, `Effetti sullo shot <b>${fxs.length}</b>`))
      for (const fx of fxs) add(section(fx, 'shot', shot.id, () => store.timeline.shot(shot.id)?.p || {}, defaults))
    }
    const sfx = sceneEffects(scene.src)
    if (sfx.length) {
      add(h('div', { class: 'insp__group' }, `Effetti della scena “${SCENE_TYPES[scene.type].label}” <b>${sfx.length}</b>`))
      for (const fx of sfx) add(section(fx, 'scene', scene.id, () => store.timeline.scene(scene.id)?.p || {}, {}))
    } else if (!shot) {
      add(h('div', { class: 'insp__note' }, 'Questa scena non ha effetti propri: seleziona uno dei suoi shot.'))
    }
    sync()
  }

  function sync() {
    for (const f of syncers) f()
  }

  store.on((what) => {
    if (what === 'selection') render()
    if (what === 'project' || what === 'history') render()
  })
  render()
  return { render }
}
