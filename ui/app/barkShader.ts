import { ShaderChunk, type Texture } from 'three';
import { TILE_ALONG, TILE_AROUND } from './twinedForm';

// The tiered tree's bark shader: three's standard material, patched so the bark is clipped while a
// piece grows (`along` against `uGrown`), has depth, and shows gold in a few scars.
// Depth is parallax occlusion mapping: from a height field, the texture coordinates are shifted as if
// the furrows lay `uDepth` metres below the ridges. Close up only: it fades out between FADE metres
// from the camera (the closest view is about 25 m away).
// Scars come from the `scar` attribute (twinedForm.ts): where it passes `uScarEdge`, with noise on
// the edge, the bark has come off and the golden heartwood lies `uSink` (times the depth) below it,
// with a callus rim raised by `uRim` around it. Gold veins fill the furrows near the scars and in
// patches elsewhere (`uVeins`, 0 turns them off). Gold is metal and glows faintly.

const FADE = [30, 80];

export type BarkUniforms = {
  uGrown: { value: number };
  uDepth: { value: number };
  uScarEdge: { value: number };
  uRim: { value: number };
  uSink: { value: number };
  uVeins: { value: number };
  uGoldColor: { value: Texture };
  uGoldData: { value: Texture };
};

type Shader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };

const VERTEX = /* glsl */ `
attribute float along;
attribute float scar;
varying float vAlong;
varying float vScar;
varying vec3 vBarkPos;
`;

// The height field is in units of `uDepth`: bark from 0 (furrow) to 1 (ridge), the rim up to
// 1 + uRim, the scar's bed down to -uSink. The tangent runs along the wood (+U, TILE_ALONG metres per
// tile), the bitangent around it (+V, about TILE_AROUND metres per tile). The scar attribute is
// carried along the parallax ray by its gradient in texture space (`scarGrad`).
const FRAGMENT = /* glsl */ `
uniform float uGrown;
uniform float uDepth;
uniform float uScarEdge;
uniform float uRim;
uniform float uSink;
uniform float uVeins;
uniform sampler2D uGoldColor;
uniform sampler2D uGoldData;
varying float vAlong;
varying float vScar;
varying vec3 vBarkPos;
vec2 scarGrad;

// How much of the scar is here (0 bark, 1 gold), its rim, and the raw mask.
float scarAt(vec2 uv, out float rim, out float mask) {
  mask = vScar + dot(scarGrad, uv - vMapUv) + (texture2D(aoMap, uv * 2.7 + 0.31).b - 0.5) * 0.25;
  float inside = smoothstep(uScarEdge - 0.015, uScarEdge + 0.015, mask);
  rim = smoothstep(uScarEdge - 0.16, uScarEdge - 0.01, mask) * (1.0 - inside);
  return inside;
}

float heightAt(vec2 uv) {
  float rim, mask;
  float inside = scarAt(uv, rim, mask);
  float bark = texture2D(aoMap, uv).b + uRim * rim;
  float bed = -uSink + 0.25 * texture2D(uGoldData, uv).b;
  return mix(bark, bed, inside);
}

vec2 parallaxUv(vec2 uv) {
  float fade = 1.0 - smoothstep(${FADE[0].toFixed(1)}, ${FADE[1].toFixed(1)}, length(vViewPosition));
  float top = 1.0 + uRim;
  float range = top + uSink;
  float depth = uDepth * range * fade;
  if (depth <= 0.0) return uv;
  vec3 v = normalize(vViewPosition);
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 tv = vec3(dot(v, normalize(vTangent)), dot(v, normalize(vBitangent)), dot(v, n));
  if (tv.z <= 0.05) return uv;
  float steps = mix(16.0, 6.0, tv.z);
  vec2 shift = tv.xy / tv.z * depth * vec2(${(1 / TILE_ALONG).toFixed(5)}, ${(1 / TILE_AROUND).toFixed(5)}) / steps;
  float layer = 0.0;
  float below = (top - heightAt(uv)) / range;
  vec2 at = uv;
  for (int i = 0; i < 16; i++) {
    if (layer >= below || float(i) >= steps) break;
    at -= shift;
    layer += 1.0 / steps;
    below = (top - heightAt(at)) / range;
  }
  // Between the last two steps, where the ray crossed the surface.
  float after = below - layer;
  float before = (top - heightAt(at + shift)) / range - (layer - 1.0 / steps);
  float w = after / (after - before + 1e-5);
  return mix(at, at + shift, clamp(w, 0.0, 1.0));
}

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

// Before anything is discarded (screen-space derivatives need the whole quad): the scar's gradient in
// texture space, then the shifted coordinate every map uses, then how much gold shows there.
const MAIN = /* glsl */ `
  mat2 uvJ = mat2(dFdx(vMapUv), dFdy(vMapUv));
  float uvDet = determinant(uvJ);
  scarGrad = abs(uvDet) > 1e-12 ? inverse(transpose(uvJ)) * vec2(dFdx(vScar), dFdy(vScar)) : vec2(0.0);
  if (vAlong > uGrown) discard;
  vec2 barkUv = parallaxUv(vMapUv);
  float scarRim, scarMask;
  float scarIn = scarAt(barkUv, scarRim, scarMask);
  float furrow = 1.0 - smoothstep(0.2, 0.4, texture2D(aoMap, barkUv).b);
  float veinNear = smoothstep(0.02, uScarEdge - 0.1, vScar);
  float veinFar = smoothstep(0.58, 0.68, noise3(vBarkPos * 0.22));
  float gold = max(scarIn, furrow * max(veinNear, veinFar) * uVeins * (1.0 - scarIn));
