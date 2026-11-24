// The film's own shaders. Colours stay graphic: a 3D number shows the exact
// palette colour on its face and takes light only on its thickness.

import * as THREE from 'three'

const col = (c) => new THREE.Color(c)

// ------------------------------------------------------------------ two-tone solid (extruded type, logos, icons)

const SOLID_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vON;
varying vec3 vV;
varying vec3 vOP;
#include <clipping_planes_pars_vertex>
void main() {
  vON = normal;
  vOP = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`

const SOLID_FRAG = /* glsl */ `
uniform vec3 uFront;
uniform vec3 uSide;
uniform vec3 uDeep;
uniform float uOpacity;
uniform float uGrad;
uniform vec3 uG0;
uniform vec3 uG1;
uniform vec3 uG2;
uniform vec3 uG3;
uniform vec4 uBox;
uniform vec2 uGradDir;
uniform float uFlat;
varying vec3 vN;
varying vec3 vON;
varying vec3 vV;
varying vec3 vOP;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float cap = smoothstep(0.5, 0.94, abs(vON.z));
  vec3 front = uFront;
  if (uGrad > 0.5) {
    float g = clamp(dot((vOP.xy - uBox.xy) / uBox.zw, uGradDir), 0.0, 1.0);
    front = g < 0.34 ? mix(uG0, uG1, g / 0.34) : g < 0.67 ? mix(uG1, uG2, (g - 0.34) / 0.33) : mix(uG2, uG3, (g - 0.67) / 0.33);
  }
  vec3 L = normalize(vec3(-0.45, 0.8, 0.55));
  float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
  vec3 side = uGrad > 0.5 ? front * 0.62 : uSide;
  vec3 deep = uGrad > 0.5 ? front * 0.3 : uDeep;
  vec3 wall = mix(deep, side, diff * diff);
  float rim = pow(1.0 - clamp(dot(n, vV), 0.0, 1.0), 3.0);
  float spec = pow(clamp(dot(reflect(-L, n), vV), 0.0, 1.0), 26.0);
  wall += (rim * 0.3 + spec * 0.55) * mix(side, vec3(1.0), 0.55);
  vec3 c = mix(wall, front, max(cap, uFlat));
  gl_FragColor = vec4(c, uOpacity);
}`

/**
 * front = exact colour of the face; side/deep = lit and shadowed thickness.
 * gradient: { stops: [c0, c1, c2, c3], box: [minx, miny, w, h], dir: [x, y] } paints the face instead.
 */
export function solidMaterial({ front = '#c0ff33', side = '#8174f2', deep = null, gradient = null } = {}) {
  const sideC = col(side)
  const m = new THREE.ShaderMaterial({
    vertexShader: SOLID_VERT,
    fragmentShader: SOLID_FRAG,
    clipping: true,
    uniforms: {
      uFront: { value: col(front) },
      uSide: { value: sideC },
      uDeep: { value: deep ? col(deep) : sideC.clone().multiplyScalar(0.34) },
      uOpacity: { value: 1 },
      uGrad: { value: gradient ? 1 : 0 },
      uG0: { value: col(gradient?.stops[0] || '#000') },
      uG1: { value: col(gradient?.stops[1] || '#000') },
      uG2: { value: col(gradient?.stops[2] || '#000') },
      uG3: { value: col(gradient?.stops[3] || '#000') },
      uBox: { value: new THREE.Vector4(...(gradient?.box || [0, 0, 1, 1])) },
      uGradDir: { value: new THREE.Vector2(...(gradient?.dir || [0, 1])) },
      uFlat: { value: 0 },
    },
    side: THREE.DoubleSide,
  })
  m.userData.setColors = (frontC, sideCol, deepCol) => {
    m.uniforms.uFront.value.set(frontC)
    if (sideCol) {
      m.uniforms.uSide.value.set(sideCol)
      if (deepCol) m.uniforms.uDeep.value.set(deepCol)
      else m.uniforms.uDeep.value.set(sideCol).multiplyScalar(0.34)
    }
  }
  m.userData.setOpacity = (o) => {
    m.uniforms.uOpacity.value = o
    m.transparent = o < 0.999
    m.depthWrite = o > 0.5
  }
  return m
}

// ------------------------------------------------------------------ video tile (rounded, cover-fit, dim + blur)

const UV_VERT = /* glsl */ `
varying vec2 vUv;
#include <clipping_planes_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`

