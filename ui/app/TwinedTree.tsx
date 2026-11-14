'use client';

import { useEffect } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARD, CARD_GAP, type Point } from './pins';
import { tube } from './Tree';
import type { Braid, TwinedPlan } from './twinedLayout';

// The twined tiered tree, kept plain for now: every strand is a tube, a couple's strands wind around
// each other from the ground up to their tier, where they bend out and carry their cards. A card
// plus some air fits between two tiers, so a card always ends above the tier below.
const TIER_GAP = CARD.height + CARD_GAP + 1.2;
// The lowest tier leaves room for a card above the hilltop.
const LOWEST = CARD.height + 2.5;
// Cards hang this far from the trunk axis, further out if a tier is crowded.
const CARD_RADIUS = 6;
// A braid's axis at the ground lies this far out per unit of the plan's offset.
const OFFSET_SCALE = 0.7;
// Distance of a strand from its braid's axis, and one full turn per this height.
const BRAID_RADIUS = 0.34;
const TURN = TIER_GAP * 0.9;
const STRAND = 0.22;
const TWIG = 0.11;
// Where a strand stops winding and turns out towards its card, below its tier.
const BEND = 1.6;
// Twig beyond the card.
const TIP = 0.9;
const BARK = new Color('#8a6a48');
const TWIG_BARK = new Color('#a58a6a');

// The angle one card needs at the card radius; the plan shrinks it for big families.
export const TWINED_SLOT_ANGLE = 2 * Math.asin((CARD.width + CARD_GAP) / (2 * CARD_RADIUS));

function paint(g: BufferGeometry, color: Color) {
  const n = g.attributes.position.count;
  g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n }, () => [color.r, color.g, color.b]).flat(), 3));
  return g;
}

// `plan` comes from `twinedPlan` with TWINED_SLOT_ANGLE; angle 0 faces `front`. Returns the bark and
// the point each member's card hangs from, relative to the tree base.
export function buildTwinedTree(plan: TwinedPlan, front: number) {
  const tubes: BufferGeometry[] = [];
  const pins = new Map<string, Point>();
  const at = (r: number, a: number, y: number) => new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  const tierY = (t: number) => LOWEST + (plan.depth - 1 - t) * TIER_GAP;

  // Narrowest gap between two cards on one tier: crowded tiers push every card further out.
  let gap = TWINED_SLOT_ANGLE;
  for (let t = 0; t < plan.depth; t++) {
    const row = plan.cards.filter((c) => c.tier === t).map((c) => c.angle).sort((a, b) => a - b);
    for (let i = 1; i < row.length; i++) gap = Math.min(gap, row[i] - row[i - 1]);
  }
  const radius = Math.max(CARD_RADIUS, (CARD.width + CARD_GAP) / (2 * Math.sin(Math.max(gap, 0.01) / 2)));
  const cardAngle = new Map(plan.cards.map((c) => [c.id, front + c.angle]));

  // A braid's axis starts `offset` out towards where it leaves the trunk and leans in as it rises,
  // so all braids form one trunk that thins as the younger ones end.
  const axis = (b: Braid, y: number) => {
    const s = Math.min(1, Math.max(0, y / tierY(b.tier)));
    return at(b.offset * OFFSET_SCALE * (1 - 0.5 * s), front + b.angle, y);
  };

  for (const braid of plan.braids) {
    const top = tierY(braid.tier);
    const n = braid.ids.length;
    // Older braids wind one way, younger ones the other, so neighbours do not melt into one.
    const spin = braid.tier % 2 ? -1 : 1;
    braid.ids.forEach((id, i) => {
      const a = cardAngle.get(id)!;
      const wind = n > 1 ? BRAID_RADIUS : 0.06;
      const points: Vector3[] = [];
      const end = top - BEND;
      const steps = Math.max(4, Math.ceil((end + 0.4) / 0.3));
      for (let k = 0; k <= steps; k++) {
        const y = -0.4 + (k / steps) * (end + 0.4);
        const turn = (2 * Math.PI * i) / n + spin * (y / TURN) * 2 * Math.PI;
        points.push(axis(braid, y).add(new Vector3(Math.cos(turn) * wind, 0, Math.sin(turn) * wind)));
      }
      // Out of the trunk towards the card: rising first, then level, drooping beyond the card.
      const pin = at(radius, a, top);
      points.push(at(1.2, a, top - BEND * 0.35), at(radius * 0.55, a, top + 0.15), pin, at(radius + TIP, a, top - 0.3));
      const flare = (t: number) => STRAND * (1 + 1.6 * Math.max(0, 1 - t * 14) ** 2) * (1 - 0.3 * t);
      const shade = BARK.clone().offsetHSL(0, 0, (i % 2 ? -0.06 : 0.06) + 0.02 * braid.tier);
      tubes.push(paint(tube(points, flare, points.length * 3, 8), shade));
      pins.set(id, [pin.x, pin.y - STRAND, pin.z]);
    });
  }

  // Twigs grow out of their parents' braid, a little below their tier.
  const braidOf = new Map(plan.braids.map((b) => [b.ids.join('\n'), b]));
  for (const twig of plan.twigs) {
    const parents = braidOf.get(twig.from.join('\n'));
    if (!parents) continue;
    const y = tierY(twig.tier);
    const a = front + twig.angle;
    const pin = at(radius, a, y);
    const start = axis(parents, y - 0.8);
    const points = [start, start.clone().lerp(at(1, a, y - 0.3), 0.7), at(radius * 0.5, a, y + 0.05), pin, at(radius + TIP, a, y - 0.3)];
    tubes.push(paint(tube(points, (t) => TWIG * (1.5 - 0.7 * t), 24, 6), TWIG_BARK));
    pins.set(twig.id, [pin.x, pin.y - TWIG, pin.z]);
  }

  const bark = tubes.length ? mergeGeometries(tubes) : new BufferGeometry();
  tubes.forEach((g) => g.dispose());
  return { bark, pins };
}

export default function TwinedTree({ tree: { bark }, position }: { tree: ReturnType<typeof buildTwinedTree>; position: Point }) {
  // The tree is rebuilt whenever the family changes; free the old one.
  useEffect(() => () => bark.dispose(), [bark]);
  return (
    <group position={position}>
      <mesh geometry={bark} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
    </group>
  );
}
