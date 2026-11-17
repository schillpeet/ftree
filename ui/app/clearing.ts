import { makeNoise, seededRandom } from './random.ts';

// The Stufenbaum's clearing (docs/superpowers/specs/2026-11-17-clearing-design.md): its hill and ground, relative to the
// hilltop, where the tree's foot stays, and the ring of forest around it.

// The hill (chosen 2026-11-17, "Zielbild"): a flat dome 2.5 m high that eases out over 35 m.
export const HILL = { height: 2.5, foot: 35 };

// Today's dome under the meadow (`Meadow.tsx`), which the organic tree keeps.
export const DOME = (r: number) => -7 * (1 - Math.exp((-r * r) / 1800));

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// How far the hill has fallen at distance r from the trunk: 0 on top, -height from its foot on.
export const hillAt = (r: number) => -HILL.height * smoothstep(0, HILL.foot, r);

const ripples = makeNoise(1, 4);

// Ground height at world (x, z) relative to the hilltop: the hill, and the meadow's gentle ripple, kept off the hilltop
// so the roots lie on the hill they were shaped for.
export function groundAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const ripple = 0.9 * Math.exp(-(r * r) / 12000) * ripples(x * 0.035, z * 0.035);
  return hillAt(r) + ripple * smoothstep(HILL.foot * 0.5, HILL.foot + 10, r);
}

// The ring's trees grow to this share of the Stufenbaum's top (chosen 2026-11-17).
export const RING_HEIGHT = 0.7;

// The vertical field of view (Scene.tsx, FOV) and how far inside the ring the camera keeps away from the trees.
const HALF_FOV = (25 * Math.PI) / 180;
const CAMERA_MARGIN = 12;
// How far (horizontally) the camera's target may move from the trunk.
const BOX = 3;

// How far the camera has to stand to see a tree `top` metres high whole, looking at its middle.
export const fitDistance = (top: number) => (top / 2 + 3) / Math.tan(HALF_FOV);

// How far back the camera may go, as a multiple of `fitDistance` (chosen 2026-11-17), so zoomed fully out the whole
// tree is in view with room around it.
export const ROOM = 1.6;

// The ring's radius (chosen 2026-11-17: it follows the tree): the camera can back off `ROOM` times the distance at
// which the whole tree fits, and still stays inside the ring.
export const ringRadius = (top: number) => Math.max(60, CAMERA_MARGIN + BOX + ROOM * fitDistance(top));

// How far the camera may move from its target, and how far (horizontally) the target from the trunk.
export const cameraLimit = (radius: number) => ({ maxDistance: radius - CAMERA_MARGIN - BOX, box: BOX });

// The ring (chosen 2026-11-17, "Zielbild"): tall slim conifers, a deep forest of 8 rows from the clearing's edge
// outward, so from far back one sees forest and not bare ground behind it; a tree every 6 m along a row, a few missing.
const SPACING = 6;
const ROWS = 8;
const GAPS = 0.05;
const ROW_GAP = 7;

export type RingTree = { x: number; z: number; height: number; cell: number; flip: boolean; row: number };

// The ring's trees: seeded, so the forest stands still while families change; `cells` silhouettes to pick from.
export function ringTrees(radius: number, top: number, cells = 3): RingTree[] {
  const rand = seededRandom(7);
  const trees: RingTree[] = [];
  for (let row = 0; row < ROWS; row++) {
    const r = radius + row * ROW_GAP;
    const count = Math.floor((2 * Math.PI * r) / SPACING);
    const step = (2 * Math.PI) / count;
    const shift = (row % 2) * step * 0.5;
    for (let i = 0; i < count; i++) {
      // Jitter along the row stays below 15 % of a step on each side, so neighbours keep 70 % of a step apart.
      const a = shift + (i + (rand() - 0.5) * 0.3) * step;
      const out = r + (rand() - 0.5) * 6;
      const height = top * (0.85 + rand() * 0.3);
      const cell = Math.floor(rand() * cells);
      const flip = rand() < 0.5;
      if (rand() < GAPS) continue;
      trees.push({ x: Math.cos(a) * out, z: Math.sin(a) * out, height, cell, flip, row });
    }
  }
  return trees;
}

// The fogExp2 density at which something `distance` metres away is still `clearAt` (0..1) visible.
export function hazeDensity(clearAt: number, distance: number): number {
  return Math.sqrt(-Math.log(clearAt)) / distance;
}

// The clearing's haze (chosen 2026-11-17, "leicht"): a tree 50 m away is 95 % clear.
export const HAZE = hazeDensity(0.95, 50);
// The meadow's haze elsewhere (Scene.tsx, DaySky).
export const MEADOW_HAZE = 0.0016;
