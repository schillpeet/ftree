// Fixed positions for the experimental view's flat family tree: one row per generation, partners
// side by side, children centred below their union. Pure and derived from the relations only, so
// the same family always looks the same; `simpleLayout.check.mjs` tests it. `gen` comes from
// `buildModel().gen` (passed in, so callers share one model). The order follows the circuit-diagram
// rules, so `experimental/routing.ts` rarely needs a crossing or a stub.
import type { Point } from './pins';
import { buildModel } from './experimental/model.ts';
import { sortPartners } from './partnerships.ts';

type Partnership = Parameters<typeof sortPartners>[1][number];
type Person = {
  id: string;
  firstName?: string;
  parentIds: string[];
  partnerIds: string[];
  partnerships?: readonly { partnerId: string; status: string; since?: string | null; marriedOn?: string | null; endedOn?: string | null }[];
  parentLinks?: readonly { parentId: string; kind: string }[];
  birthDate?: string | null;
};

export const NAME_GAP = 6.5;
export const FAMILY_GAP = 3;
export const ROW_GAP = 6.8;

// A child unit hanging below its parent via one member; `anchor` marks a child already placed elsewhere.
type Kid = { unit: string[]; via: string; anchor?: boolean };
// A laid-out subtree: x per member and the leftmost/rightmost x per generation, relative to it.
type Shape = { xs: Map<string, number>; contour: Map<number, [number, number]> };
const shifted = ({ xs, contour }: Shape, by: number): Shape => ({
  xs: new Map([...xs].map(([id, x]) => [id, x + by])),
  contour: new Map([...contour].map(([g, [l, r]]) => [g, [l + by, r + by]])),
});
const pairKey = (x: string, y: string) => (x < y ? `${x}\n${y}` : `${y}\n${x}`);

