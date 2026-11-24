// The roadmap → the sign-off.
//
// The page turns lavender from the right while the campaigns leave to the left;
// a white line comes in from the left edge of the frame and runs to the first
// campaign. At each stop: a node on the line, a stem that grows up out of it
// (it is the same line), a circle that draws itself from the stem, then what is
// inside it opens (the campaign's video, or the Cooltura "c?" in 3D for the two
// still to come), and the name, contents and date under the line. A moment to
// read, then the camera travels on with the line to the next stop.
// The sign-off, as at the end of the Cooltura reel: line, stems and circles
// draw back, the page returns to white, the cooltura letters rise out of their
// baseline one after the other, and the "?" leaves the last circle, turns, and
// docks as the "*" in its place at the right of the logotype.

import * as THREE from 'three'
import { buildText, freeText } from '../lib/type.js'
import { solidMaterial, flatMaterial, tileMaterial } from '../lib/materials.js'
import { wordmark, WORDMARK_SIZE, WORDMARK_STAR, asterisk, svgGeometry } from '../lib/brand.js'
import { makeLine, lineWindow, lineStyle, v3 } from '../lib/lines.js'
import { makeMemo } from './shared.js'
import { seg, lerp, clamp, ease, TAU, mixHex } from '../core/util.js'

const PIN_MEDIA = { 'pin-aria': 'feed/marta-carruozzo.mp4', 'pin-gioia': 'feed/gioia.mp4', 'pin-nude': 'feed/nude-look.mp4' }
const PINS = ['pin-aria', 'pin-gioia', 'pin-nude', 'pin-uwc', 'pin-natale']
const C_BOX = { cx: 14.3, cy: 22.0, h: 27.2 }
// the logo, in "c" heights, around its own centre
const LOGO = { c: [-0.2, -0.06], q: [0.5, 0.3], qCap: 0.56 }
const WCX = WORDMARK_SIZE.width / 2
const WCY = WORDMARK_SIZE.height / 2

const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _e = new THREE.Euler()

/** Half a unit circle from the bottom to the top, by the right side (dir 1) or the left (dir -1). */
function halfArc(dir, n = 72) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (dir * i * Math.PI) / n
    pts.push(v3(Math.cos(a), Math.sin(a)))
  }
  return pts
}

