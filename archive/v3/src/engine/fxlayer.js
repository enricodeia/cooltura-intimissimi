// The FX layer: type, logos and cards that need a real blur, a soft opacity and
// a mask. They live on their own layer (FX_LAYER) and are drawn after the 3D
// scene into a premultiplied accumulation target, then laid over the frame.
//
// Blur is done the honest way: a blurred element is drawn N times (one
// instanced draw call), each copy offset by a gaussian-distributed tap and
// weighted 1/N, added up. Inside a glyph the copies sum to exactly its colour,
// at the edges they fall off like a gaussian. Motion blur is the same with the
// taps spread along the velocity (a shutter). Sharp elements are one copy.
// Offsets are in the element's own units, so the blur scales with the type.
//
// A mask is a rectangle in a chosen space (a text block, a logo): fragments
// outside it are cut, with an antialiased edge (the SplitText "mask" effect).

import * as THREE from 'three'

export const FX_LAYER = 1

const VERT = /* glsl */ `
uniform float uTaps;
uniform float uBlur;
uniform vec2 uSmear;
uniform float uSpin;
varying vec3 vWorld;
#ifdef USE_MAP
varying vec2 vUv;
#endif
void main() {
  vec3 p = position;
  if (uTaps > 1.5) {
    float i = float(gl_InstanceID);
    float u = (i + 0.5) / uTaps;
    float r = uBlur * 0.5 * sqrt(-2.0 * log(1.0 - u * 0.95));
    float a = i * 2.39996323 + uSpin;
    float s = fract(i * 0.6180339887 + 0.5) - 0.5;
    p.xy += r * vec2(cos(a), sin(a)) + uSmear * s;
  }
  #ifdef USE_MAP
  vUv = uv;
  #endif
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTaps;
uniform float uMaskOn;
uniform vec4 uMask;
uniform mat4 uMaskInv;
varying vec3 vWorld;
#ifdef USE_MAP
uniform sampler2D uMap;
varying vec2 vUv;
#endif
void main() {
  float a = uOpacity / max(uTaps, 1.0);
  if (uMaskOn > 0.5) {
    vec2 q = (uMaskInv * vec4(vWorld, 1.0)).xy;
    vec2 fw = max(fwidth(q), vec2(1e-6));
    vec2 lo = clamp((q - uMask.xy) / fw + 0.5, 0.0, 1.0);
    vec2 hi = clamp((uMask.zw - q) / fw + 0.5, 0.0, 1.0);
    a *= lo.x * lo.y * hi.x * hi.y;
  }
  if (a <= 0.0) discard;
  #ifdef USE_MAP
  gl_FragColor = texture2D(uMap, vUv) * a;
  #else
  gl_FragColor = vec4(uColor * a, a);
  #endif
}`

const ADD = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
}

const NO_MASK = new THREE.Matrix4()
let spinSeed = 0 // each material turns its tap pattern a little (deterministic): neighbours never share it

/** A flat colour for the FX layer. maskInv: a shared Matrix4 (world → mask space). */
export function fxMaterial({ color = '#0b0b0c', map = null, maskInv = NO_MASK } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: map ? { USE_MAP: '' } : {},
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uTaps: { value: 1 },
      uBlur: { value: 0 },
      uSmear: { value: new THREE.Vector2() },
      uSpin: { value: (spinSeed++ * 2.39996323) % 6.2831853 },
      uMaskOn: { value: 0 },
      uMask: { value: new THREE.Vector4(-1e6, -1e6, 1e6, 1e6) },
      uMaskInv: { value: maskInv },
      uMap: { value: map },
    },
    ...ADD,
  })
  return m
}

/** A mesh on the FX layer drawing `geo` (shared, not copied) as N instanced copies. */
export function fxMesh(geo, mat) {
  const ig = new THREE.InstancedBufferGeometry()
  ig.index = geo.index
  for (const k of Object.keys(geo.attributes)) ig.setAttribute(k, geo.attributes[k])
  ig.instanceCount = 1
  const m = new THREE.Mesh(ig, mat)
  m.layers.set(FX_LAYER)
  m.frustumCulled = false
  return m
}

/**
 * Blur of an FX mesh. blur / smear in the mesh's own units; px = how many
 * pixels one of those units is on screen (to pick the number of taps).
 */
export function fxBlur(mesh, blur = 0, smearX = 0, smearY = 0, px = 100) {
  const u = mesh.material.uniforms
  const bp = Math.abs(blur) * px
  const sp = Math.hypot(smearX, smearY) * px
  const n = bp < 0.35 && sp < 0.6 ? 1 : Math.min(64, Math.max(10, Math.ceil(bp * 1.6 + sp * 0.9 + 8)))
  u.uTaps.value = n
  u.uBlur.value = n > 1 ? Math.abs(blur) : 0
  u.uSmear.value.set(n > 1 ? smearX : 0, n > 1 ? smearY : 0)
  mesh.geometry.instanceCount = n
}

/** Mask rectangle (x0, y0, x1, y1 in mask space), or off. */
export function fxMask(mesh, on, x0 = -1e6, y0 = -1e6, x1 = 1e6, y1 = 1e6) {
  const u = mesh.material.uniforms
  u.uMaskOn.value = on ? 1 : 0
  if (on) u.uMask.value.set(x0, y0, x1, y1)
}

const COMP_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`
const COMP_FRAG = /* glsl */ `
uniform sampler2D tFx;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tFx, vUv);
  gl_FragColor = vec4(c.rgb, min(c.a, 1.0));
}`

export class FxLayer {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType, depthBuffer: false })
    this.material = new THREE.ShaderMaterial({
      vertexShader: COMP_VERT,
      fragmentShader: COMP_FRAG,
      uniforms: { tFx: { value: this.rt.texture } },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    })
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    quad.frustumCulled = false
    this.scene.add(quad)
  }
  setSize(w, h) {
    this.rt.setSize(w, h)
  }
  /** Draw the FX layer of `scene` and lay it over `target`. */
  render(renderer, scene, camera, target) {
    const keepAuto = renderer.autoClear
    renderer.setRenderTarget(this.rt)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, false, false)
    camera.layers.set(FX_LAYER)
    renderer.render(scene, camera)
    camera.layers.set(0)
    renderer.setClearColor(0x000000, 1)
    renderer.setRenderTarget(target)
    renderer.autoClear = false
    renderer.render(this.scene, this.camera)
    renderer.autoClear = keepAuto
  }
}