// Tidy tree over units of partners: each union's children are centred under its node and packed
// left to right as closely as their contours allow, and families never overlap.
// A sibling group has two edges: a child whose partner's parents are in-laws stands at an edge, and
// that in-law family stands on the same side over its child. The other siblings follow by age from
// there, each as a block with their partners outside. Further in-law links and loops (cousins
// marrying) are left to routing, which turns them into stubs.
// ponytail: a partner graph with a cycle (beyond co-parents of one child) is ordered along a spanning
// tree, so its extra lines can interleave and cross; stub or reorder them if that shows up.
export function simpleLayout(people: Person[], gen: Map<string, number>) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const sorted = [...people].sort((a, b) => a.id.localeCompare(b.id));
  const level = new Map(gen);
  const genOf = (id: string) => level.get(id)!;
  const model = buildModel(people);

  // The parents a child hangs from in the drawing (biological, else all), and partnership statuses.
  const drawnParents = new Map<string, string[]>();
  for (const u of model.unions) for (const c of u.children) drawnParents.set(c, u.parents);
  const parentsOf = (id: string) => drawnParents.get(id) ?? [];
  const status = new Map(model.partnerships.map((p) => [pairKey(p.a, p.b), p.status]));
  const partnerCount = (id: string) => model.partnerships.filter((p) => p.a === id || p.b === id).length;
  // Partners in the same generation form a unit. Parents of a shared child count as partners here
  // even when no partnership is stored, so the child hangs below both of them.
  const mateSets = new Map<string, Set<string>>(people.map((p) => [p.id, new Set()]));
  const link = (a: string, b: string) => {
    if (a !== b && byId.has(a) && byId.has(b) && genOf(a) === genOf(b)) {
      mateSets.get(a)!.add(b);
      mateSets.get(b)!.add(a);
    }
  };
  for (const { a, b, status } of model.partnerships) if (status !== null) link(a, b);
  // Co-parents already joined through partners add no link: it would close a cycle of partner lines,
  // and routing stubs the union instead.
  const joined = (a: string, b: string) => {
    const seen = new Set([a]);
    for (const queue = [a]; queue.length; )
      for (const m of mateSets.get(queue.pop()!)!)
        if (!seen.has(m)) {
          seen.add(m);
          queue.push(m);
        }
    return seen.has(b);
  };
  for (const { parents } of model.unions) for (const a of parents) for (const b of parents) if (a < b && !joined(a, b)) link(a, b);
  const mates = (id: string) => [...mateSets.get(id)!].sort();
  // A family without parents in the tree (in-laws) stands one row above its children, not at the top,
  // so their lines can reach it; when a child married into a lower row, its siblings move down with it
  // and their descendants below them.
  const groupOf = (id: string) => {
    const group = new Set([id]);
    for (const queue = [id]; queue.length; )
      for (const m of mates(queue.pop()!))
        if (!group.has(m)) {
          group.add(m);
          queue.push(m);
        }
    return [...group];
  };
  const raise = (id: string, to: number) => to > genOf(id) && (level.set(id, to), true);
  for (let changed = true, rounds = 0; changed && rounds <= 2 * people.length; rounds++) {
    changed = false;
    for (const p of sorted) {
      for (const pid of p.parentIds) if (byId.has(pid)) changed = raise(p.id, genOf(pid) + 1) || changed;
      for (const m of mates(p.id)) changed = raise(p.id, genOf(m)) || changed;
      const group = groupOf(p.id);
      if (group.some((id) => byId.get(id)!.parentIds.some((pid) => byId.has(pid)))) continue;
      const kids = people.filter((c) => parentsOf(c.id).some((pid) => group.includes(pid))).map((c) => c.id);
      if (!kids.length) continue;
      const to = Math.max(...kids.map(genOf));
      for (const id of kids) changed = raise(id, to) || changed;
      for (const id of group) changed = raise(id, to - 1) || changed;
    }
  }
  const separated = (a: string, b: string) => ['separated', 'divorced'].includes(status.get(pairKey(a, b)) ?? '');
  // Children with both in their parent list, step links included: they make a partner one "with children".
  const sharedKids = (a: string, b: string) => people.filter((c) => c.parentIds.includes(a) && c.parentIds.includes(b));
  // A former partner with any child of their own, shared or not, counts as "with children" and
  // stands outside; a current partner only with a shared child.
  const hasKids = (hub: string) => (m: string) =>
    sharedKids(hub, m).length > 0 || (separated(hub, m) && people.some((c) => c.parentIds.includes(m)));
  // Current partners before former ones (separated or divorced); within each, a partner without
  // shared children counts as the newer, then the one whose latest shared child is the youngest,
  // then the one with fewer children.
  const nearestFirst = (hub: string, others: string[]) => {
    const latest = (id: string) => sharedKids(hub, id).map((c) => c.birthDate ?? '').sort().at(-1) ?? '\uffff';
    const count = (id: string) => sharedKids(hub, id).length;
    return [...others].sort(
      (a, b) =>
        Number(separated(hub, a)) - Number(separated(hub, b)) ||
        latest(b).localeCompare(latest(a)) ||
        count(a) - count(b) ||
        a.localeCompare(b),
    );
  };
  // Siblings by age: the oldest first, those without a birth date last by first name, then by id.
  const born = (id: string) => byId.get(id)!.birthDate || '\uffff';
  const byAge = (a: string, b: string) =>
    born(a).localeCompare(born(b)) || (byId.get(a)!.firstName ?? '').localeCompare(byId.get(b)!.firstName ?? '') || a.localeCompare(b);
  // A sibling's block, from the sibling outward: its partners in profile order (current first, then
  // the latest ended), co-parents without a stored partnership last, each followed by that partner's
  // own other partners.
  const outwardBlock = (via: string) => {
    const seen = new Set([via]);
    const block = (id: string): string[] => {
      const others = mates(id).filter((m) => !seen.has(m));
      for (const m of others) seen.add(m);
      const details = (byId.get(id)!.partnerships ?? []) as readonly Partnership[];
      const stored = others.filter((m) => details.some((p) => p.partnerId === m));
      const order = [...sortPartners(stored.map((m) => ({ id: m })), details).map((p) => p.id), ...others.filter((m) => !stored.includes(m))];
      return [id, ...order.flatMap(block)];
    };
    return block(via);
  };
  // Partner group order. The person with the most partners stands in the middle: the first partner
  // with shared children (by nearestFirst) outermost on the right, the second outermost on the left,
  // childless partners inside on the right, further partners with children beyond the right outer one.
  // A partner's own other partners stand beyond that partner, away from the middle, in the same order.
  const arrange = (members: string[]) => {
    const hub = [...members].sort((a, b) => mates(b).length - mates(a).length || a.localeCompare(b))[0];
    const seen = new Set([hub]);
    const block = (id: string, side: number): string[] => {
      const others = mates(id).filter((m) => !seen.has(m));
      for (const m of others) seen.add(m);
      const withKids = nearestFirst(id, others.filter(hasKids(id)));
      const childless = nearestFirst(id, others.filter((m) => !hasKids(id)(m)));
      if (side === 0) {
        const [first, second, ...further] = withKids;
        const left = second ? block(second, -1) : [];
        const right = [...childless, ...(first ? [first] : []), ...further].flatMap((m) => block(m, 1));
        return [...left, id, ...right];
      }
      const outward = [...childless, ...withKids].map((m) => block(m, side));
      return side > 0 ? [id, ...outward.flat()] : [...outward.reverse().flat(), id];
    };
    return block(hub, 0);
  };
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
    const unit = arrange([...members]);
    for (const id of unit) unitOf.set(id, unit);
  }
  // Where a union's children hang, as the router draws it: the middle of adjacent partners, else
  // straight below the outer partner (fewer partners, then farther from the rest of the group, then
  // the left one), below a single parent.
  const nodeX = (parents: string[], own: Map<string, number>) => {
    const xs = parents.map((id) => own.get(id)!);
    if (parents.length !== 2) return xs.reduce((a, b) => a + b, 0) / xs.length;
    const [l, r] = xs[0] < xs[1] ? parents : [parents[1], parents[0]];
    const [x0, x1] = [own.get(l)!, own.get(r)!];
    const others = [...own].filter(([id]) => id !== l && id !== r).map(([, x]) => x);
    if (!others.some((x) => x > x0 && x < x1) && !separated(l, r)) return (x0 + x1) / 2;
    const gap = (x: number) => Math.min(...others.map((o) => Math.abs(o - x)));
    const [pl, pr] = [partnerCount(l), partnerCount(r)];
    return pr < pl || (pr === pl && gap(x1) > gap(x0)) ? x1 : x0;
  };

  // Each unit hangs below the drawn parents of one member. With several candidates (a couple whose
  // two families are both in the tree), the family with more ancestors, then more children, keeps
  // it; the other becomes an in-law family placed over its child from outside.
  const ancestors = (id: string, seen = new Set<string>()): number => {
    for (const pid of byId.get(id)!.parentIds)
      if (byId.has(pid) && !seen.has(pid)) {
        seen.add(pid);
        ancestors(pid, seen);
      }
    return seen.size;
  };
  const familySize = (id: string) => people.filter((c) => parentsOf(c.id).some((pid) => parentsOf(id).includes(pid))).length;
  const units = [...new Set(unitOf.values())];
  const childrenOf = new Map<string[], Kid[]>(units.map((u) => [u, []]));
  const roots: string[][] = [];
  for (const unit of units) {
    const score = (id: string) => [Math.max(0, ...parentsOf(id).map((pid) => ancestors(pid) + 1)), familySize(id)];
    const via = unit
      .filter((id) => parentsOf(id).length)
      .sort((a, b) => score(b)[0] - score(a)[0] || score(b)[1] - score(a)[1] || a.localeCompare(b))[0];
    // The lowest parent, so a child whose parents sit in different generations hangs right below.
    const parentId = via && [...parentsOf(via)].sort((a, b) => genOf(b) - genOf(a) || a.localeCompare(b))[0];
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

  // Per sibling group (its parent ids, sorted), the side where a sibling hanging elsewhere stands.
  const hints = new Map<string, number>();
  const inLaw = ({ unit: child, via }: Kid) => child.some((id) => id !== via && parentsOf(id).length > 0);
  // `anchor` is a child that already hangs elsewhere (this is an in-law family): it stands at the edge
  // of its siblings facing the tree (`edge` -1 left, 1 right), so the couple stands over it.
  const layout = (unit: string[], anchor?: { id: string; edge: number }): Shape => {
    const g = genOf(unit[0]);
    const own = new Map(unit.map((id, i) => [id, i * NAME_GAP]));
    const keyOf = (via: string) => parentsOf(via).filter((pid) => own.has(pid)).sort().join();
    const kids: Kid[] = [...childrenOf.get(unit)!, ...(anchor ? [{ unit: [anchor.id], via: anchor.id, anchor: true }] : [])];
    // One sibling group per union, in the order of their nodes.
    const keys = [...new Set(kids.map((kid) => keyOf(kid.via)))].sort(
      (a, b) => nodeX(a.split(','), own) - nodeX(b.split(','), own) || a.localeCompare(b),
    );
    // Couples' groups come first; a single parent's children follow on that parent's side of them.
    const centres = keys.filter((key) => key.includes(',')).map((key) => nodeX(key.split(','), own));
    const middle = centres.reduce((a, b) => a + b, 0) / centres.length;
    const singles = centres.length ? keys.filter((key) => !key.includes(',')).map((key) => (nodeX([key], own) >= middle ? 1 : -1)) : [];
    const edgeOf = new Map<Kid, number>();
    // The side a sibling group leans to (-1 left, 1 right, 0 neither): its one taken edge, else a
    // sibling hanging elsewhere.
    const leanOf = new Map<Kid, number>();
    const groups = keys.map((key) => {
      const members = kids.filter((kid) => keyOf(kid.via) === key).sort((a, b) => a.via.localeCompare(b.via));
      // A sibling group's two edges: the anchor on its side; the last child with in-laws on the right,
      // the one before it on the left (unless the anchor stands there). A single child with in-laws
      // takes the left edge when a single parent's children stand on the right only.
      const taken = new Set<number>();
      for (const kid of members.filter((kid) => kid.anchor)) {
        edgeOf.set(kid, anchor!.edge);
        taken.add(anchor!.edge);
      }
      const inLaws = members.filter((kid) => !kid.anchor && inLaw(kid));
      const lone = inLaws.length === 1 && singles.includes(1) && !singles.includes(-1) ? -1 : 1;
      for (const [kid, edge] of [[inLaws.at(-1), lone], [inLaws.at(-2), -1]] as const)
        if (kid && !taken.has(edge)) {
          edgeOf.set(kid, edge);
          taken.add(edge);
        }
      const edge = (kid: Kid) => edgeOf.get(kid) ?? 0;
      // The others by age: the oldest next to the side the group leans to, else the oldest left.
      const lean = taken.size === 1 ? [...taken][0] : taken.size ? 0 : (hints.get(key) ?? 0);
      for (const kid of members) leanOf.set(kid, lean);
      members.sort((a, b) => edge(a) - edge(b) || (lean > 0 ? -1 : 1) * byAge(a.via, b.via));
      return { key, members };
    });
    // Married-in partners stand outside: beyond an edge child on that edge's side, away from the side
    // the group leans to, else left of the row's first child and right otherwise. A sibling with
    // several partners stands inside with all of them beyond it; a larger group with in-laws is
    // mirrored only to turn a partner with in-laws toward their edge.
    const row = groups.flatMap(({ members }) => members);
    row.forEach((kid, i) => {
      const { unit: child, via } = kid;
      if (kid.anchor || child.length < 2) return;
      const inLaws = child.flatMap((id, at) => (id !== via && parentsOf(id).length ? [at] : []));
      if (child.length > 2 && !inLaws.length) child.splice(0, child.length, ...outwardBlock(via));
      else if (child.length > 2 && !edgeOf.has(kid)) return;
      const lean = leanOf.get(kid)!;
      const outside = edgeOf.get(kid) ?? (lean ? -lean : i === 0 && row.length > 1 ? -1 : 1);
      const toward = inLaws.length ? inLaws : child.flatMap((id, at) => (id !== via ? [at] : []));
      const leftOfVia = toward.reduce((a, b) => a + b, 0) / toward.length < child.indexOf(via);
      if ((outside < 0) !== leftOfVia) child.reverse();
    });
    // Each union's children are packed as one group centred under its node. Couples' groups go first,
    // in node order, pushed apart only where they meet and then balanced.
    const shape: Shape = { xs: own, contour: new Map([[g, [0, (unit.length - 1) * NAME_GAP]]]) };
    let children: Shape = { xs: new Map(), contour: new Map() };
    const placed = groups.map(({ key, members }) => {
      const group: Shape = { xs: new Map(), contour: new Map() };
      for (const kid of members) {
        const stub: Shape = { xs: new Map([[kid.via, 0]]), contour: new Map([[g + 1, [0, 0]]]) };
        pack(group, kid.anchor ? stub : layout(kid.unit), g + 1, true);
      }
      const xs = members.map((kid) => group.xs.get(kid.via)!);
      const centre = nodeX(key.split(','), own);
      return { couple: key.includes(','), shape: group, at: centre - (Math.min(...xs) + Math.max(...xs)) / 2, centre, ref: members[0].via };
    });
    const first = placed.some((group) => group.couple) ? placed.filter((group) => group.couple) : placed;
    for (const { shape, at } of first) pack(children, shape, g + 1, true, at);
    const pushed = (group: (typeof placed)[number]) => children.xs.get(group.ref)! - group.shape.xs.get(group.ref)! - group.at;
    const balance = first.length ? (pushed(first[0]) + pushed(first.at(-1)!)) / 2 : 0;
    if (balance) children = shifted(children, -balance);
    const rest = placed.filter((group) => !first.includes(group));
    for (const { shape, at } of rest.filter(({ centre }) => centre >= middle)) pack(children, shape, g + 1, true, at);
    for (const { shape, at } of rest.filter(({ centre }) => centre < middle).reverse()) pack(children, shape, g + 1, true, at, -1);
    // A lone child of an outer parent who stands off to the side because of the others' children hangs
    // on a straight line: the parent steps outward to stand over it. Not when that parent has other unions.
    for (const { key, members } of groups) {
      const [id] = key.split(',');
      if (key.includes(',') || members.length !== 1 || groups.some((other) => other.key !== key && other.key.split(',').includes(id))) continue;
      const to = children.xs.get(members[0].via);
      const xsOwn = [...own.values()];
      if (to == null || to === own.get(id)) continue;
      if (to < own.get(id)! && own.get(id) === Math.min(...xsOwn)) own.set(id, to);
      else if (to > own.get(id)! && own.get(id) === Math.max(...xsOwn)) own.set(id, to);
    }
    shape.contour.set(g, [Math.min(...own.values()), Math.max(...own.values())]);
    return pack(shape, children, Infinity, false);
  };

  // A root whose child already hangs elsewhere (an in-law family) stands over that child, on the side
  // where the child stands next to its partner: right of the tree when the child stands right of
  // them, else left. Its other children spread away from the tree, the couple half as far so it
  // stays centred. Without room it packs next to the tree and slides back over the middle of its
  // children as far as its own row allows; its own descendants move outward for the rest.
  const tree: Shape = { xs: new Map(), contour: new Map() };
  const recontour = () => {
    tree.contour.clear();
    for (const [id, x] of tree.xs) {
      const [l, r] = tree.contour.get(genOf(id)) ?? [x, x];
      tree.contour.set(genOf(id), [Math.min(l, x), Math.max(r, x)]);
    }
  };
  const childIdsOf = (unit: string[]) => people.filter((p) => parentsOf(p.id).some((id) => unit.includes(id))).map((p) => p.id);
  const ownChild = (unit: string[], id: string) => childrenOf.get(unit)!.some(({ unit: child }) => child.includes(id));
  const placeRoots = () => {
    tree.xs.clear();
    tree.contour.clear();
    for (const left = [...roots]; left.length; ) {
      const next = left.findIndex((r) => childIdsOf(r).some((id) => tree.xs.has(id)));
      // Otherwise a root that owns all its children goes first, so a root with a child hanging under
      // another family waits for that family and can then stand over the child's side.
      const primary = left.findIndex((r) => !childIdsOf(r).some((id) => !ownChild(r, id)));
      const [root] = left.splice(next >= 0 ? next : Math.max(primary, 0), 1);
      const anchor = childIdsOf(root).find((id) => tree.xs.has(id) && !ownChild(root, id));
      const mates = anchor ? unitOf.get(anchor)!.filter((id) => id !== anchor && tree.xs.has(id)).map((id) => tree.xs.get(id)!) : [];
      const side = anchor && mates.length && mates.every((x) => x > tree.xs.get(anchor)!) ? -1 : 1;
      const shape = layout(root, anchor ? { id: anchor, edge: -side } : undefined);
      if (anchor) {
        const by = tree.xs.get(anchor)! - shape.xs.get(anchor)!;
        shape.xs.delete(anchor);
        const moved = (id: string, x: number, spread: number) => x + by + side * (root.includes(id) ? spread / 2 : spread);
        const clash = (spread: number) =>
          [...shape.xs].some(([id, x]) =>
            [...tree.xs].some(([other, ox]) => genOf(other) === genOf(id) && Math.abs(ox - moved(id, x, spread)) < NAME_GAP + FAMILY_GAP),
          );
        let spread = 0;
        while (spread < 60 && clash(spread)) spread += 1;
        if (!clash(spread)) {
          for (const [id, x] of shape.xs) tree.xs.set(id, moved(id, x, spread));
          recontour();
          continue;
        }
      }
      pack(tree, shape, Infinity, false, side > 0 ? -Infinity : Infinity, side);
      if (next < 0) continue;
      const ends = childIdsOf(root).map((id) => tree.xs.get(id)!);
      const g = genOf(root[0]);
      const [l, r] = [tree.xs.get(root[0])!, tree.xs.get(root.at(-1)!)!];
      const centre = (l + r) / 2;
      const target = (Math.min(...ends) + Math.max(...ends)) / 2;
      const row = [...tree.xs].filter(([id, x]) => genOf(id) === g && !root.includes(id) && (side > 0 ? x < l : x > r)).map(([, x]) => x);
      const by =
        side > 0
          ? Math.max(target - centre, Math.max(...row) + NAME_GAP + FAMILY_GAP - l)
          : Math.min(target - centre, Math.min(...row) - NAME_GAP - FAMILY_GAP - r);
      for (const id of root) tree.xs.set(id, tree.xs.get(id)! + by);
      const below = [...shape.xs.keys()].filter((id) => !root.includes(id));
      for (const id of below) tree.xs.set(id, tree.xs.get(id)! + 2 * (centre + by - target));
      recontour();
    }
  };
  placeRoots();
  // A sibling group whose married sibling hangs under the partner's family leans toward that sibling,
  // as toward a taken edge; that side is known only once placed, so the roots are placed again.
  const hanging = new Set([...childrenOf.values()].flat().map((kid) => kid.via));
  const mean = (ids: string[]) => ids.reduce((sum, id) => sum + tree.xs.get(id)!, 0) / ids.length;
  for (const { parents, children } of model.unions) {
    const here = children.filter((id) => hanging.has(id) && tree.xs.has(id));
    const away = children.filter((id) => !hanging.has(id) && tree.xs.has(id));
    if (here.length && away.length) hints.set([...parents].sort().join(), Math.sign(mean(away) - mean(here)));
  }
  if (hints.size) placeRoots();
  const xs = [...tree.xs.values()];
  const middle = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  const last = Math.max(0, ...level.values());
  return new Map([...tree.xs].map(([id, x]): [string, Point] => [id, [x - middle, (last - genOf(id)) * ROW_GAP, 0]]));
}
