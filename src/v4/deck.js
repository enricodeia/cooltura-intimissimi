// Value 03 · social perception, girls power: Venice, the Nude Look, the girls of
// the Intimissimi Girls Club. One card at a time, swiped like a feed: a card that
// speaks has its own voice (his cut of 2026-11-24: Sara first, silent, her clip has no
// whole sentence of her own; then Chiara, "È stata una serata stupenda per celebrare le
// donne", as her card lands); on the end of a sentence the next card pushes the one in
// front out to the left, the ones without a voice on the beat (no card ever lies over
// another: the next waits just outside the frame). The swipes follow the voices
// (deckPlan, shared with the sound): change a video or its sentence and the cut follows. At the end the last card closes like a curtain towards its
// centre and the paper is clean for "The best part?". The campaign's name under it.
// The videos: exactly their pixels (two have a caption burnt in at the top: cropped).

import * as THREE from 'three'
import { tileMaterial } from '../lib/materials.js'
import { Kinetic } from '../lib/kinetic.js'
import { caseOf } from '../actors/shared.js'
import { keysOf, applyCrop, ph, softClipTime } from './common.js'
import { clamp, ease, lerp } from '../core/util.js'

/**
 * When the cards move and speak (absolute seconds), for the picture and for the sound: card 0 speaks where its
 * voice says; with "follow" every swipe comes on the end of the voice of the card in front (+ swipeGap) and
 * card 1 speaks as it arrives (+ voiceBLead); a card without a voice keeps the fixed rhythm.
 * → { keys, nSw, tSw: [swipe k start], voices: [card i → { key, at, from, to, from2, to2, gain, end } | null] }
 */
export function deckPlan(sh, videos) {
  const p = sh.p
  const keys = keysOf(videos, p.videos)
  const nSw = Math.max(0, Math.min(keys.length - 1, Math.round(p.swipes)))
  const voices = []
  const span = (v) => Math.max(0, v.to - v.from) + (v.to2 > v.from2 + 0.05 ? v.to2 - v.from2 : 0)
  if (p.voiceOn && keys[0]) {
    const v = { key: keys[0], at: sh.start + (p.voiceAt ?? 0), from: p.voiceFrom ?? 0, to: p.voiceTo ?? 0, from2: p.voice2From ?? 0, to2: p.voice2To ?? 0, gain: p.voiceGain ?? 0 }
    v.end = v.at + span(v)
    voices[0] = v
  } else voices[0] = null
  const tSw = []
  for (let k = 1; k <= nSw; k++) {
    const prev = voices[k - 1]
    let t = p.follow !== false && prev ? prev.end + (p.swipeGap ?? 0.1) : k === 1 ? sh.start + p.swipeAt : tSw[k - 2] + p.swipeEvery
    // a silent first card gives way early enough for the second one's whole sentence before the curtain
    // (a shorter block: Chiara still says all of it, in front, lips on the sound)
    if (k === 1 && !prev && p.voiceBOn && keys[1] && p.follow !== false) {
      const sB = Math.max(0, (p.voiceBTo ?? 0) - (p.voiceBFrom ?? 0)) + ((p.voiceB2To ?? 0) > (p.voiceB2From ?? 0) + 0.05 ? p.voiceB2To - p.voiceB2From : 0)
      const latest = sh.end - (p.closeLead ?? 0.55) - (p.voiceBLead ?? 0.3) - sB - 0.12
      t = Math.max(sh.start + (p.popAt ?? 0) + 0.9, Math.min(t, latest))
    }
    tSw.push(t)
    voices[k] = null
    if (k === 1 && p.voiceBOn && keys[1]) {
      const at = p.follow !== false ? t + (p.voiceBLead ?? 0.3) : sh.start + (p.voiceBAt ?? 0)
      const v = { key: keys[1], at, from: p.voiceBFrom ?? 0, to: p.voiceBTo ?? 0, from2: p.voiceB2From ?? 0, to2: p.voiceB2To ?? 0, gain: p.voiceBGain ?? 0 }
      v.end = at + span(v)
      voices[1] = v
    }
  }
  return { keys, nSw, tSw, voices }
}

