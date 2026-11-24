// Storyboard: one hand-drawn wireframe per animation of the film, in the wide
// (16:9) or post (9:16) format, with the written animation detail beside each
// one. Times, copy and every value come from the current cut (the studio's
// saved project), so the board follows the edit. Every drawing and every sheet
// is its own SVG (named layers, live text): copy into Figma, or download.
// Open http://localhost:5410/storyboard.html (or Progetto → Storyboard).

import '@fontsource/caveat/400.css'
import '@fontsource/caveat/700.css'
import './style.css'
import { Store } from '../model/store.js'
import { fmtTime } from '../core/util.js'
import { NS, C, pencil } from './pencil.js'
import { WIDE } from './wide.js'
import { POST } from './post.js'
import { specOf } from './spec.js'
import { drawingSVG, sheetSVG, download, copy, zip, slug } from './export.js'

const FORMATS = {
  wide: { key: 'wide', label: 'Wide 16:9', W: 640, H: 360, outW: 1920, outH: 1080, draw: WIDE, tag: '16x9' },
  post: { key: 'post', label: 'Post 9:16', W: 360, H: 640, outW: 1080, outH: 1920, draw: POST, tag: '9x16' },
}

const PANELS = [
  { id: 'open', scene: 'wall', shots: ['open'], title: 'Il primo video scala' },
  { id: 'stat-2', scene: 'wall', shots: ['stat-2'], title: (d) => `${d.s[0].value} ${d.s[0].label}` },
  { id: 'stat-3', scene: 'wall', shots: ['stat-3'], title: (d) => `${d.s[1].value} ${d.s[1].label}` },
  { id: 'stat-175', scene: 'wall', shots: ['stat-175'], title: (d) => `${d.s[2].value} ${d.s[2].label}` },
  { id: 'stat-394', scene: 'wall', shots: ['stat-394'], title: (d) => `${d.s[3].value} ${d.s[3].label}` },
  { id: 'stack', scene: 'phone', shots: ['stack'], title: 'La pila ordinata' },
  { id: 'phone', scene: 'phone', shots: ['phone'], title: (d) => `iPhone · ${d.left} / ${d.right}` },
  { id: 'views', scene: 'phone', shots: ['view-70m', 'view-9m', 'view-985k'], title: (d) => d.v.map((v) => v.value).join(' · ') },
  { id: 'notifs', scene: 'comments', shots: ['notifs'], title: 'Notifiche iOS' },
  { id: 'dive', scene: 'comments', shots: ['dive'], title: 'Tuffo nei commenti' },
  { id: 'headline', scene: 'numbers', shots: ['headline'], title: 'Titolo' },
  { id: 'campaigns', scene: 'numbers', shots: ['campaigns'], title: 'Campagne' },
  { id: 'pin-aria', scene: 'roadmap', shots: ['pin-aria'], title: (d) => `Roadmap · ${d.pins[0].name}` },
  { id: 'pins-mid', scene: 'roadmap', shots: ['pin-gioia', 'pin-nude'], title: (d) => `${d.pins[1].name} · ${d.pins[2].name}` },
  { id: 'pins-logo', scene: 'roadmap', shots: ['pin-uwc', 'pin-natale'], title: (d) => `${d.pins[3].name} · ${d.pins[4].name}` },
  { id: 'signoff', scene: 'outro', shots: ['signoff'], title: 'Logotipo' },
]

const SCENES = { wall: 'Apertura · video', phone: 'iPhone + views', comments: 'Commenti', numbers: 'I numeri', roadmap: 'Roadmap', outro: 'Chiusura' }

