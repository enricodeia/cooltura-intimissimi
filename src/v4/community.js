// Value 02 · community, in real time: one creator talks (her own voice) in a tall
// video, and the real comments of the campaign float in one after the other,
// alternating sides like a conversation, the newest at the bottom pushing the
// others up. Each comment is a bubble of frosted glass: the video behind it,
// blurred and veiled (sampled from the video itself, so it is the real backdrop),
// the glass forms first, then the words come into focus. Light, organic, no
// dashboard: no counters, no icons of apps.

import * as THREE from 'three'
import { tileMaterial, canvasTexture } from '../lib/materials.js'
import { keysOf, voicedTime, softClipTime } from './common.js'
import { seg, clamp, lerp, ease, hash } from '../core/util.js'

const A = 9 / 16

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform sampler2D uBg;
uniform vec4 uRect;
uniform vec4 uBgRect;
uniform vec2 uBgScale;
uniform float uRadius;
uniform float uOpacity;
uniform float uFrost;
uniform float uInk;
uniform float uLod;
uniform vec3 uTint;
uniform vec3 uPaper;
uniform float uTintK;
varying vec2 vUv;
vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  vec2 hs = uRect.zw * 0.5;
  vec2 lp = (vUv - 0.5) * uRect.zw;
  vec2 d = abs(lp) - (hs - uRadius);
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - uRadius;
  float aa = max(fwidth(sd), 1e-5);
  float shape = clamp(0.5 - sd / aa, 0.0, 1.0);
  if (shape <= 0.0) discard;
  // what is behind: the video (blurred by its own mip chain) or the paper
  vec2 P = uRect.xy + lp;
  vec2 q = (P - uBgRect.xy) / uBgRect.zw;
  vec2 uvb = q * uBgScale + 0.5;
  float inV = smoothstep(0.5, 0.49, abs(q.x)) * smoothstep(0.5, 0.49, abs(q.y));
  vec3 bg = lin(textureLod(uBg, clamp(uvb, 0.0, 1.0), uLod * uFrost).rgb);
  vec3 behind = mix(uPaper, bg, inV);
  vec3 glass = mix(behind, uTint, uTintK * uFrost);
  // a light rim and a breath of light from the top
  float rim = smoothstep(-aa * 2.2, 0.0, sd);
  glass += vec3(0.16) * rim * uFrost;
  glass += vec3(0.05) * smoothstep(0.0, 1.0, vUv.y) * uFrost;
  // the words, coming into focus
  vec4 c = textureLod(map, vUv, (1.0 - uInk) * 3.5);
  vec3 cl = c.a > 0.0 ? lin(c.rgb / c.a) * c.a : vec3(0.0);
  float ca = c.a * uInk;
  vec3 col = glass * (1.0 - ca) + cl * uInk;
  gl_FragColor = vec4(col, shape * uOpacity);
}`

/** The content of a bubble: avatar, name, the comment (transparent canvas, the glass is the shader). */
function drawBubble(user, text, dark) {
  const S = 3
  const W = 300 * S
  const pad = 13 * S
  const av = 30 * S
  const tx = pad + av + 10 * S
  const tw = W - tx - pad
  const lh = 19 * S
  const probe = document.createElement('canvas').getContext('2d')
  const textFont = `500 ${14.5 * S}px Montserrat, "Apple Color Emoji", sans-serif`
  probe.font = textFont
  const lines = []
  let cur = ''
  for (const w of String(text).split(/\s+/)) {
    const n = cur ? cur + ' ' + w : w
    if (probe.measureText(n).width <= tw || !cur) cur = n
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > 3) {
    lines.length = 3
    lines[2] = lines[2].replace(/\s*\S*$/, '') + '…'
  }
  const H = Math.max(av + pad * 2, pad + 15 * S + lines.length * lh + pad - 3 * S)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  // avatar: a soft disc with the initial
  const cx = pad + av / 2
  const cy = pad + av / 2
  const gr = g.createLinearGradient(cx - av / 2, cy - av / 2, cx + av / 2, cy + av / 2)
  const hue = Math.floor(hash(user.length * 7.13 + user.charCodeAt(0)) * 3)
  const pairs = [
    ['#f1c9c2', '#c98a8f'],
    ['#e9d3c4', '#b48c7a'],
    ['#d8cdf2', '#a08fd6'],
  ][hue]
  gr.addColorStop(0, pairs[0])
  gr.addColorStop(1, pairs[1])
  g.fillStyle = gr
  g.beginPath()
  g.arc(cx, cy, av / 2, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = `600 ${14 * S}px Montserrat, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(user).replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '•', cx, cy + 0.5 * S)
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillStyle = dark ? 'rgba(255,240,236,0.66)' : 'rgba(84,60,68,0.72)'
  g.font = `600 ${11.5 * S}px Montserrat, "Apple Color Emoji", sans-serif`
  let name = String(user)
  while (name.length > 2 && g.measureText(name).width > tw) name = name.slice(0, -2) + '…'
  g.fillText(name, tx, pad + 11.5 * S)
  g.fillStyle = dark ? '#fff7f4' : '#2a1b21'
  g.font = textFont
  lines.forEach((l, i) => g.fillText(l, tx, pad + 13 * S + (i + 1) * lh))
  return { canvas: c, w: W, h: H }
}

