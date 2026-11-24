// Score lab: renders src/v4/score.js with the planned cut's cues, draws the
// waveform (cue markers on top), plays it, and exposes the PCM to
// tools/score.mjs through window.__score.

import { renderScore, SCORE_DEFAULTS } from '../src/v4/score.js'

export const DEFAULT_CUES = { groove: 5.5, peak: 11.0, hits: [13.0, 13.75, 14.5, 15.25, 16.0], drop: 17.5, pulse: 19.0, build: 31.5, stop: 38.0, final: 40.0 }
export const DEFAULT_DURATION = 42.0

const $ = (id) => document.getElementById(id)
const renders = []
let ac = null
let node = null

/** FNV-1a over the float32 bytes of every channel. */
function hash(buffer) {
  let h = 0x811c9dc5
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const b = new Uint8Array(buffer.getChannelData(c).buffer)
    for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function draw(buffer, cues) {
  const cv = $('wave')
  const g = cv.getContext('2d')
  const { width: W, height: H } = cv
  g.clearRect(0, 0, W, H)
  const L = buffer.getChannelData(0)
  const R = buffer.getChannelData(1)
  const step = Math.ceil(L.length / W)
  g.fillStyle = '#6cf'
  for (let x = 0; x < W; x++) {
    let m = 0
    for (let i = x * step; i < Math.min(L.length, (x + 1) * step); i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]))
    g.fillRect(x, H / 2 - (m * H) / 2, 1, m * H)
  }
  g.fillStyle = '#f84'
  const at = (t) => (t / buffer.duration) * W
  for (const [k, t] of Object.entries(cues)) {
    if (k === 'hits') for (const h of t) g.fillRect(at(h), 0, 1, 10)
    else {
      g.fillRect(at(t), 0, 1, H)
      g.fillText(k, at(t) + 3, 12)
    }
  }
}

async function render(opts = {}) {
  const o = { duration: DEFAULT_DURATION, cues: DEFAULT_CUES, mix: { ...SCORE_DEFAULTS }, ...opts }
  const t0 = performance.now()
  const r = await renderScore(o)
  const ms = Math.round(performance.now() - t0)
  renders.push(r.buffer)
  if (renders.length > 2) renders.shift()
  draw(r.buffer, r.cues)
  $('play').disabled = false
  $('stop').disabled = false
  const info = { ms, hash: hash(r.buffer), length: r.buffer.length, sampleRate: r.buffer.sampleRate, cues: r.cues, debug: r.debug }
  $('log').textContent = JSON.stringify(info, null, 1)
  return info
}

/** Are the last two renders identical, sample for sample? */
function compare() {
  if (renders.length < 2) return { identical: false, reason: 'need two renders' }
  const [a, b] = renders
  if (a.length !== b.length) return { identical: false, reason: 'length' }
  let diff = 0
  let maxDiff = 0
  for (let c = 0; c < 2; c++) {
    const x = a.getChannelData(c)
    const y = b.getChannelData(c)
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i]) {
        diff++
        maxDiff = Math.max(maxDiff, Math.abs(x[i] - y[i]))
      }
    }
  }
  return { identical: diff === 0, differing: diff, maxDiff }
}

/** The last render as interleaved float32 little-endian, base64. */
function pcm() {
  const b = renders[renders.length - 1]
  const L = b.getChannelData(0)
  const R = b.getChannelData(1)
  const f = new Float32Array(L.length * 2)
  for (let i = 0; i < L.length; i++) {
    f[2 * i] = L[i]
    f[2 * i + 1] = R[i]
  }
  const bytes = new Uint8Array(f.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

$('render').onclick = () => render()
$('play').onclick = () => {
  const b = renders[renders.length - 1]
  if (!b) return
  ac = ac || new AudioContext()
  if (node) node.stop()
  node = new AudioBufferSourceNode(ac, { buffer: b })
  node.connect(ac.destination)
  node.start()
}
$('stop').onclick = () => node && node.stop()

window.__score = { ready: true, render, compare, pcm, DEFAULT_CUES, DEFAULT_DURATION }
