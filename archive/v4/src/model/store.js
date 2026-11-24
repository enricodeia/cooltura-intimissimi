// The one mutable thing: the project (+ selection, playhead). Every edit goes
// through here so undo, autosave and the views stay in step.

import { defaultProject, resolve, MIN_DUR } from './project.js'

const KEY = 'cooltura-intimissimi.project.v8'
const snap = (x) => JSON.parse(JSON.stringify(x))

/** Saved project over the current defaults (new shots/parameters appear, unknown ones are dropped). */
function merge(saved) {
  const base = defaultProject()
  if (!saved || saved.version !== base.version) return base
  base.aspect = saved.aspect || base.aspect
  base.intro = saved.intro === 'B' ? 'B' : 'A'
  base.fps = saved.fps || base.fps
  if (Number.isFinite(saved.target) && saved.target > 0) base.target = saved.target
  Object.assign(base.look, saved.look || {})
  for (const sc of base.scenes) {
    const s = saved.scenes?.find((x) => x.id === sc.id)
    if (!s) continue
    Object.assign(sc.params, s.params || {})
    for (const sh of sc.shots) {
      const o = s.shots?.find((x) => x.id === sh.id)
      if (!o) continue
      if (Number.isFinite(o.dur)) sh.dur = Math.max(MIN_DUR, o.dur)
      if (o.name) sh.name = o.name
      Object.assign(sh.params, JSON.parse(JSON.stringify(o.params || {})))
    }
  }
  return base
}

export class Store {
  constructor({ persist = true } = {}) {
    this.persist = persist
    let saved = null
    if (persist) {
      try {
        saved = JSON.parse(localStorage.getItem(KEY) || 'null')
      } catch {}
    }
    this.project = merge(saved)
    this.timeline = resolve(this.project)
    this.selection = null // { kind: 'shot' | 'scene', id }
    this.undoStack = []
    this.redoStack = []
    this.listeners = new Set()
    this._tx = null
    this._saveTimer = 0
  }

  on(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  emit(what) {
    for (const fn of this.listeners) fn(what)
  }

  findShot(id) {
    for (const sc of this.project.scenes) for (const sh of sc.shots) if (sh.id === id) return sh
    return null
  }
  findScene(id) {
    return this.project.scenes.find((s) => s.id === id) || null
  }

  // ---- history: begin() before a drag, commit() after; single edits wrap themselves
  begin() {
    if (!this._tx) this._tx = snap(this.project)
  }
  commit() {
    if (!this._tx) return
    const before = this._tx
    this._tx = null
    if (JSON.stringify(before) === JSON.stringify(this.project)) return
    this.undoStack.push(before)
    if (this.undoStack.length > 200) this.undoStack.shift()
    this.redoStack.length = 0
    this.emit('history')
  }
  edit(fn, { live = false } = {}) {
    const own = !this._tx && !live
    if (own) this.begin()
    fn(this.project)
    this.changed()
    if (own) this.commit()
  }
  changed() {
    this.timeline = resolve(this.project)
    this.emit('project')
    if (this.persist) {
      clearTimeout(this._saveTimer)
      this._saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(this.project))
        } catch {}
      }, 250)
    }
  }
  undo() {
    const p = this.undoStack.pop()
    if (!p) return
    this.redoStack.push(snap(this.project))
    this.project = p
    this.changed()
    this.emit('history')
  }
  redo() {
    const p = this.redoStack.pop()
    if (!p) return
    this.undoStack.push(snap(this.project))
    this.project = p
    this.changed()
    this.emit('history')
  }
  reset() {
    this.edit((p) => Object.assign(p, defaultProject(), { aspect: p.aspect, intro: p.intro }))
  }
  load(json) {
    this.begin()
    this.project = merge(typeof json === 'string' ? JSON.parse(json) : json)
    this._tx && this.commitLoaded()
  }
  commitLoaded() {
    const before = this._tx
    this._tx = null
    this.undoStack.push(before)
    this.redoStack.length = 0
    this.changed()
    this.emit('history')
  }

  select(sel) {
    const same = this.selection?.kind === sel?.kind && this.selection?.id === sel?.id
    this.selection = sel
    if (!same) this.emit('selection')
  }

  // ---- timeline edits
  /** Right edge: this shot gets longer/shorter, everything after ripples. */
  setDur(id, dur) {
    const sh = this.findShot(id)
    if (!sh) return
    this.edit((p) => (sh.dur = Math.max(MIN_DUR, Math.round(dur * 1000) / 1000)), { live: !!this._tx })
  }
  /** Shots of the film as it plays (only the chosen intro). */
  liveShots() {
    const intro = this.project.intro === 'B' ? 'B' : 'A'
    return this.project.scenes.filter((s) => !s.when || s.when === intro).flatMap((s) => s.shots)
  }
  /** Left edge: move the cut between this shot and the one before it (rolling edit, the film keeps its length). */
  rollCut(id, delta, startDurs) {
    const shots = this.liveShots()
    const i = shots.findIndex((s) => s.id === id)
    if (i <= 0) return
    const a = shots[i - 1]
    const b = shots[i]
    const d = Math.max(MIN_DUR - startDurs.a, Math.min(startDurs.b - MIN_DUR, delta))
    this.edit(
      () => {
        a.dur = Math.round((startDurs.a + d) * 1000) / 1000
        b.dur = Math.round((startDurs.b - d) * 1000) / 1000
      },
      { live: !!this._tx },
    )
  }
  /** Stretch a whole scene: its shots keep their proportions. */
  scaleScene(id, total, startDurs) {
    const sc = this.findScene(id)
    if (!sc) return
    const sum = startDurs.reduce((a, b) => a + b, 0)
    const k = Math.max((MIN_DUR * sc.shots.length) / sum, total / sum)
    this.edit(() => sc.shots.forEach((sh, i) => (sh.dur = Math.max(MIN_DUR, Math.round(startDurs[i] * k * 1000) / 1000))), { live: !!this._tx })
  }
  /** Scale every shot so the film lasts `seconds`. */
  fitTo(seconds) {
    const k = seconds / this.timeline.duration
    this.edit(() => {
      const shots = this.liveShots()
      shots.forEach((sh) => (sh.dur = Math.max(MIN_DUR, Math.round(sh.dur * k * 100) / 100)))
      // put the rounding remainder on the last shot so the total is exact
      const sum = shots.reduce((a, s) => a + s.dur, 0)
      const last = shots[shots.length - 1]
      last.dur = Math.max(MIN_DUR, Math.round((last.dur + seconds - sum) * 100) / 100)
    })
  }
  setParam(kind, id, key, value) {
    const target = kind === 'scene' ? this.findScene(id) : kind === 'look' ? { params: this.project.look } : this.findShot(id)
    if (!target) return
    this.edit(() => (target.params[key] = value), { live: !!this._tx })
  }
  setAspect(a) {
    this.edit((p) => (p.aspect = a))
    this.emit('aspect')
  }
  /** The length the film should have (the mark on the ruler, "Adatta a"). */
  setTarget(v) {
    const x = Math.round(Math.max(5, Math.min(180, Number(v) || 0)) * 100) / 100
    if (!x || x === this.project.target) return
    this.edit((p) => (p.target = x))
  }
  /** Intro A (the logos) or B (statement + logos): the rest of the film is the same. */
  setIntro(v) {
    const next = v === 'B' ? 'B' : 'A'
    if (this.project.intro === next) return
    this.edit((p) => (p.intro = next))
    this.emit('intro')
  }
}
