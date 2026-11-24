// The creator videos as textures.
//
// Scenes ask for a video at a media time every frame they show it (want()).
//  · playing: wanted videos run free at the film's rate and are only re-seeked
//    when they drift; the others pause, so only what is on screen decodes.
//  · paused / scrubbing: wanted videos are seeked to their frame.
//  · export: every wanted video is seeked to its exact frame and awaited before
//    the render (frame-exact, the proxies have a key frame every 6-15 frames).

import * as THREE from 'three'
import { mod } from '../core/util.js'

const onceOr = (el, ev, ms) =>
  new Promise((res) => {
    const done = () => {
      clearTimeout(timer)
      el.removeEventListener(ev, done)
      res()
    }
    const timer = setTimeout(done, ms)
    el.addEventListener(ev, done)
  })

export class Videos {
  constructor({ base = import.meta.env.BASE_URL, onFrame = () => {} } = {}) {
    this.base = base + 'media/'
    this.items = new Map()
    this.manifest = {}
    this.cuts = {} // key → the times of the hard cuts inside it (public/media/cuts.json, tools/cuts.mjs)
    this.onFrame = onFrame
    this.placeholder = new THREE.DataTexture(new Uint8Array([20, 20, 22, 255]), 1, 1)
    this.placeholder.colorSpace = THREE.SRGBColorSpace
    this.placeholder.needsUpdate = true
  }

  async init() {
    this.manifest = await (await fetch(this.base + 'manifest.json')).json()
    try {
      const r = await fetch(this.base + 'cuts.json')
      if (r.ok) this.cuts = await r.json()
    } catch {}
    return this.manifest
  }
  /**
   * Where to start a clip so that it does not cut during `len` seconds of it (the creators'
   * own edits): the earliest start from `from` on, else `from`.
   */
  cleanStart(key, len, from = 0.35) {
    const cuts = this.cuts[key] || []
    const dur = this.manifest[key] || 8
    for (const m of [from, ...cuts.map((c) => c + 0.08)]) {
      if (m < from || m + len > dur - 0.1) continue
      if (!cuts.some((c) => c > m - 0.04 && c < m + len + 0.04)) return m
    }
    return from
  }
  keys(prefix) {
    return Object.keys(this.manifest).filter((k) => k.startsWith(prefix))
  }

  /** key = path inside public/media, e.g. 'grid/marta-carruozzo.mp4' */
  get(key) {
    let it = this.items.get(key)
    if (it) return it
    const el = document.createElement('video')
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    el.src = this.base + key
    const tex = new THREE.VideoTexture(el)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    it = { key, el, tex, dur: this.manifest[key] || 6, want: null, ready: false, seekTo: null }
    el.addEventListener('loadeddata', () => {
      it.ready = true
      tex.needsUpdate = true
      this.onFrame()
    })
    el.addEventListener('seeked', () => {
      tex.needsUpdate = true
      this.onFrame()
    })
    this.items.set(key, it)
    return it
  }
  tex(key) {
    return this.get(key).tex
  }

  /** Load a set up front. Resolves when all can show a frame (or after a timeout each). */
  preload(keys, onProgress) {
    let done = 0
    return Promise.all(
      keys.map(async (k) => {
        const it = this.get(k)
        if (it.el.readyState < 2) await onceOr(it.el, 'loadeddata', 15000)
        onProgress?.(++done, keys.length)
      }),
    )
  }

  beginFrame() {
    for (const it of this.items.values()) {
      it.want = null
      it.tight = false
    }
  }
  /** Show `key` at media time `time` (seconds, wrapped into the clip). tight: its voice is heard (V4), keep it in sync with the sound. */
  want(key, time, tight = false) {
    const it = this.get(key)
    const d = Math.max(0.1, it.dur - 0.08)
    it.want = mod(time, d)
    if (tight) it.tight = true
    return it.tex
  }

  syncPreview(playing, rate = 1) {
    for (const it of this.items.values()) {
      const el = it.el
      if (it.want === null) {
        if (!el.paused) el.pause()
        continue
      }
      if (!it.ready) continue
      if (playing) {
        if (el.playbackRate !== rate) el.playbackRate = rate
        const d = Math.max(0.1, it.dur - 0.08)
        let drift = el.currentTime - it.want
        if (drift > d / 2) drift -= d
        if (drift < -d / 2) drift += d
        if (el.paused) {
          if (Math.abs(drift) > 0.05) el.currentTime = it.want
          el.play().catch(() => {})
        } else if (Math.abs(drift) > (it.tight ? 0.06 : 0.35) && !el.seeking) {
          el.currentTime = it.want
        }
      } else {
        if (!el.paused) el.pause()
        if (!el.seeking && Math.abs(el.currentTime - it.want) > 0.02) el.currentTime = it.want
      }
    }
  }

  /** Export: every wanted video on its exact frame, awaited. */
  async seekAll() {
    const jobs = []
    for (const it of this.items.values()) {
      const el = it.el
      if (!el.paused) el.pause()
      if (it.want === null) continue
      jobs.push(
        (async () => {
          if (el.readyState < 2) await onceOr(el, 'loadeddata', 15000)
          const at = it.want + 1e-3 // 1 ms into the frame (an exact frame start can land on the one before)
          if (Math.abs(el.currentTime - at) > 1e-4 || el.seeking) {
            const done = onceOr(el, 'seeked', 5000)
            el.currentTime = at
            await done
          }
          it.tex.needsUpdate = true
        })(),
      )
    }
    await Promise.all(jobs)
  }

  pauseAll() {
    for (const it of this.items.values()) if (!it.el.paused) it.el.pause()
  }
}
