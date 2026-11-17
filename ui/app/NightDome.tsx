'use client';

import { useMemo } from 'react';
import { BackSide, Color, Matrix3, SphereGeometry, Vector3 } from 'three';
import { NIGHT_SKY } from './sky';

// The night over the tiered tree's clearing (docs/superpowers/specs/2026-11-17-night-watch-design.md): a dome inside the
// day sky's box that fades in once the afterglow is gone. It runs from its horizon colour up to its zenith colour, a little
// lighter in the last few degrees above the horizon, and lighter still in a wide patch around the moon. Stars, moon and
// sun are transparent too and come after it (`renderOrder`), so they shine through; the forest and the ground hide it.

// The night's colours are given as the screen should show them; this is the scene colour that ACES (three's and the
// post effects' `ACESFilmicToneMapping`, at the scene's exposure of 0.6, where it scales by 1) turns into `hex`: the
// output matrix, the curve and the input matrix undone. The night haze uses it too, so the forest melts into the dome.
const ACES_IN = new Matrix3().set(0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777).invert();
const ACES_OUT = new Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602).invert();
// x where RRTAndODTFit(x) = y: (1 − 0.983729y)x² + (0.0245786 − 0.432951y)x − (0.000090537 + 0.238081y) = 0.
const unfit = (y: number) => {
  const [a, b, c] = [1 - 0.983729 * y, 0.0245786 - 0.432951 * y, -(0.000090537 + 0.238081 * y)];
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
};
export function domeColor(hex: string) {
  const v = new Vector3().setFromColor(new Color(hex)).applyMatrix3(ACES_OUT);
  return new Color().setFromVector3(new Vector3(unfit(v.x), unfit(v.y), unfit(v.z)).applyMatrix3(ACES_IN));
}

const ZENITH = domeColor(NIGHT_SKY.zenith);
export const HORIZON = domeColor(NIGHT_SKY.horizon);

// Inside drei's sky box (1000 m wide), around everything the camera can reach.
const DOME = new SphereGeometry(450, 48, 24);

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uMoon;
uniform float uOpacity;
varying vec3 vWorld;
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  float up = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, smoothstep(0.05, 0.35, up));
  c *= 1.0 + 0.15 * (1.0 - smoothstep(0.0, 0.08, up));
  c += uHorizon * 1.2 * pow(max(dot(d, uMoon), 0.0), 16.0);
  gl_FragColor = vec4(c, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export default function NightDome({
  opacity,
  moon,
}: {
  opacity: number;
  // Unit vector toward the moon.
  moon: [number, number, number];
}) {
  const uniforms = useMemo(() => ({ uZenith: { value: new Color() }, uHorizon: { value: new Color() }, uMoon: { value: new Vector3() }, uOpacity: { value: 0 } }), []);
  return (
    <mesh geometry={DOME} renderOrder={-1} visible={opacity > 0}>
      <shaderMaterial
        uniforms={uniforms}
        uniforms-uZenith-value={ZENITH}
        uniforms-uHorizon-value={HORIZON}
        uniforms-uMoon-value={moon}
        uniforms-uOpacity-value={opacity}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        side={BackSide}
        transparent
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
