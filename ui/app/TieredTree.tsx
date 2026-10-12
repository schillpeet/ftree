'use client';

import { useEffect } from 'react';
import { BufferGeometry, Color, DoubleSide, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARD, CARD_GAP, type Point } from './pins';
import { seededRandom } from './random';
import type { PlanOptions, TierPlan } from './tieredLayout';
import { bakeBarkColors, ground, leafGeometry, tube } from './Tree';

// A tiered tree, grown like a pagoda dogwood: one tier of level branches per generation, each card
// hanging under its own twig with nothing but air in front of it. A card plus the leaves on the
// branches below it fit between two tiers, so a card always ends above the tier below.
const TIER_GAP = CARD.height + CARD_GAP + 1.2;
// The lowest tier leaves room for a card above the hilltop.
const LOWEST = CARD.height + 2.5;
// Twig beyond the card that carries the leaves.
const TIP = 1.4;
const ROOTS = 14;
const LEAVES_PER_CLUSTER = 36;
// Each tier reaches further out than the one above, like a pagoda, so it can be seen from above
// (see tieredLayout.ts).
export const TIERED_OPTIONS: PlanOptions = { slot: CARD.width + CARD_GAP, minRadius: 6, widening: 2.5 };

// `plan` comes from `tieredPlan` with TIERED_OPTIONS; angle 0 faces `front`. Returns the bark, the
// leaves and the point each member's card hangs from, all relative to the tree base.
export function buildTieredTree(seed: number, plan: TierPlan[], front: number) {
  const rand = seededRandom(seed);
  const range = (a: number, b: number) => a + rand() * (b - a);
  const tubes: BufferGeometry[] = [];
  const leaves: Matrix4[] = [];
  const leafColors: Color[] = [];
  const at = (r: number, a: number, y: number) => new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

  // Leaves only on top of the twigs, so the space below them where cards hang stays clear.
  function leafCluster(centre: Vector3, spread: number) {
    const q = new Quaternion();
    const e = new Euler();
    for (let i = 0; i < LEAVES_PER_CLUSTER; i++) {
      const p = centre.clone().add(new Vector3(range(-1, 1) * spread, range(0.05, 0.6), range(-1, 1) * spread));
      e.set(range(0.7, 2.6), range(0, Math.PI * 2), range(-0.5, 0.5), 'YXZ');
      const s = range(0.75, 1.25);
      leaves.push(new Matrix4().compose(p, q.setFromEuler(e), new Vector3(s, s, s)));
      leafColors.push(new Color().setHSL(range(0.24, 0.31), range(0.45, 0.7), range(0.22, 0.36)));
    }
  }

  const tierY = (t: number) => LOWEST + (plan.length - 1 - t) * TIER_GAP;
  const top = (plan.length ? tierY(0) : LOWEST) + 2;
  // The trunk thickens with the number of tiers it carries and flares at the base.
  const thick = 0.7 + 0.15 * Math.max(1, plan.length);
  const trunkRadius = (y: number) => thick * (1 + 0.9 * (1 - y / top) ** 3) * (1 - 0.6 * (y / top) ** 2);
  tubes.push(
    tube(
      [0, 0.25, 0.5, 0.75, 1].map((t) => new Vector3(0.15 * Math.sin(t * 5), t * top - 0.5, 0.15 * Math.cos(t * 4))),
      (t) => trunkRadius(t * top),
      24,
      16,
    ),
  );
  // A few strands winding around the trunk, as on the organic tree.
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + range(-0.3, 0.3);
    const twist = Math.PI * range(0.6, 1.2) * (i % 2 ? -1 : 1);
    const end = range(0.4, 0.9) * top;
    const r = range(0.12, 0.3);
    const points = Array.from({ length: 13 }, (_, k) => {
      const y = (k / 12) * end - 0.3;
      return at(trunkRadius(Math.max(0, y)) + r * 0.5, a0 + (k / 12) * twist, y);
    });
    tubes.push(tube(points, (t) => r * (1 + 0.8 * (1 - t) ** 3) * (1 - 0.6 * t), 32, 8));
  }

  // Per family one level branch, leaving the trunk right below the parents. It forks into a twig
  // per unit (a child with their partners), and those into one twig per card.
  const pins = new Map<string, Point>();
  plan.forEach(({ radius, branches }, t) => {
    const y = tierY(t);
    for (const { angle, units } of branches) {
      const middle = front + angle;
      const size = units.reduce((sum, unit) => sum + unit.length, 0);
      const fork = radius * range(0.4, 0.5);
      const split = radius * 0.75;
      const r = 0.16 + 0.05 * Math.min(size, 4);
      const twig = r * 0.6;
      // From inside the trunk the branch rises a little, as limbs of tiered trees do.
      tubes.push(
        tube(
          [at(0, middle, y - 0.6), at(trunkRadius(y) * 0.9, middle, y - 0.2), at(fork * 0.6, middle + range(-0.05, 0.05), y + 0.15), at(fork, middle, y + 0.3)],
          (s) => r * (1.6 - 0.6 * s),
          16,
          8,
        ),
      );
      leafCluster(at(fork * 0.8, middle, y + 0.3), 1.2);
      for (const unit of units) {
        const centre = front + (unit[0].angle + unit[unit.length - 1].angle) / 2;
        tubes.push(
          tube([at(fork, middle, y + 0.3), at((fork + split) / 2, (middle + centre) / 2, y + 0.3), at(split, centre, y + 0.25)], (s) => r * (1 - 0.3 * s), 12, 6),
        );
        leafCluster(at(split, centre, y + 0.25), 0.8);
        for (const card of unit) {
          const a = front + card.angle;
          const sag = range(-0.1, 0.1);
          // The card hangs where the twig passes its radius; beyond, the twig droops a little.
          const pin = at(radius, a, y + sag);
          tubes.push(
            tube([at(split, centre, y + 0.25), at((split + radius) / 2, (centre + a) / 2, y + 0.15 + sag / 2), pin, at(radius + TIP, a, y + sag - 0.25)], (s) => twig * (1 - 0.6 * s), 12, 6),
          );
          leafCluster(at(radius + TIP * 0.8, a, y + sag - 0.2), 0.9);
          pins.set(card.id, [pin.x, pin.y - twig, pin.z]);
        }
      }
    }
  });

  // A small leafy crown above the top tier, where no card hangs.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + range(-0.4, 0.4);
    const end = at(range(1.5, 3), a, top + range(1.5, 3));
    tubes.push(tube([at(0, a, top - 1), at(0.6, a, top), end], (s) => 0.25 * (1 - 0.6 * s), 10, 6));
    leafCluster(end, 1);
  }

  // Roots creep over the hill, half buried.
  for (let i = 0; i < ROOTS; i++) {
    let heading = (i / ROOTS) * Math.PI * 2 + range(-0.15, 0.15);
    const r = range(0.15, 0.5);
    const len = 4 + r * range(10, 16);
    const steps = Math.max(3, Math.round(len / 1.2));
    const p = new Vector3(Math.cos(heading) * thick, 0.4 + r * 3, Math.sin(heading) * thick);
    const points = [p.clone()];
    for (let k = 1; k <= steps; k++) {
      heading += range(-0.45, 0.45);
      p.x += Math.cos(heading) * (len / steps);
      p.z += Math.sin(heading) * (len / steps);
      p.y = ground(p.x, p.z) + r * (1 - k / steps) * 0.3;
      points.push(p.clone());
    }
    tubes.push(tube(points, (t) => r * (1 - 0.85 * t), steps * 4, 6));
  }

  const bark = mergeGeometries(tubes);
  tubes.forEach((g) => g.dispose());
  bakeBarkColors(bark);
  const leafMesh = new InstancedMesh(leafGeometry(), new MeshStandardMaterial({ side: DoubleSide, roughness: 0.55 }), leaves.length);
  leaves.forEach((m, i) => {
    leafMesh.setMatrixAt(i, m);
    leafMesh.setColorAt(i, leafColors[i]);
  });
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  return { bark, leafMesh, pins };
}

export default function TieredTree({ tree: { bark, leafMesh }, position }: { tree: ReturnType<typeof buildTieredTree>; position: Point }) {
  // The tree is rebuilt whenever the tiers change; free the old one.
  useEffect(
    () => () => {
      bark.dispose();
      leafMesh.geometry.dispose();
      (leafMesh.material as MeshStandardMaterial).dispose();
    },
    [bark, leafMesh],
  );
  return (
    <group position={position}>
      <mesh geometry={bark} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <primitive object={leafMesh} />
    </group>
  );
}
