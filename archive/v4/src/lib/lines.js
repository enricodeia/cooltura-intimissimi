// Fat lines with a "drawn so far" window: the SVG stroke-dash trick in WebGL.
// Width is in world units, so a line weighs the same at any export size.

import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

/** points: THREE.Vector3[] (repeat the first one to close a loop). */
export function makeLine(points, { color = 0xffffff, width = 0.03, opacity = 1 } = {}) {
  const pos = new Float32Array(points.length * 3)
  let len = 0
  points.forEach((p, i) => {
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
    if (i) len += p.distanceTo(points[i - 1])
  })
  const geo = new LineGeometry()
  geo.setPositions(pos)
  const mat = new LineMaterial({
    color,
    linewidth: width,
    worldUnits: true,
    dashed: true,
    dashSize: len,
    gapSize: len * 3 + 1,
    alphaToCoverage: true,
    transparent: opacity < 1,
    opacity,
  })
  // three's dashed fat lines drop the round caps and leave square, slightly mismatched joints
  // (visible as ticks along a curve): keep the capsule shape while windowing by distance.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(/(won't be rendering the endcaps\s*)#ifndef USE_DASH/, '$1#if 1')
    sh.fragmentShader = sh.fragmentShader
      .replace(/if \( vUv\.y < - 1\.0 \|\| vUv\.y > 1\.0 \) discard;[^\n]*/, '')
      .replace(/(float norm = len \/ linewidth;\s*)#ifndef USE_DASH/, '$1#if 1')
  }
  mat.customProgramCacheKey = () => 'ci-line'
  const line = new Line2(geo, mat)
  line.computeLineDistances()
  line.frustumCulled = false
  line.userData.length = len
  line.userData.width = width
  return line
}

/** Show only the stretch [a, b] (fractions of the length) of a line. */
export function lineWindow(line, a, b) {
  const L = line.userData.length
  if (!(b - a > 1e-4)) {
    line.visible = false
    return
  }
  line.visible = true
  const m = line.material
  m.dashSize = (b - a) * L
  m.gapSize = L * 3 + 1
  m.dashOffset = -a * L
}

export function lineStyle(line, { color, width, opacity } = {}) {
  const m = line.material
  if (color !== undefined) m.color.set(color)
  if (width !== undefined) m.linewidth = width
  if (opacity !== undefined) {
    m.opacity = opacity
    m.transparent = opacity < 0.999
    m.alphaToCoverage = !m.transparent
  }
}

export function disposeLine(line) {
  line.geometry.dispose()
  line.material.dispose()
}

export const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z)

export function circlePoints(r, n = 96, start = -Math.PI / 2, dir = 1) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = start + dir * (i / n) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
  }
  return pts
}