export function createDeck(engine) {
  const videos = engine.videos
  const root = new THREE.Group()
  engine.hud.add(root)
  const geo = new THREE.PlaneGeometry(1, 1)
  const cards = []
  const cardAt = (i) => {
    if (!cards[i]) {
      const mat = tileMaterial(videos.placeholder)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      root.add(mesh)
      cards[i] = { mesh, mat }
    }
    return cards[i]
  }
  const label = new Kinetic(engine.hud)

  return {
    keysFor(T) {
      return T.shots.filter((s) => s.type === 'deck').flatMap((s) => keysOf(videos, s.p.videos))
    },
    update(ctx) {
      const { t, T, view } = ctx
      for (const c of cards) if (c) c.mesh.visible = false
      label.group.visible = false
      const sh = T.shots.find((s) => s.type === 'deck' && t >= s.start - 0.05 && t < s.end + 0.05)
      if (!sh) return
      const p = sh.p
      const { keys, nSw, tSw: swipes, voices } = deckPlan(sh, videos)
      if (!keys.length) return
      const short = Math.min(view.w, view.h)
      const margin = short * 0.075
      const portrait = view.aspect < 0.9
      const capL = (p.labelSize / 100) * short * (portrait ? 1.3 : 1)
      const room = p.labelOn ? capL * 3.4 : 0
      let H = p.cardH * view.h
      let W = (H * 9) / 16
      if (W > view.w * 0.8) {
        W = view.w * 0.8
        H = (W * 16) / 9
      }
      const yC = room / 2
      const r = p.corner * W
      // the next card waits just outside the frame on the right: the push never overlaps, never covers the name
      const pitch = view.w / 2 + W / 2 + W * (p.gap ?? 0.08)
      // the feed: k = which card is in the centre (continuous); each scroll on its time
      const tSw = (j) => swipes[j]
      const swE = ease(p.swipeEase)
      let k = 0
      for (let j = 0; j < nSw; j++) k += swE(clamp((t - tSw(j)) / p.swipeDur))
      // it arrives: rises a little and its mask opens from the centre
      const inK = ease(p.popEase)(clamp((t - (sh.start + p.popAt)) / p.popDur))
      // it closes: the last card's mask closes towards its centre (a curtain), nothing left on the paper
      const tClose = sh.end - p.closeLead
      const closeK = ease('cubic(0.6,0,0.25,1)')(clamp((t - tClose) / p.closeDur))
      for (let i = 0; i <= nSw; i++) {
        const x = (i - k) * pitch
        const y = yC + (1 - inK) * -H * 0.05
        if (x - W / 2 > view.w / 2 || x + W / 2 < -view.w / 2) continue
        // the open part of the card (a mask: the picture keeps its size)
        let open = i === 0 ? lerp(0.86, 1, inK) : 1
        if (i === nSw) open *= 1 - closeK
        const vis = i === 0 ? clamp(inK * 3) : 1
        if (open <= 0.004 || vis <= 0.002) continue
        const c = cardAt(i)
        const h = H * open
        c.mesh.visible = true
        c.mesh.position.set(x, y, 0)
        c.mesh.scale.set(W, h, 1)
        const u = c.mat.uniforms
        const v = voices[i]
        const voiced = !!v
        const front = i === 0 ? sh.start + p.popAt : tSw(i - 1)
        // how long it is on screen: from its swipe in to the next swipe out (or to the curtain)
        const back = i < nSw ? tSw(i) + p.swipeDur : sh.end
        // a card that speaks: lips on the sound (the picture runs on the voice's line, before and after it)
        // (a sentence with a pause cut out: the picture jumps where the sound does)
        const cut = v && v.to2 > v.from2 + 0.05 ? v.at + (v.to - v.from) : Infinity
        const m = v ? (t >= cut ? v.from2 + (t - cut) : v.from + (t - v.at)) : videos.cleanStart(keys[i], back - front, 0.3) + (t - front)
        // never past its last frame (it glides into it), never looping back to its start
        const dur = videos.manifest[keys[i]] || 6
        u.map.value = videos.want(keys[i], softClipTime(m, dur), voiced)
        u.uSize.value.set(W, h)
        u.uRadius.value = Math.min(r, h / 2)
        u.uOpacity.value = vis
        u.uDim.value = 0
        u.uBlur.value = 0
        // the mask: the card's width sets the picture's size (cover), so a shorter card shows a
        // narrower band of the same picture, centred: the curtain closes, the picture does not move
        applyCrop(u, keys[i])
        c.mat.transparent = vis < 0.999
      }

      // the campaign's name under the card
      if (p.labelOn && String(p.label || '').trim()) {
        const info = label.set({ text: caseOf(p.label, p.caps), weight: p.labelWeight, align: 'center', tracking: p.labelTracking })
        const kk = Math.min(1, (view.w - 2 * margin) / Math.max(1e-3, info.width * capL))
        const cL = capL * kk
        const cardBottom = yC - H / 2
        const yL = Math.min((cardBottom - view.h / 2) / 2, cardBottom - cL * 1.8)
        label.group.position.set(0, yL, 0)
        label.group.scale.setScalar(cL)
        label.pose(t, {
          in: ph(sh.start + p.labelAt, 0.6, { stagger: 0.02, y: 100, blur: 24, mask: true }),
          out: ph(Math.min(sh.end - p.labelOut, tClose), 0.4, { stagger: 0.01, ease: 'ci.exit', y: -100, blur: 24, mask: true }),
          from: ctx.col('rose'),
          to: ctx.col(p.labelColor),
          motion: 0.6,
          fps: ctx.fps,
          px: cL * ctx.pxPerUnit,
        })
      }
    },
    late() {
      label.late()
    },
  }
}
