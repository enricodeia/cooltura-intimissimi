// The backdrop: two colours and a travelling front (fade, linear wipe, radial
// iris), plus the god rays: two lamps above the frame whose beams sway slowly
// through a little haze. Screen space, a pure function of time.

import * as THREE from 'three'

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
uniform float uHaze;
varying vec2 vUv;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
float noise2(vec2 x) {
  vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm2(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }

// one lamp: o = position, ang = 0 points straight down, halfW = tan of the half aperture
float beam(vec2 p, vec2 o, float ang, float halfW, float seed) {
  vec2 d = vec2(sin(ang), -cos(ang));
  vec2 v = p - o;
  float along = dot(v, d);
  if (along <= 0.0) return 0.0;
  float perp = v.x * d.y - v.y * d.x;
  float a = perp / (along * halfW);
  float core = 0.72 * exp(-a * a * 2.4) + 0.28 * exp(-a * a * 0.55);
  float shafts = 0.5 + 0.5 * noise1(a * 6.0 + seed * 13.0 + uTime * 0.06);
  shafts *= 0.72 + 0.28 * noise1(a * 21.0 - seed * 5.0 - uTime * 0.1);
  float fall = 1.0 / (1.0 + along * along * 0.38);
  return core * shafts * fall * smoothstep(0.0, 0.4, along);
}

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
    float t = uTime;
    float w = 0.085 * uWidth;
    float a1 = 0.40 + uSway * (0.1 * sin(t * 0.55) + 0.035 * sin(t * 1.3 + 1.0));
    float a2 = -0.34 + uSway * (0.11 * sin(t * 0.47 + 2.1) + 0.035 * sin(t * 1.1 + 0.3));
    vec2 o1 = vec2(-uAspect * 0.95 - 0.1, 1.5);
    vec2 o2 = vec2(uAspect * 0.9 + 0.15, 1.62);
    float b = 0.42 * (beam(p, o1, a1, w, 1.0) + beam(p, o2, a2, w * 1.2, 2.0));
    float haze = mix(1.0, 0.5 + fbm2(p * 1.3 + vec2(t * 0.05, -t * 0.03)), uHaze);
    c += uRayColor * b * haze * uRays;
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
        uA: { value: new THREE.Color('#f3f1ec') },
        uB: { value: new THREE.Color('#0b0b0c') },
        uMix: { value: 0 },
        uMode: { value: 0 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uAngle: { value: 0 },
        uSoft: { value: 0.02 },
        uAspect: { value: 9 / 16 },
        uRays: { value: 0 },
        uRayColor: { value: new THREE.Color('#ffffff') },
        uTime: { value: 0 },
        uSway: { value: 1 },
        uWidth: { value: 1 },
        uHaze: { value: 0.6 },
      },
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -10000
  }

  /** state: { a, b, mix, mode: 'fade'|'wipe'|'iris', angle, center: [u, v], soft, rays, raysColor, sway, width, haze } */
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
    u.uHaze.value = s.haze
    u.uTime.value = t
  }
}

export const bgDefaults = () => ({ a: '#f3f1ec', b: '#0b0b0c', mix: 0, mode: 'fade', angle: 0, center: [0.5, 0.5], soft: 0.02, rays: 0, raysColor: '#ffffff', sway: 1, width: 1, haze: 0.6 })