// Video textures are uploaded as plain RGBA8 (three does not use the sRGB internal
// format for video), so a custom shader gets the encoded values and must decode
// them to linear itself; without this every video comes out lighter and greyer
// (source 19 → 77 on screen). With it, the output pixels are the video's pixels.
const SRGB_DECODE = /* glsl */ `
vec3 ciSrgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}`

const TILE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uDecode;
uniform vec2 uSize;
uniform float uRadius;
uniform float uDim;
uniform vec3 uDimColor;
uniform float uBlur;
uniform float uOpacity;
uniform float uMediaAspect;
uniform float uZoom;
uniform float uCircle;
uniform vec2 uShift;
varying vec2 vUv;
#include <clipping_planes_pars_fragment>
${SRGB_DECODE}
void main() {
  #include <clipping_planes_fragment>
  vec2 p = (vUv - 0.5) * uSize;
  float r = min(uRadius, min(uSize.x, uSize.y) * 0.5);
  vec2 q = abs(p) - uSize * 0.5 + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  if (uCircle > 0.5) d = length(p) - min(uSize.x, uSize.y) * 0.5;
  float aa = max(fwidth(d), 1e-5);
  float a = clamp(0.5 - d / aa, 0.0, 1.0);
  if (a <= 0.0) discard;
  float ta = uSize.x / uSize.y;
  vec2 uv = (vUv - 0.5) / uZoom;
  if (ta > uMediaAspect) uv.y *= uMediaAspect / ta; else uv.x *= ta / uMediaAspect;
  vec3 c = texture2D(map, uv + 0.5 + uShift, uBlur).rgb;
  if (uDecode > 0.5) c = ciSrgbToLinear(c);
  c = mix(c, uDimColor, uDim);
  gl_FragColor = vec4(c, a * uOpacity);
}`

export function tileMaterial(map, { mediaAspect = 9 / 16 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: TILE_FRAG,
    clipping: true,
    uniforms: {
      map: { value: map },
      uDecode: { value: 1 },
      uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0.08 },
      uDim: { value: 0 },
      uDimColor: { value: col('#0b0b0c') },
      uBlur: { value: 0 },
      uOpacity: { value: 1 },
      uMediaAspect: { value: mediaAspect },
      uZoom: { value: 1 },
      uCircle: { value: 0 },
      uShift: { value: new THREE.Vector2(0, 0) },
    },
    alphaToCoverage: true,
    side: THREE.DoubleSide,
  })
}

// ------------------------------------------------------------------ card (canvas texture, premultiplied, blur by mip)

const CARD_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;
uniform float uBlur;
varying vec2 vUv;
void main() {
  vec4 c;
  if (uBlur < 0.02) {
    c = texture2D(map, vUv);
  } else {
    vec2 px = exp2(uBlur) / vec2(textureSize(map, 0));
    c = textureLod(map, vUv, uBlur) * 0.28;
    c += textureLod(map, vUv + px * vec2(0.92, 0.38), uBlur) * 0.18;
    c += textureLod(map, vUv + px * vec2(-0.38, 0.92), uBlur) * 0.18;
    c += textureLod(map, vUv + px * vec2(-0.92, -0.38), uBlur) * 0.18;
    c += textureLod(map, vUv + px * vec2(0.38, -0.92), uBlur) * 0.18;
  }
  gl_FragColor = c * uOpacity;
}`

export function cardMaterial(map) {
  return new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: CARD_FRAG,
    uniforms: { map: { value: map }, uOpacity: { value: 1 }, uBlur: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    side: THREE.DoubleSide,
  })
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.premultiplyAlpha = true
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 4
  return t
}

// ------------------------------------------------------------------ flat colour (type, discs)

export function flatMaterial(color = '#ffffff', opacity = 1) {
  return new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
}