/** Title lines as the film sets them: a short measure for 9:16, a longer one for 16:9. */
function lineUp(text, max) {
  const out = []
  for (const w of text.split(/\s+/)) {
    const last = out[out.length - 1]
    if (last && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w
    else out.push(w)
  }
  return out
}

function data(T) {
  const sh = (id) => T.shot(id)
  const hp = sh('headline').p
  const head = hp.caps ? String(hp.text).toLocaleUpperCase('it-IT') : String(hp.text)
  const cp = sh('campaigns').p
  return {
    s: T.scene('wall').shots.filter((s) => s.type === 'stat').map((s) => ({ value: String(s.p.value), label: String(s.p.label) })),
    v: T.scene('phone').shots.filter((s) => s.type === 'view').map((s) => ({ value: String(s.p.value), label: String(s.p.label) })),
    left: String(sh('phone').p.left),
    right: String(sh('phone').p.right),
    headLinesPost: lineUp(head, 9),
    headLinesWide: lineUp(head, 15),
    camp: [
      [cp.v1, cp.n1],
      [cp.v2, cp.n2],
      [cp.v3, cp.n3],
    ],
    pins: T.scene('roadmap').shots.map((s) => ({ name: String(s.p.name), count: String(s.p.count || ''), date: String(s.p.date) })),
  }
}

let format = 'wide'
try {
  format = localStorage.getItem('ci-storyboard-format') === 'post' ? 'post' : 'wide'
} catch {}

let toastTimer = 0
function toast(msg) {
  let el = document.querySelector('.sb-toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'sb-toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200)
}

const btn = (label, onClick, cls = '') => {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'sb-btn ' + cls
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function render() {
  const F = FORMATS[format]
  const store = new Store({ persist: true })
  const T = store.timeline
  const d = data(T)
  const board = document.getElementById('board')
  board.className = 'is-' + F.key
  board.innerHTML = `
    <header class="sb-head">
      <div>
        <h1>Storyboard · Cooltura × Intimissimi</h1>
        <p>Un wireframe disegnato a mano per ogni animazione del film (${T.duration.toFixed(2)} s), con accanto il dettaglio di animazione. Tempi, testi e valori vengono dal montaggio attuale dello studio. Ogni disegno e ogni scheda è un SVG a sé: “Copia” e incolla in Figma, oppure scaricalo.</p>
      </div>
      <div class="sb-tools">
        <div class="sb-seg" role="group" aria-label="Formato"></div>
        <div class="sb-all"></div>
        <div class="sb-legend">
          <span style="color:${C.ink}"><i></i>impaginazione</span>
          <span style="color:${C.violet}"><i></i>numeri</span>
          <span style="color:${C.red}"><i></i>movimento</span>
          <span style="color:${C.soft}"><i class="dash"></i>stato di partenza</span>
        </div>
      </div>
    </header>`
  const seg = board.querySelector('.sb-seg')
  for (const f of Object.values(FORMATS)) {
    const b = btn(f.label, () => {
      format = f.key
      try {
        localStorage.setItem('ci-storyboard-format', format)
      } catch {}
      render()
    })
    b.setAttribute('aria-pressed', String(f.key === format))
    seg.appendChild(b)
  }

  const files = {} // name → svg text, for the zip
  let n = 0
  let list = null
  let lastScene = null
  for (const p of PANELS) {
    if (p.scene !== lastScene) {
      lastScene = p.scene
      const sc = T.scene(p.scene)
      const h = document.createElement('div')
      h.className = 'sb-scene'
      h.innerHTML = `<h2>${SCENES[p.scene]}</h2><span>${fmtTime(sc.start)} → ${fmtTime(sc.end)}</span>`
      board.appendChild(h)
      list = document.createElement('div')
      list.className = 'sb-list'
      board.appendChild(list)
    }
    n++
    const num = String(n).padStart(2, '0')
    const shots = p.shots.map((id) => T.shot(id)).filter(Boolean)
    const t0 = shots[0]?.start ?? 0
    const t1 = shots[shots.length - 1]?.end ?? 0
    const title = typeof p.title === 'function' ? p.title(d) : p.title
    const time = `${fmtTime(t0)} → ${fmtTime(t1)} · ${(t1 - t0).toFixed(2)} s`
    const spec = specOf(p.id, T)
    const base = `${num}-${slug(title)}`

    const row = document.createElement('article')
    row.className = 'sb-row'
    // ---- the drawing
    const fig = document.createElement('div')
    fig.className = 'sb-fig'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${F.W} ${F.H}`)
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', title)
    const clipId = `taglio-${num}`
    svg.innerHTML = `<defs><clipPath id="${clipId}"><rect x="5" y="5" width="${F.W - 10}" height="${F.H - 10}" rx="4"/></clipPath></defs>`
    fig.appendChild(svg)
    row.appendChild(fig)
    list.appendChild(row)
    const k = pencil(svg, n * 31 + 7 + (F.key === 'wide' ? 1000 : 0), { W: F.W, H: F.H })
    const inner = k.group({ 'clip-path': `url(#${clipId})` }, 'disegno')
    F.draw[p.id](inner, d)
    k.rect(5, 5, F.W - 10, F.H - 10, { strokeWidth: 2.1, roughness: 1.5, stroke: C.ink, name: 'inquadratura' })

    const drawingName = `${base}-${F.tag}.svg`
    const sheetName = `${base}-animazione.svg`
    const getDrawing = () => drawingSVG(svg, { W: F.W, H: F.H, outW: F.outW, outH: F.outH, title: `${num} ${title}` })
    const getSheet = () => sheetSVG({ num, title, time, what: spec.what, steps: spec.steps })
    files[`${F.tag}/${drawingName}`] = getDrawing
    files[`${F.tag}/${sheetName}`] = getSheet
    const figBar = document.createElement('div')
    figBar.className = 'sb-bar'
    figBar.append(
      btn('Copia SVG', async () => toast((await copy(getDrawing())) ? 'Disegno copiato: incollalo in Figma' : 'Copia non riuscita')),
      btn('Scarica .svg', () => download(drawingName, getDrawing()), 'is-ghost'),
    )
    fig.appendChild(figBar)

    // ---- the animation sheet
    const side = document.createElement('div')
    side.className = 'sb-side'
    side.innerHTML = `
      <div class="sb-cap">
        <div class="sb-num">${num}</div>
        <div><div class="sb-title">${title}</div><div class="sb-time">${time}</div></div>
      </div>
      <p class="sb-what">${spec.what}</p>
      <ul class="sb-steps">${spec.steps.map((s) => `<li>${s}</li>`).join('')}</ul>`
    const sideBar = document.createElement('div')
    sideBar.className = 'sb-bar'
    sideBar.append(
      btn('Copia SVG scheda', async () => toast((await copy(getSheet())) ? 'Scheda copiata: incollala in Figma' : 'Copia non riuscita')),
      btn('Scarica .svg', () => download(sheetName, getSheet()), 'is-ghost'),
    )
    side.appendChild(sideBar)
    row.appendChild(side)
  }

  board.querySelector('.sb-all').appendChild(
    btn(`Scarica tutto (${Object.keys(files).length} SVG separati, .zip)`, () => {
      const out = {}
      for (const [name, get] of Object.entries(files)) out[name] = get()
      download(`storyboard-cooltura-intimissimi-${F.tag}.zip`, zip(out))
      toast('Zip pronto: un SVG per ogni disegno e ogni scheda')
    }),
  )
}

Promise.all([document.fonts.load('700 80px Caveat'), document.fonts.load('400 22px Caveat')]).finally(render)
// the studio saves the cut as you edit: follow it when this tab comes back to the front
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && render())
