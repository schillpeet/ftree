// Fixed positions for the experimental view's flat family tree: one row per generation, partners
// side by side, children centred below their parents. Pure and derived from the relations only, so
// the same family always looks the same; `simpleLayout.check.mjs` tests it. `gen` comes from
// `generations()` (passed in, so the check can import both without a bundler).
import type { Point } from './pins';

type Person = {
  id: string;
  parentIds: string[];
  partnerIds: string[];
  partnerships?: readonly { partnerId: string; status: string }[];
  birthDate?: string | null;
};

export const NAME_GAP = 9;
export const FAMILY_GAP = 2;
export const ROW_GAP = 6;

// A child unit hanging below its parent via one member; `anchor` marks a child already placed elsewhere.
type Kid = { unit: string[]; via: string; anchor?: boolean };
// A laid-out subtree: x per member and the leftmost/rightmost x per generation, relative to it.
type Shape = { xs: Map<string, number>; contour: Map<number, [number, number]> };
const shifted = ({ xs, contour }: Shape, by: number): Shape => ({
  xs: new Map([...xs].map(([id, x]) => [id, x + by])),
  contour: new Map([...contour].map(([g, [l, r]]) => [g, [l + by, r + by]])),
});

// Tidy tree over units of partners: each couple's children are centred under the couple and packed
// left to right as closely as their contours allow, so every child bar is symmetric under its stem
// and families never overlap.
// ponytail: a person whose own parents and whose partner's parents are both in the tree hangs under
// one family only. The other family lines up when it is a root (in-laws), placed after the family
// its child married into and standing over that child on the partner's side, unless
// its row is full and it has no other children to spread; deeper in-law families can get a one-sided
// bar. Pull such couples between both families if that shows up.
export function simpleLayout(people: Person[], gen: Map<string, number>) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const sorted = [...people].sort((a, b) => a.id.localeCompare(b.id));
  const genOf = (id: string) => gen.get(id)!;

  // Partners in the same generation form a unit, ordered as a chain so partners sit side by side.
  // Parents of a shared child count as partners here even when no partnership is stored, so the
  // child hangs below both of them.
  const coParents = new Map<string, Set<string>>();
  for (const p of people)
    for (const a of p.parentIds)
      for (const b of p.parentIds) if (a !== b) coParents.set(a, (coParents.get(a) ?? new Set()).add(b));
  const mates = (id: string) =>
    [...new Set([...byId.get(id)!.partnerIds, ...(coParents.get(id) ?? [])])].filter((m) => byId.has(m) && genOf(m) === genOf(id));
  // Someone with children by several partners (who are not partners of each other), or with a former
  // partner, stands at the unit's edge with the partners beside them: current partners nearest, former
  // ones (status separated) outermost. Within each, a partner without shared children counts as the
  // newer, then the one whose latest shared child is the youngest, then the one with fewer children.
  const separated = (a: string, b: string) =>
    byId.get(a)!.partnerships?.some((p) => p.partnerId === b && p.status === 'separated') ?? false;
  const sharedKids = (a: string, b: string) => people.filter((c) => c.parentIds.includes(a) && c.parentIds.includes(b));
  const starOrder = (members: string[]) => {
    const hub = members.find((id) => mates(id).length === members.length - 1);
    const others = members.filter((id) => id !== hub);
    if (!hub || members.length < 3 || others.some((a) => others.some((b) => a !== b && mates(a).includes(b)))) return null;
    // Only when at least two partners have children with them or one of them is a former partner;
    // otherwise the person stands between.
    if (others.filter((id) => sharedKids(hub, id).length).length < 2 && !others.some((id) => separated(hub, id))) return null;
    const latest = (id: string) => sharedKids(hub, id).map((c) => c.birthDate ?? '').sort().at(-1) ?? '\uffff';
    const count = (id: string) => sharedKids(hub, id).length;
    return [
      hub,
      ...others.sort(
        (a, b) =>
          Number(separated(hub, a)) - Number(separated(hub, b)) ||
          latest(b).localeCompare(latest(a)) ||
          count(a) - count(b) ||
          a.localeCompare(b),
      ),
    ];
  };
  const stars = new Set<string[]>();
  const unitOf = new Map<string, string[]>();
  for (const p of sorted) {
    if (unitOf.has(p.id)) continue;
    const members = new Set<string>();
    for (const queue = [p.id]; queue.length; ) {
      const id = queue.shift()!;
      if (members.has(id)) continue;
      members.add(id);
      queue.push(...mates(id));
    }
    const star = starOrder([...members]);
    const left = [...members].sort((a, b) => mates(a).length - mates(b).length || a.localeCompare(b));
    const unit = star ?? [left.shift()!];
    while (!star && left.length) {
      const next = left.findIndex((id) => mates(unit.at(-1)!).includes(id));
      unit.push(...left.splice(Math.max(next, 0), 1));
    }
    for (const id of unit) unitOf.set(id, unit);
    if (star) stars.add(unit);
  }

  // Each unit hangs below a parent of its first member (by id) with parents in the tree.
  const units = [...new Set(unitOf.values())];
  const childrenOf = new Map<string[], { unit: string[]; via: string }[]>(units.map((u) => [u, []]));
  const roots: string[][] = [];
  for (const unit of units) {
    const via = [...unit].sort().find((id) => byId.get(id)!.parentIds.some((pid) => byId.has(pid)));
    // The lowest parent, so a child whose parents sit in different generations hangs right below.
    const parentId =
      via &&
      byId.get(via)!.parentIds.filter((pid) => byId.has(pid)).sort((a, b) => genOf(b) - genOf(a) || a.localeCompare(b))[0];
    // The generation check also stops cycles in broken data.
    if (via && parentId && genOf(parentId) < genOf(via)) childrenOf.get(unitOf.get(parentId)!)!.push({ unit, via });
    else roots.push(unit);
  }

  const gapAt = (g: number, depth: number, sameFamily: boolean) =>
    g === depth && sameFamily ? NAME_GAP : NAME_GAP + FAMILY_GAP;
  // Places `next` right of `acc` (left with `side` -1) as close as every shared generation allows,
  // but not closer than `hint`.
  const pack = (acc: Shape, next: Shape, depth: number, sameFamily: boolean, hint = -Infinity, side = 1) => {
    let by = hint * side;
    for (const [g, [l, r]] of next.contour) {
      const [al, ar] = acc.contour.get(g) ?? [];
      if (al == null || ar == null) continue;
      const gap = gapAt(g, depth, sameFamily);
      by = Math.max(by, side > 0 ? ar + gap - l : r + gap - al);
    }
    by *= side;
    const placed = shifted(next, Number.isFinite(by) ? by : 0);
    for (const [g, [l, r]] of placed.contour) {
      const [al, ar] = acc.contour.get(g) ?? [l, r];
      acc.contour.set(g, [Math.min(al, l), Math.max(ar, r)]);
    }
    for (const [id, x] of placed.xs) acc.xs.set(id, x);
    return acc;
  };

  const inLaw = ({ unit: child, via }: { unit: string[]; via: string }) =>
    child.some((id) => id !== via && byId.get(id)!.parentIds.some((pid) => byId.has(pid))) ? 1 : 0;
  // `anchor` is a child that already hangs elsewhere (an in-law family): it counts as this unit's
  // leftmost child, so the couple stands over it and its siblings stand beyond it.
  const layout = (unit: string[], anchor?: string): Shape => {
    // In a unit with several partners, the couple of the child that links to another family goes to
    // the end facing that family: left for an anchor (this family is placed to its right), else right.
    const link = anchor ? { via: anchor } : unit.length > 2 ? childrenOf.get(unit)!.find(inLaw) : undefined;
    if (link) {
      const at = byId.get(link.via)!.parentIds.flatMap((pid) => (unit.includes(pid) ? [unit.indexOf(pid)] : []));
      const mean = at.reduce((a, b) => a + b, 0) / at.length;
      if (anchor ? mean > (unit.length - 1) / 2 : mean < (unit.length - 1) / 2) unit.reverse();
    }
    const g = genOf(unit[0]);
    const own = new Map(unit.map((id, i) => [id, i * NAME_GAP]));
    const parentsKey = (via: string) => byId.get(via)!.parentIds.filter((pid) => own.has(pid)).sort().join();
    // Where a child's parents are: their middle. Beside someone at the edge with several partners,
    // the children of a partner who is not next to them hang under that partner, so the bar to a
    // farther partner is not mistaken for one to the nearer ones.
    const meanX = (via: string) => {
      const xs = byId.get(via)!.parentIds.flatMap((pid) => (own.has(pid) ? [own.get(pid)!] : []));
      const hubX = mates(unit[0]).length === unit.length - 1 ? 0 : (unit.length - 1) * NAME_GAP;
      const far = stars.has(unit) ? xs.filter((x) => x !== hubX) : [];
      if (xs.length === 2 && far.length === 1 && Math.abs(far[0] - xs.find((x) => x !== far[0])!) > NAME_GAP) return far[0];
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    // Children of the left couple first, then a child whose partner has parents in the tree (in-laws
    // are packed on the right), then by id. Married-in partners sit on the outside: left of the first
    // child, right of the last.
    const kids = [
      ...childrenOf.get(unit)!.map((kid): Kid => kid),
      ...(anchor ? [{ unit: [anchor], via: anchor, anchor: true } as Kid] : []),
    ].sort(
      (a, b) =>
        Number(!!b.anchor) - Number(!!a.anchor) ||
        meanX(a.via) - meanX(b.via) ||
        inLaw(a) - inLaw(b) ||
        a.via.localeCompare(b.via),
    );
    kids.forEach(({ unit: child, via }, i) => {
      const at = child.indexOf(via);
      if (i === kids.length - 1 ? at > 0 : i === 0 && at < child.length - 1) child.reverse();
    });
    // Each couple's children are packed as one group centred under that couple, pushed aside only
    // where an earlier group is in the way; half-siblings stand as close as siblings. Children of one
    // parent alone come after the couples', on that parent's side (their line runs over to them).
    const shape: Shape = { xs: own, contour: new Map([[g, [0, (unit.length - 1) * NAME_GAP]]]) };
    const children: Shape = { xs: new Map(), contour: new Map() };
    const groups: { couple: boolean; shape: Shape; at: number; right: boolean }[] = [];
    // A child of one parent alone hangs with the children of that parent's couple, as one family,
    // so its line joins theirs instead of running next to it.
    const couples = kids.map((kid) => parentsKey(kid.via)).filter((key) => key.includes(','));
    const keyOf = (via: string) => {
      const key = parentsKey(via);
      return key.includes(',') ? key : (couples.find((couple) => couple.split(',').includes(key)) ?? key);
    };
    const keys = [...new Set(kids.map((kid) => keyOf(kid.via)))];
    for (const key of keys) {
      // The child who married into another family stands last, at the edge facing that family.
      const members = kids
        .filter((kid) => keyOf(kid.via) === key)
        .sort((a, b) => Number(!!b.anchor) - Number(!!a.anchor) || inLaw(a) - inLaw(b));
      const group: Shape = { xs: new Map(), contour: new Map() };
      for (const kid of members) {
        const stub: Shape = { xs: new Map([[kid.via, 0]]), contour: new Map([[g + 1, [0, 0]]]) };
        pack(group, kid.anchor ? stub : layout(kid.unit), g + 1, true);
      }
      const ends = members.map((kid) => kid.via);
      const xs = ends.map((id) => group.xs.get(id)!);
      const centre = meanX((members.find((kid) => parentsKey(kid.via) === key) ?? members[0]).via);
      const at = centre - (Math.min(...xs) + Math.max(...xs)) / 2;
      groups.push({ couple: key.includes(','), shape: group, at, right: centre >= ((unit.length - 1) * NAME_GAP) / 2 });
    }
    const first = groups.some((group) => group.couple) ? groups.filter((group) => group.couple) : groups;
    const rest = groups.filter((group) => !first.includes(group));
    for (const { shape, at } of first) pack(children, shape, g + 1, true, at);
    for (const { shape, at } of rest.filter(({ right }) => right)) pack(children, shape, g + 1, true, at);
    for (const { shape, at } of rest.filter(({ right }) => !right).reverse()) pack(children, shape, g + 1, true, at, -1);
    return pack(shape, children, Infinity, false);
  };

  // A root whose child already hangs elsewhere (an in-law family) packs right next to the tree, then
  // slides left over the middle of all its children as far as its own row allows; if that is not
  // far enough, its own descendants move right instead, so its bar stays symmetric too.
  const tree: Shape = { xs: new Map(), contour: new Map() };
  const childIdsOf = (unit: string[]) => people.filter((p) => p.parentIds.some((id) => unit.includes(id))).map((p) => p.id);
  const ownChild = (unit: string[], id: string) => childrenOf.get(unit)!.some(({ unit: child }) => child.includes(id));
  for (const left = [...roots]; left.length; ) {
    const next = left.findIndex((r) => childIdsOf(r).some((id) => tree.xs.has(id)));
    // Otherwise a root that owns all its children goes first, so a root with a child hanging under
    // another family waits for that family and can then stand over the child's side.
    const primary = left.findIndex((r) => !childIdsOf(r).some((id) => !ownChild(r, id)));
    const [root] = left.splice(next >= 0 ? next : Math.max(primary, 0), 1);
    const anchor = childIdsOf(root).find((id) => tree.xs.has(id) && !ownChild(root, id));
    const shape = layout(root, anchor);
    if (anchor) {
      // Stand over the anchor; where that is too close to the tree, the siblings and their families
      // spread out to the right, the couple moving half as far so it stays centred over its children.
      const by = tree.xs.get(anchor)! - shape.xs.get(anchor)!;
      shape.xs.delete(anchor);
      const moved = (id: string, x: number, spread: number) => x + by + (root.includes(id) ? spread / 2 : spread);
      const clash = (spread: number) =>
        [...shape.xs].some(([id, x]) =>
          [...tree.xs].some(([other, ox]) => genOf(other) === genOf(id) && Math.abs(ox - moved(id, x, spread)) < NAME_GAP + FAMILY_GAP),
        );
      let spread = 0;
      while (spread < 60 && clash(spread)) spread += 1;
      if (!clash(spread)) {
        for (const [id, x] of shape.xs) tree.xs.set(id, moved(id, x, spread));
        tree.contour.clear();
        for (const [id, x] of tree.xs) {
          const [l, r] = tree.contour.get(genOf(id)) ?? [x, x];
          tree.contour.set(genOf(id), [Math.min(l, x), Math.max(r, x)]);
        }
        continue;
      }
    }
    pack(tree, shape, Infinity, false);
    if (next < 0) continue;
    const ends = childIdsOf(root).map((id) => tree.xs.get(id)!);
    const g = genOf(root[0]);
    const from = tree.xs.get(root[0])!;
    const centre = (from + tree.xs.get(root.at(-1)!)!) / 2;
    const target = (Math.min(...ends) + Math.max(...ends)) / 2;
    const row = [...tree.xs].filter(([id, x]) => genOf(id) === g && x < from).map(([, x]) => x);
    const by = Math.max(target - centre, Math.max(...row) + NAME_GAP + FAMILY_GAP - from);
    for (const id of root) tree.xs.set(id, tree.xs.get(id)! + by);
    const below = [...shape.xs.keys()].filter((id) => !root.includes(id));
    for (const id of below) tree.xs.set(id, tree.xs.get(id)! + 2 * (centre + by - target));
    tree.contour.clear();
    for (const [id, x] of tree.xs) {
      const [l, r] = tree.contour.get(genOf(id)) ?? [x, x];
      tree.contour.set(genOf(id), [Math.min(l, x), Math.max(r, x)]);
    }
  }
  const xs = [...tree.xs.values()];
  const middle = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  const last = Math.max(0, ...gen.values());
  return new Map([...tree.xs].map(([id, x]): [string, Point] => [id, [x - middle, (last - genOf(id)) * ROW_GAP, 0]]));
}
