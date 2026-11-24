// V5 · the take. One actor draws the whole film from the plan (machina/plan.js):
// the camera, the line (one Line2 windowed up to the pen), the asterisk that
// draws it, the logo at both ends, and everything that stands on the line.
// A pure function of time, like the rest of the studio.

import * as THREE from 'three'
import { Kinetic } from '../lib/kinetic.js'
import { Counter } from '../lib/counter.js'
import { tileMaterial, canvasTexture } from '../lib/materials.js'
import { fxMaterial, fxMesh, fxBlur, fxMask } from '../engine/fxlayer.js'
import { makeLine, lineWindow, lineStyle, disposeLine } from '../lib/lines.js'
import { buildPlan, HERO } from './plan.js'
import { LockupView, initLockup, starGeometry, STAR_D } from './lockup.js'
import { commentArt } from './art.js'
import { LOOK } from './model.js'
import { setGlyphAlternates } from '../lib/type.js'
import { CAM_D, VIEW_H } from '../engine/engine.js'
import { seg, clamp, lerp, ease, smooth } from '../core/util.js'

const ARMS = 5 // the asterisk's symmetry: it lands back on a multiple of 360° / 5
const IDENT = new THREE.Matrix4()

let _h = 0
const strHash = (s) => {
  _h = 2166136261
  for (let i = 0; i < s.length; i++) _h = Math.imul(_h ^ s.charCodeAt(i), 16777619)
  return (_h >>> 0) / 4294967296
}

