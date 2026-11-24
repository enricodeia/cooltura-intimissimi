// "From content to communities": the comments as notifications on an iPhone 17 Pro.
//
// The title comes up in the upper part of the frame and the phone rises from
// the bottom under it (only its upper part is in the frame: the island, the lock
// screen with a campaign video as wallpaper, the clock). Then ONE camera move
// that never stops (2026-11-23, "più fluida"): it starts while the phone is
// still rising, so the frame keeps flowing up without a pause, goes down into
// the phone (the title leaves through the top) and arrives on the lock screen
// with the first comment. The comments land one under the other as iOS
// notifications (real frosted glass made from the screen under them: the glass
// forms first, the text comes into focus in it), the camera always on the
// newest. After the first three they come sooner and sooner, and the camera
// accelerates down with them: the device dissolves around its screen, the
// stream runs past and clears to white for "We paired creators…".
//
// The camera is a polyline through "where it frames the newest notification"
// with every corner rounded along a smoothstep of the speed: it never stops,
// never goes back, and its speed never dips under the two levels it joins (no
// rocking between the moves).
//
// The camera is a transform of one stage group in the HUD (title + phone), so it
// works under any edition's own camera (V5 keeps its camera on the line).
// The wallpaper video is drawn with exactly its pixels.

import * as THREE from 'three'
import { roundedRectShape } from '../lib/brand.js'
import { tileMaterial, cardMaterial, canvasTexture } from '../lib/materials.js'
import { drawNotification, drawLockScreen } from '../lib/draw2d.js'
import { Kinetic } from '../lib/kinetic.js'
import { COMMENTS } from '../data/comments.js'
import { caseOf, makeMemo } from './shared.js'
import { seg, lerp, clamp, ease } from '../core/util.js'

// iPhone 17 Pro in decimetres: 150.0 × 71.9 × 8.75 mm; 6.3" display, 2622 × 1206 px = 874 × 402 pt.
export const PHONE17 = { w: 0.719, h: 1.5, t: 0.0875, r: 0.1226, sw: 0.666, sh: 1.448, sr: 0.0961 }
const PT = PHONE17.sw / 402 // one point, in dm
const FINISH = { silver: 0xd6d6d9, orange: 0xd5672f, blue: 0x39465e }
// which comments land first (short, warm, the brand in the second), then the stream
const FIRST = [2, 4]

const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const SCREEN_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 uSize;
uniform float uRadius;
uniform float uFade;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  vec2 q = abs(p) - uSize * 0.5 + uRadius;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float aa = max(fwidth(d), 1e-5);
  float a = clamp(0.5 - d / aa, 0.0, 1.0);
  if (a <= 0.0) discard;
  // it dissolves into the white of the paper: to white, not to transparent (over the black
  // glass of the device a fade to transparent passes through a dark grey)
  gl_FragColor = vec4(mix(texture2D(map, vUv).rgb, vec3(1.0), uFade), a);
}`

// the phone's shadow on the paper: a soft rounded rectangle, premultiplied
const SHADOW_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uBox;
uniform float uRadius;
uniform float uSoft;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  vec2 q = abs(p) - uBox * 0.5 + uRadius;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float a = uOpacity * (1.0 - smoothstep(-uSoft, uSoft, d)) ;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`

