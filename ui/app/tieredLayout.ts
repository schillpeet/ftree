// Where cards hang in the tiered tree: one tier of branches per generation, each family in its own
// wedge around the trunk, parents right above their children. Pure, so `tieredLayout.check.mjs` can
// test it without a scene.
type Person = { id: string; parentIds: string[]; partnerIds: string[]; birthDate?: string | null };

// A card at `angle` radians from the front around the trunk.
export type PlanCard = { id: string; angle: number };
// Per tier its radius and its branches: a branch carries the units (a person with their partners)
// that are children of one unit above, or one unit of founders on the top tier. It leaves the
// trunk at `angle`, right below the middle of the parents' unit.
export type Branch = { angle: number; units: PlanCard[][] };
export type TierPlan = { radius: number; branches: Branch[] };
// `slot` is the width a card needs, tier t reaches `minRadius + widening * t` out. Parameters
// because plain node cannot resolve a value import of './pins'.
export type PlanOptions = { slot: number; minRadius: number; widening: number };

const FULL = Math.PI * 2;

// Every unit gets a wedge wide enough for its own cards and, below them, the wedges of its
// children's units. Founders share the circle by age, children sit in their parents' wedge by age,
// and a unit's cards hang in the middle of its wedge. So the middle of a couple is the middle of
// their children's branch. The family is centred on the front; if the wedges do not fit around the
// trunk, all tiers reach further out.
// `gen` comes from `generations()`.
// ponytail: a couple whose partners both have parents in the tree joins the elder partner's family
// only; the line to the other family stays long.
export function tieredPlan(people: Person[], gen: Map<string, number>, { slot, minRadius, widening }: PlanOptions): TierPlan[] {
  if (!people.length) return [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const born = (id: string) => byId.get(id)!.birthDate ?? '￿';
  const byAge = (a: string, b: string) => born(a).localeCompare(born(b)) || a.localeCompare(b);
  const hasParents = (id: string) => byId.get(id)!.parentIds.some((p) => byId.has(p));
  const tierOf = (id: string) => gen.get(id) ?? 0;

  // Units: partners on the same tier, blood relatives first, then by age.
  const unitOf = new Map<string, string[]>();
  const units: string[][] = [];
  for (const id of [...byId.keys()].sort(byAge)) {
    if (unitOf.has(id)) continue;
    const unit = [id];
    for (let i = 0; i < unit.length; i++)
      for (const other of byId.get(unit[i])!.partnerIds)
        if (byId.has(other) && !unit.includes(other) && tierOf(other) === tierOf(id)) unit.push(other);
    unit.sort((a, b) => Number(hasParents(b)) - Number(hasParents(a)) || byAge(a, b));
    unit.forEach((m) => unitOf.set(m, unit));
    units.push(unit);
  }
  // A unit belongs below the unit of its eldest blood member's parents.
  const childrenOf = new Map<string[], string[][]>();
  const roots: string[][] = [];
  for (const unit of units) {
    const parent = unit.flatMap((m) => byId.get(m)!.parentIds.filter((p) => byId.has(p) && unitOf.get(p) !== unit))[0];
    if (parent === undefined) roots.push(unit);
    else childrenOf.set(unitOf.get(parent)!, [...(childrenOf.get(unitOf.get(parent)!) ?? []), unit]);
  }

  const depth = Math.max(...people.map((p) => tierOf(p.id))) + 1;
  let scale = 1;
  const radius = (t: number) => (minRadius + widening * t) * scale;
  const slotAngle = (t: number) => 2 * Math.asin(Math.min(1, slot / (2 * radius(t))));
  const kids = (u: string[]) => childrenOf.get(u) ?? [];
  const width = (u: string[]): number => Math.max(u.length * slotAngle(tierOf(u[0])), kids(u).reduce((s, c) => s + width(c), 0));
  const total = () => roots.reduce((s, u) => s + width(u), 0);
  // Wedges narrow as the tiers reach out; a few rounds settle the arcsine.
  for (let round = 0; round < 20 && total() > FULL; round++) scale *= (total() / FULL) * 1.001;

  const plan: TierPlan[] = Array.from({ length: depth }, (_, t) => ({ radius: radius(t), branches: [] }));
  const eldest = (u: string[]) => [...u].sort(byAge)[0];
  const place = (unit: string[], start: number) => {
    const t = tierOf(unit[0]);
    const middle = start + width(unit) / 2;
    const cards = unit.map((id, i) => ({ id, angle: middle + (i - (unit.length - 1) / 2) * slotAngle(t) }));
    // Children's units hang side by side in the middle of the wedge, one branch per tier.
    const children = [...kids(unit)].sort((a, b) => byAge(eldest(a), eldest(b)));
    let at = middle - children.reduce((s, c) => s + width(c), 0) / 2;
    const branches = new Map<number, PlanCard[][]>();
    for (const child of children) {
      const placed = place(child, at);
      at += width(child);
      const ct = tierOf(child[0]);
      branches.set(ct, [...(branches.get(ct) ?? []), placed]);
    }
    branches.forEach((units, ct) => plan[ct].branches.push({ angle: middle, units }));
    return cards;
  };
  // The family stays together around the front; spare room is left behind the trunk.
  let at = -total() / 2;
  for (const root of [...roots].sort((a, b) => byAge(eldest(a), eldest(b)))) {
    plan[tierOf(root[0])].branches.push({ angle: at + width(root) / 2, units: [place(root, at)] });
    at += width(root);
  }
  return plan;
}
