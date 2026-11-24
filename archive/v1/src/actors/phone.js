// The iPhone. It is born from the pile of videos: an outline draws around the
// pile, a scan line climbs from the bottom and leaves the solid device behind
// it, then it steps to the right, tilted, with the feed swiping inside.
// Later it comes up to the camera: comments land as notifications, the camera
// follows them down, dives into the screen and the device dissolves.

import * as THREE from 'three'
import { roundedRectShape } from '../lib/brand.js'
import { makeLine, lineWindow, lineStyle, v3 } from '../lib/lines.js'
import { tileMaterial, cardMaterial, canvasTexture } from '../lib/materials.js'
import { drawNotification, drawFeedUI } from '../lib/draw2d.js'
import { COMMENTS } from '../data/comments.js'
import { PHONE, phoneLayout, planeFromLocal } from './shared.js'
import { HERO, heroTime } from './wall.js'
import { seg, lerp, clamp, ease, DEG } from '../core/util.js'

const FEED = [HERO, 'feed/marta-carruozzo.mp4', 'feed/carola-solgato.mp4', 'feed/maria-facchinelli.mp4', 'feed/selvaggia-may.mp4', 'feed/silvia-mongelluzzo.mp4', 'feed/virginia-labella.mp4', 'feed/francesca-bergesio.mp4']

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
  vec3 c = texture2D(map, vUv).rgb * (1.0 - uFade);
  gl_FragColor = vec4(c, a);
}`
const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/** Half outlines of a rounded rectangle: bottom centre → top centre, right side and left side. */
function halfLoops(w, h, r, z, arc = 12) {
  const half = (sx) => {
    const pts = [v3(0, -h / 2, z)]
    for (let i = 0; i <= arc; i++) {
      const a = -Math.PI / 2 + (i / arc) * (Math.PI / 2)
      pts.push(v3(sx * (w / 2 - r + Math.cos(a) * r), -h / 2 + r + Math.sin(a) * r, z))
    }
    for (let i = 0; i <= arc; i++) {
      const a = (i / arc) * (Math.PI / 2)
      pts.push(v3(sx * (w / 2 - r + Math.cos(a) * r), h / 2 - r + Math.sin(a) * r, z))
    }
    pts.push(v3(0, h / 2, z))
    return pts
  }
  return [half(1), half(-1)]
}

export function createPhone(engine) {
  const videos = engine.videos

  // ------------------------------------------------------------ the screen (its own little scene → texture)
  const SW = 720
  const SH = Math.round((SW * PHONE.sh) / PHONE.sw)
  const AH = SH / SW
  const screenRT = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.HalfFloatType, depthBuffer: false })
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
  const uiTex = canvasTexture(drawFeedUI(SW, SH))
  const ui = new THREE.Mesh(sGeo, cardMaterial(uiTex))
  ui.position.z = 1
  sScene.add(ui)

  // ------------------------------------------------------------ the device
  const phone = new THREE.Group()
  phone.visible = false
  engine.scene.add(phone)
  const revealPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e3)
  const linePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3)
  const titanium = new THREE.MeshStandardMaterial({ color: 0xa39f97, metalness: 1, roughness: 0.34, envMapIntensity: 1.15, clippingPlanes: [revealPlane] })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x030304, metalness: 0, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9, clippingPlanes: [revealPlane] })
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, clippingPlanes: [revealPlane] })
  const lens = new THREE.MeshBasicMaterial({ color: 0x10131c, clippingPlanes: [revealPlane] })
  const bodyMats = [titanium, glass, black, lens]

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
  phone.add(body, front, btn(-xb, 0.36, 0.05), btn(-xb, 0.25, 0.09), btn(-xb, 0.135, 0.09), btn(xb, 0.21, 0.14))

  const screenMat = new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: SCREEN_FRAG,
    uniforms: { map: { value: screenRT.texture }, uSize: { value: new THREE.Vector2(PHONE.sw, PHONE.sh) }, uRadius: { value: PHONE.sr }, uFade: { value: 0 } },
    alphaToCoverage: true,
  })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PHONE.sw, PHONE.sh), screenMat)
  screen.position.z = PHONE.t / 2 + 0.0012
  phone.add(screen)

  const ISL = { w: 0.2, h: 0.058, y: PHONE.h / 2 - 0.079 }
  const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(ISL.w, ISL.h, ISL.h / 2), 16), black)
  island.position.set(0, ISL.y, PHONE.t / 2 + 0.002)
  const lensDot = new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), lens)
  lensDot.position.set(0.058, ISL.y, PHONE.t / 2 + 0.0024)
  phone.add(island, lensDot)

  // outline (drawn before the solid exists)
  const zl = PHONE.t / 2 + 0.003
  const lines = []
  const addLine = (pts, group) => {
    const l = makeLine(pts, { color: 0xffffff, width: 0.02 })
    l.material.clippingPlanes = [linePlane]
    l.userData.group = group
    phone.add(l)
    lines.push(l)
  }
  halfLoops(PHONE.w, PHONE.h, PHONE.r, zl).forEach((p) => addLine(p, 0))
  halfLoops(PHONE.sw, PHONE.sh, PHONE.sr, zl).forEach((p) => addLine(p, 1))
  halfLoops(ISL.w, ISL.h, ISL.h / 2, zl, 8).forEach((p) => addLine(p.map((q) => q.clone().setY(q.y + ISL.y)), 2))
  for (const [x, y, len] of [
    [-1, 0.36, 0.05],
    [-1, 0.25, 0.09],
    [-1, 0.135, 0.09],
    [1, 0.21, 0.14],
  ])
    addLine([v3(x * (PHONE.w / 2 + 0.012), y - len / 2, zl), v3(x * (PHONE.w / 2 + 0.012), y + len / 2, zl)], 3)

  // the scan line that leaves the solid behind it
  const scanMat = new THREE.MeshBasicMaterial({ color: 0xc0ff33, transparent: true, depthWrite: false })
  const scan = new THREE.Mesh(new THREE.BoxGeometry(PHONE.w + 0.03, 0.0045, PHONE.t + 0.03), scanMat)
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() {
        float y = vUv.y;
        float a = smoothstep(0.0, 1.0, y) * smoothstep(1.0, 0.985, y);
        a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(uColor * a * a * uOpacity, 0.0);
      }`,
    uniforms: { uColor: { value: new THREE.Color('#c0ff33') }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  })
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(PHONE.w, 0.2), glowMat)
  glow.position.z = PHONE.t / 2 + 0.004
  phone.add(scan, glow)

  // ------------------------------------------------------------ comments as notifications
  const cardGeo = new THREE.PlaneGeometry(1, 1)
  const cards = []
  const CARD_W = 0.61
  function card(i) {
    if (!cards[i]) {
      const d = drawNotification(COMMENTS[i % COMMENTS.length])
      const tex = canvasTexture(d.canvas)
      const mat = cardMaterial(tex)
      const mesh = new THREE.Mesh(cardGeo, mat)
      mesh.renderOrder = 50 + i
      const k = CARD_W / d.w // local units per px
      phone.add(mesh)
      cards[i] = { mesh, mat, w: d.canvas.width * k, h: d.canvas.height * k, ch: d.h * k }
    }
    return cards[i]
  }

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
    keys: FEED.filter((k) => k !== HERO),
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('phone')
      const P = sc.p
      const build = T.shot('build')
      const notifs = T.shot('notifs')
      const dive = T.shot('dive')
      const views = sc.shots.filter((s) => s.type === 'view')
      const visible = t >= build.start && t < dive.end
      phone.visible = visible
      screenLive = false
      if (!visible) return
      const bp = build.p
      const np = notifs.p
      const dp = dive.p
      const L = phoneLayout(view, P)

      // ---------------- backdrop: black, with the two lamps while the numbers are up
      const ink = ctx.col('ink')
      ctx.bg.a = ink
      ctx.bg.b = ink
      ctx.bg.mix = 0
      if (P.raysOn) {
        const on = seg(t, build.start + build.dur * 0.5, 0.8, 'power2.inOut') * (1 - seg(t, notifs.start + 0.1, 0.7, 'power2.inOut'))
        ctx.bg.rays = P.rays * on
        ctx.bg.raysColor = ctx.col(P.raysColor)
        ctx.bg.sway = P.raysSway
        ctx.bg.width = P.raysWidth
        ctx.bg.haze = P.raysHaze
      }

      // ---------------- pose: build → side → front
      const side = { ...L.side, rx: bp.tiltX * DEG, ry: bp.tiltY * DEG, rz: bp.tiltZ * DEG }
      const frontW = (L.portrait ? view.w : Math.min(view.w * 0.46, view.h * 0.9)) * np.phoneFill
      const fs = frontW / PHONE.w
      const frontY0 = view.h / 2 - view.h * 0.09 - (PHONE.h * fs) / 2
      const front = { x: 0, y: frontY0, s: fs }
      const toSide = seg(t, build.start + build.dur * bp.poseFrom, build.dur * (1 - bp.poseFrom) + 0.22, bp.poseEase)
      const toFront = seg(t, notifs.start - 0.2, Math.min(np.frontDur, notifs.dur), np.frontEase)
      if (toFront > 0) mix(side, front, toFront)
      else mix(L.build, side, toSide)
      const idle = toSide * (1 - toFront)
      pose.ry += Math.sin(t * 0.9) * 0.04 * idle
      pose.rx += Math.sin(t * 0.7 + 1) * 0.022 * idle
      pose.y += Math.sin(t * 1.1) * 0.035 * idle

      // ---------------- notifications: where they sit, how far the camera has followed
      const n1 = Math.round(np.count)
      const n2 = Math.round(dp.extra)
      const gapL = 0.0125
      const top = ISL.y - ISL.h / 2 - 0.03
      const firstAt = notifs.start + Math.min(np.frontDur, notifs.dur) * 0.72
      const every = np.every * Math.min(4, Math.max(0.3, notifs.dur / 2.8)) // stretch the block and the banners spread with it
      const tPop = (k) => firstAt + k * every
      let yCur = top
      const place = []
      for (let k = 0; k < n1 + n2; k++) {
        const c = card(k)
        place.push({ c, y: yCur - c.ch / 2 })
        yCur -= c.ch + gapL
      }
      const lastBottom1 = place[n1 - 1].y - place[n1 - 1].c.ch / 2
      // the camera follows the stack down: enough to keep the newest banner in the frame, never past the device's foot
      const bottom0 = frontY0 - (PHONE.h / 2) * fs
      const budget = Math.max(0, -view.h * 0.47 - bottom0)
      const want = Math.max(0, view.h * np.anchor - (frontY0 + lastBottom1 * fs))
      const follow = Math.min(budget, want) * seg(t, firstAt + every * 0.5, Math.max(0.2, (n1 - 1) * every + np.followLag), 'sine.inOut')

      // ---------------- dive: zoom into the screen, accelerate down, the device dissolves
      const du = clamp((t - dive.start) / dive.dur)
      const inDive = t >= dive.start
      const Z = Math.max(dp.zoom, (view.w * 1.12) / frontW)
      const zoom = inDive ? lerp(1, Z, ease(dp.zoomEase)(clamp(du / 0.7))) : 1
      const pitch = (yCur - top) / (n1 + n2) // negative: one banner + gap, local
      const dist = -pitch * n2 * fs + view.h * 0.9
      const run = (u) => dist * ease(dp.speedEase)(clamp(u))
      const scroll = inDive ? run(du) : 0
      const dissolve = inDive ? seg(du, 0.06, 0.3, 'power2.inOut') : 0
      if (inDive) {
        // speed blur from the actual travel per frame (half-open shutter)
        const h = 0.5 / ctx.fps
        const vel = ((run(du + h / dive.dur) - run(du - h / dive.dur)) * zoom) / (2 * h)
        const ease0 = 1 - seg(du, 0.7, 0.3, 'power2.inOut') // the camera is braking: the title arrives sharp
        ctx.fx.blurY = ((vel * 0.5) / ctx.fps / view.h) * dp.blur * ease0
        ctx.fx.zoomBlur = (Z - 1) * 0.16 * Math.sin(Math.PI * clamp(du / 0.7)) * dp.blur
      }

      phone.position.set(pose.x * zoom, (pose.y + follow + scroll) * zoom, 0)
      phone.scale.setScalar(pose.s * zoom)
      phone.rotation.set(pose.rx, pose.ry, pose.rz)
      phone.updateMatrixWorld(true)

      // ---------------- build: outline, then the solid from the bottom
      const u = t - build.start
      const drawDur = Math.min(bp.drawDur, build.dur * 0.6)
      const fill = seg(t, build.start + build.dur * bp.fillFrom, bp.fillDur, 'power2.inOut')
      const revealY = lerp(-PHONE.h / 2 - 0.02, PHONE.h / 2 + 0.02, fill)
      planeFromLocal(revealPlane, phone, 0, -1, 0, 0, fill >= 1 ? 50 : revealY, 0)
      planeFromLocal(linePlane, phone, 0, 1, 0, 0, revealY, 0)
      const lw = 0.0048 * bp.lineWeight * pose.s * view.lw
      const lc = ctx.col(bp.lineColor)
      for (const l of lines) {
        const g = l.userData.group
        const a = seg(u, g * 0.07, drawDur, 'power3.inOut')
        lineWindow(l, 0, fill >= 1 ? 0 : a)
        lineStyle(l, { color: lc, width: lw })
      }
      const scanOn = fill > 0 && fill < 1
      scan.visible = glow.visible = scanOn
      if (scanOn) {
        const k = Math.sin(Math.PI * fill) ** 0.5
        scan.position.y = revealY
        const gh = clamp(revealY + PHONE.h / 2, 0.001, 0.2) // the light it leaves on the glass, never below the device
        glow.scale.y = gh / 0.2
        glow.position.y = revealY - gh / 2
        scanMat.color.set(ctx.col(bp.scanColor))
        scanMat.opacity = k
        glowMat.uniforms.uColor.value.set(ctx.col(bp.scanColor))
        glowMat.uniforms.uOpacity.value = 0.55 * k * bp.scanGlow
      }
      for (const m of bodyMats) {
        m.transparent = dissolve > 0
        m.opacity = 1 - dissolve
        m.depthWrite = dissolve < 0.5
      }
      const bodyOn = dissolve < 0.999
      body.visible = front.visible = island.visible = lensDot.visible = bodyOn
      phone.children.forEach((c) => c.geometry?.type === 'BoxGeometry' && c !== scan && (c.visible = bodyOn))
      screen.visible = bodyOn
      screenMat.uniforms.uFade.value = dissolve
      screenLive = bodyOn

      // ---------------- the feed inside the screen
      const feedStart = build.end + 0.05
      let s = 0
      const sE = ease(P.swipeEase)
      const lastSwipe = Math.floor((notifs.start - 0.25 - feedStart) / P.swipeEvery)
      const nSw = Math.min(lastSwipe, Math.max(0, Math.ceil((t - feedStart) / P.swipeEvery)))
      for (let k = 1; k <= nSw; k++) s += sE(clamp((t - (feedStart + k * P.swipeEvery - P.swipeDur)) / P.swipeDur))
      const i0 = Math.floor(s + 1e-6)
      const f = s - i0
      const wall = toFront // on the lock screen the feed is only a blurred wallpaper
      const setItem = (mesh, idx, y) => {
        const key = FEED[idx % FEED.length]
        const mu = mesh.material.uniforms
        mu.map.value = key === HERO ? videos.want(HERO, heroTime(t, T)) : videos.want(key, Math.max(0, t - (feedStart + idx * P.swipeEvery - P.swipeDur - 0.2)))
        mu.uBlur.value = wall * 4.6
        mu.uDim.value = 1 - (1 - wall * 0.55) ** 2.2
        mesh.position.y = y
      }
      setItem(feedA, i0, f * AH)
      feedB.visible = f > 1e-4
      if (feedB.visible) setItem(feedB, i0 + 1, (f - 1) * AH)
      ui.visible = P.feedUi
      ui.material.uniforms.uOpacity.value = seg(t, build.start + build.dur * 0.55, 0.45, 'power2.out') * (1 - seg(toFront, 0, 0.5))

      // ---------------- the banners
      const popE = ease(np.popEase)
      const fade = inDive ? 1 - seg(du, dp.fadeFrom, Math.max(0.05, 0.97 - dp.fadeFrom), 'power1.inOut') : 1
      const zc = PHONE.t / 2 + 0.006
      cards.forEach((c, k) => {
        const pl = place[k]
        if (!pl) return (c.mesh.visible = false)
        let a = 1
        if (k < n1) a = clamp((t - tPop(k)) / np.popDur)
        else a = dissolve // the rest of the feed only exists once the device has dissolved
        const on = a > 0 && fade > 0.002
        c.mesh.visible = on
        if (!on) return
        const e = k < n1 ? popE(a) : 1
        const sc2 = lerp(0.72, 1, e)
        c.mesh.position.set(0, pl.y + (1 - e) * (c.ch * 0.75), zc + k * 1e-4)
        c.mesh.scale.set(c.w * sc2, c.h * sc2, 1)
        c.mat.uniforms.uOpacity.value = Math.min(1, a * 3.2) * fade
        c.mat.uniforms.uBlur.value = (1 - fade) * 5.2 * dp.fadeBlur + (1 - Math.min(1, a * 2.2)) * 2.4
      })
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
