// The plan of the twined tiered tree: everyone with a partner or children brings a strand of their
// own, growing from the ground up to their generation's tier, and a couple's strands wind around
// each other (a braid). A childless person without a partner whose parents are in the tree is a twig
// of the parents' braid instead. Each family keeps its own wedge around the trunk, parents right
// above their children. Pure, so `twinedLayout.check.mjs` can test it without a scene.
type Person = { id: string; parentIds: string[]; partnerIds: string[]; birthDate?: string | null };

// People whose strands wind together and end on `tier`. The braid leaves the trunk towards `angle`
// (radians, 0 = front); at the ground its axis lies `offset` from the trunk axis, 0 for the eldest.
export type Braid = { ids: string[]; tier: number; angle: number; offset: number };
// A twig grows out of the parents' braid (`from` = that braid's ids) on `tier`, towards `angle`.
export type Twig = { id: string; tier: number; angle: number; from: string[] };
export type PlanCard = { id: string; tier: number; angle: number };
export type TwinedPlan = { depth: number; braids: Braid[]; twigs: Twig[]; cards: PlanCard[] };

const FULL = Math.PI * 2;
// The front stays free so the trunk shows: the cards part there by this many slots. The family sits
// a quarter slot left of the front first, so no card is ever right on it and each card knows its side.
const FRONT_GAP = 2;
const BIAS = -0.25;

// `gen` comes from `generations()`; `slotAngle` is the angle one card needs. If the family does not
// fit around the trunk, every slot shrinks.
// ponytail: a couple whose partners both have parents in the tree joins the elder partner's family
// only; a forked trunk for both families comes later.
export function twinedPlan(people: Person[], gen: Map<string, number>, slotAngle: number): TwinedPlan {
  if (!people.length) return { depth: 0, braids: [], twigs: [], cards: [] };
  const byId = new Map(people.map((p) => [p.id, p]));
  const born = (id: string) => byId.get(id)!.birthDate ?? '￿';
  const byAge = (a: string, b: string) => born(a).localeCompare(born(b)) || a.localeCompare(b);
  const tierOf = (id: string) => gen.get(id) ?? 0;
  const parentsOf = (id: string) => byId.get(id)!.parentIds.filter((p) => byId.has(p));
  const parents = new Set(people.flatMap((p) => parentsOf(p.id)));

  // Units: a person and their partners on the same tier, blood relatives first, then by age.
  const unitOf = new Map<string, string[]>();
  const units: string[][] = [];
  for (const id of [...byId.keys()].sort(byAge)) {
    if (unitOf.has(id)) continue;
    const unit = [id];
    for (let i = 0; i < unit.length; i++)
      for (const other of byId.get(unit[i])!.partnerIds)
        if (byId.has(other) && !unit.includes(other) && tierOf(other) === tierOf(id)) unit.push(other);
    unit.sort((a, b) => Number(parentsOf(b).length > 0) - Number(parentsOf(a).length > 0) || byAge(a, b));
    unit.forEach((m) => unitOf.set(m, unit));
    units.push(unit);
  }
  const isTwig = (u: string[]) => u.length === 1 && parentsOf(u[0]).length > 0 && !parents.has(u[0]);

  // A unit hangs below the unit of its eldest blood member's parents. Only units on a higher tier
  // count, so bad data with a parent cycle cannot loop.
  const parentUnit = new Map<string[], string[]>();
  const childrenOf = new Map<string[], string[][]>();
  const roots: string[][] = [];
  for (const unit of units) {
    const up = unit.flatMap((m) => parentsOf(m).map((p) => unitOf.get(p)!)).find((u) => u !== unit && tierOf(u[0]) < tierOf(unit[0]));
    if (!up) roots.push(unit);
    else {
      parentUnit.set(unit, up);
      childrenOf.set(up, [...(childrenOf.get(up) ?? []), unit]);
    }
  }

  // A unit's wedge, in slots: room for its own cards and, below them, its children's wedges.
  const kids = (u: string[]) => childrenOf.get(u) ?? [];
  const width = (u: string[]): number => Math.max(u.length, kids(u).reduce((s, c) => s + width(c), 0));
  const eldest = (u: string[]) => [...u].sort(byAge)[0];
  const sortedRoots = [...roots].sort((a, b) => byAge(eldest(a), eldest(b)));
  const total = sortedRoots.reduce((s, u) => s + width(u), 0);
  const slot = Math.min(slotAngle, FULL / (total + FRONT_GAP));

  const braids: Braid[] = [];
  const twigs: Twig[] = [];
  const cards: PlanCard[] = [];
  const place = (unit: string[], start: number) => {
    const tier = tierOf(unit[0]);
    const middle = start + (width(unit) * slot) / 2;
    unit.forEach((id, i) => cards.push({ id, tier, angle: middle + (i - (unit.length - 1) / 2) * slot }));
    if (isTwig(unit)) twigs.push({ id: unit[0], tier, angle: middle, from: parentUnit.get(unit)! });
    else braids.push({ ids: unit, tier, angle: middle, offset: braids.length ? 0.5 + 0.15 * tier : 0 });
    // Children's wedges side by side in the middle of the parents' wedge, by age.
    const children = [...kids(unit)].sort((a, b) => byAge(eldest(a), eldest(b)));
    let at = middle - (children.reduce((s, c) => s + width(c), 0) * slot) / 2;
    for (const child of children) {
      place(child, at);
      at += width(child) * slot;
    }
  };
  // The family is centred on the front, spare room is left behind the trunk.
  let at = (-total * slot) / 2;
  for (const root of sortedRoots) {
    place(root, at);
    at += width(root) * slot;
  }
  // Part the cards at the front; braids and twigs follow their cards.
  for (const c of cards) {
    const a = c.angle + BIAS * slot;
    c.angle = a + (a < 0 ? -1 : 1) * (FRONT_GAP / 2) * slot;
  }
  const angleOf = new Map(cards.map((c) => [c.id, c.angle]));
  for (const b of braids) {
    const as = b.ids.map((id) => angleOf.get(id)!);
    b.angle = (Math.min(...as) + Math.max(...as)) / 2;
  }
  for (const t of twigs) t.angle = angleOf.get(t.id)!;
  return { depth: Math.max(...people.map((p) => tierOf(p.id))) + 1, braids, twigs, cards };
}
