// The opening. Nicole Pieretto's video scales up on white; the camera pulls back
// for the first number and the videos join it step by step, one beat per number:
//   2    one video behind the number
//   3    two more slide out from behind it, left and right
//   175  the whole row unfolds and starts to turn
//   394  every other row grows out of the sphere, rows turning in alternate directions
// Then, in order: the other rows sink back into the sphere, the row stops on a
// slot, and its cards slide one by one onto the centre card, alternating left
// and right, each one exactly on top of the last: a neat deck. The deck grows
// into the phone's screen; its top card (not the opening video) plays on in the
// phone.
//
// The videos are never treated: no dimming, no blur, no tint, exactly their pixels.
// The tiles are one sphere of fixed size; the camera does the zooming.

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { openingLayout, openCard, phoneLayout, PHONE } from './shared.js'
import { CAM_D } from '../engine/engine.js'
import { seg, lerp, clamp, ease, mod, wrapSym, TAU } from '../core/util.js'

export const HERO = 'hero.mp4'
/** Media time of the hero video: it runs unbroken through the opening. */
export const heroTime = (t, T) => Math.max(0, t - T.shot('open').start)

/** The card on top of the deck, which the phone then plays: one long take (tools/media.sh, LONG). */
export const DECK_TOP = 'marta-carruozzo'
export const deckTime = (t) => t + 0.6 // her best take is on top as the deck lands

const H = 1 // tile height in world units
const W = (H * 9) / 16

let _h = 0
const strHash = (s) => {
  _h = 2166136261
  for (let i = 0; i < s.length; i++) _h = Math.imul(_h ^ s.charCodeAt(i), 16777619)
  return (_h >>> 0) / 4294967296
}
/** Media time of a grid video at film time t (each one starts at its own point, so the copies differ). */
export function tileTime(key, t) {
  if (key === HERO) return t
  if (key.includes(DECK_TOP)) return deckTime(t)
  return t + 0.3 + strHash(key) * 4.4
}

/** ∫ of a smoothstep ramp that starts at a and lasts L (0 before; then grows at slope 1). */
function rampInt(t, a, L) {
  if (t <= a) return 0
  const x = (t - a) / L
  if (x >= 1) return L / 2 + (t - a - L)
  return L * (x * x * x - (x * x * x * x) / 2)
}

const smooth01 = (a, b, x) => {
  const u = clamp((x - a) / (b - a))
  return u * u * (3 - 2 * u)
}