export async function createMachina(engine) {
  await initLockup()
  const videos = engine.videos
  const world = new THREE.Group()
  engine.scene.add(world)

  // ---------------------------------------------------------------- the line, the pen, the logos
  let line = null
  const penMat = fxMaterial({ maskInv: IDENT })
  const pen = fxMesh(starGeometry(), penMat)
  pen.visible = false
  world.add(pen)
  const lockOpen = new LockupView(world)
  const lockClose = new LockupView(world)

  // ---------------------------------------------------------------- pools (by element id)
  const texts = new Map()
  const counters = new Map()
  const tiles = new Map()
  const bars = new Map()
  const notes = new Map()
  const words = new Map()
  const tileGeo = new THREE.PlaneGeometry(1, 1)
  const barGeo = new THREE.PlaneGeometry(1, 1)
  const planes = new Map() // clip planes by height

  let plan = null
  let planT = null
  let planKey = ''
  const colA = new THREE.Color()
  const colB = new THREE.Color()

  const lookOf = (store) => ({ ...LOOK.defaults, ...store.project.look })

  function rebuild(ctx, look) {
    plan = buildPlan(ctx.T, ctx.view, look, { grid: videos.keys('v3/grid/') })
    // the line
    if (line) {
      world.remove(line)
      disposeLine(line)
    }
    const P = plan.path
    const pts = []
    for (let i = 0; i < P.n; i++) pts.push(new THREE.Vector3(P.x[i], P.y[i], 0))
    if (pts.length < 2) pts.push(new THREE.Vector3(P.x[0] ?? 0, P.y[0] ?? 0, 0), new THREE.Vector3((P.x[0] ?? 0) + 1e-3, P.y[0] ?? 0, 0))
    line = makeLine(pts, { color: ctx.col(look.lineColor), width: 0.02 })
    line.renderOrder = 5
    world.add(line)
    // forget the elements that are gone
    const ids = new Set(plan.els.map((e) => e.id))
    for (const [id, k] of texts) if (!ids.has(id)) (k.dispose(), texts.delete(id))
    for (const [id, c] of counters) if (!ids.has(id)) (c.dispose(), counters.delete(id))
    for (const [id, o] of tiles) if (!ids.has(id) || o.key !== plan.els.find((e) => e.id === id)?.key) (world.remove(o.mesh), o.mat.dispose(), tiles.delete(id))
    for (const [id, o] of bars) if (!ids.has(id)) (world.remove(o.mesh), o.mat.dispose(), bars.delete(id))
    for (const [id, o] of notes) if (!ids.has(id) || o.w !== plan.els.find((e) => e.id === id)?.w) (world.remove(o.mesh), o.mat.dispose(), o.mesh.geometry.dispose(), notes.delete(id))
    for (const [id, k] of words) if (!ids.has(id)) (k.dispose(), words.delete(id))
  }

  const textOf = (id, pool = texts) => {
    let k = pool.get(id)
    if (!k) pool.set(id, (k = new Kinetic(world)))
    return k
  }
  const counterOf = (id) => {
    let c = counters.get(id)
    if (!c) counters.set(id, (c = new Counter(world)))
    return c
  }
  const tileOf = (el) => {
    let o = tiles.get(el.id)
    if (o) return o
    const mat = tileMaterial(videos.tex(el.key))
    if (el.clipY !== undefined) {
      const key = el.clipY.toFixed(4)
      let pl = planes.get(key)
      if (!pl) planes.set(key, (pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -el.clipY)))
      mat.clippingPlanes = [pl]
    }
    const mesh = new THREE.Mesh(tileGeo, mat)
    mesh.frustumCulled = false
    mesh.visible = false
    mesh.renderOrder = 1
    world.add(mesh)
    o = { mesh, mat, key: el.key }
    tiles.set(el.id, o)
    return o
  }
  const barOf = (id) => {
    let o = bars.get(id)
    if (o) return o
    const mat = fxMaterial({ maskInv: IDENT })
    const mesh = fxMesh(barGeo, mat)
    world.add(mesh)
    o = { mesh, mat }
    bars.set(id, o)
    return o
  }
  const noteOf = (el, S) => {
    let o = notes.get(el.id)
    if (o) return o
    const art = commentArt(el.idx, (el.w / S) * 1080)
    const tex = canvasTexture(art.canvas)
    const mat = fxMaterial({ map: tex, maskInv: IDENT })
    const mesh = fxMesh(new THREE.PlaneGeometry(1, art.aspect), mat)
    world.add(mesh)
    o = { mesh, mat, tex, w: el.w, aspect: art.aspect }
    notes.set(el.id, o)
    return o
  }

  // ---------------------------------------------------------------- per frame
  return {
    /** Every video the film can show (preloaded at boot). */
    keysFor(T) {
      const keys = new Set([HERO, ...videos.keys('v3/grid/')])
      for (const sh of T.shots) if (sh.type === 'proof') for (const s of sh.p.videos || []) keys.add(`v3/feed/${s}.mp4`)
      return [...keys]
    },
    update(ctx) {
      const { t, view } = ctx
      const look = lookOf(engine.store)
      // the zero without its slash: new outlines, so every block of type is rebuilt
      if (setGlyphAlternates(look.plainZero ? { 0: 'zero.ss12' } : {})) {
        for (const k of texts.values()) k.dispose()
        for (const c of counters.values()) c.dispose()
        for (const k of words.values()) k.dispose()
      }
      const key = `${view.w.toFixed(4)}|${view.h.toFixed(4)}|${look.penSize}|${look.plainZero}`
      if (ctx.T !== planT || key !== planKey) {
        planT = ctx.T
        planKey = key
        rebuild(ctx, look)
      }
      const P = plan
      const S = P.S

      // ---------------- camera
      const c = P.camAt(t)
      const D = (CAM_D * c.h) / VIEW_H
      ctx.camera.position.set(c.x, c.y, D)
      const far = Math.max(600, D * 1.6)
      if (Math.abs(ctx.camera.far - far) > 1) {
        ctx.camera.far = far
        ctx.camera.updateProjectionMatrix()
      }
      const pxW = engine.canvas.height / c.h // pixels per world unit on the paper
      ctx.pxPerWorld = pxW
      const halfW = (c.h * view.aspect) / 2
      const vx0 = c.x - halfW * 1.15
      const vx1 = c.x + halfW * 1.15
      const vy0 = c.y - (c.h / 2) * 1.15
      const vy1 = c.y + (c.h / 2) * 1.15
      const inView = (b) => !b || (b.x1 >= vx0 && b.x0 <= vx1 && b.y1 >= vy0 && b.y0 <= vy1)
      // camera motion blur (the post pass smears along the camera's travel)
      const c0 = P.camAt(t - 1 / ctx.fps)
      // only for lateral travel: during a zoom the content flows around a pivot a uniform smear cannot follow, so it fades out
      const dz = Math.abs(Math.log(c.h / c0.h))
      const mb = look.motionBlur / (1 + dz * 400)
      ctx.fx.blurX = ((c.x - c0.x) / (c.h * view.aspect)) * mb
      ctx.fx.blurY = ((c.y - c0.y) / c.h) * mb
      ctx.fx.zoomBlur = 0

      // ---------------- the line
      const shortPx = Math.min(engine.canvas.width, engine.canvas.height)
      const lwPx = look.lineWidth * (shortPx / 1080) * clamp(Math.pow(VIEW_H / c.h, 0.18), 0.62, 1.25)
      const lw = lwPx / pxW
      const L = P.path.s
      const s = P.penS(t)
      const a = P.tail(t)
      if (L > 1e-4 && s - a > 1e-5) {
        lineWindow(line, a / L, s / L)
        lineStyle(line, { color: ctx.col(look.lineColor), width: lw })
      } else line.visible = false

      // ---------------- the logos
      const op = P.open
      if (op) {
        const u = t - op.sh.start
        const vis = t >= op.sh.start - 0.05 && inView(op.g.box)
        lockOpen.pose(ctx, op.g, op.sh.p, u, vis)
      } else lockOpen.pose(ctx, null, null, 0, false)
      const cl = P.els.find((e) => e.kind === 'lockup' && e.role === 'close')
      if (cl) lockClose.pose(ctx, cl.g, cl.sh.p, t - cl.revealAt, t >= cl.revealAt - 0.05 && inView(cl.g.box))
      else lockClose.pose(ctx, null, null, 0, false)

      // ---------------- the pen (the asterisk of cooltura*)
      const penD = (look.penSize / 100) * S * (c.h / VIEW_H)
      const q = P.pos(s, [0, 0])
      let px = q[0]
      let py = q[1]
      let pd = penD
      let rot = P.rotAt(t)
      colA.set(ctx.col(look.penColor))
      let opa = 1
      let blur = 0
      let mask = null
      if (op && t < P.departAt) {
        // resting in the logo (it reveals with the other letters)
        const st = lockOpen.star
        px = op.g.star.x
        py = op.g.star.y + st.y
        pd = op.g.star.d
        rot = 0
        colA.set(ctx.col(op.sh.p.logoColor))
        opa = st.on ? st.op : 0
        blur = st.blur
        mask = st.mask
      } else if (op && t < P.departAt + 0.45) {
        const u = smooth(clamp((t - P.departAt) / 0.45))
        pd = lerp(op.g.star.d, penD, u)
        colB.set(ctx.col(op.sh.p.logoColor))
        colA.lerpColors(colB, colA.clone(), u)
      }
      if (P.close) {
        const g = P.close.g
        const left = P.dockAt - t
        const rEnd = P.rotAt(P.dockAt)
        const target = Math.round(rEnd / ((2 * Math.PI) / ARMS)) * ((2 * Math.PI) / ARMS)
        if (left <= 0) {
          px = g.star.x
          py = g.star.y
          pd = g.star.d
          rot = target
          colA.set(ctx.col(P.close.sh.p.logoColor))
        } else if (left < 0.5) {
          const u = smooth(1 - left / 0.5)
          pd = lerp(penD, g.star.d, u)
          rot = rot + (target - rEnd) * u
          colB.set(ctx.col(P.close.sh.p.logoColor))
          colA.lerp(colB, u)
        }
      }
      const penOn = opa > 0.002 && (op || t >= P.departAt) && (P.departAt >= 0 || s > 0 || P.close)
      pen.visible = !!penOn && inView({ x0: px - pd, x1: px + pd, y0: py - pd, y1: py + pd })
      if (pen.visible) {
        pen.position.set(px, py, 0)
        pen.rotation.set(0, 0, rot)
        const k = pd / STAR_D
        pen.scale.setScalar(k)
        penMat.uniforms.uColor.value.copy(colA)
        penMat.uniforms.uOpacity.value = opa
        if (mask) fxMask(pen, true, mask[0], mask[1], mask[2], mask[3])
        else fxMask(pen, false)
        fxBlur(pen, blur / k, 0, 0, k * pxW)
      }

      // ---------------- elements
      const fps = ctx.fps
      for (const el of P.els) {
        switch (el.kind) {
          case 'text':
            poseText(ctx, el, t, lw, inView)
            break
          case 'counter':
            poseCounter(ctx, el, t, inView)
            break
          case 'tile':
            poseTile(el, t, inView)
            break
          case 'tick':
          case 'branch':
            poseBar(ctx, el, t, lw, look, inView)
            break
          case 'comment':
            poseNote(el, t, S, pxW, inView)
            break
          case 'word':
            poseWord(ctx, el, t, S, fps)
            break
        }
      }
    },
    late() {
      for (const k of texts.values()) k.late()
      for (const k of words.values()) k.late()
      for (const c of counters.values()) c.late()
      lockOpen.late()
      lockClose.late()
    },
  }

  // ================================================================ element poses

  function stackShift(el, t) {
    const st = el.stack
    if (!st) return 0
    let dy = 0
    if (el.index !== undefined) for (let j = el.index + 1; j < st.enters.length; j++) dy += ease(st.enterEase)(clamp((t - st.enters[j]) / st.enterDur)) * st.step
    if (st.sink && el.kind === 'text' && el.side !== 'below') {
      const k = ease(st.sink.ease)(clamp((t - st.sink.at) / st.sink.dur))
      dy -= k * (st.step * st.enters.length + el.cap * 2)
    }
    return dy
  }

  function poseText(ctx, el, t, lw, inView) {
    const kt = textOf(el.id)
    const R = el.rise
    const gone = el.stack?.sink && t > el.stack.sink.at + el.stack.sink.dur + 0.05
    if (!inView(el.box) || gone || (R.mode === 'time' && t < R.at - 0.05)) {
      kt.group.visible = false
      return
    }
    const info = kt.set({ text: el.text, weight: el.weight, align: 'left', measure: el.measure ?? Infinity, leading: el.leading ?? 1.1, tracking: el.tracking ?? 0 })
    const cap = el.cap
    let gy = el.side === 'below' ? el.top - (info.height / 2) * cap : el.base + (info.height / 2) * cap
    gy += stackShift(el, t)
    kt.group.position.set(el.x, gy, 0)
    kt.group.scale.setScalar(cap)
    if (el.side === 'below') {
      kt.clipHi = (el.lineY - lw * 0.5 - gy) / cap
      kt.clipLo = null
    } else {
      kt.clipLo = (el.lineY + lw * 0.5 - gy) / cap
      kt.clipHi = null
    }
    const split = R.split || 'chars'
    let times = null
    if (R.mode === 'pen' && el.floor) times = kt.groupsX(split).map(([x0, x1]) => plan.tPassX(el.floor, el.x + ((x0 + x1) / 2) * cap) + (R.delay || 0))
    const at = times ? Math.min(...times) : R.at ?? 0
    if (t < at - 0.05) {
      kt.group.visible = false
      return
    }
    const sign = el.side === 'below' ? -1 : 1
    const inPh = { at, dur: R.dur, stagger: R.stagger ?? 0, order: R.order ?? 'start', split, ease: R.ease, x: 0, y: sign * R.y, rot: 0, depth: 0, scale: 1, blur: R.blur, opacity: 0, mask: true, times }
    let outPh = null
    const sk = el.stack?.sink
    if (sk && el.side === 'below') outPh = { at: sk.at, dur: sk.dur * 0.8, stagger: 0.008, order: 'start', split: 'chars', ease: sk.ease, x: 0, y: -150, rot: 0, depth: 0, scale: 1, blur: 15, opacity: 0, mask: true }
    kt.pose(t, { in: inPh, out: outPh, from: ctx.col(el.from), to: ctx.col(el.color), motion: el.motion ?? 0.6, fps: ctx.fps, px: cap * ctx.pxPerWorld })
  }

  function poseCounter(ctx, el, t, inView) {
    const ctr = counterOf(el.id)
    const sk = el.stack?.sink
    if (!inView(el.box) || t < el.at - 0.05 || (sk && t > sk.at + sk.dur + 0.1)) {
      ctr.group.visible = false
      return
    }
    const p = el.p
    ctr.set({ value: el.value, weight: p.weight, align: 'left', spins: el.spins ?? 5, step: el.step ?? 1, down: !!el.down, digitAlign: el.digitAlign || 'center' })
    ctr.group.position.set(el.x, el.base + el.cap * 0.5, 0)
    ctr.group.scale.setScalar(el.cap)
    ctr.pose(t, {
      at: el.at,
      dur: el.dur,
      stagger: 0.05,
      order: 'end',
      ease: p.cEase || 'ci.emph',
      blur: p.cBlur ?? 24,
      motion: 1,
      fromColor: ctx.col(p.fromColor || 'violet'),
      color: ctx.col(p.color || 'ink'),
      px: el.cap * ctx.pxPerWorld,
      fps: ctx.fps,
      steps: el.steps,
      stepDur: el.stepDur,
      out: sk ? { at: sk.at, dur: sk.dur * 0.85, stagger: 0.02, order: 'start', ease: sk.ease, y: 160, blur: 20, opacity: 0, mask: true } : null,
    })
  }

  function poseTile(el, t, inView) {
    const o = tileOf(el)
    const m = o.mesh
    let y = el.y
    let rv = 1
    let zoom = el.zoom || 1
    if (el.reveal) {
      const k = ease(el.reveal.ease)(clamp((t - el.reveal.at) / el.reveal.dur))
      rv = k
      if (!el.noZoom) zoom *= lerp(1.12, 1, ease('ci.reveal')(clamp((t - el.reveal.at) / (el.reveal.dur * 1.6))))
      if (el.lift) y -= el.lift * (1 - k)
      if (t < el.reveal.at) {
        m.visible = false
        return
      }
    }
    if (el.rise) {
      if (t < el.rise.at) {
        m.visible = false
        return
      }
      y -= (1 - ease(el.rise.ease)(clamp((t - el.rise.at) / el.rise.dur))) * el.rise.dist
    }
    const box = { x0: el.x - el.w / 2, x1: el.x + el.w / 2, y0: y - el.h / 2, y1: y + el.h / 2 }
    if (!inView(box)) {
      m.visible = false
      return
    }
    m.visible = true
    m.position.set(el.x, y, 0)
    m.scale.set(el.w, el.h, 1)
    const u = o.mat.uniforms
    u.uSize.value.set(el.w, el.h)
    u.uRadius.value = el.r
    u.uZoom.value = zoom
    const z = el.zoom || 1
    if (el.shift) u.uShift.value.set(el.shift[0] * (1 - 1 / z), el.shift[1] * (1 - 1 / z))
    u.uReveal.value = rv
    u.uDim.value = 0
    u.uBlur.value = 0
    let mt
    if (el.media === 'grid') mt = t + 0.3 + strHash(el.key) * 3.8
    else mt = Math.max(0, t - (el.reveal ? el.reveal.at : 0)) + (el.media === 'proof' ? 0.25 : 0)
    u.map.value = videos.want(el.key, mt)
  }

  function poseBar(ctx, el, t, lw, look, inView) {
    const o = barOf(el.id)
    const k = ease('ci.reveal')(clamp((t - el.at) / el.dur))
    if (k <= 0 || !inView(el.box)) {
      o.mesh.visible = false
      return
    }
    o.mesh.visible = true
    o.mat.uniforms.uColor.value.set(ctx.col(look.lineColor))
    o.mat.uniforms.uOpacity.value = 1
    if (el.kind === 'tick') {
      o.mesh.position.set(el.x, el.y, 0)
      o.mesh.scale.set(lw, Math.max(1e-4, 2 * el.h * k), 1)
    } else {
      const len = (el.x1 - el.x0) * k
      o.mesh.position.set(el.x0 + len / 2, el.y, 0)
      o.mesh.scale.set(Math.max(1e-4, Math.abs(len)), lw, 1)
    }
    fxMask(o.mesh, false)
    fxBlur(o.mesh, 0, 0, 0, 100)
  }

  function poseNote(el, t, S, pxW, inView) {
    if (t < el.at - 0.02 || !inView(el.box)) {
      const o = notes.get(el.id)
      if (o) o.mesh.visible = false
      return
    }
    const o = noteOf(el, S)
    const k = ease(el.ease)(clamp((t - el.at) / el.dur))
    const dx = (el.right ? -1 : 1) * (1 - k) * el.w * 0.32
    o.mesh.visible = true
    o.mesh.position.set(el.x + el.w / 2 + dx, el.top - (el.w * o.aspect) / 2, 0)
    o.mesh.scale.setScalar(el.w)
    o.mat.uniforms.uOpacity.value = clamp(k * 1.5)
    if (el.right) fxMask(o.mesh, true, el.clipX, -1e6, 1e6, 1e6)
    else fxMask(o.mesh, true, -1e6, -1e6, el.clipX, 1e6)
    fxBlur(o.mesh, (1 - k) * 0.03, 0, 0, el.w * pxW)
  }

  function poseWord(ctx, el, t, S, fps) {
    const sh = el.sh
    const p = sh.p
    const kt = textOf(el.id, words)
    if (t < sh.start + p.inAt - 0.05 || t > sh.end + 0.6) {
      kt.group.visible = false
      return
    }
    const cap = (p.size / 100) * S
    kt.set({ text: String(p.text), weight: p.weight, align: 'center', tracking: p.tracking })
    kt.group.position.set(el.x, el.y, 0)
    kt.group.scale.setScalar(cap)
    kt.clipLo = null
    kt.clipHi = null
    kt.pose(t, {
      in: { at: sh.start + p.inAt, dur: p.inDur, stagger: p.inStagger, order: 'start', split: 'chars', ease: p.inEase, x: 0, y: p.inY, rot: 0, depth: 0, scale: 1, blur: p.inBlur, opacity: 0, mask: true },
      out: { at: sh.end + p.outAt, dur: p.outDur, stagger: p.outStagger, order: 'start', split: 'chars', ease: p.outEase, x: 0, y: p.outY, rot: 0, depth: 0, scale: 1, blur: p.outBlur, opacity: 0, mask: true },
      from: ctx.col(p.fromColor),
      to: ctx.col(p.color),
      motion: 0.6,
      fps,
      px: cap * ctx.pxPerWorld,
    })
  }
}
