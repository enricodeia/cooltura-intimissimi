// Render the score headlessly through tools/score-lab.html (one Chrome, closed
// at the end), write a 48 kHz 16-bit stereo WAV and analyse it with ffmpeg.
//
//   node tools/score.mjs --out <dir> [--name score] [--duration 42] [--sr 48000] [--cues '{"groove":5.5,...}'] [--mix '{"drums":-2}']
//
// Renders twice (render time + sample-exact determinism), then: EBU R128
// (integrated, LRA, true peak), astats (peak, RMS, DC), silencedetect, a
// spectrogram and a waveform PNG, the RMS of every section and the final tail.

import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.CI_PORT || 5410)
const BASE = `http://localhost:${PORT}`

function args(argv) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) o[argv[i].slice(2)] = true
    else o[argv[i++].slice(2)] = next
  }
  return o
}

const o = args(process.argv.slice(2))
const out = path.resolve(o.out || path.join(os.tmpdir(), 'cooltura-score'))
const name = o.name || 'score'
fs.mkdirSync(out, { recursive: true })
const opts = { debug: true }
if (o.duration) opts.duration = Number(o.duration)
if (o.cues) opts.cues = JSON.parse(o.cues)
if (o.mix) opts.mix = JSON.parse(o.mix)
if (o.sr) opts.sampleRate = Number(o.sr)

// ---------------------------------------------------------------- render (one browser, always closed)

const errors = []
let first
let second
let same
let b64
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling'] })
try {
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  await page.goto(`${BASE}/tools/score-lab.html`)
  await page.waitForFunction(() => window.__score && window.__score.ready, null, { timeout: 30000 })
  first = await page.evaluate((x) => window.__score.render(x), opts)
  second = await page.evaluate((x) => window.__score.render(x), opts)
  same = await page.evaluate(() => window.__score.compare())
  b64 = await page.evaluate(() => window.__score.pcm())
} catch (e) {
  errors.push('[harness] ' + (e.stack || e.message))
} finally {
  await browser.close()
}
if (!b64) {
  console.error(errors.join('\n'))
  process.exit(1)
}

// ---------------------------------------------------------------- WAV (16-bit, no dither: deterministic)

const raw = Buffer.from(b64, 'base64')
const f = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
const sr = second.sampleRate
const frames = f.length / 2
const wav = path.join(out, `${name}.wav`)
const pcm = Buffer.alloc(frames * 4)
for (let i = 0; i < frames * 2; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767))), i * 2)
const head = Buffer.alloc(44)
head.write('RIFF', 0)
head.writeUInt32LE(36 + pcm.length, 4)
head.write('WAVEfmt ', 8)
head.writeUInt32LE(16, 16)
head.writeUInt16LE(1, 20)
head.writeUInt16LE(2, 22)
head.writeUInt32LE(sr, 24)
head.writeUInt32LE(sr * 4, 28)
head.writeUInt16LE(4, 32)
head.writeUInt16LE(16, 34)
head.write('data', 36)
head.writeUInt32LE(pcm.length, 40)
fs.writeFileSync(wav, Buffer.concat([head, pcm]))