`;

// One shifted coordinate for every map: they all share the tube's uv without a transform.
const shifted = (chunk: string, varying: string) => ShaderChunk[chunk as keyof typeof ShaderChunk].replaceAll(varying, 'barkUv');

export function patchBark(shader: Shader, uniforms: BarkUniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = `${VERTEX}${shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\nvAlong = along;\nvScar = scar;\nvBarkPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  )}`;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>\n${FRAGMENT}`)
    .replace('void main() {', `void main() {\n${MAIN}`)
    .replace(
      '#include <map_fragment>',
      `${shifted('map_fragment', 'vMapUv')}
      vec3 goldTex = texture2D(uGoldColor, barkUv).rgb * mix(0.35, 1.0, smoothstep(uScarEdge, min(1.0, uScarEdge + 0.25), scarMask));
      diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 + 0.3 * scarRim), goldTex, gold);`,
    )
    .replace('#include <roughnessmap_fragment>', `${shifted('roughnessmap_fragment', 'vRoughnessMapUv')}\nroughnessFactor = mix(roughnessFactor, texture2D(uGoldData, barkUv).g, gold);`)
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gold;')
    .replace(
      '#include <normal_fragment_maps>',
      `${shifted('normal_fragment_maps', 'vNormalMapUv')}
      normal = normalize(mix(normal, nonPerturbedNormal, scarIn * 0.7));
      // The scar's wall and rim tilt the surface: a bump from the scar's own height.
      float scarH = uDepth * (uRim * scarRim - uSink * scarIn);
      vec3 sdx = dFdx(-vViewPosition);
      vec3 sdy = dFdy(-vViewPosition);
      vec3 sr1 = cross(sdy, normal);
      vec3 sr2 = cross(normal, sdx);
      float sdet = dot(sdx, sr1);
      vec3 sgrad = sign(sdet) * (dFdx(scarH) * sr1 + dFdy(scarH) * sr2);
      normal = normalize(abs(sdet) * normal - sgrad);`,
    )
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += texture2D(uGoldColor, barkUv).rgb * gold * 0.3;')
    .replace('#include <aomap_fragment>', shifted('aomap_fragment', 'vAoMapUv'));
}
