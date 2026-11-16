// The shape of the twined tiered tree (direction "Tiers" from the Blender look-dev in
// docs/design/blender): an old tree whose wood only rises. Every strand starts as a root on the hill
// and winds up the trunk with its partner. A couple leaves the trunk on a limb of its own, lower for
// every younger generation: it reaches out low, lets the couple's single children peel off as twigs
// and climbs to the fork that carries the two cards. Wood without cards makes the tree full: strands
// around the eldest couple's leader that leave as crown branches, shoots on the limbs and a fine
// shoot beyond each card. Pure, so `twinedForm.check.mjs` can test it without a scene.
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { CARD, CARD_GAP, type Point } from './pins.ts';
import type { GrowingPlan } from './twinedGrowth';
import type { Braid, TwinedPlan, Twig } from './twinedLayout';

const TIER_GAP = CARD.height + CARD_GAP + 1.2;
// The lowest tier leaves room for a card and a base trunk above the hilltop.
const LOWEST = CARD.height + 10.7;
// The angle one card needs is measured at this radius; limbs reach further (see `radiusOf`).
const CARD_RADIUS = 10;
// A couple leaves the trunk this far below its tier, and this far if single children hang below it:
// then the limb starts under their cards, so their twigs can grow out of it and still rise.
const RISE = 5.2;
const RISE_LOW = 8.9;
// Limbs of one generation do not all leave at the same height.
const STAGGER = 0.8;
// Younger braids stand around the eldest at this distance; a strand winds around its braid's axis
// at WIND times its thickness, one full turn per TURN of length. The whole trunk turns slowly
// (TWIST per unit of height), and a limb leaves a little before the direction it heads for (SWING).
const RING = 1.38;
const WIND = 0.68;
const TURN = 5.5;
const TWIST = (3 * Math.PI) / 180;
const TWIST_AT = 10;
const SWING = 0.4;
// A strand is this thick at the ground and THIN of it where its card hangs. Limbs sway (SWAY) and
// the wood swells and thins a little along its way (KNOTS).
const STRAND = 0.68;
const THIN = 0.46;
const SWAY = 0.4;
const KNOTS = 0.07;
const TWIG = 0.24;
// Below this height a strand is a root: [distance out, height above the ground, thickness].
const FLARE = 2.6;
const ROOT = [[8, -0.9, 0.08], [6.2, -0.25, 0.34], [4.5, 0.1, 0.6], [2.8, 0.4, 0.9], [1.5, 1.0, 1.22], [0.5, 1.85, 1.15]];
// Crown branches: how many, how far from the front they stay (radians), how thick they start and
// how far from the leader's axis they wind up the trunk.
const CROWN = 8;
const CROWN_FREE = 1.25;
const CROWN_THICK = 0.4;
const WRAP = 0.85;
// The base trunk: strands without cards that wind up around the eldest couple's leader from roots of
// their own, so even one person stands on eight roots. How many, how thick, and between which heights
// above the hilltop they leave the trunk.
const BASE_ROOTS = 7;
const BASE_THICK = 0.42;
const BASE_LEAVE = [4.5, 9.5];
// At the ground the base strands stand this many times as far out, so the trunk has a broad foot.
const FOOT = 1.4;
// Every person brings a root that leaves the trunk's foot and creeps far over the hill: thick
// (a few), medium (more) or fine (most), sized to the trunk. Thick roots carry medium ones and medium
// ones fine ones. Per kind: thickness and reach (times the foot's radius), and its round segments.
const ROOT_SIZE = [0.42, 0.22, 0.1];
const ROOT_REACH = [8, 5, 3];
const ROOT_SIDES = [8, 6, 4];
// A person's roots only change when the trunk's foot does, but the tree is rebuilt every frame while it
// grows: keep the last ones per person with the foot they fit.
const rootCache = new Map<string, { footR: number; roots: BufferGeometry }>();
// Likewise every piece keeps its geometry object as long as what it is built from stays the same, so
// while the tree grows only the wood that moves is rebuilt, and the scene re-uploads only that.
const pieceCache = new Map<string, { hash: number; geometry: BufferGeometry }>();
const hashOf = (points: Vector3[], radii: number[], salt: number) => {
  let h = 2166136261 ^ salt;
  const add = (v: number) => {
    h = Math.imul(h ^ Math.round(v * 1e4), 16777619);
  };
  for (const p of points) {
    add(p.x);
    add(p.y);
    add(p.z);
  }
  for (const r of radii) add(r);
  return h;
};
const reuse = (name: string, hash: number, build: () => BufferGeometry) => {
  const cached = pieceCache.get(name);
  if (cached?.hash === hash) return cached.geometry;
  if (pieceCache.size > 5000) pieceCache.clear();
  const geometry = build();
  pieceCache.set(name, { hash, geometry });
  return geometry;
};
// Free wood in (share of its reach, share of its rise): a branch or shoot that rises out at a slant
// (straight up first would read as a horn), and a side shoot.
const SHOOT_SHAPE = [[0, 0], [0.3, 0.5], [0.62, 0.86], [1, 1]];
const SIDE_SHAPE = [[0, 0], [0.35, 0.3], [0.7, 0.7], [1, 1]];
const UP = new Vector3(0, 1, 0);
const FULL = Math.PI * 2;
// The bark texture repeats every 2 * FULL texture units along the wood (see docs/design/blender).
// Bark is tiled in metres: one tile of the baked bark covers TILE_AROUND metres around the wood and
// TILE_ALONG along it, the same in docs/design/blender/tree.py. Every tube gets a whole number of
// tiles around, so there is no seam and plates are about the same size on thick and thin wood.
export const TILE_AROUND = 1.0;
export const TILE_ALONG = 4.0;
// Thick wood gets more sides, so its silhouette is round: about 64 per metre of radius, never fewer
// than the kind's own minimum and never more than 32.
export const sidesFor = (maxRadius: number, min: number) => Math.min(32, Math.max(min, Math.round(maxRadius * 64)));
export const tilesAround = (radii: number[]) => Math.max(1, Math.round((FULL * radii.reduce((a, r) => a + r, 0)) / radii.length / TILE_AROUND));

