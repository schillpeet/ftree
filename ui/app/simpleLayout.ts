// Fixed positions for the experimental view's flat family tree: one row per generation, partners
// side by side, children centred below their parents. Pure and derived from the relations only, so
// the same family always looks the same; `simpleLayout.check.mjs` tests it. `gen` comes from
// `generations()` (passed in, so the check can import both without a bundler).
import type { Point } from './pins';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

export const NAME_GAP = 6;
export const FAMILY_GAP = 2;
export const ROW_GAP = 6;

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
// one family only. The other family lines up when it is a root (in-laws) packed on the right, unless
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
    const left = [...members].sort((a, b) => mates(a).length - mates(b).length || a.localeCompare(b));
    const unit = [left.shift()!];
    while (left.length) {
      const next = left.findIndex((id) => mates(unit.at(-1)!).includes(id));
      unit.push(...left.splice(Math.max(next, 0), 1));
    }
    for (const id of unit) unitOf.set(id, unit);
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

  const layout = (unit: string[]): Shape => {
    const g = genOf(unit[0]);
    const own = new Map(unit.map((id, i) => [id, i * NAME_GAP]));
    const parentsKey = (via: string) => byId.get(via)!.parentIds.filter((pid) => own.has(pid)).sort().join();
    const meanX = (via: string) => {
      const xs = byId.get(via)!.parentIds.flatMap((pid) => (own.has(pid) ? [own.get(pid)!] : []));
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    // Children of the left couple first, then a child whose partner has parents in the tree (in-laws
    // are packed on the right), then by id. Married-in partners sit on the outside: left of the first
    // child, right of the last.
    const inLaw = ({ unit: child, via }: { unit: string[]; via: string }) =>
      child.some((id) => id !== via && byId.get(id)!.parentIds.some((pid) => byId.has(pid))) ? 1 : 0;
    const kids = childrenOf
      .get(unit)!
      .sort((a, b) => meanX(a.via) - meanX(b.via) || inLaw(a) - inLaw(b) || a.via.localeCompare(b.via));
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
    for (let i = 0; i < kids.length; ) {
      const key = parentsKey(kids[i].via);
      const group: Shape = { xs: new Map(), contour: new Map() };
      const ends: string[] = [];
      for (; i < kids.length && parentsKey(kids[i].via) === key; i++) {
        pack(group, layout(kids[i].unit), g + 1, true);
        ends.push(kids[i].via);
      }
      const xs = ends.map((id) => group.xs.get(id)!);
      const centre = meanX(ends[0]);
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
  for (const left = [...roots]; left.length; ) {
    const next = left.findIndex((r) => childIdsOf(r).some((id) => tree.xs.has(id)));
    const [root] = left.splice(Math.max(next, 0), 1);
    const shape = layout(root);
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
    const own = [...shape.xs.keys()].filter((id) => !root.includes(id));
    for (const id of own) tree.xs.set(id, tree.xs.get(id)! + 2 * (centre + by - target));
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
