// The panel on the right: the selected block, its timing, and its effects as
// collapsible sections (Premiere's Effect Controls). Under a shot's own effects
// sit the effects of the scene it belongs to.

import { icon, h } from './icons.js'
import { effectsOf, sceneEffects, defaultProject, SHOT_TYPES, SCENE_TYPES, PALETTE, SWATCHES, MIN_DUR } from '../model/project.js'
import { EASES, ease } from '../core/util.js'

const SWATCH_LABEL = { lime: 'Lime', lavender: 'Lavanda', violet: 'Viola', orange: 'Arancio', white: 'Bianco', paper: 'Carta', ink: 'Nero' }
const open = new Map() // effect id → open?

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
      EASES.forEach((n) => sel.appendChild(h('option', { value: n }, n === 'coolBounce' ? 'elastic bounce (custom)' : n === 'coolGlide' ? 'glide (custom)' : n === 'coolWhip' ? 'whip (custom)' : n)))
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
      row.append(wrap, cubic)
      row._sync = () => {
        const v = String(get())
        const isCubic = v.startsWith('cubic(')
        // a value from a pasted project that is not in the list still shows (and stays selectable)
        if (!isCubic && ![...sel.options].some((o) => o.value === v)) sel.insertBefore(h('option', { value: v }, v), sel.lastChild)
        sel.value = isCubic ? '__cubic' : v
        cubic.hidden = !isCubic
        if (isCubic && document.activeElement !== cubic) cubic.value = v.slice(6, -1).split(',').join(', ')
        curve(cv, v)
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