// The angle one card needs at the card radius; the plan shrinks it for big families.
export const TWINED_SLOT_ANGLE = 2 * Math.asin((CARD.width + CARD_GAP) / (2 * CARD_RADIUS));

// A piece of wood. `along` (a vertex attribute) runs from where it starts (0) to its tip (1), so it
// can be drawn only part of the way while it grows; it grows together with member `follows`.
// `tint` is its brightness. Free wood has an id that starts with "free:".
export type Piece = { id: string; follows: string; geometry: BufferGeometry; tint: number };

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
// The shortest turn from one angle to another.
const turnTo = (from: number, to: number) => ((((to - from) % FULL) + FULL + Math.PI) % FULL) - Math.PI;
// A Bezier curve through any number of control points.
const bezier = (p: number[][], t: number): number[] => {
  let q = p;
  while (q.length > 1) q = q.slice(1).map((b, i) => [mix(q[i][0], b[0], t), mix(q[i][1], b[1], t)]);
  return q[0];
};
// The eldest couple's fork in (distance from the axis, height): up the trunk first, then out.
const bough = (r: number, y: number, out: number, up: number) => [[r, y], [r + 0.05 * out, y + 0.7 * up], [r + 0.55 * out, y + 1.02 * up], [r + out, y + up]];
// A limb: an elbow out of the trunk, a long low reach, then the climb to the fork.
const limbOf = (r: number, y: number, out: number, up: number) => [[r, y], [r, y + 1.8], [r + 0.45 * out, y + 0.9], [r + 0.72 * out, y + 0.72 * up], [r + out, y + up]];
// The meadow's hill around the tree, relative to the hilltop.
const ground = (r: number) => -7 * (1 - Math.exp((-r * r) / 1800));
const key = (ids: string[]) => ids.join('\n');

// Chance that only depends on a name (mulberry32 seeded with an FNV-1a hash), so a piece keeps its
// shape when the family around it changes. The Blender script uses the same generator.
export function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two normals per point that do not spin around the line (parallel transport).
function frames(points: Vector3[]) {
  const out: [Vector3, Vector3][] = [];
  const tangent = new Vector3();
  const before = new Vector3();
  const normal = new Vector3(1, 0, 0);
  const q = new Quaternion();
  points.forEach((_, i) => {
    tangent.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
    if (i) normal.applyQuaternion(q.setFromUnitVectors(before, tangent));
    else if (Math.abs(tangent.x) > 0.9) normal.set(0, 1, 0);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    out.push([normal.clone(), new Vector3().crossVectors(tangent, normal)]);
    before.copy(tangent);
  });
  return out;
}

// A round tube through `points` with a radius per point and at least `radial` sides (see `sidesFor`).
// uv.x counts bark tiles along its length, uv.y a whole number of tiles around (`tilesAround`); the
// tangent runs along the wood (+U) with w = -1, so three's bitangent runs around it (+V); `along` runs from 0 to 1, or across `span`.
// Every piece starts somewhere else in the bark (`name`), so no two show the same patches.
// `along` counts from point `origin` both ways, so a strand's root grows out while its wood grows up.
type Tube = { name: string; points: Vector3[]; radii: number[]; radial: number; origin?: number; span?: [number, number] };

