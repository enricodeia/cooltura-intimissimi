// Final pass: speed blur (a directional blur along the camera's travel + a zoom
// blur), vignette, grain, and a dither so the dark gradients survive H.264.

import * as THREE from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uBlur;
uniform float uZoomBlur;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform float uAspect;
varying vec2 vUv;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

void main() {
  vec2 uv = vUv;
  vec3 c;
  float n = hash12(gl_FragCoord.xy + uSeed * 17.0);
  if (dot(uBlur, uBlur) > 1e-9 || abs(uZoomBlur) > 1e-5) {
    vec3 acc = vec3(0.0);
    float ws = 0.0;
    for (int i = 0; i < 28; i++) {
      float f = (float(i) + n) / 28.0 - 0.5;
      vec2 o = uBlur * f + (uv - 0.5) * uZoomBlur * f;
      float w = 1.0 - abs(f) * 1.1;
      acc += texture2D(tScene, clamp(uv + o, 0.0, 1.0)).rgb * w;
      ws += w;
    }
    c = acc / ws;
  } else {
    c = texture2D(tScene, uv).rgb;
  }
  vec2 v = (uv - 0.5) * vec2(min(uAspect, 1.0), min(1.0 / uAspect, 1.0)) * 2.0;
  c *= 1.0 - uVignette * smoothstep(0.55, 1.5, length(v));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  float g = hash12(gl_FragCoord.xy * 1.31 + uSeed * 37.0) - 0.5;
  gl_FragColor.rgb += g * (uGrain + 1.0 / 255.0);
}`

export class Post {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null },
        uBlur: { value: new THREE.Vector2() },
        uZoomBlur: { value: 0 },
        uVignette: { value: 0 },
        uGrain: { value: 0 },
        uSeed: { value: 0 },
        uAspect: { value: 1 },
      },
    })
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }
  render(renderer, texture, fx, aspect, frame) {
    const u = this.material.uniforms
    u.tScene.value = texture
    u.uBlur.value.set(fx.blurX, fx.blurY)
    u.uZoomBlur.value = fx.zoomBlur
    u.uVignette.value = fx.vignette
    u.uGrain.value = fx.grain
    u.uSeed.value = frame % 997
    u.uAspect.value = aspect
    renderer.setRenderTarget(null)
    renderer.render(this.scene, this.camera)
  }
}

export const fxDefaults = () => ({ blurX: 0, blurY: 0, zoomBlur: 0, vignette: 0, grain: 0 })