// ---------------------------------------------------------------- measurements in JS

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity)
function span(t0, t1) {
  const a = Math.max(0, Math.round(t0 * sr))
  const b = Math.min(frames, Math.round(t1 * sr))
  let e = 0
  let p = 0
  for (let i = a; i < b; i++) {
    const l = f[2 * i]
    const r = f[2 * i + 1]
    e += l * l + r * r
    p = Math.max(p, Math.abs(l), Math.abs(r))
  }
  return { rms: +db(Math.sqrt(e / Math.max(1, 2 * (b - a)))).toFixed(1), peak: +db(p).toFixed(1) }
}
// K-weighted (BS.1770 at 48 kHz) mean loudness of a span, ungated: compares sections perceptually
const kw = (() => {
  const st = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1, -2, 1, -1.99004745483398, 0.99007225036621]]
  const y = new Float32Array(f.length)
  for (let c = 0; c < 2; c++) {
    const z = [0, 0, 0, 0]
    for (let i = 0; i < frames; i++) {
      let v = f[2 * i + c]
      for (let k = 0; k < 2; k++) {
        const [b0, b1, b2, a1, a2] = st[k]
        const o = b0 * v + z[2 * k]
        z[2 * k] = b1 * v - a1 * o + z[2 * k + 1]
        z[2 * k + 1] = b2 * v - a2 * o
        v = o
      }
      y[2 * i + c] = v
    }
  }
  return y
})()
function lufsOf(t0, t1) {
  const a = Math.max(0, Math.round(t0 * sr))
  const b = Math.min(frames, Math.round(t1 * sr))
  let e = 0
  for (let i = 2 * a; i < 2 * b; i++) e += kw[i] * kw[i]
  return +(-0.691 + 10 * Math.log10((2 * e) / Math.max(1, 2 * (b - a)) + 1e-20)).toFixed(1)
}
const cues = second.cues
const sections = second.debug.sections.map((s) => ({ ...s, ...span(s.t0, s.t1), lufs: lufsOf(s.t0, s.t1) }))
const dur = frames / sr
const final = cues.final
const tail = final !== undefined ? { hit: span(final, final + 0.3), beforeFade: span(dur - 0.25, dur - 0.15), last50ms: span(dur - 0.05, dur) } : null
if (tail) tail.dropDb = +(tail.beforeFade.rms - tail.hit.rms).toFixed(1)
// short-term clicks: largest sample-to-sample jump
let jump = 0
let jumpAt = 0
for (let i = 1; i < frames; i++) {
  for (let c = 0; c < 2; c++) {
    const d = Math.abs(f[2 * i + c] - f[2 * (i - 1) + c])
    if (d > jump) {
      jump = d
      jumpAt = i / sr
    }
  }
}

// ---------------------------------------------------------------- ffmpeg

const ff = (a) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...a], { encoding: 'utf8', maxBuffer: 64 << 20 })
  return (r.stderr || '') + (r.stdout || '')
}
const ebur = ff(['-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
const summary = ebur.slice(ebur.lastIndexOf('Summary:'))
const num = (re, s) => {
  const m = re.exec(s)
  return m ? Number(m[1]) : null
}
const r128 = {
  integrated: num(/I:\s+(-?[\d.]+) LUFS/, summary),
  lra: num(/LRA:\s+(-?[\d.]+) LU/, summary),
  truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/, summary),
}
const ast = ff(['-i', wav, '-af', 'astats', '-f', 'null', '-'])
const overall = ast.slice(ast.lastIndexOf('Overall'))
const astats = {
  dcOffset: num(/DC offset:\s+(-?[\d.e+-]+)/, overall),
  peakDb: num(/Peak level dB:\s+(-?[\d.]+)/, overall),
  rmsDb: num(/RMS level dB:\s+(-?[\d.]+)/, overall),
}
const sil = ff(['-i', wav, '-af', 'silencedetect=noise=-60dB:d=0.3', '-f', 'null', '-'])
const silences = [...sil.matchAll(/silence_(start|end): (-?[\d.]+)/g)].map((m) => `${m[1]} ${m[2]}`)
const spec = path.join(out, `${name}-spectrum.png`)
ff(['-y', '-i', wav, '-lavfi', 'showspectrumpic=s=1600x600:legend=1', spec])
const wave = path.join(out, `${name}-wave.png`)
ff(['-y', '-i', wav, '-lavfi', 'showwavespic=s=1600x300:split_channels=1', '-frames:v', '1', wave])

const report = {
  wav,
  spectrogram: spec,
  waveform: wave,
  renderMs: { first: first.ms, second: second.ms, inside: second.debug.ms },
  deterministic: { ...same, hashes: [first.hash, second.hash] },
  r128,
  astats,
  jsLoudness: { lufs: second.debug.lufs, preLufs: second.debug.preLufs, masterGainDb: second.debug.masterGainDb, glueDb: second.debug.glueDb, iterations: second.debug.iterations, limiter: second.debug.limiter },
  chords: second.debug.chords.map(([t, c]) => `${t}:${c}`).join(' '),
  counts: second.debug.counts,
  samplePeakDb: +db(f.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toFixed(2),
  maxJump: { value: +jump.toFixed(4), at: +jumpAt.toFixed(3) },
  silences,
  cues,
  sections,
  tail,
  stems: second.debug.stems,
  errors,
}
fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(report, null, 1))
fs.writeFileSync(path.join(out, `${name}-ffmpeg.log`), [summary, overall, sil].join('\n\n'))
console.log(JSON.stringify(report, null, 1))
