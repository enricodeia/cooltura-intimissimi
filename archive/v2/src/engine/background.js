// The backdrop: two colours and a travelling front (fade, linear wipe, radial
// iris), plus the light of the iPhone scene: two beams of warm daylight from
// high windows on the left, falling across a white room. On white, light can
// only show against shade, so the room takes a little shade where the light
// does not fall; in the beams the paper comes back to full white, warmed by the
// light's colour, with the soft streaks of real window light and a slow haze.
// Screen space, a pure function of time. RAYS_GLSL is shared with the dust.

import * as THREE from 'three'

export const RAYS_GLSL = /* glsl */ `
float rHash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float rHash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float rNoise1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(rHash11(i), rHash11(i + 1.0), f); }
float rNoise2(vec2 x) {
  vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rHash21(i), rHash21(i + vec2(1.0, 0.0)), f.x), mix(rHash21(i + vec2(0.0, 1.0)), rHash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float rFbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * rNoise2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }

// one shaft of window light fanning out from S (just outside the frame, top left):
// a0 its direction (0 = straight down), w its half aperture. Soft edges, fine
// streaks running along it, a slow falloff with distance.
float rShaft(vec2 p, vec2 S, float a0, float w, float seed, float t) {
  vec2 v = p - S;
  float r = length(v);
  float a = atan(v.x, -v.y);
  float da = abs(a - a0);
  float soft = w * 0.42 + 0.01;
  float prof = smoothstep(w + soft, w - soft * 0.5, da);
  float u = (a - a0) / w;
  float streak = 0.66 + 0.34 * rNoise1(u * 4.3 + seed * 11.0 + t * 0.028);
  streak *= 0.82 + 0.18 * rNoise1(u * 14.0 - seed * 5.0 - t * 0.045);
  float fall = 1.0 / (1.0 + r * r * 0.05);
  return prof * streak * fall;
}

// the light at p (aspect-corrected, frame height 2): 0 … ~1
float rLight(vec2 p, float aspect, float t, float sway, float width) {
  vec2 S = vec2(-aspect - 0.5, 1.7);
  float s1 = sway * (0.012 * sin(t * 0.37) + 0.005 * sin(t * 0.91 + 1.3));
  float s2 = sway * (0.011 * sin(t * 0.31 + 2.1) + 0.004 * sin(t * 0.83 + 0.4));
  float b = rShaft(p, S, 0.6 + s1, 0.09 * width, 1.0, t);
  b += 0.9 * rShaft(p, S, 0.86 + s2, 0.062 * width, 2.0, t);
  float haze = 0.84 + 0.16 * rFbm(p * 1.2 + vec2(t * 0.03, -t * 0.02));
  return clamp(b * haze * 1.15, 0.0, 1.0);
}
`

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`

const FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uMix;
uniform int uMode;
uniform vec2 uCenter;
uniform float uAngle;
uniform float uSoft;
uniform float uAspect;
uniform float uRays;
uniform vec3 uRayColor;
uniform float uTime;
uniform float uSway;
uniform float uWidth;
uniform float uShade;
varying vec2 vUv;
${RAYS_GLSL}
void main() {
  float m = uMix;
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  if (uMode == 1) {
    vec2 dir = vec2(cos(uAngle), sin(uAngle));
    float ext = 0.5 * (abs(dir.x) * uAspect + abs(dir.y));
    float s = dot(q, dir) + 0.06 * sin(dot(q, vec2(-dir.y, dir.x)) * 3.1 + 0.6);
    float front = mix(-ext - uSoft - 0.07, ext + uSoft + 0.07, uMix);
    m = 1.0 - smoothstep(front - uSoft, front + uSoft, s);
  } else if (uMode == 2) {
    vec2 c = (uCenter - 0.5) * vec2(uAspect, 1.0);
    float maxR = length(vec2(uAspect, 1.0) * 0.5) + length(c);
    float front = uMix * (maxR + uSoft * 2.0) - uSoft;
    m = 1.0 - smoothstep(front - uSoft, front + uSoft, length(q - c));
  }
  vec3 c = mix(uA, uB, clamp(m, 0.0, 1.0));
  if (uRays > 0.001) {
    vec2 p = q * 2.0;
    float L = rLight(p, uAspect, uTime, uSway, uWidth);
    // the room: a little shade, a touch deeper away from the windows
    float on = min(uRays, 1.0);
    // the room takes a little shade, deeper away from the window; the window itself glows a touch
    float far = smoothstep(-1.4, 2.2, length(p - vec2(-uAspect - 0.5, 1.7)));
    float shade = uShade * on * (0.1 + 0.07 * far);
    vec3 room = c * (1.0 - shade);
    vec3 light = c * mix(vec3(1.0), uRayColor, 0.3) * 0.985;
    c = mix(room, light, clamp(L * uRays, 0.0, 1.0));
  }
  gl_FragColor = vec4(c, 1.0);
}`

export class Background {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uA: { value: new THREE.Color('#ffffff') },
        uB: { value: new THREE.Color('#0b0b0c') },
        uMix: { value: 0 },
        uMode: { value: 0 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uAngle: { value: 0 },
        uSoft: { value: 0.02 },
        uAspect: { value: 9 / 16 },
        uRays: { value: 0 },
        uRayColor: { value: new THREE.Color('#ffe2b8') },
        uTime: { value: 0 },
        uSway: { value: 1 },
        uWidth: { value: 1 },
        uShade: { value: 0.5 },
      },
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -10000
  }

  /** state: { a, b, mix, mode: 'fade'|'wipe'|'iris', angle, center: [u, v], soft, rays, raysColor, sway, width, haze (= room shade) } */
  apply(s, aspect, t) {
    const u = this.material.uniforms
    u.uA.value.set(s.a)
    u.uB.value.set(s.b)
    u.uMix.value = s.mix
    u.uMode.value = s.mode === 'wipe' ? 1 : s.mode === 'iris' ? 2 : 0
    u.uAngle.value = s.angle
    u.uCenter.value.set(s.center[0], s.center[1])
    u.uSoft.value = s.soft
    u.uAspect.value = aspect
    u.uRays.value = s.rays
    u.uRayColor.value.set(s.raysColor)
    u.uSway.value = s.sway
    u.uWidth.value = s.width
    u.uShade.value = s.haze
    u.uTime.value = t
  }
}

export const bgDefaults = () => ({ a: '#ffffff', b: '#0b0b0c', mix: 0, mode: 'fade', angle: 0, center: [0.5, 0.5], soft: 0.02, rays: 0, raysColor: '#ffe2b8', sway: 1, width: 1, haze: 0.5 })
