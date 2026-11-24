// SVG out: every drawing and every animation sheet is its own file, made of
// named layers (ids), with live text in Caveat. Copy one and paste it in Figma,
// or download one, or download them all as separate files in a zip.

import { zipSync, strToU8 } from 'fflate'
import { NS, C, FONT } from './pencil.js'

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n'

/** The drawing as a standalone SVG at the film's pixel size (viewBox in board units). */
export function drawingSVG(svgEl, { W, H, outW, outH, title }) {
  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', NS)
  clone.setAttribute('width', outW)
  clone.setAttribute('height', outH)
  clone.setAttribute('viewBox', `0 0 ${W} ${H}`)
  clone.removeAttribute('class')
  clone.removeAttribute('role')
  clone.removeAttribute('aria-label')
  const t = document.createElementNS(NS, 'title')
  t.textContent = title
  clone.insertBefore(t, clone.firstChild)
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('id', 'foglio')
  bg.setAttribute('width', W)
  bg.setAttribute('height', H)
  bg.setAttribute('fill', C.sheet)
  clone.insertBefore(bg, t.nextSibling)
  return HEAD + new XMLSerializer().serializeToString(clone)
}

// text wrapping for the sheets, measured with the real font
const ctx = document.createElement('canvas').getContext('2d')
function wrap(str, size, weight, maxW) {
  ctx.font = `${weight} ${size}px ${FONT}`
  const out = []
  let cur = ''
  for (const w of String(str).split(/\s+/)) {
    const next = cur ? cur + ' ' + w : w
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) out.push(cur)
  return out
}

/** The animation sheet as its own SVG: number, title, time, what happens, one paragraph per track. */
export function sheetSVG({ num, title, time, what, steps }, { width = 1200 } = {}) {
  const pad = 56
  const maxW = width - pad * 2
  const parts = []
  let y = pad + 46
  parts.push(`<text id="numero" x="${pad}" y="${y}" font-family="${FONT}" font-size="62" font-weight="700" fill="${C.red}">${esc(num)}</text>`)
  parts.push(`<text id="titolo" x="${pad + 92}" y="${y}" font-family="${FONT}" font-size="50" font-weight="700" fill="${C.ink}">${esc(title)}</text>`)
  y += 40
  parts.push(`<text id="tempi" x="${pad + 94}" y="${y}" font-family="${FONT}" font-size="27" fill="${C.soft}">${esc(time)}</text>`)
  y += 64
  const para = (id, str, size, weight, x, w, color, lh = 1.16) => {
    const ls = wrap(str, size, weight, w)
    const spans = ls.map((l, i) => `<tspan x="${x}" y="${(y + i * size * lh).toFixed(1)}">${esc(l)}</tspan>`).join('')
    parts.push(`<text id="${id}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}">${spans}</text>`)
    y += ls.length * size * lh
  }
  para('cosa-succede', what, 36, 700, pad, maxW, C.ink)
  y += 26
  steps.forEach((st, i) => {
    parts.push(`<g id="traccia-${i + 1}"><text id="punto-${i + 1}" x="${pad}" y="${y}" font-family="${FONT}" font-size="34" font-weight="700" fill="${C.red}">·</text>`)
    para(`traccia-${i + 1}-testo`, st, 31, 400, pad + 26, maxW - 26, C.ink)
    parts.push('</g>')
    y += 16
  })
  const height = Math.ceil(y + pad - 16)
  return `${HEAD}<svg xmlns="${NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${esc(num + ' ' + title)}</title><rect id="foglio" width="${width}" height="${height}" fill="${C.sheet}"/>${parts.join('')}</svg>`
}

export function download(name, text, type = 'image/svg+xml') {
  const blob = text instanceof Blob ? text : new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fallback for browsers that block the async clipboard
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Separate files in one zip: { 'name.svg': text }. */
export function zip(files) {
  const entries = {}
  for (const [name, text] of Object.entries(files)) entries[name] = strToU8(text)
  return new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' })
}

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
