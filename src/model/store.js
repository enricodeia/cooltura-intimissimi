// The one mutable thing: the project (+ selection, playhead). Every edit goes
// through here so undo, autosave and the views stay in step.

import { defaultProject, migrate, resolve, MIN_DUR, STORE_KEY, SHOT_TYPES } from './project.js'

const KEY = STORE_KEY
const snap = (x) => JSON.parse(JSON.stringify(x))

const clone = snap

/**
 * A saved project over the current defaults. The saved ORDER of scenes and shots is kept (blocks moved,
 * deleted: `removed` lists the deleted ones), the saved values go over the default ones, unknown ids are
 * dropped, and blocks the save does not know (new in the code) come in at their default place unless the
 * user deleted them.
 */
function merge(saved) {
  saved = migrate(saved)
  const base = defaultProject()
  if (!saved || saved.version !== base.version) return base
  base.aspect = saved.aspect || base.aspect
  base.intro = saved.intro === 'B' ? 'B' : 'A'
  base.fps = saved.fps || base.fps
  if (Number.isFinite(saved.target) && saved.target > 0) base.target = saved.target
  Object.assign(base.look, saved.look || {})
  const removed = new Set(Array.isArray(saved.removed) ? saved.removed : [])
  const defScenes = base.scenes
  const defShot = new Map(defScenes.flatMap((sc) => sc.shots.map((sh) => [sh.id, sh])))
  const placed = new Set()
  const take = (o, d) => {
    const sh = clone(d)
    if (o) {
      if (Number.isFinite(o.dur)) sh.dur = Math.max(MIN_DUR, o.dur)
      if (o.name) sh.name = o.name
      Object.assign(sh.params, clone(o.params || {}))
    }
    placed.add(sh.id)
    return sh
  }
  const out = []
  for (const s of Array.isArray(saved.scenes) ? saved.scenes : []) {
    const d = defScenes.find((x) => x.id === s.id)
    if (!d || out.some((x) => x.id === s.id)) continue
    const sc = { ...clone(d), shots: [] }
    Object.assign(sc.params, s.params || {})
    for (const o of s.shots || []) {
      const ds = defShot.get(o.id)
      if (ds && !placed.has(o.id)) sc.shots.push(take(o, ds))
    }
    out.push(sc)
  }
  // what the save does not know: at its default place (after what precedes it in the defaults)
  const after = (list, prevIds) => list.reduce((at, x, k) => (prevIds.includes(x.id) ? k + 1 : at), 0)
  defScenes.forEach((d, i) => {
    let sc = out.find((x) => x.id === d.id)
    const fresh = d.shots.filter((sh) => !placed.has(sh.id) && !removed.has(sh.id))
    if (!fresh.length) return
    if (!sc) {
      if (removed.has('scene:' + d.id)) return
      sc = { ...clone(d), shots: [] }
      out.splice(after(out, defScenes.slice(0, i).map((x) => x.id)), 0, sc)
    }
    d.shots.forEach((ds, j) => {
      if (placed.has(ds.id) || removed.has(ds.id)) return
      sc.shots.splice(after(sc.shots, d.shots.slice(0, j).map((x) => x.id)), 0, take(null, ds))
    })
  })
  base.scenes = out.filter((sc) => sc.shots.length)
  base.removed = [...removed]
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
    this.edit((p) => Object.assign(p, defaultProject(), { aspect: p.aspect, intro: p.intro, removed: [] }))
  }

  // ---- structure: move and delete blocks (a "bound" shot belongs to its scene's choreography and only
  // moves or goes with the whole scene)
  isBound(id) {
    const sh = this.findShot(id)
    return !!(sh && SHOT_TYPES[sh.type]?.bound)
  }
  sceneOf(shotId) {
    return this.project.scenes.find((sc) => sc.shots.some((s) => s.id === shotId)) || null
  }
  /** Move a shot before the shot `beforeId`, or to the end of the scene `sceneId` (beforeId null). */
  moveShot(id, beforeId, sceneId = null) {
    if (id === beforeId || this.isBound(id)) return
    this.edit((p) => {
      const from = p.scenes.find((sc) => sc.shots.some((s) => s.id === id))
      if (!from) return
      const [sh] = from.shots.splice(from.shots.findIndex((s) => s.id === id), 1)
      const to = (beforeId ? p.scenes.find((sc) => sc.shots.some((s) => s.id === beforeId)) : p.scenes.find((sc) => sc.id === sceneId)) || from
      const at = beforeId ? to.shots.findIndex((s) => s.id === beforeId) : -1
      to.shots.splice(at < 0 ? to.shots.length : at, 0, sh)
      p.scenes = p.scenes.filter((sc) => sc.shots.length)
    })
  }
  /** Move a scene before the scene `beforeId` (null: to the end of the film). */
  moveScene(id, beforeId) {
    if (id === beforeId) return
    this.edit((p) => {
      const i = p.scenes.findIndex((sc) => sc.id === id)
      if (i < 0) return
      const [sc] = p.scenes.splice(i, 1)
      const at = beforeId ? p.scenes.findIndex((x) => x.id === beforeId) : -1
      p.scenes.splice(at < 0 ? p.scenes.length : at, 0, sc)
    })
  }
  removeShot(id) {
    if (this.isBound(id) || !this.sceneOf(id)) return false
    this.edit((p) => {
      const sc = p.scenes.find((x) => x.shots.some((s) => s.id === id))
      sc.shots = sc.shots.filter((s) => s.id !== id)
      p.removed = [...new Set([...(p.removed || []), id])]
      p.scenes = p.scenes.filter((x) => x.shots.length)
    })
    if (this.selection?.id === id) this.select(null)
    return true
  }
  removeScene(id) {
    const sc = this.findScene(id)
    if (!sc) return false
    this.edit((p) => {
      p.removed = [...new Set([...(p.removed || []), 'scene:' + id, ...sc.shots.map((s) => s.id)])]
      p.scenes = p.scenes.filter((x) => x.id !== id)
    })
    if (this.selection?.kind === 'scene' && this.selection.id === id) this.select(null)
    return true
  }
  /** Back to the original order with every deleted block, keeping all the values. */
  restoreStructure() {
    const curShot = new Map(this.project.scenes.flatMap((sc) => sc.shots.map((s) => [s.id, s])))
    const curScene = new Map(this.project.scenes.map((sc) => [sc.id, sc]))
    this.edit((p) => {
      const base = defaultProject()
      for (const sc of base.scenes) {
        const c = curScene.get(sc.id)
        if (c) Object.assign(sc.params, clone(c.params || {}))
        sc.shots = sc.shots.map((sh) => (curShot.has(sh.id) ? clone(curShot.get(sh.id)) : sh))
      }
      p.scenes = base.scenes
      p.removed = []
    })
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
