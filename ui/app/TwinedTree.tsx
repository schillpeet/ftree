'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { CARD, CARD_GAP, type Point } from './pins';
import { tube } from './Tree';
import { blendPlans, type GrowingPlan } from './twinedGrowth';
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

// One growth step, in seconds.
export const GROW_SECONDS = 2.5;

// A strand or twig of one member. `along` runs from where it starts (0) to its tip (1), so it can be
// drawn only part of the way while it grows.
export type Piece = { id: string; geometry: BufferGeometry; color: Color };

function piece(id: string, geometry: BufferGeometry, color: Color): Piece {
  const uv = geometry.attributes.uv;
  geometry.setAttribute('along', new Float32BufferAttribute(Array.from({ length: uv.count }, (_, i) => uv.getX(i)), 1));
  return { id, geometry, color };
}

// `plan` comes from `twinedPlan` with TWINED_SLOT_ANGLE (or from `blendPlans` while growing, with a
// fractional depth); angle 0 faces `front`. Returns a piece per strand and twig and the point each
// member's card hangs from, relative to the tree base.
export function buildTwinedTree(plan: TwinedPlan, front: number) {
  const pieces: Piece[] = [];
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
      pieces.push(piece(id, tube(points, flare, points.length * 3, 8), shade));
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
    pieces.push(piece(twig.id, tube(points, (t) => TWIG * (1.5 - 0.7 * t), 24, 6), TWIG_BARK));
    pins.set(twig.id, [pin.x, pin.y - TWIG, pin.z]);
  }

  return { pieces, pins };
}

const EMPTY: TwinedPlan = { depth: 0, braids: [], twigs: [], cards: [] };
const same = (a: TwinedPlan, b: TwinedPlan) => JSON.stringify(a) === JSON.stringify(b);

// Bark that is drawn only up to `grown` along each piece (see `Piece`); the clipped tube stays open.
function growingBark() {
  const material = new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide });
  const grown = { value: 1 };
  material.userData.grown = grown;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrown = grown;
    shader.vertexShader = `attribute float along;\nvarying float vAlong;\n${shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = along;')}`;
    shader.fragmentShader = `uniform float uGrown;\nvarying float vAlong;\n${shader.fragmentShader.replace('void main() {', 'void main() {\nif (vAlong > uGrown) discard;')}`;
  };
  return material;
}

// The tree grows towards `target`: whenever it changes, new strands and twigs grow in, cards glide
// and the tree rises if a tier was added, over GROW_SECONDS. `replay` grows these plans one after
// the other from nothing. Without `animate` it jumps. Card pins are reported when a step has settled,
// so cards move once per step. Remount it (a `key`) to show another family without growing.
export default function TwinedTree({
  target,
  replay,
  animate,
  front,
  position,
  onPins,
  onReplayEnd,
}: {
  target: TwinedPlan;
  replay: TwinedPlan[] | null;
  animate: boolean;
  front: number;
  position: Point;
  onPins: (pins: Map<string, Point>) => void;
  onReplayEnd: () => void;
}) {
  const group = useRef<Group>(null);
  const callbacks = useRef({ onPins, onReplayEnd });
  const state = useRef({
    shown: null as TwinedPlan | null,
    queue: [] as TwinedPlan[],
    step: null as { from: TwinedPlan; to: TwinedPlan; start: number | null } | null,
    replaying: false,
    meshes: new Map<string, Mesh>(),
  });
  useEffect(() => {
    callbacks.current = { onPins, onReplayEnd };
  }, [onPins, onReplayEnd]);

  // Shows `plan`: one mesh per piece, reused by member id, grown as far as the plan says.
  const draw = (plan: TwinedPlan | GrowingPlan) => {
    const { pieces, pins } = buildTwinedTree(plan, front);
    const meshes = state.current.meshes;
    const ids = new Set(pieces.map((p) => p.id));
    for (const [id, mesh] of meshes)
      if (!ids.has(id)) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.removeFromParent();
        meshes.delete(id);
      }
    for (const p of pieces) {
      let mesh = meshes.get(p.id);
      if (!mesh) {
        mesh = new Mesh(p.geometry, growingBark());
        mesh.receiveShadow = true;
        meshes.set(p.id, mesh);
        group.current?.add(mesh);
      } else {
        mesh.geometry.dispose();
        mesh.geometry = p.geometry;
      }
      const material = mesh.material as MeshStandardMaterial;
      material.color.copy(p.color);
      const grown = 'grown' in plan ? (plan.grown.get(p.id) ?? 1) : 1;
      material.userData.grown.value = grown;
      // The depth pass would cast the whole strand; shadows come once it has grown.
      mesh.castShadow = grown >= 1;
    }
    return pins;
  };

  useEffect(() => {
    const s = state.current;
    // Those who prefer less motion see the tree jump.
    const moving = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (s.shown === null || !moving) {
      s.queue = [];
      s.step = null;
      s.replaying = false;
      s.shown = target;
      callbacks.current.onPins(draw(target));
      if (replay) callbacks.current.onReplayEnd();
      return;
    }
    if (replay) {
      s.queue = [...replay];
      s.step = null;
      s.shown = EMPTY;
      s.replaying = true;
      callbacks.current.onPins(draw(EMPTY));
    } else {
      s.replaying = false;
      s.queue = [target];
    }
    // `draw` only depends on `front`, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, replay, animate]);

  useEffect(() => {
    const meshes = state.current.meshes;
    return () => {
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
      }
      meshes.clear();
    };
  }, []);

  useFrame(({ clock }) => {
    const s = state.current;
    while (!s.step && s.queue.length) {
      const to = s.queue.shift()!;
      if (s.shown && !same(to, s.shown)) s.step = { from: s.shown, to, start: null };
    }
    if (!s.step) {
      if (s.replaying) {
        s.replaying = false;
        callbacks.current.onReplayEnd();
      }
      return;
    }
    const step = s.step;
    step.start ??= clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - step.start) / GROW_SECONDS);
    const pins = draw(blendPlans(step.from, step.to, t));
    if (t >= 1) {
      s.shown = step.to;
      s.step = null;
      callbacks.current.onPins(pins);
    }
  });

  return <group ref={group} position={position} />;
}
