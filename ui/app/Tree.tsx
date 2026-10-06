'use client';

import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { height } from './Meadow';
import type { Point } from './pins';
import { makeNoise, seededRandom } from './random';

const TRUNK_HEIGHT = 7;
const THICK_STEMS = 6;
const THIN_STRANDS = 40;
const AERIAL_ROOTS = 10;
const ROOTS = 24;
const BRANCH_DEPTH = 5;
const LEAVES_PER_TIP = 24;

// Light beige bark with darker mottling and scattered spots, as on the reference photos.
// Kept pale and low in saturation so it still reads as beige under the orange sunset light.
const BARK_LIGHT = new Color('#e2d7bf');
const BARK_DARK = new Color('#ab9b7e');
const BARK_SPOT = new Color('#86765c');

// Ground height in tree-local coordinates (the tree stands at the hilltop, height(0, 0)).
const ground = (x: number, z: number) => height(x, z) - height(0, 0);

// Tube along a smooth curve whose radius varies with t ∈ [0, 1].
function tube(points: Vector3[], radius: (t: number) => number, segments = 16, radial = 7) {
  const curve = new CatmullRomCurve3(points);
  const g = new TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.attributes.position;
  const c = new Vector3();
  const v = new Vector3();
  // TubeGeometry lays out rings of (radial + 1) vertices around curve.getPointAt(i / segments).
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const r = radius(i / segments);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return g;
}

// Bodhi leaf: heart-shaped base with a long drawn-out tip, petiole at origin, tip along +y.
function leafGeometry() {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-0.35, -0.15, -0.65, 0.3, -0.45, 0.65);
  s.bezierCurveTo(-0.3, 0.95, -0.06, 1.1, 0, 1.75);
  s.bezierCurveTo(0.06, 1.1, 0.3, 0.95, 0.45, 0.65);
  s.bezierCurveTo(0.65, 0.3, 0.35, -0.15, 0, 0);
  const g = new ShapeGeometry(s, 4);
  g.translate(0, 0.15, 0); // short gap as petiole
  g.scale(0.26, 0.26, 0.26);
  return g;
}

