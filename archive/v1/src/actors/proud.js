// Proud Moments → the campaign timeline → the sign-off.
//
// The backdrop wipes from black to lavender as a white line cuts the frame from
// the left, between "Proud" and "Moments" (the letters come out of the line).
// The line is not straight: it is a ring lying flat, seen edge-on. As the camera
// travels right and rises, the ring shows as an ellipse with the campaigns
// pinned along it (video in a circle, name, contents, date); the last two pins
// hold the Cooltura "c" in 3D with a "?" where the asterisk goes.
// Sign-off: line, stem and circle retract into the last pin, the "c" becomes
// the first letter of the logotype, the rest is written stroke by stroke, the
// "?" turns into the "*", and the backdrop returns to paper.

import * as THREE from 'three'
import { buildText, widthInCaps } from '../lib/type.js'
import { solidMaterial, flatMaterial, tileMaterial } from '../lib/materials.js'
import { wordmark, WORDMARK_SIZE, WORDMARK_STAR, asterisk, svgGeometry, svgContours } from '../lib/brand.js'
import { makeLine, lineWindow, lineStyle, circlePoints, v3 } from '../lib/lines.js'
import { makeMemo } from './shared.js'
import { CAM_D } from '../engine/engine.js'
import { seg, lerp, clamp, ease, DEG, TAU, mixHex } from '../core/util.js'

const PIN_MEDIA = { 'pin-aria': 'feed/marta-carruozzo.mp4', 'pin-gioia': 'feed/gioia.mp4', 'pin-nude': 'feed/nude-look.mp4' }
const C_BOX = { cx: 14.3, cy: 22.0, h: 27.2 }
// the logo, in "c" heights, around its own centre
const LOGO = { c: [-0.2, -0.06], q: [0.5, 0.3], qCap: 0.56 }

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _q2 = new THREE.Quaternion()
const _e = new THREE.Euler()

