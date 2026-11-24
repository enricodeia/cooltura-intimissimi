// The iPhone. It is there at once: the top card of the deck is its screen and
// the device closes around it (the bezel grows out from under the glass).
// "made for" and "externability" come in letter by letter either side of it
// (above and below it when the frame is too narrow), go out the same way, and
// the phone steps right, tilted, with the feed swiping (the numbers come in on
// the left). Later it comes to the camera: the lock screen, comments landing as
// iOS notifications (real frosted glass over the wallpaper) while the camera
// closes in; then the dive into the screen with speed blur.

import * as THREE from 'three'
import { roundedRectShape } from '../lib/brand.js'
import { tileMaterial, cardMaterial, canvasTexture, flatMaterial } from '../lib/materials.js'
import { drawNotification, drawFeedUI, drawLockScreen } from '../lib/draw2d.js'
import { buildText, freeText, widthInCaps } from '../lib/type.js'
import { COMMENTS } from '../data/comments.js'
import { PHONE, phoneLayout, makeMemo } from './shared.js'
import { DECK_TOP, deckTime } from './wall.js'
import { seg, lerp, clamp, ease, DEG } from '../core/util.js'

const FEED = [`feed/${DECK_TOP}.mp4`, 'feed/carola-solgato.mp4', 'feed/maria-facchinelli.mp4', 'feed/selvaggia-may.mp4', 'feed/silvia-mongelluzzo.mp4', 'feed/virginia-labella.mp4', 'feed/francesca-bergesio.mp4', 'feed/nicole-pieretto.mp4']

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
  float a = clamp(0.5 - d / aa, 0.0, 1.0) * (1.0 - uFade);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(texture2D(map, vUv).rgb, a);
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
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uPlane;
  float d = sdRound(p, uCard * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-6);
  float inside = clamp(0.5 - d / aa, 0.0, 1.0);
  float ds = sdRound(p - vec2(0.0, -uCard.y * 0.05), uCard * 0.5, uRadius);
  float shadow = 0.13 * exp(-max(ds, 0.0) / (uCard.x * 0.05)) * smoothstep(0.0, uCard.x * 0.01, ds + uCard.x * 0.01);
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
  vec3 col = ct.rgb + glass * (1.0 - ct.a);
  float a = inside * uOpacity;
  gl_FragColor = vec4(col * a, a) + vec4(0.0, 0.0, 0.0, shadow * uOpacity) * (1.0 - a);
}`

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
      uScreen: { value: new THREE.Vector2(PHONE.sw, PHONE.sh) },
      uRadius: { value: 0.03 },
      uFrost: { value: 1 },
      uOpacity: { value: 1 },
      uDark: { value: 0 },
      uWhite: { value: 0 },
      uBlur: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
}

export function createPhone(engine) {
  const videos = engine.videos
  const memo = makeMemo()

  // ------------------------------------------------------------ the screen (its own little scene → texture)
  const SW = 900
  const SH = Math.round((SW * PHONE.sh) / PHONE.sw)
  const AH = SH / SW
  const screenRT = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.HalfFloatType, depthBuffer: false })
  screenRT.texture.generateMipmaps = true
  screenRT.texture.minFilter = THREE.LinearMipmapLinearFilter
  const sScene = new THREE.Scene()
  const sCam = new THREE.OrthographicCamera(-0.5, 0.5, AH / 2, -AH / 2, 0, 10)
  sCam.position.z = 5
  const sGeo = new THREE.PlaneGeometry(1, AH)
  const feedA = new THREE.Mesh(sGeo, tileMaterial(videos.placeholder))
  const feedB = new THREE.Mesh(sGeo, tileMaterial(videos.placeholder))
  for (const m of [feedA, feedB]) {
    m.material.alphaToCoverage = false
    m.material.uniforms.uSize.value.set(1, AH)
    m.material.uniforms.uRadius.value = 0
    sScene.add(m)
  }
  const ui = new THREE.Mesh(sGeo, cardMaterial(canvasTexture(drawFeedUI(SW, SH))))
  ui.position.z = 1
  const lock = new THREE.Mesh(sGeo, cardMaterial(canvasTexture(drawLockScreen(SW, SH))))
  lock.position.z = 1.1
  sScene.add(ui, lock)

  // ------------------------------------------------------------ the device
  const phone = new THREE.Group()
  phone.visible = false
  engine.scene.add(phone)
  const titanium = new THREE.MeshStandardMaterial({ color: 0x9d988f, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x030304, metalness: 0, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 })
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true })
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x10131c, transparent: true })
  const bodyMats = [titanium, glass]

  const shell = new THREE.Group() // everything but the screen: it grows out from under the glass
  phone.add(shell)
  const bev = 0.013
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(PHONE.w - bev * 1.8, PHONE.h - bev * 1.8, PHONE.r - bev * 0.9), {
    depth: PHONE.t - bev * 2,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev * 0.9,
    bevelSegments: 6,
    curveSegments: 28,
  })
  bodyGeo.translate(0, 0, -(PHONE.t - bev * 2) / 2)
  const body = new THREE.Mesh(bodyGeo, titanium)
  const front = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(PHONE.w - 0.02, PHONE.h - 0.02, PHONE.r - 0.01), 24), glass)
  front.position.z = PHONE.t / 2 + 0.0005
  const btn = (x, y, len) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.007, len, 0.026), titanium)
    m.position.set(x, y, 0)
    return m
  }
  const xb = PHONE.w / 2 + 0.0015
  shell.add(body, front, btn(-xb, 0.36, 0.05), btn(-xb, 0.25, 0.09), btn(-xb, 0.135, 0.09), btn(xb, 0.21, 0.14))

  const screenMat = new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: SCREEN_FRAG,
    uniforms: { map: { value: screenRT.texture }, uSize: { value: new THREE.Vector2(PHONE.sw, PHONE.sh) }, uRadius: { value: PHONE.sr }, uFade: { value: 0 } },
    transparent: true,
  })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PHONE.sw, PHONE.sh), screenMat)
  screen.position.z = PHONE.t / 2 + 0.0012
  phone.add(screen)

  const ISL = { w: 0.2, h: 0.058, y: PHONE.h / 2 - 0.079 }
  const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(ISL.w, ISL.h, ISL.h / 2), 16), black)
  island.position.set(0, ISL.y, PHONE.t / 2 + 0.002)
  const lensDot = new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), lensMat)
  lensDot.position.set(0.058, ISL.y, PHONE.t / 2 + 0.0024)
  phone.add(island, lensDot)

  // ------------------------------------------------------------ comments as notifications
  const cardGeo = new THREE.PlaneGeometry(1, 1)
  const cards = []
  const CARD_W = PHONE.sw * (358 / 393)
  const SHADOW = 1.18 // the plane is a little larger than the card, for the shadow
  function card(i, style) {
    const key = style
    if (!cards[i] || cards[i].style !== key) {
      if (cards[i]) {
        phone.remove(cards[i].mesh)
        cards[i].mat.uniforms.uContent.value.dispose()
        cards[i].mat.dispose()
      }
      const d = drawNotification(COMMENTS[i % COMMENTS.length], style)
      const tex = canvasTexture(d.canvas)
      const mat = cardShader(tex, screenRT.texture)
      const mesh = new THREE.Mesh(cardGeo, mat)
      mesh.renderOrder = 50 + i
      const k = CARD_W / d.w
      phone.add(mesh)
      cards[i] = { mesh, mat, w: CARD_W, h: d.h * k, r: d.r * k, style: key }
    }
    return cards[i]
  }

  // ------------------------------------------------------------ "made for" · "externability"
  const words = new THREE.Group()
  engine.scene.add(words)
  const lines = [0, 1].map(() => {
    const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)]
    const mat = flatMaterial('#0b0b0c')
    mat.clippingPlanes = clip
    const g = new THREE.Group()
    words.add(g)
    return { g, mat, clip }
  })

  const pose = { x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0 }
  const mix = (a, b, k) => {
    pose.x = lerp(a.x, b.x, k)
    pose.y = lerp(a.y, b.y, k)
    pose.s = lerp(a.s, b.s, k)
    pose.rx = lerp(a.rx || 0, b.rx || 0, k)
    pose.ry = lerp(a.ry || 0, b.ry || 0, k)
    pose.rz = lerp(a.rz || 0, b.rz || 0, k)
  }

  let screenLive = false

  return {
    keys: FEED,
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('phone')
      const P = sc.p
      const ph = T.shot('phone')
      const pp = ph.p
      const notifs = T.shot('notifs')
      const dive = T.shot('dive')
      const visible = t >= ph.start && t < dive.end
      phone.visible = visible
      words.visible = visible && t < ph.end + 0.1
      screenLive = false
      if (!visible) return
      const np = notifs.p
      const dp = dive.p
      const L = phoneLayout(view, P)
      ctx.bg.a = ctx.bg.b = ctx.col('white')
      ctx.bg.mix = 0

      // ---------------- the light: two beams and dust while the numbers are up (scene effect, on white)
      if (P.raysOn) {
        const on = seg(t, ph.end - 0.2, 0.9, 'power2.inOut') * (1 - seg(t, notifs.start - 0.1, 0.7, 'power2.inOut'))
        ctx.bg.rays = P.rays * on
        ctx.bg.raysColor = ctx.col(P.raysColor)
        ctx.bg.sway = P.raysSway
        ctx.bg.width = P.raysWidth
        ctx.bg.haze = P.raysShade
      }

      // ---------------- pose: centre → side → front
      const center = { ...L.center }
      const side = { ...L.side, rx: pp.tiltX * DEG, ry: pp.tiltY * DEG, rz: pp.tiltZ * DEG }
      const frontW = (L.portrait ? view.w : Math.min(view.w * 0.46, view.h * 0.9)) * np.phoneFill
      const fs = frontW / PHONE.w
      const frontY0 = view.h / 2 - view.h * 0.09 - (PHONE.h * fs) / 2
      const front = { x: 0, y: frontY0, s: fs }
      const tMove = ph.end - pp.moveDur * 0.35
      const toSide = seg(t, tMove, pp.moveDur, pp.moveEase)
      const toFront = seg(t, notifs.start - 0.2, Math.min(np.frontDur, notifs.dur), np.frontEase)
      if (toFront > 0) mix(side, front, toFront)
      else mix(center, side, toSide)
      const idle = toSide * (1 - toFront)
      pose.ry += Math.sin(t * 0.9) * 0.04 * idle
      pose.rx += Math.sin(t * 0.7 + 1) * 0.022 * idle
      pose.y += Math.sin(t * 1.1) * 0.03 * idle

      // ---------------- notifications: their slots, and the camera that closes in on them
      const style = np.style === 'dark' ? 'dark' : 'light'
      const n1 = Math.round(np.count)
      const n2 = Math.round(dp.extra)
      const gapL = (8 / 852) * PHONE.sh
      const top = PHONE.sh / 2 - (232 / 852) * PHONE.sh // under the lock screen clock
      const firstAt = notifs.start + Math.min(np.frontDur, notifs.dur) * 0.75
      const every = np.every * Math.min(4, Math.max(0.3, notifs.dur / 2.6)) // stretch the block and the banners spread with it
      const tPop = (k) => firstAt + k * every
      let yCur = top
      const place = []
      for (let k = 0; k < n1 + n2; k++) {
        const c = card(k, style)
        place.push({ c, y: yCur - c.h / 2 })
        yCur -= c.h + gapL
      }
      const zoomIn = lerp(1, np.zoomTo, seg(t, firstAt - 0.1, notifs.end - firstAt + 0.1 + dive.dur * 0.5, np.zoomEase))
      // the camera follows the stack down: the newest banner stays in the frame
      const lastBottom = place[n1 - 1].y - place[n1 - 1].c.h / 2
      const anchorY = -view.h * 0.3
      const need = Math.max(0, anchorY / np.zoomTo - (frontY0 + lastBottom * fs))
      const follow = need * seg(t, firstAt + every * 0.6, Math.max(0.3, (n1 - 1) * every + 0.5), 'sine.inOut')

      // ---------------- dive: zoom into the screen, accelerate down, the device dissolves
      const du = clamp((t - dive.start) / dive.dur)
      const inDive = t >= dive.start
      const Z = Math.max(dp.zoom, (view.w * 1.12) / (frontW * np.zoomTo))
      const zoomD = inDive ? lerp(1, Z, ease(dp.zoomEase)(clamp(du / 0.7))) : 1
      const zoom = zoomIn * zoomD
      const pitch = (yCur - top) / (n1 + n2) // negative: one banner + gap, local
      const dist = -pitch * n2 * fs + view.h * 0.9
      const run = (u) => dist * ease(dp.speedEase)(clamp(u))
      const scroll = inDive ? run(du) : 0
      const dissolve = inDive ? seg(du, 0.05, 0.3, 'power2.inOut') : 0
      if (inDive) {
        // speed blur from the actual travel per frame (half-open shutter)
        const h = 0.5 / ctx.fps
        const vel = ((run(du + h / dive.dur) - run(du - h / dive.dur)) * zoom) / (2 * h)
        const brake = 1 - seg(du, 0.7, 0.3, 'power2.inOut') // the title arrives sharp
        ctx.fx.blurY = ((vel * 0.5) / ctx.fps / view.h) * dp.blur * brake
        ctx.fx.zoomBlur = (Z - 1) * 0.12 * Math.sin(Math.PI * clamp(du / 0.7)) * dp.blur
      }

      phone.position.set(pose.x * zoom, (pose.y + follow + scroll) * zoom, 0)
      phone.scale.setScalar(pose.s * zoom)
      phone.rotation.set(pose.rx, pose.ry, pose.rz)
      phone.updateMatrixWorld(true)

      // ---------------- the device closes around the screen
      const appear = seg(t, ph.start, pp.appearDur, pp.appearEase)
      shell.scale.set(lerp(PHONE.sw / PHONE.w, 1, appear), lerp(PHONE.sh / PHONE.h, 1, appear), 1)
      shell.position.z = -0.002 * (1 - appear)
      const isl = seg(t, ph.start + pp.appearDur * 0.45, pp.appearDur * 0.7, 'power2.out')
      island.scale.setScalar(lerp(0.6, 1, isl))
      black.opacity = lensMat.opacity = isl * (1 - dissolve)
      for (const m of bodyMats) {
        m.transparent = dissolve > 0
        m.opacity = 1 - dissolve
        m.depthWrite = dissolve < 0.5
      }
      const bodyOn = dissolve < 0.999
      shell.visible = island.visible = lensDot.visible = bodyOn
      screen.visible = bodyOn
      screenMat.uniforms.uFade.value = dissolve
      screenLive = bodyOn || inDive

      // ---------------- the feed inside the screen (swipes once the phone is on the right)
      const feedStart = ph.end + 0.1
      let s = 0
      const sE = ease(P.swipeEase)
      const lastSwipe = Math.floor((notifs.start - 0.25 - feedStart) / P.swipeEvery)
      const nSw = Math.min(lastSwipe, Math.max(0, Math.ceil((t - feedStart) / P.swipeEvery)))
      for (let k = 1; k <= nSw; k++) s += sE(clamp((t - (feedStart + k * P.swipeEvery - P.swipeDur)) / P.swipeDur))
      const i0 = Math.floor(s + 1e-6)
      const f = s - i0
      const setItem = (mesh, idx, y) => {
        const key = FEED[idx % FEED.length]
        const mu = mesh.material.uniforms
        mu.map.value = idx === 0 ? videos.want(key, deckTime(t)) : videos.want(key, Math.max(0, t - (feedStart + idx * P.swipeEvery - P.swipeDur - 0.2)))
        mu.uBlur.value = 0
        mu.uDim.value = 0
        mesh.position.y = y
      }
      setItem(feedA, i0, f * AH)
      feedB.visible = f > 1e-4
      if (feedB.visible) setItem(feedB, i0 + 1, (f - 1) * AH)
      ui.visible = P.feedUi
      ui.material.uniforms.uOpacity.value = seg(t, ph.start + pp.appearDur * 0.8, 0.5, 'power2.out') * (1 - seg(toFront, 0, 0.45))
      lock.material.uniforms.uOpacity.value = np.clock ? seg(toFront, 0.35, 0.65, 'power2.inOut') : 0
      lock.visible = lock.material.uniforms.uOpacity.value > 0.002

      // ---------------- the banners
      const popE = ease(np.popEase)
      const fade = inDive ? 1 - seg(du, dp.fadeFrom, Math.max(0.05, 0.97 - dp.fadeFrom), 'power1.inOut') : 1
      const zc = PHONE.t / 2 + 0.006
      cards.forEach((c, k) => {
        const pl = place[k]
        if (!pl) return (c.mesh.visible = false)
        let a = 1
        if (k < n1) a = clamp((t - tPop(k)) / np.popDur)
        else a = dissolve // the rest of the feedback only shows once the device has gone
        const on = a > 0 && fade > 0.002
        c.mesh.visible = on
        if (!on) return
        const e = k < n1 ? popE(a) : 1
        const sc2 = lerp(0.9, 1, e)
        const y = pl.y + (1 - e) * c.h * 0.32
        c.mesh.position.set(0, y, zc + k * 1e-4)
        c.mesh.scale.set(c.w * SHADOW * sc2, (c.h + c.w * (SHADOW - 1)) * sc2, 1)
        const u = c.mat.uniforms
        u.uCard.value.set(c.w * sc2, c.h * sc2)
        u.uPlane.value.set(c.w * SHADOW * sc2, (c.h + c.w * (SHADOW - 1)) * sc2)
        u.uCenter.value.set(0, y)
        u.uRadius.value = c.r * sc2
        u.uFrost.value = k < n1 ? seg(a, 0.0, 0.8, 'power2.out') : 1 // the frost materialises with the card
        u.uOpacity.value = Math.min(1, a * 2.6) * fade
        u.uDark.value = style === 'dark' ? 1 : 0
        u.uWhite.value = dissolve
        u.uBlur.value = (1 - fade) * 5.2 * dp.fadeBlur
      })

      // ---------------- "made for" · "externability"
      if (words.visible) {
        const cs = L.center.s
        const pw = PHONE.w * cs
        const phH = PHONE.h * cs
        const texts = [String(pp.left || ''), String(pp.right || '')]
        const wl = widthInCaps(texts[0], pp.weight)
        const wr = widthInCaps(texts[1], pp.weight)
        const gap = view.h * 0.034
        const margin = view.w * 0.07
        const room = (view.w - pw) / 2 - gap - margin
        let cap = Math.min(view.h * 0.04, room / Math.max(wl, wr, 1e-3)) * pp.size
        let lay
        if (cap >= view.h * 0.028) {
          // beside it: "made for" ends at its left edge, "externability" starts at its right edge
          lay = [
            { x: L.center.x - pw / 2 - gap, base: L.center.y - cap / 2, align: 'right' },
            { x: L.center.x + pw / 2 + gap, base: L.center.y - cap / 2, align: 'left' },
          ]
        } else {
          // no room beside it: above it on the left, below it on the right
          cap = Math.min(view.h * 0.042, (view.w - 2 * margin) / Math.max(wl, wr, 1e-3)) * pp.size
          lay = [
            { x: -view.w / 2 + margin, base: L.center.y + phH / 2 + gap, align: 'left' },
            { x: view.w / 2 - margin, base: L.center.y - phH / 2 - gap - cap, align: 'right' },
          ]
        }
        const by = pp.split === 'words' ? 'words' : 'chars'
        const inE = ease(pp.inEase)
        const outE = ease(pp.outEase)
        const tIn = ph.start + pp.inAt
        const tOut = ph.end - pp.outLead
        let order = 0
        lines.forEach((ln, li) => {
          const blk = memo(
            'w' + li,
            `${texts[li]}|${pp.weight}|${by}|${lay[li].align}`,
            () => {
              const b = buildText(texts[li], { weight: pp.weight, cap: 1, by, align: lay[li].align, pivot: 'baseline', material: ln.mat })
              ln.g.add(b.group)
              return b
            },
            (b) => {
              ln.g.remove(b.group)
              freeText(b)
            },
          )
          ln.mat.color.set(ctx.col(pp.color))
          ln.g.position.set(lay[li].x, lay[li].base + cap / 2, 0.2)
          ln.g.scale.setScalar(cap)
          // the mask: from just under the descenders to just over the capitals
          ln.clip[0].constant = -(lay[li].base - cap * 0.32)
          ln.clip[1].constant = lay[li].base + cap * 1.28
          // the right word starts while the left one is still arriving
          const off = li === 0 ? 0 : blk.units.length * 0 + (lines[0].n || 0) * pp.charStagger * 0.55
          blk.units.forEach((u, j) => {
            const e = inE(clamp((t - tIn - off - j * pp.charStagger) / pp.charDur))
            const o = outE(clamp((t - tOut - (order + j) * pp.outStagger) / pp.outDur))
            u.mesh.position.y = u.y - (1 - e) * 1.25 + o * 1.35
            u.mesh.visible = e > 0 && o < 1
          })
          ln.n = blk.units.length
          order += blk.units.length
        })
      }
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