// Several tubes in one geometry, written straight into one set of buffers: the tree is rebuilt every
// frame while it grows, so this avoids merging and short-lived arrays.
function sweepAll(tubes: Tube[]) {
  let vertices = 0;
  let indices = 0;
  const sides = tubes.map((t) => sidesFor(Math.max(...t.radii), t.radial));
  tubes.forEach((t, k) => {
    vertices += t.points.length * (sides[k] + 1);
    indices += (t.points.length - 1) * sides[k] * 6;
  });
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const along = new Float32Array(vertices);
  const tangent = new Float32Array(vertices * 4);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  const v = new Vector3();
  const axis = new Vector3();
  let v0 = 0;
  let i0 = 0;
  tubes.forEach(({ name, points, radii, origin = 0, span = [0, 1] }, t) => {
    const radial = sides[t];
    const around = tilesAround(radii);
    const n = points.length;
    const ring = radial + 1;
    const length = [0];
    for (let i = 1; i < n; i++) length.push(length[i - 1] + points[i].distanceTo(points[i - 1]));
    const reach = Math.max(length[origin], length[n - 1] - length[origin]);
    const frame = frames(points);
    const chance = seeded(`bark${name}`);
    const shift = [chance(), chance()];
    for (let i = 0; i < n; i++) {
      const grow = mix(span[0], span[1], Math.abs(length[i] - length[origin]) / reach);
      // The frame's two vectors are at right angles to the wood, so their cross product runs along it.
      axis.crossVectors(frame[i][0], frame[i][1]).normalize();
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * FULL;
        const k = v0 + i * ring + j;
        v.copy(frame[i][0]).multiplyScalar(Math.cos(a)).addScaledVector(frame[i][1], Math.sin(a));
        normal[k * 3] = v.x;
        normal[k * 3 + 1] = v.y;
        normal[k * 3 + 2] = v.z;
        position[k * 3] = points[i].x + v.x * radii[i];
        position[k * 3 + 1] = points[i].y + v.y * radii[i];
        position[k * 3 + 2] = points[i].z + v.z * radii[i];
        uv[k * 2] = shift[0] + length[i] / TILE_ALONG;
        uv[k * 2 + 1] = shift[1] + (j / radial) * around;
        along[k] = grow;
        tangent[k * 4] = axis.x;
        tangent[k * 4 + 1] = axis.y;
        tangent[k * 4 + 2] = axis.z;
        tangent[k * 4 + 3] = -1;
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < radial; j++) {
        const a = v0 + i * ring + j;
        index[i0++] = a;
        index[i0++] = a + 1;
        index[i0++] = a + ring;
        index[i0++] = a + ring;
        index[i0++] = a + 1;
        index[i0++] = a + ring + 1;
      }
    v0 += n * ring;
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('along', new Float32BufferAttribute(along, 1));
  g.setAttribute('tangent', new Float32BufferAttribute(tangent, 4));
  g.setIndex(new BufferAttribute(index, 1));
  return g;
}
const sweep = (name: string, points: Vector3[], radii: number[], radial: number, origin = 0) => sweepAll([{ name, points, radii, radial, origin }]);

// `plan` comes from `twinedPlan` with TWINED_SLOT_ANGLE (or from `blendPlans` while growing, with a
// fractional depth); angle 0 faces `front`. `name` (the family's id) shapes the base trunk, so it
// stays as it is whoever joins. Returns a piece per strand, twig and free branch and the
// point each member's card hangs from, relative to the tree base.
export function buildTwinedTree(plan: TwinedPlan | GrowingPlan, front: number, name = '') {
  const pieces: Piece[] = [];
  const pins = new Map<string, Point>();
  const at = (r: number, a: number, y: number) => new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  const tierY = (t: number) => LOWEST + (plan.depth - 1 - t) * TIER_GAP;
  const cardAngle = new Map(plan.cards.map((c) => [c.id, c.angle]));
  const grown = 'grown' in plan ? plan.grown : null;
  const grownOf = (id: string) => grown?.get(id) ?? 1;
  // A root out over the hill and into the ground, a little wavy, `reach` times as long as usual: its
  // points from the tip to the foot of `wood` (whose first three points it bends into) and their thickness.
  const rootOf = (wood: Vector3[], size: number, wave: number, reach = 1) => {
    const r0 = Math.hypot(wood[0].x, wood[0].z);
    const footAngle = Math.atan2(wood[0].z, wood[0].x);
    const curve = new CatmullRomCurve3([
      ...ROOT.map(([out, lift]) => at(r0 + reach * out, footAngle + 0.1 * Math.sin(out * 0.8 + wave) * smooth(out / 2), ground(r0 + reach * out) + lift)),
      wood[0],
      wood[2],
    ]);
    const root: Vector3[] = [];
    const thick: number[] = [];
    for (let k = 0; k < ROOT.length * 4; k++) {
      const u = k / 4;
      root.push(curve.getPoint(u / (ROOT.length + 1)));
      const next = u + 1 < ROOT.length ? ROOT[Math.floor(u) + 1][2] : 1;
      thick.push(size * mix(ROOT[Math.floor(u)][2], next, u % 1));
    }
    return { root, thick };
  };
  // Wood ends in a fan of three fine twigs reaching out, not in a single point: one geometry with
  // the wood itself. The wood grows in the first 85 % of the time, the twigs from where the wood
  // reaches its tip to the end.
  const tipped = (name: string, points: Vector3[], radii: number[], radial: number, origin = 0) =>
    reuse(name, hashOf(points, radii, radial * 7919 + origin * 31), () => {
    const n = points.length;
    let before = 0;
    let after = 0;
    for (let i = 1; i < n; i++) {
      const d = points[i].distanceTo(points[i - 1]);
      if (i <= origin) before += d;
      else after += d;
    }
    const reached = (0.85 * after) / Math.max(before, after);
    const tip = points[n - 1];
    const way = tip.clone().sub(points[Math.max(0, n - 3)]).setY(0);
    if (way.lengthSq() < 1e-6) way.set(Math.cos(front), 0, Math.sin(front));
    way.normalize();
    const r = radii[n - 1];
    const length = Math.min(1.6, Math.max(0.4, 12 * r));
    const chance = seeded(`fan${name}`);
    const fans = [-0.6, 0, 0.6].map((turn, f): Tube => {
      const dir = way.clone().applyAxisAngle(UP, turn + 0.4 * (chance() - 0.5));
      const lift = mix(-0.15, 0.3, chance());
      const twig: Vector3[] = [];
      const thin: number[] = [];
      for (let k = 0; k <= 3; k++) {
        twig.push(tip.clone().addScaledVector(dir, length * (k / 3)).setY(tip.y + length * lift * (k / 3) ** 1.5));
        thin.push(r * mix(0.8, 0.2, k / 3));
      }
      return { name: `${name}.fan${f}`, points: twig, radii: thin, radial: 3, span: [reached, 1] };
    });
    return sweepAll([{ name, points, radii, radial, origin, span: [0, 0.85] }, ...fans]);
  });
  // How far the limbs of a tier reach: a dome, widest a little below the middle of the tree and
  // wider for deeper families; a crowded tier pushes its cards further out.
  const widest = 13.4 + 0.75 * (Math.min(plan.depth, 4) - 1);
  const radii = new Map<number, number>();
  const radiusOf = (tier: number) => {
    if (!radii.has(tier)) {
      const row = plan.cards.filter((c) => c.tier === tier).map((c) => c.angle).sort((a, b) => a - b);
      let gap = TWINED_SLOT_ANGLE;
      for (let i = 1; i < row.length; i++) gap = Math.min(gap, row[i] - row[i - 1]);
      const crowded = (CARD.width + CARD_GAP) / (2 * Math.sin(Math.max(gap, 0.01) / 2));
      const height = plan.depth > 1 ? Math.max(-0.5, (plan.depth - 1 - tier) / (plan.depth - 1)) : 1;
      radii.set(tier, Math.max(crowded, widest * (1 - 1.26 * (height - 0.36) ** 2)));
    }
    return radii.get(tier)!;
  };

  // Where a braid leaves the trunk. A couple with twigs sinks to the low start while its first twig grows.
  const twigsOf = new Map<string, Twig[]>();
  for (const t of plan.twigs) twigsOf.set(key(t.from), [...(twigsOf.get(key(t.from)) ?? []), t]);
  const eldest = (b: Braid) => b.offset <= 0;
  const leaveOf = (b: Braid) => {
    if (eldest(b)) return tierY(b.tier) - RISE;
    const low = Math.max(0, ...(twigsOf.get(key(b.ids)) ?? []).map((t) => grownOf(t.id)));
    return Math.max(FLARE + 1.5, tierY(b.tier) - mix(RISE, RISE_LOW, low) - STAGGER * seeded(b.ids[0])());
  };

  // Where each younger braid stands around the eldest: evenly spaced, in the order in which they
  // leave, turned so that each stands close to where it leaves. While a new braid grows in, the
  // others glide from their old places to the new ones.
  const places = (braids: Braid[]) => {
    const outer = braids.filter((b) => !eldest(b)).map((b) => ({ b, want: b.angle - SWING - TWIST * (leaveOf(b) - TWIST_AT) }));
    outer.sort((x, y) => x.want - y.want);
    const n = outer.length;
    const off = Math.atan2(
      outer.reduce((s, o, k) => s + Math.sin(o.want - (k * FULL) / n), 0),
      outer.reduce((s, o, k) => s + Math.cos(o.want - (k * FULL) / n), 0),
    );
    return new Map(outer.map((o, k) => [o.b, off + (k * FULL) / n]));
  };
  const settled = grown ? plan.braids.filter((b) => b.ids.some((id) => (grown.get(id) ?? 1) >= 1)) : plan.braids;
  const arrived = grown ? Math.min(1, ...grown.values()) : 1;
  const now = places(plan.braids);
  const before = settled.length < plan.braids.length ? places(settled) : now;
  const ring = Math.max(RING, (mix(before.size, now.size, arrived) * 1.9) / FULL);
  // The foot: younger braids stand around the eldest's axis, the base strands wind around them.
  const around = WRAP + Math.max(0, ...plan.braids.filter((b) => !eldest(b)).map((b) => ring * smooth(b.offset / 0.5)));
  const footR = around + STRAND;

  // A person's roots: one leaves the foot a little above the hill, bends down onto it and creeps far
  // out, its tip sinking in; side roots peel off it and grow once it has reached them. Kind, direction
  // and shape only depend on the person, the size on the trunk, so roots thicken as the tree grows.
  const rootsOf = (id: string) => {
    const cached = rootCache.get(id);
    // A trunk that thickens a little keeps its roots; they follow once it is 6 % thicker or thinner.
    if (cached && Math.abs(cached.footR - footR) < 0.06 * footR) return cached.roots;
    const chance = seeded(`${id}|roots`);
    const pick = chance();
    const roots: Tube[] = [];
    const creep = (name: string, kind: number, a: number, turn: number, r0: number, rise: number, from: number) => {
      const size = ROOT_SIZE[kind] * Math.sqrt(footR) * mix(0.8, 1.2, chance());
      const length = ROOT_REACH[kind] * footR ** 0.8 * mix(0.75, 1.25, chance());
      const wave = chance() * FULL;
      const steps = 18;
      const angleAt = (s: number) => a + turn * smooth(s / 0.5) + 0.18 * s * Math.sin(wave + 2.2 * s);
      const points: Vector3[] = [];
      const thick: number[] = [];
      for (let k = 0; k <= steps; k++) {
        const s = k / steps;
        const r = r0 + length * s;
        const w = size * mix(1, 0.08, s ** 0.7);
        points.push(at(r, angleAt(s), ground(r) + rise * (1 - smooth(s / 0.18)) + (0.3 * w + 0.12) * (1 - smooth((s - 0.8) / 0.2)) - 0.6 * w * smooth((s - 0.85) / 0.15)));
        thick.push(w);
      }
      roots.push({ name, points, radii: thick, radial: ROOT_SIDES[kind], span: [from, 1] });
      const sides = kind < 2 ? 3 - kind : 0;
      for (let j = 0; j < sides; j++) {
        const s = mix(0.2, 0.65, (j + chance()) / sides);
        creep(`${name}.${j}`, kind + 1, angleAt(s), (j % 2 ? 1 : -1) * mix(0.35, 0.8, chance()), r0 + length * s, 0, mix(from, 1, s));
      }
    };
    creep(`${id}.root`, pick < 0.18 ? 0 : pick < 0.55 ? 1 : 2, chance() * FULL, 0, 0.55 * footR, 0.6 + 1.5 * ROOT_SIZE[0] * Math.sqrt(footR), 0);
    const merged = sweepAll(roots);
    rootCache.set(id, { footR, roots: merged });
    return merged;
  };

  // A braid's axis up the trunk and along its limb; `along` is -1 in the trunk and 0 to 1 on the limb.
  type Limb = { axis: Vector3[]; along: number[]; run: number[]; axisAt: (y: number) => Vector3 };
  const limbs = new Map<string, Limb>();
  // Where a strand's card hangs: the strand up to there, for the shoot that runs on.
  const ends: { id: string; tier: number; points: Vector3[]; angle: number }[] = [];
  plan.braids.forEach((braid, index) => {
    const top = tierY(braid.tier);
    const first = eldest(braid);
    const leave = leaveOf(braid);
    const reachHere = radiusOf(braid.tier);
    const to = now.get(braid) ?? braid.angle;
    const old = before.get(braid);
    const home = old === undefined ? to : old + turnTo(old, to) * arrived;
    const rho = first ? 0 : ring * smooth(braid.offset / 0.5);
    const axisAt = (y: number) => at(rho, front + home + TWIST * (y - TWIST_AT), y);

    const axis: Vector3[] = [];
    const along: number[] = [];
    for (let y = FLARE; y < leave - 1e-6; y += 0.3) {
      axis.push(axisAt(y));
      along.push(-1);
    }
    const a0 = home + TWIST * (leave - TWIST_AT);
    const curve = (first ? bough : limbOf)(rho, leave, reachHere - rho, top - leave);
    const steps = first ? 24 : 40;
    const limb: Vector3[] = [];
    for (let k = 0; k <= steps; k++) {
      const [r, y] = bezier(curve, k / steps);
      limb.push(at(r, front + a0 + turnTo(a0, braid.angle) * smooth(k / steps / (first ? 0.6 : 0.75)), y));
    }
    if (!first) {
      // The limb sways a little, not at the trunk and not at the cards.
      const side = frames(limb);
      const chance = seeded(`sway${braid.ids[0]}`);
      const phase = [chance() * FULL, chance() * FULL];
      let far = 0;
      const moved = limb.map((p, k) => {
        if (k) far += p.distanceTo(limb[k - 1]);
        const s = k / steps;
        const sway = SWAY * smooth(s / 0.3) * smooth((1 - s) / 0.25);
        return p.clone().addScaledVector(side[k][0], sway * Math.sin(0.8 * far + phase[0])).addScaledVector(side[k][1], sway * Math.sin(1.25 * far + phase[1]));
      });
      limb.splice(0, limb.length, ...moved);
    }
    limb.forEach((p, k) => {
      axis.push(p);
      along.push(k / steps);
    });
    const frame = frames(axis);
    const run = [FLARE];
    for (let k = 1; k < axis.length; k++) run.push(run[k - 1] + axis[k].distanceTo(axis[k - 1]));
    const total = run[run.length - 1] - FLARE;
    limbs.set(key(braid.ids), { axis, along, run, axisAt });

    const n = braid.ids.length;
    // Partners wind around each other up the trunk and for the first part of the limb, then part.
    const fork = first ? 0.3 : 0.55;
    const forkOver = first ? 0.35 : 0.3;
    braid.ids.forEach((id, i) => {
      const a = cardAngle.get(id)!;
      const apart = turnTo(braid.angle, a);
      const knot = seeded(`knot${id}`)() * FULL;
      const points: Vector3[] = [];
      const thick: number[] = [];
      axis.forEach((p, k) => {
        const t = along[k];
        const swell = 1 + KNOTS * (0.6 * Math.sin(1.7 * run[k] + knot) + 0.4 * Math.sin(4.1 * run[k] + 2 * knot));
        const size = STRAND * mix(1, THIN, ((run[k] - FLARE) / total) ** 1.15) * swell;
        const turn = (FULL * i) / n + (FULL * run[k]) / TURN;
        const wind = (n > 1 ? WIND : WIND * 0.15) * size * (t < 0 ? 1 : 1 - smooth((t - fork) / forkOver));
        const point = p.clone().addScaledVector(frame[k][0], wind * Math.cos(turn)).addScaledVector(frame[k][1], wind * Math.sin(turn));
        if (t > fork) point.applyAxisAngle(UP, -apart * smooth((t - fork) / (1 - fork)));
        points.push(point);
        thick.push(size);
      });
      const end = thick[thick.length - 1];
      ends.push({ id, tier: braid.tier, points: points.slice(-6), angle: front + a });
      // Beyond the card the strand runs out a little further, barely rising, into its fan.
      for (let k = 1; k <= 8; k++) {
        points.push(at(reachHere + 2.4 * (k / 8), front + a, top + 0.5 * (k / 8) ** 1.7));
        thick.push(end * mix(0.9, 0.3, k / 8));
      }
      const root = rootOf(points, thick[0], index * 2.4 + i);
      pieces.push({ id, follows: id, geometry: tipped(id, [...root.root, ...points], [...root.thick, ...thick], 9, root.root.length), tint: 1 + (i % 2 ? -0.07 : 0.07) + 0.02 * braid.tier });
      pieces.push({ id: `free:roots:${id}`, follows: id, geometry: rootsOf(id), tint: 1 });
      const pin = at(reachHere, front + a, top);
      pins.set(id, [pin.x, pin.y - end, pin.z]);
    });
  });

  // Twigs start inside their parents' braid and follow it for a moment. Out of the eldest couple's
  // leader a twig sweeps up and out; out of a limb it peels off the low part and reaches out below
  // the parents' cards.
  for (const twig of plan.twigs) {
    const parent = plan.braids.find((b) => key(b.ids) === key(twig.from));
    const limb = limbs.get(key(twig.from));
    if (!parent || !limb) continue;
    const top = tierY(twig.tier);
    const reachHere = radiusOf(twig.tier);
    const points: Vector3[] = [];
    const thick: number[] = [];
    if (eldest(parent)) {
      const leave = Math.max(FLARE + 0.5, top - 3.6);
      for (let k = 0; k < 4; k++) {
        points.push(limb.axisAt(leave - 1.6 + 0.4 * k));
        thick.push(TWIG * mix(0.3, 1, k / 4));
      }
      const start = limb.axisAt(leave);
      const r0 = Math.hypot(start.x, start.z);
      const a0 = Math.atan2(start.z, start.x);
      const curve = bough(r0, leave, reachHere - r0, top - leave);
      for (let k = 0; k <= 24; k++) {
        const [r, y] = bezier(curve, k / 24);
        points.push(at(r, a0 + turnTo(a0, front + twig.angle) * smooth(k / 24 / 0.6), y));
        thick.push(TWIG * mix(1, 0.42, k / 24));
      }
    } else {
      const rank = twigsOf.get(key(twig.from))!.indexOf(twig);
      let i0 = limb.along.findIndex((s) => s >= 0.3);
      limb.along.forEach((s, i) => {
        if (s >= 0.2 && limb.axis[i].y <= top - 1) i0 = i;
      });
      i0 = Math.max(5, i0 - 2 * rank);
      const start = limb.axis[i0];
      const r0 = Math.hypot(start.x, start.z);
      const a0 = Math.atan2(start.z, start.x);
      // A long reach is sturdier.
      const size = 0.2 + 0.012 * (reachHere - r0);
      for (let k = 5; k > 0; k--) {
        points.push(limb.axis[i0 - k].clone());
        thick.push(size * mix(0.3, 1, (5 - k) / 5));
      }
      const curve = [[r0, start.y], [r0 + 0.4 * (reachHere - r0), start.y + 0.1 * (top - start.y)], [reachHere - 0.3 * (reachHere - r0), top - 0.35], [reachHere, top]];
      for (let k = 0; k <= 24; k++) {
        const [r, y] = bezier(curve, k / 24);
        points.push(at(r, a0 + turnTo(a0, front + twig.angle) * smooth(k / 24 / 0.75), y));
        thick.push(size * mix(1, 0.42, k / 24));
      }
    }
    const end = thick[thick.length - 1];
    for (let k = 1; k <= 6; k++) {
      points.push(at(reachHere + 1.5 * (k / 6), front + twig.angle, top + 0.4 * (k / 6) ** 1.8));
      thick.push(end * mix(0.8, 0.15, k / 6));
    }
    pieces.push({ id: twig.id, follows: twig.id, geometry: tipped(twig.id, points, thick, 6), tint: 1.1 });
    pieces.push({ id: `free:roots:${twig.id}`, follows: twig.id, geometry: rootsOf(twig.id), tint: 1 });
    const pin = at(reachHere, front + twig.angle, top);
    pins.set(twig.id, [pin.x, pin.y - end, pin.z]);
  }

  // Free wood carries no card and always grows up and out, while cards only hang below the wood.
  // `lead` is its way inside the wood it grows out of; `subs` says how many side branches each
  // level has. Its chance comes from its own name, so it stays as it is when the family changes.
  // `leadThick` and `origin` are for wood that brings its own root (see `sweep`).
  const free = (
    id: string,
    follows: string,
    lead: Vector3[],
    size: number,
    heading: number,
    reach: number,
    rise: number,
    shape: number[][],
    bend: number,
    wobble: number,
    subs: number[],
    chance: () => number,
    leadThick?: number[],
    origin = 0,
  ) => {
    const start = lead[lead.length - 1];
    const points: Vector3[] = [];
    const thick: number[] = [];
    const n = Math.max(8, Math.floor((reach + rise) / 0.45));
    const phase = chance() * FULL;
    let x = start.x;
    let z = start.z;
    let gone = 0;
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      const [out, up] = bezier(shape, s);
      const a = heading + bend * s;
      x += Math.cos(a) * (out - gone) * reach;
      z += Math.sin(a) * (out - gone) * reach;
      gone = out;
      const w = wobble * Math.sin(phase + 5 * s) * s;
      points.push(new Vector3(x - Math.sin(a) * w, start.y + up * rise, z + Math.cos(a) * w));
      thick.push(size * mix(1, 0.3, s ** 0.9));
    }
    leadThick ??= lead.map((_, i) => size * mix(0.3, 1, smooth(i / Math.min(10, Math.max(1, lead.length - 1)))));
    pieces.push({ id, follows, geometry: tipped(id, [...lead, ...points], [...leadThick, ...thick], origin ? 8 : 5, origin), tint: 1.05 });
    for (let j = 0; j < (subs[0] ?? 0); j++) {
      const k0 = Math.floor(points.length * mix(0.35, 0.7, chance()));
      const side = chance() < 0.5 ? 1 : -1;
      const share = mix(0.42, 0.6, chance());
      const turn = heading + (bend * k0) / points.length + side * mix(0.5, 0.95, chance());
      free(`${id}.${j + 1}`, follows, points.slice(Math.max(0, k0 - 5), k0 + 1), size * 0.55, turn, reach * share, rise * share, SHOOT_SHAPE, side * 0.3, wobble * 0.5, subs.slice(1), chance);
    }
  };

  // The crown: strands wind up the trunk around the eldest couple's leader, so the trunk stays a
  // trunk above the limbs, and leave it as branches on every side but the front.
  const founders = plan.braids.find(eldest);
  const leader = founders && limbs.get(key(founders.ids));
  if (founders && leader) {
    const trunk = leader.along.filter((s) => s < 0).length;
    // A young tree has a small crown.
    const scale = Math.min(1, Math.max(0.35, (trunk * 0.3) / 20));
    for (let j = 0; j < CROWN; j++) {
      const chance = seeded(`${key(founders.ids)}|crown${j}`);
      const a = front + CROWN_FREE + ((j + 0.5 + 0.5 * (chance() - 0.5)) / CROWN) * (FULL - 2 * CROWN_FREE);
      const i0 = Math.max(1, Math.min(leader.axis.length - 1, Math.floor(mix(0.5, 0.97, chance()) * trunk)));
      const i1 = Math.max(0, Math.min(i0 - 12, Math.floor(0.25 * trunk)));
      const lead: Vector3[] = [];
      for (let i = i1; i <= i0; i++) {
        const turn = a + 0.45 * (leader.run[i] - leader.run[i0]);
        const out = WRAP * smooth((i - i1) / 10);
        lead.push(leader.axis[i].clone().add(new Vector3(Math.cos(turn) * out, 0, Math.sin(turn) * out)));
      }
      const length = mix(8, 12, chance()) * scale;
      free(`free:crown${j}`, founders.ids[0], lead, CROWN_THICK * mix(0.6, 1, scale), a - 0.2, 1.0 * length, 0.45 * length, SHOOT_SHAPE, 0.4, 0.5 * scale, [2, 1], chance);
    }
    // The base trunk: each strand stands on its root at its own place around the foot, winds up around
    // the leader and everyone else's braid and leaves low as a branch on every side but the front.
    // shortcut: its branches may cross a younger couple's limb at the back; check once deep families look crowded.
    // It grows with whoever has grown furthest, so it only grows once, with the first person.
    const anchor = plan.braids.flatMap((b) => b.ids).reduce((a, b) => (grownOf(b) > grownOf(a) ? b : a), founders.ids[0]);
    // The root collar: a solid core inside the strands that flares out at the hill, so the foot is
    // never hollow, and closes below where the first limb leaves.
    const top = Math.max(FLARE + 1, Math.min(...plan.braids.map(leaveOf)) - 0.8);
    const core = Math.max(0.45, around - 0.35);
    const spine: Vector3[] = [];
    const girth: number[] = [];
    for (let y = -1.2; y <= top + 1e-6; y += 0.3) {
      spine.push(new Vector3(0, y, 0));
      girth.push(core * (1 + 0.9 * Math.exp(-Math.max(0, y) / (0.6 + 0.3 * core))) * Math.sqrt(smooth((top - y) / 1.5)));
    }
    pieces.push({ id: 'free:collar', follows: anchor, geometry: reuse(`free:collar|${name}`, hashOf(spine, girth, 16), () => sweep('free:collar', spine, girth, 16)), tint: 0.95 });
    for (let j = 0; j < BASE_ROOTS && trunk > 4; j++) {
      const chance = seeded(`${name}|base${j}`);
      const want = front + ((j + 0.5 + 0.6 * (chance() - 0.5)) / BASE_ROOTS) * FULL;
      const end = front + CROWN_FREE + chance() * (FULL - 2 * CROWN_FREE);
      const i0 = Math.min(trunk - 1, Math.max(3, Math.round((mix(BASE_LEAVE[0], BASE_LEAVE[1], chance()) - FLARE) / 0.3)));
      // It climbs at least as steeply as it winds, or around a thick trunk it would lie like a hoop.
      const spin = Math.min((((end - want) % FULL) + FULL) % FULL, (i0 * 0.3) / around);
      const foot = end - spin;
      const size = BASE_THICK * mix(0.75, 1.15, chance());
      const lead: Vector3[] = [];
      const leadThick: number[] = [];
      for (let i = 0; i <= i0; i++) {
        const turn = foot + spin * (i / i0);
        const out = around * mix(FOOT, 1, smooth(i / 6));
        lead.push(leader.axis[i].clone().add(new Vector3(Math.cos(turn) * out, 0, Math.sin(turn) * out)));
        leadThick.push(size * mix(1, 0.7, i / i0));
      }
      const root = rootOf(lead, size, j * 1.7, mix(0.7, 1.2, chance()));
      const length = mix(4, 7, chance());
      free(`free:base${j}`, anchor, [...root.root, ...lead], 0.7 * size, end - 0.2, 0.8 * length, 0.6 * length, SHOOT_SHAPE, 0.4, 0.4, [1], chance, [...root.thick, ...leadThick], root.root.length);
    }
  }
  // Shoots on the limbs, away from the fork: up where nothing hangs above, sideways under another limb.
  for (const braid of plan.braids) {
    const limb = limbs.get(key(braid.ids));
    if (eldest(braid) || !limb) continue;
    const spots = limb.along.flatMap((s, i) => (s >= 0.3 && s <= 0.6 ? [i] : []));
    const up = braid.tier <= 1;
    const count = up ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const chance = seeded(`${braid.ids[0]}|shoot${j}`);
      const i0 = spots[Math.floor(((j + mix(0.2, 0.8, chance())) / count) * spots.length)];
      const way = limb.axis[i0 + 2].clone().sub(limb.axis[i0 - 2]);
      const length = mix(2.6, 4.6, chance());
      const side = (j + braid.tier) % 2 ? 1 : -1;
      const turn = Math.atan2(way.z, way.x) + side * (up ? mix(0.5, 1, chance()) : mix(0.9, 1.3, chance()));
      free(`free:${braid.ids[0]}:shoot${j}`, braid.ids[0], limb.axis.slice(i0 - 5, i0 + 1), 0.14, turn, (up ? 0.65 : 0.9) * length, (up ? 0.6 : 0.3) * length, up ? SHOOT_SHAPE : SIDE_SHAPE, side * 0.3, 0.25, length > 3.8 ? [1] : [], chance);
    }
  }
  // Where a couple's card hangs the wood runs on into a fine shoot, unless a card hangs right above.
  for (const end of ends) {
    if (end.tier > 0 && radiusOf(end.tier) < radiusOf(end.tier - 1)) continue;
    const chance = seeded(`${end.id}|tip`);
    const side = chance() < 0.5 ? 1 : -1;
    const length = mix(2, 3.4, chance());
    free(`free:${end.id}:tip`, end.id, end.points, 0.11, end.angle + side * mix(0.4, 0.9, chance()), 0.85 * length, 0.35 * length, SHOOT_SHAPE, side * 0.3, 0.2, [], chance);
  }

  return { pieces, pins };
}