// An iOS notification: rounded card, soft shadow, frosted glass made from the
// phone's own screen under it (blurred through the mips, saturated, veiled),
// content on top. Output premultiplied.
const CARD_FRAG = /* glsl */ `
uniform sampler2D uContent;
uniform sampler2D uBackdrop;
uniform vec2 uCard;
uniform vec2 uPlane;
uniform vec2 uCenter;
uniform vec2 uScreen;
uniform float uRadius;
uniform float uFrost;
uniform float uOpacity;
uniform float uDark;
uniform float uWhite;
uniform float uBlur;
uniform float uInk;
uniform float uClip;
uniform float uScreenR;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uPlane;
  float d = sdRound(p, uCard * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-6);
  float inside = clamp(0.5 - d / aa, 0.0, 1.0);
  float ds = sdRound(p - vec2(0.0, -uCard.y * 0.05), uCard * 0.5, uRadius);
  float shadow = 0.1 * exp(-max(ds, 0.0) / (uCard.x * 0.05)) * smoothstep(0.0, uCard.x * 0.01, ds + uCard.x * 0.01);
  vec2 suv = (uCenter + p) / uScreen + 0.5;
  float lod = 4.6 * uFrost;
  vec2 px = exp2(lod) / vec2(textureSize(uBackdrop, 0));
  vec3 b = textureLod(uBackdrop, suv, lod).rgb * 0.2;
  b += textureLod(uBackdrop, suv + px * vec2(1.3, 0.45), lod).rgb * 0.2;
  b += textureLod(uBackdrop, suv + px * vec2(-0.45, 1.3), lod).rgb * 0.2;
  b += textureLod(uBackdrop, suv + px * vec2(-1.3, -0.45), lod).rgb * 0.2;
  b += textureLod(uBackdrop, suv + px * vec2(0.45, -1.3), lod).rgb * 0.2;
  b = mix(b, vec3(1.0), uWhite);
  float l = dot(b, vec3(0.2126, 0.7152, 0.0722));
  b = max(mix(vec3(l), b, 1.0 + 0.6 * uFrost), 0.0);
  vec3 glass = uDark < 0.5 ? mix(b, vec3(0.93), 0.66 * uFrost) : mix(b, vec3(0.025), 0.58 * uFrost);
  vec2 cuv = p / uCard + 0.5;
  vec4 ct = vec4(0.0);
  if (uBlur < 0.02) ct = texture2D(uContent, cuv);
  else {
    vec2 tp = exp2(uBlur) / vec2(textureSize(uContent, 0));
    ct = textureLod(uContent, cuv, uBlur) * 0.28;
    ct += textureLod(uContent, cuv + tp * vec2(0.92, 0.38), uBlur) * 0.18;
    ct += textureLod(uContent, cuv + tp * vec2(-0.38, 0.92), uBlur) * 0.18;
    ct += textureLod(uContent, cuv + tp * vec2(-0.92, -0.38), uBlur) * 0.18;
    ct += textureLod(uContent, cuv + tp * vec2(0.38, -0.92), uBlur) * 0.18;
  }
  ct *= uInk; // the text comes into focus after the glass
  vec3 col = ct.rgb + glass * (1.0 - ct.a);
  // inside the screen while the device is there (the run goes on below it once it has dissolved)
  float dsc = sdRound(uCenter + p, uScreen * 0.5, uScreenR);
  float keep = mix(1.0, clamp(0.5 - dsc / max(fwidth(dsc), 1e-6), 0.0, 1.0), uClip);
  float a = inside * uOpacity * keep;
  gl_FragColor = vec4(col * a, a) + vec4(0.0, 0.0, 0.0, shadow * uOpacity * keep) * (1.0 - a);
}`

const premultiplied = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
}

function cardShader(content, backdrop) {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: CARD_FRAG,
    uniforms: {
      uContent: { value: content },
      uBackdrop: { value: backdrop },
      uCard: { value: new THREE.Vector2(1, 1) },
      uPlane: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2() },
      uScreen: { value: new THREE.Vector2(PHONE17.sw, PHONE17.sh) },
      uRadius: { value: 0.03 },
      uFrost: { value: 1 },
      uOpacity: { value: 1 },
      uDark: { value: 0 },
      uWhite: { value: 0 },
      uBlur: { value: 0 },
      uInk: { value: 1 },
      uClip: { value: 1 },
      uScreenR: { value: PHONE17.sr },
    },
    ...premultiplied,
  })
}

/**
 * When each notification lands and how long its arrival takes: the first `n1`
 * at a steady pace (`every`), then the run, each one sooner than the last
 * (× `accel`, down to `minEvery`), with arrivals shortened to their pace.
 */
function rhythm(p, t0, n1, N) {
  const at = []
  const dur = []
  let t = t0 + p.popAt
  let gap = p.every
  for (let k = 0; k < N; k++) {
    at.push(t)
    dur.push(k < n1 ? p.popDur : p.popDur * clamp(gap / p.every, 0.45, 1))
    if (k + 1 >= n1) gap = Math.max(p.minEvery, gap * p.accel)
    t += gap
  }
  return { at, dur }
}

