import { ShaderChunk } from 'three';
import { TILE_ALONG, TILE_AROUND } from './twinedForm';

// The tiered tree's bark shader: three's standard material, patched so the bark is clipped while a
// piece grows (`along` against `uGrown`) and has depth. The depth is parallax occlusion mapping: from
// the height in the bark data (blue channel of the `aoMap`), the texture coordinates are shifted as
// if the furrows lay `uDepth` metres below the ridges. Close up only: it fades out between FADE
// metres from the camera (the closest view is about 25 m away).

const FADE = [30, 80];

export type BarkUniforms = { uGrown: { value: number }; uDepth: { value: number } };

type Shader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };

// Steps a ray from the surface into the height field, in tangent space. The tangent runs along the
// wood (+U, TILE_ALONG metres per tile), the bitangent around it (+V, about TILE_AROUND metres per tile).
const PARALLAX = /* glsl */ `
uniform float uDepth;
vec2 parallaxUv(vec2 uv) {
  float fade = 1.0 - smoothstep(${FADE[0].toFixed(1)}, ${FADE[1].toFixed(1)}, length(vViewPosition));
  float depth = uDepth * fade;
  if (depth <= 0.0) return uv;
  vec3 v = normalize(vViewPosition);
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 tv = vec3(dot(v, normalize(vTangent)), dot(v, normalize(vBitangent)), dot(v, n));
  if (tv.z <= 0.05) return uv;
  float steps = mix(16.0, 6.0, tv.z);
  vec2 shift = tv.xy / tv.z * depth * vec2(${(1 / TILE_ALONG).toFixed(5)}, ${(1 / TILE_AROUND).toFixed(5)}) / steps;
  float layer = 0.0;
  float below = 1.0 - texture2D(aoMap, uv).b;
  vec2 at = uv;
  for (int i = 0; i < 16; i++) {
    if (layer >= below || float(i) >= steps) break;
    at -= shift;
    layer += 1.0 / steps;
    below = 1.0 - texture2D(aoMap, at).b;
  }
  // Between the last two steps, where the ray crossed the surface.
  float after = below - layer;
  float before = (1.0 - texture2D(aoMap, at + shift).b) - (layer - 1.0 / steps);
  float w = after / (after - before + 1e-5);
  return mix(at, at + shift, clamp(w, 0.0, 1.0));
}
`;

// One shifted coordinate for every map: they all share the tube's uv without a transform.
const shifted = (chunk: string, varying: string) => ShaderChunk[chunk as keyof typeof ShaderChunk].replaceAll(varying, 'barkUv');

export function patchBark(shader: Shader, uniforms: BarkUniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = `attribute float along;\nvarying float vAlong;\n${shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = along;')}`;
  shader.fragmentShader = `uniform float uGrown;\nvarying float vAlong;\n${shader.fragmentShader}`
    .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>\n${PARALLAX}`)
    .replace('void main() {', 'void main() {\nif (vAlong > uGrown) discard;\nvec2 barkUv = parallaxUv(vMapUv);')
    .replace('#include <map_fragment>', shifted('map_fragment', 'vMapUv'))
    .replace('#include <roughnessmap_fragment>', shifted('roughnessmap_fragment', 'vRoughnessMapUv'))
    .replace('#include <normal_fragment_maps>', shifted('normal_fragment_maps', 'vNormalMapUv'))
    .replace('#include <aomap_fragment>', shifted('aomap_fragment', 'vAoMapUv'));
}
