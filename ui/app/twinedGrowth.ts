// How the twined tiered tree grows from one family state to the next: the order in which a family is
// replayed, and the plan between two states. Pure, so `twinedGrowth.check.mjs` can test it without a
// scene.
import { generations } from './generations.ts';
import type { TwinedPlan } from './twinedLayout';

type Person = { id: string; parentIds: string[]; partnerIds: string[]; birthDate?: string | null };

// A plan on its way: how far each member's strand or twig has grown, 0 to 1.
export type GrowingPlan = TwinedPlan & { grown: Map<string, number> };

// Eldest first, tier by tier, so the tree grows downwards. In a generation blood relatives come by
// age, each followed by their partners, so a married-in partner never stands alone on top.
export function growthOrder<T extends Person>(people: T[]): T[] {
  const gen = generations(people);
  const byId = new Map(people.map((p) => [p.id, p]));
  const born = (p: T) => p.birthDate ?? '￿';
  const byAge = (a: T, b: T) => born(a).localeCompare(born(b)) || a.id.localeCompare(b.id);
  const hasParents = (p: T) => p.parentIds.some((id) => byId.has(id));
  const order: T[] = [];
  const done = new Set<string>();
  const add = (p: T) => {
    if (done.has(p.id)) return;
    done.add(p.id);
    order.push(p);
    for (const id of p.partnerIds) {
      const partner = byId.get(id);
      if (partner && gen.get(id) === gen.get(p.id)) add(partner);
    }
  };
  const depth = Math.max(-1, ...gen.values()) + 1;
  for (let g = 0; g < depth; g++) {
    const row = people.filter((p) => gen.get(p.id) === g).sort(byAge);
    row.filter(hasParents).forEach(add);
    row.forEach(add);
  }
  return order;
}

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// The plan at t ∈ [0, 1] between `from` and `to`: the tree rises with the fractional depth, cards of
// members in both glide, new ones sit where they will hang. Members who keep their strand or twig are
// fully grown, new ones grow in; members only in `from` are gone.
export function blendPlans(from: TwinedPlan, to: TwinedPlan, t: number): GrowingPlan {
  const oldAngle = new Map(from.cards.map((c) => [c.id, c.angle]));
  const angle = new Map(to.cards.map((c) => [c.id, oldAngle.has(c.id) ? lerp(oldAngle.get(c.id)!, c.angle, t) : c.angle]));
  const strands = new Set(from.braids.flatMap((b) => b.ids));
  const twigs = new Set(from.twigs.map((w) => w.id));
  const grown = new Map<string, number>();
  for (const b of to.braids) for (const id of b.ids) grown.set(id, strands.has(id) ? 1 : smoothstep(t));
  for (const w of to.twigs) grown.set(w.id, twigs.has(w.id) ? 1 : smoothstep(t));
  return {
    depth: from.depth ? lerp(from.depth, to.depth, t) : to.depth,
    braids: to.braids.map((b) => {
      const as = b.ids.map((id) => angle.get(id)!);
      const old = from.braids.find((o) => o.ids.some((id) => b.ids.includes(id)));
      return { ...b, angle: (Math.min(...as) + Math.max(...as)) / 2, offset: old ? lerp(old.offset, b.offset, t) : b.offset };
    }),
    twigs: to.twigs.map((w) => ({ ...w, angle: angle.get(w.id)! })),
    cards: to.cards.map((c) => ({ ...c, angle: angle.get(c.id)! })),
    grown,
  };
}
