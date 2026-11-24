// One WebGL canvas, one clock. The film is a pure function of time: renderAt(t)
// asks every actor to pose itself for t, then draws scene → MSAA float target →
// post pass → canvas. Preview and export call the same function.

import * as THREE from 'three'
import gsap from 'gsap'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Background, bgDefaults } from './background.js'
import { Post, fxDefaults } from './post.js'
import { PALETTE } from '../model/project.js'
import { clamp } from '../core/util.js'

export const ASPECTS = {
  '9:16': { w: 1080, h: 1920, hint: 'Reel · Story · TikTok' },
  '3:4': { w: 1080, h: 1440, hint: 'Post verticale' },
  '1:1': { w: 1080, h: 1080, hint: 'Quadrato' },
  '16:9': { w: 1920, h: 1080, hint: 'Wide' },
}

export const VIEW_H = 10 // world units visible top to bottom at z = 0
export const FOV = 30
export const CAM_D = VIEW_H / 2 / Math.tan((FOV * Math.PI) / 360)

export class Engine {
  constructor({ canvas, store, videos }) {
    this.canvas = canvas
    this.store = store
    this.videos = videos
    this.actors = []
    this.time = 0
    this.playing = false
    this.loop = true
    this.exporting = false
    this.dirty = true
    this.listeners = new Set()
    this.frame = 0

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }))
    r.setPixelRatio(1)
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.NoToneMapping
    r.localClippingEnabled = true
    r.autoClear = true
    r.setClearColor(0x000000, 1)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 9 / 16, 0.5, 600)
    this.scene.add(this.camera)
    // HUD: children live in view units at the focal plane, whatever the camera does
    this.hud = new THREE.Group()
    this.hud.position.z = -CAM_D
    this.camera.add(this.hud)

    const pmrem = new THREE.PMREMGenerator(r)
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    this.scene.environment = this.envMap
    this.scene.environmentIntensity = 1
    pmrem.dispose()

    this.background = new Background()
    this.scene.add(this.background.mesh)
    this.post = new Post()
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true })
    this.W = 1080
    this.H = 1920
    this.view = { w: VIEW_H * (9 / 16), h: VIEW_H, aspect: 9 / 16, portrait: true, U: VIEW_H * (9 / 16), lw: 1 }

    this.ctx = {
      engine: this,
      t: 0,
      T: store.timeline,
      view: this.view,
      camera: this.camera,
      scene: this.scene,
      hud: this.hud,
      videos,
      bg: bgDefaults(),
      fx: fxDefaults(),
      fps: 30,
      exporting: false,
      col: (k) => PALETTE[k] || k,
    }

    this.setAspect(store.project.aspect)
    this._tick = this._tick.bind(this)
    this._last = performance.now()
    gsap.ticker.add(this._tick)
    gsap.ticker.lagSmoothing(0)
    store.on((what) => {
      if (what === 'project' || what === 'history') this.dirty = true
    })
  }

  on(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  emit(what) {
    for (const fn of this.listeners) fn(what)
  }

  add(actor) {
    this.actors.push(actor)
    return actor
  }

  get duration() {
    return this.store.timeline.duration
  }

  // ---------------------------------------------------------------- size

  setAspect(key) {
    const a = ASPECTS[key] || ASPECTS['9:16']
    this.aspectKey = key
    this.W = a.w
    this.H = a.h
    const aspect = a.w / a.h
    // lw: hairlines are authored for the 1920-tall frame; shorter frames have fewer pixels per unit, so lines thicken to keep their weight
    Object.assign(this.view, { w: VIEW_H * aspect, h: VIEW_H, aspect, portrait: aspect < 1, U: VIEW_H * Math.min(aspect, 1), lw: Math.sqrt(1920 / a.h) })
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this.dirty = true
    this.emit('aspect')
  }
  /** Drawing-buffer size in pixels (the CSS size is the UI's business). */
  setBuffer(w, h) {
    w = Math.max(2, Math.round(w))
    h = Math.max(2, Math.round(h))
    if (this.canvas.width === w && this.canvas.height === h) return
    this.renderer.setSize(w, h, false)
    this.rt.setSize(w, h)
    this.dirty = true
  }

  // ---------------------------------------------------------------- clock

  play() {
    if (this.playing) return
    if (this.time >= this.duration - 1e-3) this.time = 0
    this.playing = true
    this._last = performance.now()
    this.emit('play')
  }
  pause() {
    if (!this.playing) return
    this.playing = false
    this.dirty = true
    this.emit('play')
  }
  toggle() {
    this.playing ? this.pause() : this.play()
  }
  seek(t) {
    this.time = clamp(t, 0, this.duration)
    this.dirty = true
    this.emit('time')
  }

  _tick() {
    const now = performance.now()
    const dt = Math.min(0.1, (now - this._last) / 1000)
    this._last = now
    if (this.exporting) return
    if (this.playing) {
      this.time += dt
      if (this.time >= this.duration) {
        if (this.loop) this.time = this.time % this.duration
        else {
          this.time = this.duration
          this.playing = false
          this.emit('play')
        }
      }
      this.dirty = true
      this.emit('time')
    }
    if (this.dirty) {
      this.dirty = false
      this.renderAt(this.time)
      this.videos.syncPreview(this.playing)
    }
  }

  // ---------------------------------------------------------------- frame

  pose(t) {
    const c = this.ctx
    const T = this.store.timeline
    c.t = clamp(t, 0, Math.max(0, T.duration - 1e-4))
    c.T = T
    c.fps = this.store.project.fps
    c.exporting = this.exporting
    const cam = this.camera
    cam.position.set(0, 0, CAM_D)
    cam.quaternion.identity()
    cam.up.set(0, 1, 0)
    Object.assign(c.bg, bgDefaults())
    Object.assign(c.fx, fxDefaults())
    const look = this.store.project.look
    c.fx.grain = look.grain
    c.fx.vignette = look.vignette
    this.videos.beginFrame()
    for (const a of this.actors) a.update(c)
    cam.updateMatrixWorld(true)
    for (const a of this.actors) a.late?.(c)
  }

  renderAt(t) {
    this.pose(t)
    const c = this.ctx
    const r = this.renderer
    this.background.apply(c.bg, this.view.aspect, c.t)
    for (const a of this.actors) a.preRender?.(r, c)
    r.setRenderTarget(this.rt)
    r.clear()
    r.render(this.scene, this.camera)
    this.frame = Math.round(c.t * c.fps)
    this.post.render(r, this.rt.texture, c.fx, this.view.aspect, this.frame)
  }

  /** Export: pose once to learn which videos are on screen, put them on their frame. */
  async prepare(t) {
    this.pose(t)
    await this.videos.seekAll()
  }
}
