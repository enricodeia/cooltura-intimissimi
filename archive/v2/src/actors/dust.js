// Dust in the light: a few hundred motes drifting slowly through the room of the
// iPhone scene. They are only lit where the window beams cross them (the same
// light field as the backdrop), sharp near the focal plane and soft, larger
// discs away from it. In front of the phone they read against the dark glass.

import * as THREE from 'three'
import { RAYS_GLSL } from '../engine/background.js'
import { CAM_D } from '../engine/engine.js'

const N = 900

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uAspect;
uniform float uSway;
uniform float uWidth;
uniform float uAmount;
uniform float uSize;
uniform float uDrift;
uniform float uPx;
uniform float uOn;
uniform vec2 uView;
varying float vA;
varying float vSoft;
${RAYS_GLSL}
void main() {
  float t = uTime * uDrift;
  vec3 p = vec3((aSeed.x - 0.5) * uView.x * 1.25, (aSeed.y - 0.5) * uView.y * 1.2, mix(-2.5, 4.0, aSeed.z));
  // a lazy wander, a slow fall to the right
  p.x += 0.2 * sin(t * (0.19 + 0.14 * aSeed.w) + aSeed.w * 31.0) + t * 0.05;
  p.y += 0.16 * sin(t * (0.15 + 0.12 * aSeed.x) + aSeed.y * 17.0) - t * 0.04;
  p.z += 0.12 * sin(t * (0.11 + 0.1 * aSeed.y) + aSeed.z * 9.0);
  p.x = mod(p.x + uView.x * 0.625, uView.x * 1.25) - uView.x * 0.625;
  p.y = mod(p.y + uView.y * 0.6, uView.y * 1.2) - uView.y * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vec2 ndc = gl_Position.xy / gl_Position.w;
  float L = rLight(vec2(ndc.x * uAspect, ndc.y), uAspect, uTime, uSway, uWidth);
  float dz = abs(p.z - 0.3);
  vSoft = clamp(dz * 0.42, 0.0, 0.9);
  float size = (2.8 + 4.6 * aSeed.w * aSeed.w) * uSize * (1.0 + dz * 1.0);
  gl_PointSize = size * uPx * (${CAM_D.toFixed(4)} / max(0.5, -mv.z));
  float tw = 0.62 + 0.38 * sin(uTime * (1.1 + 2.3 * aSeed.z) + aSeed.w * 40.0);
  vA = uOn * (0.32 + 0.68 * L) * tw * (1.0 - vSoft * 0.55) * step(aSeed.w, uAmount);
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
varying float vSoft;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, mix(0.3, 0.0, vSoft), r) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a, a);
}`

export function createDust(engine) {
  const geo = new THREE.BufferGeometry()
  const seed = new Float32Array(N * 4)
  let s = 1234567
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < N * 4; i++) seed[i] = rnd()
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 9 / 16 },
      uSway: { value: 1 },
      uWidth: { value: 1 },
      uAmount: { value: 0.33 },
      uSize: { value: 1 },
      uDrift: { value: 1 },
      uPx: { value: 1 },
      uOn: { value: 0 },
      uView: { value: new THREE.Vector2(5.625, 10) },
      uColor: { value: new THREE.Color('#efcf9a') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 40
  points.visible = false
  engine.scene.add(points)

  return {
    update(ctx) {
      const P = ctx.T.scene('phone').p
      const on = ctx.bg.rays > 0.001 && P.dustOn && P.raysOn ? Math.min(1, ctx.bg.rays / Math.max(0.01, P.rays)) : 0
      points.visible = on > 0.001
      if (!points.visible) return
      const u = mat.uniforms
      u.uTime.value = ctx.t
      u.uAspect.value = ctx.view.aspect
      u.uSway.value = ctx.bg.sway
      u.uWidth.value = ctx.bg.width
      u.uAmount.value = Math.min(1, P.dust / 2)
      u.uSize.value = P.dustSize
      u.uDrift.value = P.dustDrift
      u.uPx.value = engine.canvas.height / 1920
      u.uOn.value = on
      u.uView.value.set(ctx.view.w, ctx.view.h)
    },
  }
}
