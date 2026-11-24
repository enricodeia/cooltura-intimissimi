// The model of the film being edited. Two editions share the studio (engine,
// timeline, panel, export) and differ in their model and actors:
//   index.html    V4 · Instrument  (model/project-v4.js, actors/)
//   machina.html  V5 · La nota     (machina/model.js, machina/)
// The page says which one it is (window.__CI_EDITION, set before the modules load).

import * as V4 from './project-v4.js'
import * as V5 from '../machina/model.js'

const ED = typeof window !== 'undefined' ? window.__CI_EDITION : null
const M = ED === 'machina' ? V5 : V4

export const EDITION = M.EDITION
export const EDITIONS = [V4.EDITION, V5.EDITION]
export const STORE_KEY = M.STORE_KEY
export const LOOK = M.LOOK
export const PALETTE = M.PALETTE
export const SWATCHES = M.SWATCHES
export const FACES = M.FACES
export const SPLITS = M.SPLITS
export const ORDERS = M.ORDERS
export const SHOT_TYPES = M.SHOT_TYPES
export const SCENE_TYPES = M.SCENE_TYPES
export const MIN_DUR = M.MIN_DUR
export const INTROS = M.INTROS
export const defaultProject = M.defaultProject
export const effectsOf = M.effectsOf
export const sceneEffects = M.sceneEffects
export const resolve = M.resolve