/** ∫ of a smoothstep from 0 (at x = -h) to 1 (at x = +h): a ramp with its corner rounded. */
function rampS(x, h) {
  if (h <= 1e-6) return Math.max(0, x)
  if (x <= -h) return 0
  if (x >= h) return x
  const v = (x / h + 1) / 2
  return h * (2 * v * v * v - v * v * v * v)
}

/**
 * A polyline through [t, y] knots, flat before the first, each corner rounded
 * over ±hs[i] s: the speed goes from one level to the next along a smoothstep
 * (never past either), and keeps its last value after the last knot.
 */
function smoothPath(knots, hs) {
  const n = knots.length
  for (let i = 1; i < n; i++) knots[i][0] = Math.max(knots[i][0], knots[i - 1][0] + 0.02)
  const d = []
  for (let i = 0; i < n - 1; i++) d.push((knots[i + 1][1] - knots[i][1]) / (knots[i + 1][0] - knots[i][0]))
  d.push(n > 1 ? d[n - 2] : 0)
  return (t) => {
    let y = knots[0][1]
    let prev = 0
    for (let i = 0; i < n; i++) {
      const dd = d[i] - prev
      prev = d[i]
      if (dd) y += dd * rampS(t - knots[i][0], hs[i] ?? 0)
    }
    return y
  }
}

/** The wallpaper's media key. */
export const wallpaperKey = (p) => `v3/feed/${(p.wallpaper && p.wallpaper[0]) || 'aria-beatrice-scintu'}.mp4`

