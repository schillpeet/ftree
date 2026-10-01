'use client';

import { useMemo } from 'react';
import {
  Color,
  ConeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Euler,
  Vector3,
} from 'three';
import { makeNoise, seededRandom } from './random';

// Ground reaches far past the fog so the horizon is meadow all the way, with no visible edge.
const GROUND_RADIUS = 4000;
const GROUND_SEGMENTS = 384;
const GRASS_BLADES = 60000;
const GRASS_RADIUS = 45;

const hills = makeNoise(1, 4);
const patches = makeNoise(2, 5);

// Hill height at world (x, z): a broad, uneven dome that flattens into rolling ground.
export function height(x: number, z: number) {
  const r2 = x * x + z * z;
  // Ripples flatten far out, where the coarse grid would alias them into streaks.
  return 7 * Math.exp(-r2 / 1800) + 0.9 * Math.exp(-r2 / 12000) * hills(x * 0.035, z * 0.035);
}

// Slightly blue-leaning greens so they stay deep green rather than straw under orange sunset light.
const DARK = new Color('#0f3d22');
const LIGHT = new Color('#2c8a4a');

function groundColor(x: number, z: number, out: Color) {
  // Patches fade out with distance, where the coarse far-away grid would alias them into streaks.
  const fade = Math.exp(-(x * x + z * z) / 15000);
  const t = 0.5 + fade * (0.35 * patches(x * 0.12, z * 0.12) + 0.15 * patches(x * 0.6 + 40, z * 0.6));
  return out.lerpColors(DARK, LIGHT, Math.min(1, Math.max(0, t)));
}

function buildMeadow() {
  const ground = new PlaneGeometry(2, 2, GROUND_SEGMENTS, GROUND_SEGMENTS);
  const pos = ground.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  // Spread vertices non-linearly: dense around the tree, coarse toward the far horizon.
  const spread = (u: number) => Math.sign(u) * GROUND_RADIUS * Math.abs(u) ** 3;
  // Plane is rotated -90° around X, so local y maps to world -z.
  for (let i = 0; i < pos.count; i++) {
    const x = spread(pos.getX(i));
    const z = -spread(pos.getY(i));
    pos.setXYZ(i, x, -z, height(x, z));
    groundColor(x, z, c).toArray(colors, i * 3);
  }
  ground.setAttribute('color', new Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();

  // Grass blades: thin three-sided cones, densest near the tree, tinted like the ground below.
  const blade = new ConeGeometry(0.035, 0.45, 3, 1, true);
  blade.translate(0, 0.22, 0);
  // Upward normals light the blades like the ground beneath them instead of as dark spikes.
  blade.setAttribute('normal', new Float32BufferAttribute(Array.from({ length: blade.attributes.position.count }, () => [0, 1, 0]).flat(), 3));
  const grass = new InstancedMesh(blade, new MeshStandardMaterial({ roughness: 0.9 }), GRASS_BLADES);
  const rand = seededRandom(3);
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const e = new Euler();
  const s = new Vector3();
  for (let i = 0; i < GRASS_BLADES; i++) {
    const r = 0.8 + Math.sqrt(rand()) * GRASS_RADIUS;
    const a = rand() * Math.PI * 2;
    p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    p.y = height(p.x, p.z) - 0.02;
    e.set((rand() - 0.5) * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
    const h = (0.6 + rand() * 0.8) * (1 - (r / (GRASS_RADIUS + 0.8)) ** 3); // fade out toward the edge
    grass.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s.set(1, h, 1)));
    grass.setColorAt(i, groundColor(p.x, p.z, c).multiplyScalar(0.75 + rand() * 0.3));
  }
  grass.receiveShadow = true;

  return { ground, grass };
}

export default function Meadow() {
  const { ground, grass } = useMemo(() => buildMeadow(), []);
  return (
    <group>
      <mesh geometry={ground} rotation-x={-Math.PI / 2} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <primitive object={grass} />
    </group>
  );
}