export function buildTree(seed: number) {
  const rand = seededRandom(seed);
  const range = (a: number, b: number) => a + rand() * (b - a);
  const canopyTubes: BufferGeometry[] = [];
  const groundTubes: BufferGeometry[] = [];
  const leaves: Matrix4[] = [];
  const leafColors: Color[] = [];
  // Points along the main limbs where aerial roots can hang down to the ground.
  const rootAnchors: Vector3[] = [];
  // Points along the outer branches where member cards can be pinned (see pins.ts).
  const pinCandidates: Point[] = [];

  const randomDir = () => new Vector3(range(-1, 1), range(-1, 1), range(-1, 1)).normalize();
  const turn = (d: Vector3, angle: number) => d.clone().applyAxisAngle(randomDir().cross(d).normalize(), angle);

  function leafCluster(at: Vector3, dir: Vector3) {
    const q = new Quaternion();
    const e = new Euler();
    for (let i = 0; i < LEAVES_PER_TIP; i++) {
      const p = at.clone().addScaledVector(dir, range(-0.8, 0.5)).addScaledVector(randomDir(), range(0.1, 1));
      // Leaves droop on long petioles: tilt the tip sideways or downward, random heading.
      e.set(range(0.7, 2.6), range(0, Math.PI * 2), range(-0.5, 0.5), 'YXZ');
      const s = range(0.75, 1.25);
      leaves.push(new Matrix4().compose(p, q.setFromEuler(e), new Vector3(s, s, s)));
      leafColors.push(new Color().setHSL(range(0.24, 0.31), range(0.45, 0.7), range(0.22, 0.36)));
    }
  }

  // A curved branch that leaves `start` along the parent's tangent `inDir` and only then bends
  // toward `dir`, so forks flow into each other instead of kinking.
  function branch(start: Vector3, inDir: Vector3, dir: Vector3, length: number, r: number, depth: number) {
    // Inner, thicker branches climb; outer twigs spread toward the horizontal: a broad dome.
    const rise = 0.05 + 0.09 * depth;
    const points = [start.clone()];
    const p = start.clone().addScaledVector(inDir, length * 0.15);
    points.push(p.clone());
    const d = inDir.clone();
    for (let k = 0; k < 3; k++) {
      d.lerp(dir, 0.55).addScaledVector(randomDir(), 0.15);
      d.y += (rise - d.y) * 0.3;
      d.normalize();
      p.addScaledVector(d, (length * 0.85) / 3);
      points.push(p.clone());
    }
    const rEnd = r * 0.7;
    canopyTubes.push(tube(points, (t) => r + (rEnd - r) * t, 12, r > 0.2 ? 10 : 6));
    if (depth >= BRANCH_DEPTH - 1) rootAnchors.push(points[2], points[4]);
    if (depth <= 3) pinCandidates.push(points[2].toArray(), points[4].toArray());

    if (depth === 0) {
      leafCluster(p, d);
      return;
    }
    // Leader continues the branch at the same radius; side branches start slightly inside the
    // parent so their open tube ends stay hidden.
    branch(p, d, turn(d, range(0.15, 0.35)), length * range(0.7, 0.8), rEnd, depth - 1);
    for (let i = 0; i < 2; i++) {
      const sd = turn(d, range(0.5, 1));
      branch(p.clone().addScaledVector(d, -rEnd), sd, sd, length * range(0.6, 0.75), rEnd * range(0.55, 0.75), depth - 1);
    }
    // Extra shoot from mid-branch, biased upward, keeps the top of the crown full.
    if (depth >= 2 && rand() < 0.6) {
      const mid = points[2];
      const up = turn(d, range(0.4, 0.8)).lerp(new Vector3(0, 1, 0), 0.5).normalize();
      branch(mid, up, up, length * range(0.5, 0.65), r * 0.5, depth - 2);
    }
  }

  // Spiral strand around the trunk axis; returns its top point and tangent.
  function strand(a0: number, twist: number, radiusAt: (t: number) => number, top: number, thickness: (t: number) => number) {
    const points: Vector3[] = [];
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const a = a0 + t * twist;
      const rr = radiusAt(t);
      points.push(new Vector3(Math.cos(a) * rr, t * top - 0.3, Math.sin(a) * rr));
    }
    canopyTubes.push(tube(points, thickness, 32, 10));
    const end = points[n];
    return { end, tangent: end.clone().sub(points[n - 1]).normalize() };
  }

  // Solid core so the trunk is closed: nothing to see through between the strands.
  const coreRadius = (t: number) => 1.1 * (1 + 0.9 * (1 - t) ** 3) * (1 - 0.5 * t ** 3);
  canopyTubes.push(
    tube(
      [0, 0.25, 0.5, 0.75, 1].map((t) => new Vector3(0.15 * Math.sin(t * 5), t * (TRUNK_HEIGHT + 0.5) - 0.5, 0.15 * Math.cos(t * 4))),
      coreRadius,
      24,
      16,
    ),
  );

  // Stems of clearly different thickness: spirals that touch and partly fuse, flaring at the base.
  for (let i = 0; i < THICK_STEMS; i++) {
    const a0 = (i / THICK_STEMS) * Math.PI * 2 + range(-0.3, 0.3);
    const thick = range(0.25, 0.6);
    const center = range(0.7, 1);
    const { end, tangent } = strand(
      a0,
      Math.PI * range(0.6, 1),
      (t) => (center + 1.1 * (1 - t) ** 4 + 0.9 * t * t) * (1 + 0.2 * Math.sin(t * 7 + i * 2)),
      TRUNK_HEIGHT,
      (t) => thick * (1 + 0.9 * (1 - t) ** 3) * (1 - 0.3 * t),
    );
    const out = new Vector3(end.x, 0, end.z).normalize().setY(range(0.6, 1)).normalize();
    branch(end, tangent, out, range(7, 8.5), thick * 0.7, BRANCH_DEPTH);
  }

  // Steep shoots from the middle of the trunk top close the canopy over the centre.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + range(-0.4, 0.4);
    const up = new Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize();
    branch(new Vector3(0, TRUNK_HEIGHT - 0.5, 0), new Vector3(0, 1, 0), up, range(4, 5), 0.3, 3);
  }

  // Many thin strands lying on the core's surface, some winding against the others.
  // Most end part-way up; every fourth reaches the top and becomes a branch.
  for (let i = 0; i < THIN_STRANDS; i++) {
    const reachesTop = i % 4 === 0;
    const top = reachesTop ? TRUNK_HEIGHT : range(2.5, 6.5);
    const thin = range(0.06, 0.24);
    const { end, tangent } = strand(
      range(0, Math.PI * 2),
      Math.PI * range(0.5, 1.5) * (rand() < 0.4 ? -1 : 1),
      (t) => coreRadius((t * top) / TRUNK_HEIGHT) + thin * 0.6 + (reachesTop ? 0.9 * t * t : 0),
      top,
      (t) => thin * (1 + 0.8 * (1 - t) ** 3),
    );
    if (reachesTop) {
      const out = new Vector3(end.x, 0, end.z).normalize().setY(range(1.2, 2)).normalize();
      branch(end, tangent, out, range(3.5, 4.5), thin * 0.8, 3);
    }
  }

  // Aerial roots: thin, nearly vertical strands hanging from the main limbs into the ground.
  const anchors = rootAnchors.filter((p) => Math.hypot(p.x, p.z) > 3 && p.y - ground(p.x, p.z) > 3);
  for (let i = 0; i < AERIAL_ROOTS && anchors.length; i++) {
    const top = anchors[Math.floor(rand() * anchors.length)];
    const bottom = ground(top.x, top.z) - 0.4;
    const sway = randomDir().setY(0).multiplyScalar(0.3);
    const points = [0, 0.33, 0.66, 1].map((t) =>
      new Vector3(top.x, top.y + (bottom - top.y) * t, top.z).addScaledVector(sway, Math.sin(t * Math.PI)),
    );
    const thin = range(0.05, 0.12);
    groundTubes.push(tube(points, (t) => thin * (1 + 1.5 * t ** 4), 16, 6));
  }

  // Roots creep far over the hill, half buried, winding and forking: the tree's footing.
  function root(start: Vector3, heading: number, len: number, thick: number, forks: number) {
    const points = [start.clone()];
    const p = start.clone();
    const steps = Math.max(3, Math.round(len / 1.2));
    for (let k = 1; k <= steps; k++) {
      heading += range(-0.45, 0.45);
      p.x += Math.cos(heading) * (len / steps);
      p.z += Math.sin(heading) * (len / steps);
      p.y = ground(p.x, p.z) + thick * (1 - k / steps) * 0.3;
      points.push(p.clone());
      if (forks > 0 && k >= 2 && k < steps - 1 && rand() < 0.3) {
        forks--;
        root(p, heading + range(0.5, 0.9) * (rand() < 0.5 ? -1 : 1), len * (1 - k / steps) * 0.7, thick * (1 - k / steps) * 0.6, 0);
      }
    }
    groundTubes.push(tube(points, (t) => thick * (1 - 0.85 * t), steps * 4, thick > 0.3 ? 10 : 6));
  }
  for (let i = 0; i < ROOTS; i++) {
    const a = (i / ROOTS) * Math.PI * 2 + range(-0.15, 0.15);
    const thick = range(0.1, 0.55);
    // Thick roots leave the trunk higher up, forming buttresses.
    const start = new Vector3(Math.cos(a) * 1.3, 0.4 + thick * 3, Math.sin(a) * 1.3);
    root(start, a, 4 + thick * range(12, 20), thick, thick > 0.3 ? 2 : 0);
  }

  const canopyBark = mergeGeometries(canopyTubes);
  const groundBark = mergeGeometries(groundTubes);
  canopyTubes.forEach((g) => g.dispose());
  groundTubes.forEach((g) => g.dispose());

  // Mottled bark with occasional darker spots, applied to canopy and grounded root network.
  // Vertex positions are identical to before the split, so the colors stay the same.
  const mottle = makeNoise(4, 4);
  const spots = makeNoise(5, 3);
  const bakeBarkColors = (geometry: BufferGeometry) => {
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      c.lerpColors(BARK_DARK, BARK_LIGHT, clamp01(0.6 + 0.45 * mottle(x * 1.5 + y * 0.9, z * 1.5 - y * 1.2)));
      // Scattered darker spots: only the peaks of a finer noise.
      c.lerp(BARK_SPOT, clamp01((spots(x * 4 + y * 3, z * 4 - y * 2.5) - 0.45) * 3)).toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  };
  bakeBarkColors(canopyBark);
  bakeBarkColors(groundBark);

  const leafMesh = new InstancedMesh(
    leafGeometry(),
    new MeshStandardMaterial({ side: DoubleSide, roughness: 0.55 }),
    leaves.length,
  );
  leaves.forEach((m, i) => {
    leafMesh.setMatrixAt(i, m);
    leafMesh.setColorAt(i, leafColors[i]);
  });
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;

  return { canopyBark, groundBark, leafMesh, pinCandidates };
}

// The scene builds the tree once (`buildTree(7)`) because it also needs the pin candidates.
export default function Tree({
  tree: { canopyBark, groundBark, leafMesh },
  position,
  scale = 1,
}: {
  tree: ReturnType<typeof buildTree>;
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position}>
      {/* Canopy and leaves scale together; the grounded roots stay terrain-following. */}
      <group scale={scale}>
        <mesh geometry={canopyBark} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.9} />
        </mesh>
        <primitive object={leafMesh} />
      </group>
      <mesh geometry={groundBark} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
    </group>
  );
}