export function createRoadmap(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  root.visible = false
  engine.scene.add(root)
  const memo = makeMemo()
  const circleGeo = new THREE.CircleGeometry(1, 72)
  const planeGeo = new THREE.PlaneGeometry(1, 1)
  const cShapes = wordmark()[0].shapes
  const star = asterisk()

  function makePin(id) {
    const g = new THREE.Group()
    root.add(g)
    const stem = makeLine([v3(0, 0), v3(0, 1)], { color: 0xffffff, width: 0.05 })
    const arcs = [makeLine(halfArc(1), { color: 0xffffff, width: 0.05 }), makeLine(halfArc(-1), { color: 0xffffff, width: 0.05 })]
    const nodeMat = flatMaterial('#ffffff')
    const node = new THREE.Mesh(circleGeo, nodeMat)
    const head = new THREE.Group() // what the circle holds, opened from its centre
    g.add(head, stem, node, ...arcs)
    const pin = { id, g, stem, arcs, node, nodeMat, head, labels: new THREE.Group(), labMats: [flatMaterial('#0b0b0c'), flatMaterial('#0b0b0c'), flatMaterial('#0b0b0c')] }
    g.add(pin.labels)
    if (PIN_MEDIA[id]) {
      pin.media = PIN_MEDIA[id]
      pin.videoMat = tileMaterial(videos.tex(pin.media))
      pin.videoMat.uniforms.uCircle.value = 1
      pin.videoMat.uniforms.uShift.value.set(0, 0.06)
      pin.video = new THREE.Mesh(planeGeo, pin.videoMat)
      head.add(pin.video)
    } else {
      pin.discMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0c })
      pin.disc = new THREE.Mesh(circleGeo, pin.discMat)
      head.add(pin.disc)
      // the 3D logo: "c" + "?" ride invisible nodes; the meshes follow them (and the "?" leaves them in the sign-off)
      pin.logoMat = solidMaterial()
      pin.logoNode = new THREE.Object3D()
      pin.cNode = new THREE.Object3D()
      pin.qNode = new THREE.Object3D()
      pin.cNode.position.set(LOGO.c[0], LOGO.c[1], 0)
      pin.qNode.position.set(LOGO.q[0], LOGO.q[1], 0)
      pin.qNode.scale.setScalar(LOGO.qCap)
      pin.logoNode.add(pin.cNode, pin.qNode)
      g.add(pin.logoNode)
      pin.c = new THREE.Mesh(new THREE.BufferGeometry(), pin.logoMat)
      pin.q = new THREE.Mesh(new THREE.BufferGeometry(), pin.logoMat)
      g.add(pin.c, pin.q)
    }
    return pin
  }
  const pins = PINS.map(makePin)
  const lastPin = pins[pins.length - 1]

  // ---------------------------------------------------------- the logotype (sign-off)
  const sign = new THREE.Group()
  root.add(sign)
  const signClip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)]
  const letters = wordmark()
    .slice(0, 8)
    .map((gl) => {
      const mat = flatMaterial('#0b0b0c')
      mat.clippingPlanes = signClip
      const mesh = new THREE.Mesh(svgGeometry(gl.shapes, { cx: WCX, cy: WCY, k: 1 }), mat)
      sign.add(mesh)
      return { mesh, mat }
    })
  const starMat = solidMaterial({ front: '#0b0b0c', side: '#0b0b0c' })
  const starMesh = new THREE.Mesh(svgGeometry(star.shapes, { cx: star.cx, cy: star.cy, k: 1 / star.size, depth: 0.22, bevel: 0.02 }), starMat)
  starMesh.visible = false
  root.add(starMesh)

  return {
    keys: Object.values(PIN_MEDIA),
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('roadmap')
      const P = sc.p
      const beats = PINS.map((id) => T.shot(id))
      const camp = T.shot('campaigns')
      const so = T.shot('signoff')
      const sp = so.p
      const b0 = beats[0]
      const wipeLead = 0.55 // the colour chases the campaigns out of the frame
      const visible = t >= b0.start - wipeLead - 0.02
      root.visible = visible
      if (!visible) return
      void camp

      const bgCol = ctx.col(P.bgColor)
      const white = ctx.col('white')
      const lc = ctx.col(P.lineColor)
      const txt = ctx.col(P.textColor)
      const lw = 0.045 * P.lineWeight * view.lw

      // ---------------- layout (world units; the camera trucks along x)
      const rP = Math.min(view.w * 0.24, view.h * 0.14) * P.pinSize
      const stemH = rP * 0.36
      const yLine = -rP * 0.32
      const headY = yLine + stemH + rP
      const D = Math.max(rP * 2 * 2.25, Math.min(view.w * 0.92, view.h * 0.64)) * P.spacing
      const xs = PINS.map((_, k) => k * D)
      const xL = -view.w / 2 - 0.3
      const xEnd = xs[xs.length - 1]

      // ---------------- when the line reaches each stop, and the camera
      const travelOf = (k) => beats[k].dur * beats[k].p.travel
      const arrive = beats.map((b, k) => (k === 0 ? b.start + 0.5 : b.start + travelOf(k) - 0.06))
      let camX = 0
      let headX = xL
      const first = seg(t, b0.start - 0.2, 0.7, 'power2.inOut')
      headX = lerp(xL, xs[0], first)
      for (let k = 1; k < beats.length; k++) {
        const b = beats[k]
        const e = seg(t, b.start, travelOf(k), b.p.travelEase)
        const eh = seg(t, b.start - 0.06, travelOf(k), b.p.travelEase) // the line leads the camera a hair
        camX = lerp(camX, xs[k], e)
        if (t >= b.start - 0.06) headX = lerp(xs[k - 1], xs[k], eh)
      }
      ctx.camera.position.x = camX

      // ---------------- backdrop: white → lavender (from the right), then lavender → white (iris) in the sign-off
      const wipe = seg(t, b0.start - wipeLead, P.wipeDur, P.wipeEase)
      const toWhite = seg(t, so.start + sp.bgFrom, sp.bgDur, sp.bgEase)
      if (t >= so.start && toWhite > 0) Object.assign(ctx.bg, { a: bgCol, b: white, mix: toWhite, mode: 'iris', center: [0.5, 0.5], soft: 0.012, rays: 0 })
      else Object.assign(ctx.bg, { a: white, b: bgCol, mix: wipe, mode: 'wipe', angle: Math.PI, soft: 0.03, rays: 0 })

      // ---------------- the line (retracts into the last stop in the sign-off)
      const line = memo(
        'line',
        `${xL.toFixed(3)}|${xEnd.toFixed(3)}|${yLine.toFixed(3)}`,
        () => {
          const l = makeLine([v3(xL, yLine), v3(xEnd, yLine)], { color: 0xffffff, width: 0.05 })
          root.add(l)
          return l
        },
        (l) => {
          root.remove(l)
          l.geometry.dispose()
          l.material.dispose()
        },
      )
      const und = t >= so.start ? seg(t, so.start, sp.undrawDur, sp.undrawEase) : 0
      const fx = (x) => (x - xL) / (xEnd - xL)
      lineWindow(line, und * fx(xEnd), fx(headX))
      lineStyle(line, { color: lc, width: lw })

      // ---------------- the stops
      const gone = t >= so.start ? seg(t, so.start, Math.min(0.5, sp.undrawDur), 'power2.in') : 0
      pins.forEach((pin, k) => {
        const b = beats[k]
        const p = b.p
        const isLast = pin === lastPin
        const ta = arrive[k]
        const on = t >= ta - 0.02 && headX >= xs[k] - 1e-3
        pin.g.visible = on
        if (!on) return
        pin.g.position.set(xs[k], 0, 0)
        const drawE = ease(p.drawEase)
        // node → stem → circle (two halves from the stem round to the top) → what it holds
        const nodeIn = seg(t, ta, 0.22, 'power2.out')
        const stemIn = seg(t, ta + 0.04, 0.24, 'power2.out')
        const circ = drawE(clamp((t - ta - 0.2) / p.drawDur))
        const fill = seg(t, ta + 0.2 + p.drawDur * 0.75, 0.5, 'power3.out')
        const out = gone
        pin.node.position.set(0, yLine, 0.01)
        pin.node.scale.setScalar(Math.max(1e-4, lw * 2.1 * nodeIn * (1 - out)))
        pin.nodeMat.color.set(lc)
        pin.stem.position.set(0, yLine, 0)
        pin.stem.scale.set(1, stemH, 1)
        lineWindow(pin.stem, 0, stemIn * (1 - out))
        lineStyle(pin.stem, { color: lc, width: lw })
        for (const a of pin.arcs) {
          a.position.set(0, headY, 0.012)
          a.scale.setScalar(rP)
          lineWindow(a, 0, circ * (1 - out))
          lineStyle(a, { color: lc, width: lw * 1.15 })
        }
        // the content opens from the centre (an iris), the picture holding still
        const rIn = rP - lw * 0.55
        const shrink = isLast ? seg(t, so.start + 0.05, 0.5, 'power3.inOut') : out
        const open = fill * (1 - shrink)
        pin.head.position.set(0, headY, 0)
        if (pin.video) {
          const s = Math.max(1e-4, open)
          pin.video.scale.set(2 * rIn * s, 2 * rIn * s, 1)
          pin.videoMat.uniforms.uSize.value.set(2 * rIn * s, 2 * rIn * s)
          pin.videoMat.uniforms.uZoom.value = 1.22 / s
          pin.video.visible = open > 0.002
          if (pin.video.visible) pin.videoMat.uniforms.map.value = videos.want(pin.media, Math.max(0, t - ta + 0.6))
        } else {
          pin.disc.scale.setScalar(Math.max(1e-4, rIn * open))
          pin.disc.visible = open > 0.002
          pin.discMat.color.set(ctx.col(p.discColor))
          // the logo turns in once its disc is there, then breathes
          const spinIn = seg(t, ta + 0.2 + p.drawDur * 0.75, 0.8, 'power3.out')
          const spin = (1 - spinIn) * p.spin * TAU
          const sway = Math.sin(t * 1.2 + k) * 0.2 * spinIn
          pin.logoNode.position.set(0, headY, rP * 0.3)
          pin.logoNode.rotation.set(Math.sin(t * 0.9 + k) * 0.05, spin + sway, 0)
          // the last "?" does not shrink with its circle: it is about to fly into the logotype
          pin.logoNode.scale.setScalar(Math.max(1e-4, rP * 0.98 * spinIn * (isLast ? 1 : 1 - shrink)))
          pin.logoNode.updateMatrix()
          pin.cNode.updateMatrix()
          pin.qNode.updateMatrix()
          const cGeo = memo('c' + k, String(p.logoDepth), () => svgGeometry(cShapes, { cx: C_BOX.cx, cy: C_BOX.cy, k: 1 / C_BOX.h, depth: p.logoDepth, bevel: 0.022 }), (g) => g.dispose())
          const qGeo = memo(
            'q' + k,
            String(p.logoDepth),
            () => {
              const blk = buildText('?', { weight: 800, cap: 1, by: 'all', depth: p.logoDepth / LOGO.qCap, pivot: 'center', segs: 12 })
              const geo = blk.units[0].mesh.geometry
              geo.scale(blk.em, blk.em, blk.em)
              return geo
            },
            (g) => g.dispose(),
          )
          pin.c.geometry = cGeo
          pin.q.geometry = qGeo
          const front = ctx.col(p.logoColor)
          const sideHex = p.logoColor === 'lime' ? ctx.col('violet') : mixHex(front, '#5a4fd0', 0.55)
          pin.logoMat.userData.setColors(front, sideHex, mixHex(sideHex, '#000000', 0.6))
          const placeOn = (mesh, node) => {
            _m.multiplyMatrices(pin.logoNode.matrix, node.matrix).decompose(_p, _q, _s)
            mesh.position.copy(_p)
            mesh.quaternion.copy(_q)
            mesh.scale.copy(_s)
          }
          placeOn(pin.c, pin.cNode)
          placeOn(pin.q, pin.qNode)
          if (isLast) pin.c.scale.multiplyScalar(Math.max(1e-4, 1 - shrink))
          pin.c.visible = pin.logoNode.scale.x > 1e-3 && pin.c.scale.x > 1e-3
          pin.q.visible = pin.c.visible && !(isLast && t >= so.start + sp.dockAt)
        }
        // labels: name, contents, date under the line
        const lab = memo(
          'lab' + k,
          `${p.name}|${p.count}|${p.date}|${rP.toFixed(3)}|${D.toFixed(3)}`,
          () => {
            const g = new THREE.Group()
            const rows = []
            const maxW = Math.min(view.w * 0.86, D * 0.9)
            const add = (str, weight, cap, m, tracking) => {
              if (!String(str || '').trim()) return
              const blk = buildText(String(str), { weight, cap, by: 'all', pivot: 'baseline', tracking, material: m })
              const fit = Math.min(1, maxW / blk.width) // one line: a long one shrinks to fit
              blk.group.scale.setScalar(fit)
              g.add(blk.group)
              rows.push({ blk, m, cap: cap * fit })
            }
            add(p.name, 560, rP * 0.22, pin.labMats[0], 0.06)
            add(p.count, 400, rP * 0.145, pin.labMats[1], 0)
            add(p.date, 400, rP * 0.145, pin.labMats[2], 0)
            let y = yLine - rP * 0.3
            for (const r of rows) {
              r.base = y - r.cap
              y = r.base - r.cap * 1.05
            }
            pin.labels.add(g)
            return { g, rows }
          },
          (o) => {
            pin.labels.remove(o.g)
            o.rows.forEach((r) => freeText(r.blk))
          },
        )
        lab.rows.forEach((r, i) => {
          const e = seg(t, ta + 0.32 + i * 0.08, 0.6, 'power3.out')
          const o = isLast ? seg(t, so.start, 0.35, 'power2.in') : out
          r.blk.group.position.set(0, r.base + r.cap * 0.5 - (1 - e) * r.cap * 0.9, 0)
          r.m.color.set(txt)
          r.m.opacity = e * (1 - o)
        })
      })

      // ---------------- sign-off: the logotype rises, the "?" docks as the "*"
      const signOn = t >= so.start
      sign.visible = signOn
      starMesh.visible = false
      if (signOn) {
        const W = Math.min(view.w * 0.74, view.h * 1.05) * sp.wordSize
        const ws = W / WORDMARK_SIZE.width
        const yW = 0
        sign.position.set(camX, yW, 0)
        sign.scale.setScalar(ws)
        signClip[0].constant = -(yW - WCY * ws - ws * 0.6) // nothing shows under the baseline
        const riseE = ease(sp.riseEase)
        const word = ctx.col(sp.wordColor)
        letters.forEach((L, j) => {
          const e = riseE(clamp((t - so.start - sp.riseAt - j * sp.riseStagger) / sp.riseDur))
          L.mesh.position.y = -(1 - e) * (WORDMARK_SIZE.height + 4)
          L.mesh.visible = e > 0
          L.mat.color.set(word)
        })
        // the "?" of the last circle → the "*" in its slot
        const f = seg(t, so.start + sp.dockAt, sp.dockDur, sp.dockEase)
        if (f > 0 && lastPin.q) {
          _p.set(lastPin.q.position.x + xs[xs.length - 1], lastPin.q.position.y, lastPin.q.position.z)
          const slot = new THREE.Vector3(camX + (WORDMARK_STAR.x - WCX) * ws, yW - (WORDMARK_STAR.y - WCY) * ws, 0.02)
          const fromS = lastPin.q.scale.x
          const toS = WORDMARK_STAR.size * ws
          // an arc: up a little, then down into the slot
          const pos = new THREE.Vector3().lerpVectors(_p, slot, f)
          pos.y += Math.sin(Math.PI * f) * rP * 0.35
          const turn = sp.starSpin * TAU * (1 - f)
          // swap "?" → "*" where it is edge-on (half a turn before it lands), so the change never shows
          const swapAt = sp.starSpin > 0 ? 1 - 0.25 / sp.starSpin : 0.5
          const isStar = f >= swapAt
          const front = ctx.col(beats[beats.length - 1].p.logoColor)
          const sc2 = ctx.col(sp.starColor)
          if (isStar) {
            starMesh.visible = true
            starMesh.position.copy(pos)
            starMesh.quaternion.setFromEuler(_e.set(0, turn, 0))
            const s = lerp(fromS * 1.25, toS, f)
            starMesh.scale.set(s, s, s * lerp(0.6, 0.04, f))
            starMat.userData.setColors(mixHex(front, sc2, f), mixHex(front, sc2, f))
            lastPin.q.visible = false
          } else {
            lastPin.q.visible = true
            lastPin.q.position.set(pos.x - xs[xs.length - 1], pos.y, pos.z)
            lastPin.q.quaternion.setFromEuler(_e.set(0, turn, 0))
            lastPin.q.scale.setScalar(lerp(fromS, toS * 0.85, f))
          }
          if (f >= 1) {
            // docked: flat, ink, exactly the wordmark's own asterisk
            starMesh.scale.set(toS, toS, toS * 0.04)
            starMesh.quaternion.identity()
          }
        }
      }
    },
  }
}