export function createCommunity(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  engine.hud.add(root)
  const geo = new THREE.PlaneGeometry(1, 1)
  const card = { mat: tileMaterial(videos.placeholder) }
  card.mesh = new THREE.Mesh(geo, card.mat)
  card.mesh.visible = false
  root.add(card.mesh)
  const bubbles = [] // { key, mesh, mat, tex, w, h }
  const bubble = (i, user, text, dark) => {
    const key = user + '|' + text + '|' + dark
    let b = bubbles[i]
    if (b && b.key === key) return b
    if (!b) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          map: { value: null },
          uBg: { value: videos.placeholder },
          uRect: { value: new THREE.Vector4() },
          uBgRect: { value: new THREE.Vector4(0, 0, 1, 1) },
          uBgScale: { value: new THREE.Vector2(1, 1) },
          uRadius: { value: 0.1 },
          uOpacity: { value: 1 },
          uFrost: { value: 1 },
          uInk: { value: 1 },
          uLod: { value: 5.5 },
          uTint: { value: new THREE.Color('#fbf4f1') },
          uPaper: { value: new THREE.Color('#f7f1ec') },
          uTintK: { value: 0.66 },
        },
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = 10
      root.add(mesh)
      b = bubbles[i] = { mesh, mat }
    }
    b.tex?.dispose()
    const art = drawBubble(user, text, dark)
    b.tex = canvasTexture(art.canvas)
    b.mat.uniforms.map.value = b.tex
    b.w = art.w
    b.h = art.h
    b.key = key
    return b
  }

  return {
    keysFor(T) {
      return T.shots.filter((s) => s.type === 'community').flatMap((s) => keysOf(videos, s.p.videos))
    },
    update(ctx) {
      const { t, T, view } = ctx
      card.mesh.visible = false
      for (const b of bubbles) if (b) b.mesh.visible = false
      const sh = T.shots.find((s) => s.type === 'community' && t >= s.start - 0.05 && t < s.end + 0.05)
      if (!sh) return
      const p = sh.p
      const key = keysOf(videos, p.videos)[0]
      if (!key) return
      const portrait = view.aspect < 0.9
      const short = Math.min(view.w, view.h)
      // ---------------- the video: a tall card in the centre, revealed from its centre (a mask, the picture does not move)
      let ch = p.cardH * view.h
      let cw = ch * A
      if (cw > view.w * 0.92) {
        cw = view.w * 0.92
        ch = cw / A
      }
      const inK = ease(p.inEase)(clamp((t - sh.start) / p.inDur))
      const tOut = sh.end - p.outLead
      const outK = ease('ci.exit')(clamp((t - tOut) / (p.outLead + 0.02)))
      const reveal = lerp(0.82, 1, inK) * lerp(1, 0.94, outK)
      const cy = lerp(-view.h * 0.03, 0, inK) + outK * view.h * 0.02
      const w = cw * reveal
      const h = ch * reveal
      const op = clamp(inK * 3) * (1 - outK)
      if (op <= 0.002) return
      card.mesh.visible = true
      card.mesh.position.set(0, cy, 0)
      card.mesh.scale.set(w, h, 1)
      const u = card.mat.uniforms
      const voiced = !!p.voiceOn
      const m = voiced ? voicedTime(p, sh.start, t) : t - sh.start + 0.5
      // never past its last frame (it glides into it), never looping back to its start
      const tex = videos.want(key, softClipTime(m, videos.manifest[key] || 6), voiced)
      u.map.value = tex
      u.uSize.value.set(w, h)
      u.uRadius.value = p.corner * w
      u.uOpacity.value = op
      u.uDim.value = 0
      u.uBlur.value = 0
      u.uZoom.value = 1 / reveal // the picture keeps its size while the mask grows
      u.uShift.value.set(0, 0)
      card.mat.transparent = op < 0.999

      // ---------------- the comments
      const dark = p.style === 'dark'
      const list = [p.c1, p.c2, p.c3, p.c4, p.c5, p.c6].map((s) => String(s || '').trim()).filter(Boolean)
      const bw = portrait ? cw * 0.66 * (p.bubble / 0.36) : Math.min(p.bubble * short, short * 0.62)
      const gap = bw * 0.045
      const items = list.map((s, i) => {
        const cut = s.indexOf(' · ')
        const user = cut > 0 ? s.slice(0, cut) : ''
        const text = cut > 0 ? s.slice(cut + 3) : s
        const b = bubble(i, user, text, dark)
        return { b, i, bh: (bw * b.h) / b.w, at: sh.start + p.popAt + i * p.every }
      })
      const popE = ease(p.popEase)
      const pushE = ease('cubic(0.5,0,0.2,1)')
      // newest at the bottom; each new one lifts the older ones by its own height
      const yBottom = portrait ? -ch * 0.3 : -ch * 0.3
      for (const it of items) {
        const a = clamp((t - it.at) / p.popDur)
        if (a <= 0) continue
        let lift = 0
        for (const jt of items) if (jt.i > it.i) lift += pushE(clamp((t - jt.at) / 0.45)) * (jt.bh + gap)
        const e = popE(a)
        const side = it.i % 2 === 0 ? -1 : 1
        const ov = portrait ? 0 : 0.4
        const x = portrait ? side * (cw / 2 - bw / 2 - cw * 0.05) : side * (cw / 2 + bw / 2 - ov * bw)
        const drift = p.drift * view.h * Math.max(0, t - it.at)
        const y = yBottom + lift + drift + (1 - e) * -it.bh * 0.55 + cy
        const sc = lerp(0.92, 1, e)
        // the ones that reach the top of the video leave
        const top = cy + ch * 0.45
        const gone = clamp((y + it.bh / 2 - top) / (it.bh * 0.8))
        const out = ease('ci.exit')(clamp((t - tOut - it.i * 0.03) / 0.36))
        const o = clamp(a * 2.2) * (1 - gone) * (1 - out) * op
        if (o <= 0.002) continue
        const bb = it.b
        const bwS = bw * sc
        const bhS = it.bh * sc
        bb.mesh.visible = true
        bb.mesh.position.set(x, y + out * view.h * 0.05, 0.05 + it.i * 0.001)
        bb.mesh.rotation.set(0, 0, (hash(it.i * 3.7) - 0.5) * 0.035)
        bb.mesh.scale.set(bwS, bhS, 1)
        const U = bb.mat.uniforms
        U.uRect.value.set(x, y, bwS, bhS)
        U.uBg.value = tex
        U.uBgRect.value.set(0, cy, w / reveal, h / reveal)
        const ta = w / h
        U.uBgScale.value.set(ta > A ? 1 : ta / A, ta > A ? A / ta : 1)
        U.uRadius.value = Math.min(bhS * 0.5, bwS * 0.09)
        U.uOpacity.value = o
        U.uFrost.value = clamp(a * 1.6)
        U.uInk.value = ease('cubic(0.4,0,0.2,1)')(clamp((a - 0.25) / 0.6))
        U.uTint.value.set(dark ? '#3a262d' : '#fffaf8')
        U.uTintK.value = dark ? 0.6 : 0.74
        U.uPaper.value.set(ctx.bg.a)
      }
    },
  }
}