export function createProud(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  root.visible = false
  engine.scene.add(root)
  const memo = makeMemo()

  // ---------------------------------------------------------- title
  const titleG = new THREE.Group()
  root.add(titleG)
  const clipUp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const clipDown = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  const matUp = flatMaterial('#0b0b0c')
  const matDown = flatMaterial('#0b0b0c')
  matUp.clippingPlanes = [clipUp]
  matDown.clippingPlanes = [clipDown]

  // ---------------------------------------------------------- pins
  const cShapes = wordmark()[0].shapes
  const star = asterisk()
  const circleGeo = new THREE.CircleGeometry(1, 72)
  const planeGeo = new THREE.PlaneGeometry(1, 1)

  function makePin(id) {
    const g = new THREE.Group()
    root.add(g)
    const stem = makeLine([v3(0, 0), v3(0, 1)], { color: 0xffffff, width: 0.05 })
    const ring = makeLine(circlePoints(1, 96, -Math.PI / 2, -1), { color: 0xffffff, width: 0.06 })
    const head = new THREE.Group() // disc + content, scaled from its centre
    g.add(stem, head, ring)
    const pin = { id, g, stem, ring, head, labels: new THREE.Group(), labMats: [flatMaterial('#0b0b0c'), flatMaterial('#0b0b0c'), flatMaterial('#0b0b0c')] }
    g.add(pin.labels)
    if (PIN_MEDIA[id]) {
      pin.media = PIN_MEDIA[id]
      pin.videoMat = tileMaterial(videos.tex(pin.media))
      pin.videoMat.uniforms.uCircle.value = 1
      pin.videoMat.uniforms.uShift.value.set(0, 0.06)
      pin.videoMat.uniforms.uZoom.value = 1.25
      pin.video = new THREE.Mesh(planeGeo, pin.videoMat)
      head.add(pin.video)
    } else {
      pin.discMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0c })
      pin.disc = new THREE.Mesh(circleGeo, pin.discMat)
      head.add(pin.disc)
      // the 3D logo: "c" + "?" ride invisible nodes; the meshes follow them (and, in the sign-off, leave them)
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
  const pins = ['pin-aria', 'pin-gioia', 'pin-nude', 'pin-uwc', 'pin-natale'].map(makePin)
  const lastPin = pins[pins.length - 1]

  // ---------------------------------------------------------- sign-off: the logotype, in the last pin's frame
  const sign = new THREE.Group()
  lastPin.g.add(sign)
  const WCX = WORDMARK_SIZE.width / 2
  const WCY = WORDMARK_SIZE.height / 2
  const letters = wordmark()
    .slice(1, 8)
    .map((gl) => {
      const mat = flatMaterial('#0b0b0c')
      const mesh = new THREE.Mesh(svgGeometry(gl.shapes, { cx: WCX, cy: WCY, k: 1 }), mat)
      sign.add(mesh)
      const strokes = svgContours(gl.shapes, { cx: WCX, cy: WCY, k: 1, divisions: 14 }).map((pts) => {
        const l = makeLine(pts, { color: 0x0b0b0c, width: 0.02 })
        l.position.z = 0.001
        sign.add(l)
        return l
      })
      return { mesh, mat, strokes }
    })
  const starMat = solidMaterial({ front: '#0b0b0c', side: '#0b0b0c' })
  const starMesh = new THREE.Mesh(svgGeometry(star.shapes, { cx: star.cx, cy: star.cy, k: 1 / star.size, depth: 0.22, bevel: 0.02 }), starMat)
  starMesh.visible = false
  lastPin.g.add(starMesh)

  const ringPts = (Rc, a0, n = 300) => {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * TAU
      pts.push(v3(Rc * Math.sin(a), 0, -Rc + Rc * Math.cos(a)))
    }
    return pts
  }

  return {
    keys: Object.values(PIN_MEDIA),
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('proud')
      const P = sc.p
      const tb = T.shot('proud-title')
      const tp = tb.p
      const so = T.shot('signoff')
      const sp = so.p
      const beats = pins.map((p) => T.shot(p.id))
      const lead = 0.48 // the wipe chases the campaign rows out of the frame
      const visible = t >= tb.start - lead
      root.visible = visible
      if (!visible) return

      const lav = ctx.col('lavender')
      const ink = ctx.col('ink')
      const paper = ctx.col('paper')
      const txt = ctx.col(P.textColor)

      // ---------------- ring + camera
      const Rc = Math.max(6, view.w * 0.6) * P.ring
      const spacing = P.spacing * DEG
      const halfVis = Math.asin(Math.min(0.95, (view.w * 0.5) / Rc))
      const a0 = -(halfVis + 0.22) // the line starts just outside the left edge
      const line = memo(
        'ring',
        Rc.toFixed(3) + '|' + a0.toFixed(3),
        () => {
          const l = makeLine(ringPts(Rc, a0), { color: 0xffffff, width: 0.05 })
          root.add(l)
          return l
        },
        (l) => {
          root.remove(l)
          l.geometry.dispose()
          l.material.dispose()
        },
      )
      const pt = (a, out = new THREE.Vector3()) => out.set(Rc * Math.sin(a), 0, -Rc + Rc * Math.cos(a))
      const frac = (a) => (a - a0) / TAU

      const rP = Math.min(view.w * 0.26, view.h * 0.15) * P.pinSize
      const stemH = rP * 0.42
      const headY = stemH + rP
      let th = 0
      let rise = 0
      beats.forEach((b, k) => {
        const e = seg(t, b.start, b.dur * b.p.travel, b.p.travelEase)
        th += e * spacing
        if (k === 0) rise = e
      })
      const el = rise * P.elev * DEG
      const yT = rise * (headY * 0.6)
      const target = pt(th).add(_p.set(0, yT, 0))
      const cam = ctx.camera
      cam.position.set(target.x + CAM_D * Math.sin(th) * Math.cos(el), target.y + CAM_D * Math.sin(el), target.z + CAM_D * Math.cos(th) * Math.cos(el))
      cam.lookAt(target)
      cam.updateMatrixWorld(true)
      // every pin faces the camera; the logotype sits where the camera looks, in the last pin's frame
      for (const pin of pins) pin.g.quaternion.copy(cam.quaternion)
      sign.position.copy(target).sub(pt(spacing * pins.length, _p2)).applyQuaternion(_q2.copy(cam.quaternion).invert())

      // ---------------- backdrop: black → lavender (wipe from the right) → paper (iris from the logo)
      const wipe = seg(t, tb.start - lead, tp.wipeDur, tp.wipeEase)
      const toPaper = seg(t, so.start + so.dur * sp.bgFrom, sp.bgDur, 'power3.inOut')
      if (t >= so.start && toPaper > 0) Object.assign(ctx.bg, { a: lav, b: paper, mix: toPaper, mode: 'iris', soft: 0.012, rays: 0 })
      else Object.assign(ctx.bg, { a: ink, b: lav, mix: wipe, mode: 'wipe', angle: Math.PI, soft: 0.03, rays: 0 })

      // ---------------- the line
      const cut = seg(t, tb.start + tb.dur * tp.cutFrom - 0.16, tp.cutDur, tp.cutEase)
      const headA0 = lerp(a0, halfVis + 0.3, cut)
      const full = TAU + a0
      const lastA = spacing * pins.length
      const headA = Math.min(full, headA0 + th + (th / lastA) * (full - lastA - halfVis - 0.3))
      const und = t >= so.start ? seg(t, so.start, Math.min(sp.undrawDur, so.dur * 0.6), sp.undrawEase) : 0
      const f5 = frac(lastA)
      const lw = 0.05 * P.lineWeight * view.lw
      const lc = ctx.col(P.lineColor)
      lineWindow(line, und * f5, lerp(frac(headA), f5, und))
      lineStyle(line, { color: lc, width: lw })

      // ---------------- title: letters come out of the line as it passes them
      const titleOn = th < 1.15
      titleG.visible = titleOn
      if (titleOn) {
        const capT = Math.min((view.w * 0.84) / Math.max(widthInCaps(String(tp.line1), 800), widthInCaps(String(tp.line2), 800)), view.h * 0.2) * tp.size
        const gapT = capT * 0.2 + lw
        const up = memo(
          'tu',
          String(tp.line1),
          () => {
            const b = buildText(String(tp.line1), { weight: 800, cap: 1, by: 'chars', pivot: 'baseline', material: matUp, tracking: -0.01 })
            titleG.add(b.group)
            return b
          },
          (b) => {
            titleG.remove(b.group)
            b.units.forEach((u) => u.mesh.geometry.dispose())
          },
        )
        const down = memo(
          'td',
          String(tp.line2),
          () => {
            const b = buildText(String(tp.line2), { weight: 800, cap: 1, by: 'chars', pivot: 'baseline', material: matDown, tracking: -0.01 })
            titleG.add(b.group)
            return b
          },
          (b) => {
            titleG.remove(b.group)
            b.units.forEach((u) => u.mesh.geometry.dispose())
          },
        )
        matUp.color.set(ctx.col(tp.titleColor))
        matDown.color.set(ctx.col(tp.titleColor))
        up.group.scale.setScalar(capT)
        down.group.scale.setScalar(capT)
        up.group.position.set(0, gapT + capT / 2, 0)
        down.group.position.set(0, -gapT - capT / 2, 0)
        const headX = Rc * Math.sin(Math.min(headA0, Math.PI / 2))
        const rev = ease('expo.out')
        up.units.forEach((u) => {
          const e = rev(clamp((headX - (u.x * capT - 0.5)) / 1.6))
          u.mesh.position.y = u.y - (1 - e) * 1.32
        })
        down.units.forEach((u) => {
          const e = rev(clamp((headX - (u.x * capT - 0.2)) / 1.6))
          u.mesh.position.y = u.y + (1 - e) * 1.32
        })
        clipUp.constant = -lw * 0.5
        clipDown.constant = -lw * 0.5
      }

      // ---------------- pins
      const fly = t >= so.start ? { c: seg(t, so.start + 0.1, Math.min(0.95, so.dur * 0.45), 'expo.inOut'), q: seg(t, so.start + 0.22, Math.min(1.05, so.dur * 0.5), 'expo.inOut') } : { c: 0, q: 0 }
      const gone = t >= so.start ? seg(t, so.start, 0.35, 'power2.in') : 0
      const W = Math.min(view.w * 0.76, view.h * 1.1) * sp.wordSize
      const ws = W / WORDMARK_SIZE.width
      pins.forEach((pin, k) => {
        const b = beats[k]
        const p = b.p
        const isLast = pin === lastPin
        const a = spacing * (k + 1)
        pt(a, pin.g.position)
        const arrive = b.start + b.dur * p.travel * 0.5
        const pop = ease(p.popEase)(clamp((t - arrive) / 0.55))
        const draw = seg(t, arrive - 0.1, 0.6, 'power3.inOut')
        const on = t >= arrive - 0.12
        pin.g.visible = on
        if (!on) return
        const leave = isLast ? 0 : gone
        const shrink = isLast ? seg(t, so.start + 0.12, 0.5, 'power3.inOut') : gone

        lineWindow(pin.stem, isLast ? und : 0, draw * (1 - leave))
        pin.stem.scale.set(1, stemH, 1)
        lineStyle(pin.stem, { color: lc, width: lw })
        const headS = Math.max(1e-4, rP * pop * (1 - shrink))
        pin.ring.position.set(0, headY, 0.012)
        pin.ring.scale.setScalar(headS)
        lineWindow(pin.ring, 0, draw * (1 - (isLast ? und : leave)))
        lineStyle(pin.ring, { color: lc, width: lw * 1.25 })
        pin.head.position.set(0, headY, 0)
        pin.head.scale.setScalar(headS)

        if (pin.video) {
          pin.video.scale.set(2, 2, 1)
          pin.videoMat.uniforms.uSize.value.set(2, 2)
          pin.videoMat.uniforms.map.value = videos.want(pin.media, Math.max(0, t - arrive + 0.4))
        } else {
          pin.discMat.color.set(ctx.col(p.discColor))
          // logo pose (pin frame): turns in, then sways
          const spin = (1 - seg(t, arrive, 1.0, 'expo.out')) * p.spin * TAU
          const sway = Math.sin(t * 1.3 + k) * 0.22
          pin.logoNode.position.set(0, headY, rP * 0.3)
          pin.logoNode.rotation.set(Math.sin(t * 0.9 + k) * 0.06, spin + sway, 0)
          pin.logoNode.scale.setScalar(Math.max(1e-4, rP * 0.98 * pop * (1 - leave)))
          pin.logoNode.updateMatrix()
          pin.cNode.updateMatrix()
          pin.qNode.updateMatrix()
          const cGeo = memo('c' + k, String(p.logoDepth), () => svgGeometry(cShapes, { cx: C_BOX.cx, cy: C_BOX.cy, k: 1 / C_BOX.h, depth: p.logoDepth, bevel: 0.022 }), (g) => g.dispose())
          const qGeo = memo(
            'q' + k,
            String(p.logoDepth),
            () => {
              const blk = buildText('?', { weight: 800, cap: 1, by: 'all', depth: p.logoDepth / LOGO.qCap, pivot: 'center', material: pin.logoMat, segs: 12 })
              const geo = blk.units[0].mesh.geometry
              geo.scale(blk.em, blk.em, blk.em)
              return geo
            },
            (g) => g.dispose(),
          )
          pin.c.geometry = cGeo
          pin.q.geometry = qGeo

          const kInk = isLast ? seg(t, so.start + so.dur * sp.bgFrom, sp.bgDur * 0.7, 'power2.inOut') : 0
          const front = ctx.col(p.logoColor)
          const sideHex = p.logoColor === 'lime' ? ctx.col('violet') : mixHex(front, '#5a4fd0', 0.55)
          const word = ctx.col(sp.wordColor)
          pin.logoMat.userData.setColors(mixHex(front, word, kInk), mixHex(sideHex, word, kInk), mixHex(mixHex(sideHex, '#000000', 0.6), word, kInk))

          // "c": on the logo, or flying to its place in the logotype
          const place = (mesh, node, f, tx, ty, ts, turns) => {
            _m.multiplyMatrices(pin.logoNode.matrix, node.matrix).decompose(_p, _q, _s)
            if (f > 0) {
              _p2.set(sign.position.x + tx, sign.position.y + ty, sign.position.z)
              _p.lerp(_p2, f)
              _q.slerp(_q2.setFromEuler(_e.set(0, turns * TAU * (1 - f), 0)), f)
              _s.set(lerp(_s.x, ts, f), lerp(_s.y, ts, f), lerp(_s.z, ts * 0.04, f))
            }
            mesh.position.copy(_p)
            mesh.quaternion.copy(_q)
            mesh.scale.copy(_s)
          }
          const fc = isLast ? fly.c : 0
          const fq = isLast ? fly.q : 0
          place(pin.c, pin.cNode, fc, (C_BOX.cx - WCX) * ws, -(C_BOX.cy - WCY) * ws, C_BOX.h * ws, 1)
          const sx = (WORDMARK_STAR.x - WCX) * ws
          const sy = -(WORDMARK_STAR.y - WCY) * ws
          place(pin.q, pin.qNode, fq, sx, sy, WORDMARK_STAR.size * ws * 0.9, sp.starSpin)
          // halfway through its flight the "?" has turned into the "*"
          if (isLast) {
            const swap = fq > 0.5
            pin.q.visible = !swap
            starMesh.visible = swap
            if (swap) {
              starMesh.position.copy(pin.q.position)
              starMesh.quaternion.copy(pin.q.quaternion)
              const ss = WORDMARK_STAR.size * ws
              const grow = lerp(pin.q.scale.x / (WORDMARK_STAR.size * ws * 0.9), 1, fq)
              starMesh.scale.set(ss * grow, ss * grow, ss * lerp(0.6, 0.05, fq))
              starMat.userData.setColors(mixHex(front, ctx.col(sp.starColor), Math.max(kInk, fq)), mixHex(sideHex, ctx.col(sp.starColor), Math.max(kInk, fq)))
            }
          }
        }

        // labels: name, contents, date under the line
        const lab = memo(
          'lab' + k,
          `${p.name}|${p.count}|${p.date}|${rP.toFixed(3)}`,
          () => {
            const g = new THREE.Group()
            const rows = []
            const maxW = Math.min(view.w * 0.84, rP * 4.4)
            const add = (str, weight, cap, m, oneLine) => {
              if (!String(str || '').trim()) return
              const blk = buildText(String(str), { weight, cap, by: 'all', pivot: 'baseline', maxWidth: oneLine ? Infinity : maxW, leading: 1.55, material: m })
              const k = oneLine ? Math.min(1, maxW / blk.width) : 1 // a name never wraps: it shrinks to fit
              blk.group.scale.setScalar(k)
              g.add(blk.group)
              rows.push({ blk, m, h: blk.height * k })
            }
            add(p.name, 800, rP * 0.3, pin.labMats[0], true)
            add(p.count, 800, rP * 0.17, pin.labMats[1], true)
            add(p.date, 400, rP * 0.165, pin.labMats[2], false)
            let y = -rP * 0.34
            for (const r of rows) {
              r.y = y - r.h / 2
              y -= r.h + rP * 0.2
            }
            pin.labels.add(g)
            return { g, rows }
          },
          (o) => {
            pin.labels.remove(o.g)
            o.rows.forEach((r) => r.blk.units.forEach((u) => u.mesh.geometry.dispose()))
          },
        )
        lab.rows.forEach((r, i) => {
          const e = seg(t, arrive + 0.12 + i * 0.07, 0.5, 'expo.out')
          const away = clamp((Math.abs(a - th) - 0.5) / 0.5) // the pins behind keep their circle, not their words
          const o = Math.max(away, isLast ? seg(t, so.start, 0.3, 'power2.in') : leave)
          r.blk.group.position.set(0, r.y - (1 - e) * rP * 0.3 - o * rP * 0.3, 0)
          r.m.color.set(txt)
          r.m.opacity = e * (1 - o)
        })
      })

      // ---------------- sign-off: the rest of the logotype is written
      const signOn = t >= so.start
      sign.visible = signOn
      if (signOn) {
        sign.scale.setScalar(ws)
        const word = ctx.col(sp.wordColor)
        const t0 = so.start + so.dur * sp.writeFrom
        letters.forEach((L, j) => {
          const tj = t0 + j * sp.writeStagger
          const d = seg(t, tj, sp.writeDur, 'power2.inOut')
          const fill = seg(t, tj + sp.writeDur * 0.5, sp.writeDur * 0.55, 'power2.out')
          L.mat.color.set(word)
          L.mat.opacity = fill
          L.mesh.visible = fill > 0.002
          for (const s of L.strokes) {
            lineWindow(s, 0, fill >= 1 ? 0 : d)
            lineStyle(s, { color: word, width: ws * 0.9 * (1 - fill * 0.6) })
          }
        })
      }
      if (signOn && ctx.bg.mode === 'iris') {
        _p.copy(target).project(cam)
        ctx.bg.center = [_p.x * 0.5 + 0.5, _p.y * 0.5 + 0.5]
      }
    },
  }
}