export function createPhone(engine) {
  const videos = engine.videos
  const memo = makeMemo()

  // ------------------------------------------------------------ the screen (its own little scene → texture)
  const SW = 1206
  const SH = 2622
  const AH = SH / SW
  const screenRT = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.HalfFloatType, depthBuffer: false })
  screenRT.texture.generateMipmaps = true
  screenRT.texture.minFilter = THREE.LinearMipmapLinearFilter
  const sScene = new THREE.Scene()
  const sCam = new THREE.OrthographicCamera(-0.5, 0.5, AH / 2, -AH / 2, 0, 10)
  sCam.position.z = 5
  const sGeo = new THREE.PlaneGeometry(1, AH)
  const wall = new THREE.Mesh(sGeo, tileMaterial(videos.placeholder))
  wall.material.alphaToCoverage = false
  wall.material.uniforms.uSize.value.set(1, AH)
  wall.material.uniforms.uRadius.value = 0
  const lock = new THREE.Mesh(sGeo, cardMaterial(null))
  lock.position.z = 1
  sScene.add(wall, lock)

  // ------------------------------------------------------------ the stage (the camera moves it) and the device
  const stage = new THREE.Group()
  stage.visible = false
  engine.hud.add(stage)
  const title = new Kinetic(stage)
  const dev = new THREE.Group()
  stage.add(dev)

  // transparent from the start: three bakes "opaque" into the shader at the first compile, so
  // switching it on later did nothing and the body vanished in one frame instead of fading
  const metal = new THREE.MeshStandardMaterial({ color: FINISH.silver, metalness: 1, roughness: 0.34, envMapIntensity: 1.15, transparent: true })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x030304, metalness: 0, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.55, transparent: true })
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true })
  const P = PHONE17
  const bev = 0.012
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(P.w - bev * 1.8, P.h - bev * 1.8, P.r - bev * 0.9), {
    depth: P.t - bev * 2,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev * 0.9,
    bevelSegments: 6,
    curveSegments: 32,
  })
  bodyGeo.translate(0, 0, -(P.t - bev * 2) / 2)
  const body = new THREE.Mesh(bodyGeo, metal)
  const front = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(P.w - 0.014, P.h - 0.014, P.r - 0.007), 32), glass)
  front.position.z = P.t / 2 + 0.0005
  const btn = (x, y, len) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, len, 0.028), metal)
    m.position.set(x, y, 0)
    return m
  }
  const xb = P.w / 2 + 0.0015
  // Action button and volume on the left; side button and Camera Control on the right
  const shell = new THREE.Group()
  shell.add(body, front, btn(-xb, 0.39, 0.06), btn(-xb, 0.25, 0.1), btn(-xb, 0.12, 0.1), btn(xb, 0.21, 0.15), btn(xb, -0.17, 0.085))
  dev.add(shell)
  const screenMat = new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: SCREEN_FRAG,
    uniforms: { map: { value: screenRT.texture }, uSize: { value: new THREE.Vector2(P.sw, P.sh) }, uRadius: { value: P.sr }, uFade: { value: 0 } },
    transparent: true,
  })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(P.sw, P.sh), screenMat)
  screen.position.z = P.t / 2 + 0.0012
  dev.add(screen)
  // the Dynamic Island: 126 × 37 pt, 11 pt under the top of the screen
  const ISL = { w: 126.3 * PT, h: 37.3 * PT, y: P.sh / 2 - (11 + 18.7) * PT }
  const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(ISL.w, ISL.h, ISL.h / 2), 24), black)
  island.position.set(0, ISL.y, P.t / 2 + 0.002)
  dev.add(island)
  // the shadow on the paper (a little below, very soft)
  const shadowMat = new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: SHADOW_FRAG,
    uniforms: { uSize: { value: new THREE.Vector2(P.w * 1.6, P.h * 1.3) }, uBox: { value: new THREE.Vector2(P.w, P.h) }, uRadius: { value: P.r }, uSoft: { value: 0.07 }, uOpacity: { value: 0.14 } },
    ...premultiplied,
    depthTest: true, // hidden where the phone stands in front of it
  })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(P.w * 1.6, P.h * 1.3), shadowMat)
  shadow.position.set(0, -0.035, -P.t / 2 - 0.01)
  shadow.renderOrder = -1
  dev.add(shadow)

  // ------------------------------------------------------------ comments as notifications
  const cardGeo = new THREE.PlaneGeometry(1, 1)
  const cards = []
  const CARD_W = 370 * PT // 370 of 402 pt
  const SHADE = 1.18 // the plane is a little larger than the card, for its shadow
  function card(i, idx, style) {
    const key = idx + '|' + style
    if (!cards[i] || cards[i].key !== key) {
      if (cards[i]) {
        dev.remove(cards[i].mesh)
        cards[i].mat.uniforms.uContent.value.dispose()
        cards[i].mat.dispose()
      }
      const d = drawNotification({ ...COMMENTS[idx % COMMENTS.length], time: 'ora' }, style)
      const mat = cardShader(canvasTexture(d.canvas), screenRT.texture)
      const mesh = new THREE.Mesh(cardGeo, mat)
      mesh.renderOrder = 60 + i
      const k = CARD_W / d.w
      dev.add(mesh)
      cards[i] = { mesh, mat, w: CARD_W, h: d.h * k, r: d.r * k, key }
    }
    return cards[i]
  }

  let screenLive = false

  return {
    keysFor(T) {
      return T.shots.filter((s) => s.type === 'phone').map((s) => wallpaperKey(s.p))
    },
    update(ctx) {
      const { t, T, view } = ctx
      const sh = T.shots.find((s) => s.type === 'phone' && t >= s.start - 0.05 && t < s.end + 0.05)
      stage.visible = !!sh
      screenLive = false
      if (!sh) {
        title.group.visible = false
        return
      }
      const p = sh.p
      const u = t - sh.start
      const short = Math.min(view.w, view.h)
      const portrait = view.aspect < 0.9

      // ---------------- the phone's size and its resting place (only its upper part is in the frame)
      const s = Math.min((p.phoneH * view.h) / P.h, (view.w * 0.78) / P.w)
      const H = P.h * s
      const topRest = (p.restTop * view.h) / 2
      const yRest = topRest - H / 2
      const yFrom = -view.h / 2 - H / 2 - 0.15
      const rise = seg(t, sh.start + p.riseAt, p.riseDur, p.riseEase)
      const yPhone = lerp(yFrom, yRest, rise)

      // ---------------- notifications: where each one sits (phone units), when it lands
      const style = p.style === 'dark' ? 'dark' : 'light'
      const n1 = Math.max(1, Math.round(p.count))
      const n2 = Math.max(0, Math.round(p.extra))
      const N = n1 + n2
      const gapL = 8 * PT
      let yCur = P.sh / 2 - 250 * PT // under the clock
      const place = []
      const order = [...FIRST]
      for (let i = 0; order.length < N; i++) if (!FIRST.includes(i % COMMENTS.length) || i >= COMMENTS.length) order.push(i % COMMENTS.length)
      for (let k = 0; k < N; k++) {
        const c = card(k, order[k], style)
        place.push({ c, y: yCur - c.h / 2 })
        yCur -= c.h + gapL
      }
      for (let k = N; k < cards.length; k++) if (cards[k]) cards[k].mesh.visible = false
      const R = rhythm(p, sh.start, n1, N)
      const landAt = (k) => R.at[k] + R.dur[k] * 0.5 // the camera is on it halfway through its arrival
      const tRun = R.at[Math.min(n1, N - 1)] // the first one of the run

      // ---------------- the camera: one move down into the phone that never stops
      const tCam = sh.start + p.camAt
      const Z1 = Math.max(1.25, Math.min(view.w * 0.6, view.h * 1.05) / (P.w * s)) * p.zoom
      // the zoom: the camera goes down first and pushes in as it goes (part of the way by the first
      // notification, so it rises into the frame instead of being pushed out of it), a slow push
      // while they land, more in the run
      const zPath = smoothPath(
        [
          [tCam, 0],
          [landAt(0), Math.log(Z1) * 0.6],
          [landAt(n1 - 1), Math.log(Z1 * p.drift)],
          [Math.max(landAt(n1 - 1) + 0.1, sh.end), Math.log(Z1 * p.drift * p.runZoom)],
        ],
        [p.camSoft, p.camSoft, Math.min(p.camSoft, 0.2), 0],
      )
      const Zt = (tt) => Math.exp(zPath(tt))
      // the height it frames: the newest notification, `frameY` of the frame under the centre
      const knots = [[tCam, 0]]
      const soft = [p.camSoft]
      for (let k = 0; k < N; k++) {
        const tk = landAt(k)
        knots.push([tk, yRest + s * place[k].y + (p.frameY * view.h) / Zt(tk)])
        const g = Math.min(k > 0 ? R.at[k] - R.at[k - 1] : Infinity, k < N - 1 ? R.at[k + 1] - R.at[k] : Infinity)
        // landing: a soft arrival; the steady ones: within their gap; the run: wider than its gaps,
        // so the speed is an average over a few notifications (tall and short ones alike) and only grows
        soft.push(k === 0 ? p.camSoft : k < n1 - 1 ? Math.min(p.camSoft, 0.5 * g) : Math.max(0.5 * g, p.runSoft))
      }
      const camY = smoothPath(knots, soft)
      const cy = camY(t)
      const Z = Zt(t)
      stage.position.set(0, -cy * Z, 0)
      stage.scale.setScalar(Z)
      const dissolve = seg(t, tRun + p.dissolveAt, p.dissolveDur, 'power2.inOut')
      const fade = 1 - seg(t, sh.end - p.fadeDur, Math.max(0.05, p.fadeDur - 0.05), 'power1.inOut')
      // speed blur from the real travel per frame (half-open shutter), off unless asked for
      if (p.speedBlur > 0) {
        const h = 0.5 / ctx.fps
        const run = (tt) => camY(tt) * Zt(tt)
        const vel = (run(t + h) - run(t - h)) / (2 * h)
        ctx.fx.blurY += ((Math.abs(vel) * 0.5) / ctx.fps / view.h) * p.speedBlur * fade
      }

      // ---------------- the title, in the upper part of the frame (it leaves with the camera)
      const capT = (p.size / 100) * short * (portrait ? 1.25 : 1)
      const margin = short * 0.075
      const tStr = caseOf(p.text, p.caps)
      let info = title.set({ text: tStr, weight: p.weight, align: 'center', measure: (view.w - 2 * margin) / capT, leading: p.leading, tracking: p.tracking })
      const k = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, info.width * capT))
      const cT = capT * k
      if (k < 0.999) info = title.set({ text: tStr, weight: p.weight, align: 'center', measure: (view.w - 2 * margin) / cT, leading: p.leading, tracking: p.tracking })
      const yT = (view.h / 2 + topRest) / 2 + view.h * 0.01
      title.group.position.set(0, yT, 0)
      title.group.scale.setScalar(cT)
      title.pose(t, {
        in: { at: sh.start + p.inAt, dur: p.inDur, stagger: p.inStagger, order: 'start', split: p.inSplit, ease: p.inEase, x: 0, y: p.inY, rot: 0, depth: 0, scale: 1, blur: p.inBlur, opacity: 0, mask: true },
        out: null,
        from: ctx.col(p.fromColor),
        to: ctx.col(p.color),
        motion: 0.7,
        fps: ctx.fps,
        px: cT * Z * ctx.pxPerUnit,
      })
      // gone once it is out of the frame
      if ((yT - info.height * cT * 0.6 - cy) * Z > view.h / 2) title.group.visible = false

      // ---------------- the device
      dev.position.set(0, yPhone, 0)
      dev.scale.setScalar(s)
      metal.color.setHex(FINISH[p.finish] ?? FINISH.silver)
      const bodyGone = clamp(dissolve / 0.7) // the body goes a little ahead of its screen
      for (const m of [metal, glass]) {
        m.opacity = 1 - bodyGone
        m.depthWrite = bodyGone < 0.5
      }
      black.opacity = 1 - bodyGone
      shadowMat.uniforms.uOpacity.value = 0.14 * (1 - dissolve) * rise
      const bodyOn = dissolve < 0.999 && rise > 0
      shell.visible = island.visible = shadow.visible = bodyOn
      screen.visible = bodyOn
      screenMat.uniforms.uFade.value = dissolve
      screenLive = bodyOn

      // ---------------- the lock screen: the wallpaper (exactly its pixels), the clock
      const lockArt = memo('lock', `${p.clock}|${p.date}`, () => canvasTexture(drawLockScreen(SW, SH, { clock: String(p.clock), date: String(p.date), pt: 402, status: true })), (tex) => tex.dispose())
      lock.material.uniforms.map.value = lockArt
      if (screenLive) {
        const wu = wall.material.uniforms
        wu.map.value = videos.want(wallpaperKey(p), Math.max(0, t - sh.start) + 0.4)
        wu.uBlur.value = 0
        wu.uDim.value = 0
      }

      // ---------------- the banners: each one rises into its place from just below (with the
      // flow of the frame), the glass forms first, the text comes into focus in it
      const popE = ease(p.popEase)
      const zc = P.t / 2 + 0.006
      place.forEach((pl, k) => {
        const c = pl.c
        const a = clamp((t - R.at[k]) / R.dur[k])
        const on = a > 0 && fade > 0.002 && rise > 0
        c.mesh.visible = on
        if (!on) return
        const e = popE(a)
        const sc2 = lerp(p.popScale, 1, e)
        const y = pl.y - (1 - e) * c.h * p.popRise
        c.mesh.position.set(0, y, zc + k * 1e-4)
        c.mesh.scale.set(c.w * SHADE * sc2, (c.h + c.w * (SHADE - 1)) * sc2, 1)
        const cu = c.mat.uniforms
        cu.uCard.value.set(c.w * sc2, c.h * sc2)
        cu.uPlane.value.set(c.w * SHADE * sc2, (c.h + c.w * (SHADE - 1)) * sc2)
        cu.uCenter.value.set(0, y)
        cu.uRadius.value = c.r * sc2
        cu.uOpacity.value = seg(a, 0, 0.3, 'power1.out') * fade
        cu.uFrost.value = seg(a, 0, 0.7, 'power2.out') // the frost materialises with the card
        cu.uInk.value = seg(a, 0.12, 0.4, 'power1.out')
        cu.uBlur.value = (1 - seg(a, 0.08, 0.5, 'power2.out')) * 2.2 + (1 - fade) * 5.2 * p.fadeBlur
        cu.uClip.value = 1 - dissolve
        cu.uDark.value = style === 'dark' ? 1 : 0
        cu.uWhite.value = dissolve
      })
    },

    late() {
      title.late()
    },

    preRender(renderer) {
      if (!screenLive) return
      renderer.setRenderTarget(screenRT)
      renderer.setClearColor(0x000000, 1)
      renderer.clear()
      renderer.render(sScene, sCam)
    },
  }
}