export function createWall(engine) {
  const videos = engine.videos
  // the opening video has its own full-resolution file; the others come from the grid proxies
  const all = videos.keys('grid/').filter((k) => !k.includes('nicole-pieretto')).sort()
  const deckKey = all.find((k) => k.includes(DECK_TOP)) || all[0]

  const group = new THREE.Group()
  group.visible = false
  engine.scene.add(group)
  const geo = new THREE.PlaneGeometry(1, 1)

  // ---------------------------------------------------------------- the sphere (rebuilt when its shape changes)
  let built = ''
  let tiles = []
  let row0 = []
  let R = 3
  function build(P) {
    const rows = Math.max(3, Math.min(9, Math.round(P.rows) | 1))
    const g = P.gap * H
    const mid = (rows - 1) / 2
    R = ((Math.max(1, mid) * (H + g)) / 1.12) * P.radius
    const key = `${rows}|${R.toFixed(4)}|${g.toFixed(4)}`
    if (key === built) return
    built = key
    deckKeyAt = ''
    for (const t of tiles) {
      group.remove(t.mesh)
      t.mat.dispose()
    }
    tiles = []
    for (let r = -mid; r <= mid; r++) {
      const lat = (r * (H + g)) / R
      const n = Math.max(8, Math.round((TAU * R * Math.cos(lat)) / (W + g)))
      const dLon = TAU / n
      const half = Math.floor(n / 2)
      for (let j = 0; j < n; j++) {
        const i = j - half // …, -1, 0, 1, …
        const isHero = r === 0 && i === 0
        const key = isHero ? HERO : all[mod(i * 7 + r * 11 + 3, all.length)]
        const mat = tileMaterial(videos.tex(key))
        const mesh = new THREE.Mesh(geo, mat)
        mesh.visible = false
        group.add(mesh)
        const tile = { mesh, mat, r, i, n, lat, dLon, key, isHero, side: Math.sign(i), k: Math.abs(i), mid }
        tile.base = i * dLon + (Math.abs(r) % 2) * 0.5 * dLon // brick offset on odd rows
        tiles.push(tile)
      }
    }
    row0 = tiles.filter((t) => t.r === 0)
  }
  let deckKeyAt = ''
  function setKey(tile, key) {
    if (tile.key === key) return
    tile.key = key
    tile.mat.uniforms.map.value = videos.tex(key)
  }

  const pos = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const toCam = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const euler = new THREE.Euler()

  return {
    get keys() {
      return [HERO, ...all]
    },
    update(ctx) {
      const { t, T, view } = ctx
      const sc = T.scene('wall')
      const P = sc.p
      const open = T.shot('open')
      const stack = T.shot('stack')
      const stats = sc.shots.filter((s) => s.type === 'stat')
      const visible = t >= open.start && t < stack.end
      group.visible = visible
      if (!visible) return
      build(P)
      ctx.bg.a = ctx.bg.b = ctx.col('white')
      ctx.bg.mix = 0

      const op = open.p
      const sp = stack.p
      const [s2, s3, s175, s394] = stats
      const Lo = openingLayout(view, P, stats)
      const ss = stack.start
      const SD = stack.dur

      // ---------------- camera targets, one per beat
      const card1 = openCard(view, op.margin)
      const cam = (d, cy) => ({ ld: Math.log(d), cy })
      const anchored = (hs, bottomY) => {
        const d = (H * CAM_D) / hs
        return cam(d, -H / 2 - (bottomY * d) / CAM_D)
      }
      const hs2 = Math.min((Lo.yT - Lo.yB) * 0.98, view.w * 0.64 * (16 / 9))
      const hs3 = hs2 * 0.74
      const hs4 = hs3 * 0.8
      const C1 = cam((H * CAM_D) / card1.h, 0)
      const C2 = anchored(hs2, Lo.yB)
      const C3 = anchored(hs3, Lo.yB)
      const C4 = anchored(hs4, Lo.yB)
      const yB5 = Lo.yN + Lo.capN * (1 - P.overlap * 0.35)
      const rs5 = Math.min((Lo.yT - yB5) / 2, view.w * 0.46)
      const Dc = Math.sqrt(((R * CAM_D) / rs5) ** 2 + R * R)
      const C5 = cam(Dc - R, -((yB5 + rs5) * Dc) / CAM_D)
      const C6 = cam(CAM_D, 0) // the default camera: the phone's world
      let ld = C1.ld
      let cy = C1.cy
      const step = (C, t0, d, e) => {
        const k = seg(t, t0, d, e)
        ld = lerp(ld, C.ld, k)
        cy = lerp(cy, C.cy, k)
      }
      const beat = (sh, C) => sh && step(C, sh.start - sh.p.cameraDur * 0.18, sh.p.cameraDur, sh.p.cameraEase)
      beat(s2, C2)
      beat(s3, C3)
      beat(s175, C4)
      beat(s394, C5)
      // closer to the row while the other rows sink (the cards gather big enough to read), then back as the deck grows
      const Cb = cam((H * CAM_D) / Math.min(view.h * 0.27, view.w * 0.5 * (16 / 9)), 0)
      step(Cb, ss, SD * 0.5, 'power2.inOut')
      step(C6, ss + SD * 0.64, SD * 0.36, sp.growEase)
      ctx.camera.position.set(0, cy, Math.exp(ld))
      const camPos = ctx.camera.position

      // ---------------- the rows turn: still until the row has unfolded, ramp up, then brake onto a slot
      const v = s175 ? P.speed : 0
      const a0 = s175 ? s175.start + 0.25 : 0
      const brake = Math.max(0.2, SD * 0.42)
      const travel = (tt) => (v > 0 ? v * (rampInt(tt, a0, 1.1) - rampInt(tt, ss, brake)) : 0)
      const n0 = row0.length
      const dLon0 = TAU / n0
      const thetaF = v > 0 ? (v * (ss - a0 - 0.55 + brake / 2)) / R : 0 // where row 0 would stop
      const slotF = Math.ceil(thetaF / dLon0 - 1e-6) // the next slot ahead: it never turns back
      const align = (slotF * dLon0 - thetaF) * seg(t, ss, brake * 1.05, 'power2.inOut')
      const slotOf = (tile) => Math.round(wrapSym(tile.i + slotF, n0)) // row-0 slot once stopped (0 = centre)
      const K = Math.max(2, Math.min(Math.floor(n0 / 2) - 1, sp.cards))

      // the top of the deck is DECK_TOP (it plays on in the phone); swap it into that slot
      const dk = `${built}|${slotF}|${K}`
      if (dk !== deckKeyAt) {
        deckKeyAt = dk
        const topTile = row0.find((tl) => slotOf(tl) === -K)
        const holder = tiles.find((tl) => tl.key === deckKey && tl !== topTile)
        if (topTile && !topTile.isHero) {
          const was = topTile.key
          setKey(topTile, deckKey)
          if (holder) setKey(holder, was)
        }
      }

      // ---------------- schedules
      const three = (tt) => (s3 ? seg(tt, s3.start - 0.06, s3.p.videoDur, s3.p.videoEase) : 1)
      const unfold = (tt, m) => (s175 ? seg(tt, s175.start - 0.06 + ((m - 2) * s175.p.videoDur * s175.p.videoStagger) / 6, s175.p.videoDur, s175.p.videoEase) : 1)
      const grow = (tile) => {
        if (!s394) return 1
        const dist = Math.hypot(tile.base * R * Math.cos(tile.lat), tile.lat * R) / (R * 1.6)
        const span = s394.p.videoDur * s394.p.videoStagger * 1.6
        return seg(t, s394.start - 0.04 + clamp(dist) * span, s394.p.videoDur * 0.8, 'power3.out')
      }
      // the other rows sink back, outermost first (the reverse of how they came)
      const retract = (tile) => {
        const order = tile.r === 0 ? 1 : (tile.mid - Math.abs(tile.r)) / Math.max(1, tile.mid)
        return seg(t, ss + order * SD * 0.14, SD * sp.retract, 'power3.in')
      }
      // the deck: grows into the phone's screen and moves to its place
      const L = phoneLayout(view, T.scene('phone').p)
      const cs = L.center.s
      const scr = { w: PHONE.sw * cs, h: PHONE.sh * cs, r: PHONE.sr * cs, z: (PHONE.t / 2 + 0.0012) * cs, x: L.center.x, y: L.center.y }
      const g = seg(t, ss + SD * 0.64, SD * 0.36, sp.growEase) // the deck grows once it is complete
      const deckW = lerp(W, scr.w, g)
      const deckH = lerp(H, scr.h, g)
      const deckX = lerp(0, scr.x, g)
      const deckY = lerp(0, scr.y, g)
      const deckZ = lerp(0, scr.z - 0.0045 * 2 * K, g) // the top card ends exactly on the screen plane
      const slideE = ease(sp.slideEase)
      const slideDur = SD * sp.slide
      const landAt = (idx) => ss + SD * 0.22 + (2 * K > 1 ? idx / (2 * K - 1) : 0) * Math.max(0, SD * 0.66 - slideDur - SD * 0.22)

      const tileR = P.corner * W
      const used = new Set()

      for (const tile of tiles) {
        const m = tile.mesh
        // ---- where it is on the sphere, and how big
        let lon = tile.base
        let scale = 1
        let sink = 0
        let zoom = 1
        let rad = tileR
        if (tile.isHero) {
          scale = lerp(op.from, 1, seg(t, open.start, Math.min(op.scaleDur, open.dur + (s2?.dur || 0)), op.scaleEase))
          zoom = Math.pow(Math.max(scale, 0.05), -op.parallax) // the picture grows a little less than its frame
          const zoomOut = s2 ? seg(t, s2.start - s2.p.cameraDur * 0.18, s2.p.cameraDur, s2.p.cameraEase) : 1
          rad = lerp(op.radius * W, tileR, zoomOut)
        } else if (tile.r === 0) {
          // cumulative: card k never passes card k-1, so each slides out from behind its
          // neighbour; until it moves it is not drawn, and while it moves it rides deeper
          // than the card in front of it (no two cards ever share a plane)
          const e1 = three(t)
          let last = e1
          let acc = e1
          for (let q = 2; q <= tile.k; q++) {
            last = unfold(t, q)
            acc += last
          }
          if (e1 <= 0 || last <= 0) {
            m.visible = false
            continue
          }
          lon = tile.side * tile.dLon * acc
          sink = (0.12 + 0.01 * tile.k) * (1 - last)
        } else {
          scale = grow(tile)
          sink = 0.35 * (1 - scale)
        }
        const dir = tile.r % 2 === 0 || !P.alternate ? 1 : -1
        lon += (dir * travel(t)) / (R * Math.cos(tile.lat))
        if (tile.r === 0) lon += align

        // ---- the pile
        let inDeck = 0 // 0 on the sphere … 1 in the deck
        let lift = 0
        if (t >= ss) {
          const s = tile.r === 0 ? slotOf(tile) : null
          if (s === 0) {
            inDeck = 1 // the centre card is the bottom of the deck
          } else if (s !== null && Math.abs(s) <= K) {
            const idx = 2 * (Math.abs(s) - 1) + (s > 0 ? 0 : 1)
            inDeck = slideE(clamp((t - landAt(idx)) / slideDur))
            // slide along the row towards the centre, a little in front of everything (it never cuts through
            // the cards already there), landing just above the last one
            lift = 0.0045 * (idx + 1) + 0.16 * Math.sin(Math.PI * inDeck)
            lon = lerp(lon, 0, inDeck)
          } else {
            const rt = retract(tile)
            scale *= 1 - rt
            sink += 0.35 * rt
          }
        }
        if (scale <= 0.002) {
          m.visible = false
          continue
        }

        const rr = R - sink + lift
        const cl = Math.cos(tile.lat)
        pos.set(rr * Math.sin(lon) * cl, rr * Math.sin(tile.lat), rr * Math.cos(lon) * cl - R)
        // a card on its way into the deck turns to face us early, so it lies flat on the cards under it
        quat.setFromEuler(euler.set(-tile.lat, inDeck > 0 && inDeck < 1 ? lon * (1 - Math.min(1, inDeck * 2.2)) : lon, 0, 'YXZ'))
        // hide what faces away (tiles at the rim are edge-on, so nothing pops)
        nrm.set(Math.sin(lon) * cl, Math.sin(tile.lat), Math.cos(lon) * cl)
        toCam.copy(camPos).sub(pos).normalize()
        const f = tile.isHero && t < (s175 ? s175.start : Infinity) ? 1 : smooth01(-0.02, 0.06, nrm.dot(toCam))
        let w = W * scale * f
        let h = H * scale * f
        rad *= scale
        if (inDeck > 0) {
          // into the deck, which itself grows into the screen
          pos.x += deckX * inDeck
          pos.y += deckY * inDeck
          pos.z += deckZ * inDeck
          w = lerp(w, deckW, inDeck)
          h = lerp(h, deckH, inDeck)
          rad = lerp(rad, lerp(tileR, scr.r, g), inDeck)
        }
        m.visible = w > 1e-4 && h > 1e-4
        if (!m.visible) continue
        const u = tile.mat.uniforms
        m.position.copy(pos)
        m.quaternion.copy(quat)
        m.scale.set(w, h, 1)
        u.uSize.value.set(w, h)
        u.uRadius.value = rad
        u.uZoom.value = zoom
        u.uDim.value = 0
        u.uBlur.value = 0
        used.add(tile.key)
      }

      for (const key of used) videos.want(key, key === HERO ? heroTime(t, T) : tileTime(key, t))
    },
  }
}
