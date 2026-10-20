import type { Point } from './pins';

type Person = {
  id: string;
  parentIds: string[];
  partnerIds: string[];
  partnerships?: readonly { partnerId: string; status: string }[];
};

// Line segments (as point pairs) in family-tree style: from each parent a line drops to a bar
// joining them, from the middle of that bar a stem drops to a second bar, and each child hangs
// from it. Partners without shared children get a direct line instead. `along` orders bars within a
// row: the angle around the trunk by default, plain x for a flat tree.
// With `focusId`, the segments on the way from that person to everyone their person panel lists
// (parents, partners, children, siblings, half-siblings) go to `focused` and `focusedDashed` instead.
const angle = ([x, , z]: Point) => Math.atan2(z, x);
const separated = (people: Person[], a: string, b: string) =>
  people.find((p) => p.id === a)?.partnerships?.some((p) => p.partnerId === b && p.status === 'separated') ?? false;

export function relationLines(people: Person[], positions: Map<string, Point>, along = angle, fork = 0, focusId: string | null = null) {
  const parents: Point[] = [];
  const partners: Point[] = [];
  // Flat trees only: the lines of couples who split up, to draw dashed.
  const dashed: Point[] = [];
  const focused: Point[] = [];
  const focusedDashed: Point[] = [];
  const add = (list: Point[], marked: boolean, ...points: Point[]) =>
    (marked ? (list === dashed ? focusedDashed : focused) : list).push(...points);
  const focus = focusId ? people.find((p) => p.id === focusId) : undefined;
  // The focused person and their relatives as `relativesOf` lists them.
  const related = new Set<string>();
  if (focus) {
    related.add(focus.id);
    for (const p of people)
      if (focus.parentIds.includes(p.id) || focus.partnerIds.includes(p.id) || p.parentIds.some((id) => id === focus.id || focus.parentIds.includes(id)))
        related.add(p.id);
  }
  const touchesFocus = (a: string, b: string) => focus != null && (a === focus.id || b === focus.id);
  const at = (id: string) => positions.get(id)!;
  const level = ([x, , z]: Point, y: number): Point => [x, y, z];

  // Siblings share bars only if they have exactly the same parents.
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const p of people) {
    const parentIds = p.parentIds.filter((id) => positions.has(id)).sort();
    if (!parentIds.length) continue;
    const key = parentIds.join();
    if (!families.has(key)) families.set(key, { parentIds, childIds: [] });
    families.get(key)!.childIds.push(p.id);
  }

  // With `fork` (flat trees), a child of one parent alone hangs from the bar of that parent's couple
  // whose children stand nearest, as one family, instead of from a bar of its own.
  if (fork) {
    for (const [key, { parentIds, childIds }] of [...families]) {
      if (parentIds.length !== 1) continue;
      const nearest = [...families.values()]
        .filter((other) => other.parentIds.length > 1 && other.parentIds.includes(parentIds[0]))
        .map((other) => ({ other, gap: Math.min(...other.childIds.flatMap((a) => childIds.map((b) => Math.abs(along(at(a)) - along(at(b)))))) }))
        .sort((a, b) => a.gap - b.gap)[0];
      if (!nearest) continue;
      nearest.other.childIds.push(...childIds);
      families.delete(key);
    }
  }

  for (const p of people) {
    for (const id of p.partnerIds) {
      const haveChildren = families.has([p.id, id].sort().join());
      if (id > p.id && positions.has(id) && !haveChildren) add(partners, touchesFocus(p.id, id), at(p.id), at(id));
    }
  }

  // Child bars of different families in one row get their own heights wherever they overlap,
  // so two families never look like one.
  const plans = [...families.values()].map(({ parentIds, childIds }) => {
    const parentY = Math.min(...parentIds.map((id) => at(id)[1]));
    const drop = parentY - Math.max(...childIds.map((id) => at(id)[1]));
    const drops = parentIds.map((id) => level(at(id), parentY - drop / 2)).sort((a, b) => a[0] - b[0]);
    const middle = [0, 1, 2].map((k) => drops.reduce((sum, d) => sum + d[k], 0) / drops.length) as Point;
    const spans = [middle, ...childIds.map(at)].map(along);
    return { parentIds, childIds, parentY, drop, drops, middle, from: Math.min(...spans), to: Math.max(...spans), lane: 0 };
  });
  const lanesByRow = new Map<number, number[]>();
  for (const plan of [...plans].sort((a, b) => a.from - b.from)) {
    const ends = lanesByRow.get(plan.parentY) ?? [];
    lanesByRow.set(plan.parentY, ends);
    plan.lane = ends.findIndex((end) => end < plan.from - 1e-6);
    if (plan.lane < 0) plan.lane = ends.length;
    ends[plan.lane] = plan.to;
  }

  // With `fork` (flat trees only, it steps along x), someone with children by several partners forks
  // halfway down to the couple bars: each branch steps `fork` toward that partner, so every couple
  // gets a bar of its own, and the branch to children of theirs alone runs over to those children.
  // The stems stay centred over their children.
  const familiesOf = new Map<string, number>();
  for (const { parentIds } of plans) for (const id of parentIds) familiesOf.set(id, (familiesOf.get(id) ?? 0) + 1);
  // Someone whose partners all stand on one side drops straight to the bars; only with partners on
  // both sides each branch steps toward its partner, so the couples get bars of their own.
  const bothSides = (id: string) => {
    const sides = new Set<number>();
    for (const { parentIds } of plans)
      if (parentIds.includes(id))
        for (const other of parentIds) if (other !== id) sides.add(Math.sign(at(other)[0] - at(id)[0]));
    return sides.has(-1) && sides.has(1);
  };
  // A separated couple without children: when one of them has a family of their own, a dashed line
  // runs at that family's bar height to the former partner, who drops straight down to it; else it
  // joins the two under their names.
  if (fork)
    for (const p of people)
      for (const id of p.partnerIds) {
        if (!(id > p.id && positions.has(id) && separated(people, p.id, id) && !families.has([p.id, id].sort().join()))) continue;
        const [a, b] = [at(p.id), at(id)];
        const marked = touchesFocus(p.id, id);
        const own = [p.id, id].map((who) => plans.find((plan) => plan.parentIds.includes(who) && plan.parentY === a[1])).find(Boolean);
        const hub = own && [p.id, id].find((who) => own.parentIds.includes(who))!;
        if (own && hub && !bothSides(hub)) {
          const y = own.parentY - own.drop / 2;
          const [from, to] = hub === p.id ? [a, b] : [b, a];
          add(dashed, marked, level(from, y), level(to, y));
          add(parents, marked, to, level(to, y));
        } else {
          const under = (point: Point): Point => [point[0], point[1] - 2, point[2]];
          add(dashed, marked, a, under(a), under(a), under(b), under(b), b);
        }
      }
  for (const { parentIds, childIds, parentY, drop, middle, lane } of plans) {
    const lanes = lanesByRow.get(parentY)!.length;
    const barY = parentY - drop / 2;
    // Lanes share the space between 60 % and 85 % of the way down to the children.
    const childBar = parentY - drop * (lanes > 1 ? 0.6 + (0.25 * lane) / (lanes - 1) : 0.75);
    const childXs = childIds.map((id) => at(id)[0]);
    // The focused person's way into this family: themselves, or for half-siblings the shared parent.
    const anchor = focus && ([...parentIds, ...childIds].includes(focus.id) ? focus.id : parentIds.find((id) => focus.parentIds.includes(id)));
    const on = (id: string) => anchor != null && related.has(id);
    const linked = parentIds.some(on) && childIds.some(on);
    const ends = parentIds.map((id) => {
      const [x, , z] = at(id);
      const others = parentIds.filter((other) => other !== id).map((other) => at(other)[0]);
      let endX = x;
      if (fork && familiesOf.get(id)! > 1 && (!others.length || bothSides(id)))
        endX = others.length
          ? x + fork * Math.sign(others.reduce((a, b) => a + b) / others.length - x)
          : (Math.min(...childXs) + Math.max(...childXs)) / 2;
      const end: Point = [endX, barY, z];
      if (endX === x) add(parents, on(id), at(id), end);
      else {
        const forkY = parentY - drop / 4;
        add(parents, on(id), at(id), [x, forkY, z], [x, forkY, z], [endX, forkY, z], [endX, forkY, z], end);
      }
      return end;
    });
    const reached = parentIds.flatMap((id, i) => (on(id) ? [ends[i][0]] : []));
    ends.sort((a, b) => a[0] - b[0]);
    // The bar of a separated couple is dashed, and its children hang straight below the partner who
    // is not the one with several families, so the bar reads as a link to the earlier partner.
    const apart = fork > 0 && parentIds.length === 2 && separated(people, parentIds[0], parentIds[1]);
    const former = apart ? [...parentIds].sort((a, b) => familiesOf.get(a)! - familiesOf.get(b)!)[0] : undefined;
    const stem =
      ends.length === 1 ? ends[0] : former ? level(at(former), barY) : level(middle, barY);
    // The bar is focused between the outermost focused parents, and the stem when it leads to a child.
    const xs = linked ? [...reached, stem[0]] : reached;
    const between = (a: Point, b: Point) =>
      xs.length > 1 && Math.min(a[0], b[0]) >= Math.min(...xs) - 1e-6 && Math.max(a[0], b[0]) <= Math.max(...xs) + 1e-6;
    for (let i = 1; i < ends.length; i++) add(apart ? dashed : parents, between(ends[i - 1], ends[i]), ends[i - 1], ends[i]);
    add(parents, linked, stem, level(stem, childBar));
    for (const id of childIds) {
      add(parents, on(id), level(stem, childBar), level(at(id), childBar), level(at(id), childBar), at(id));
    }
  }
  return { parents, partners, dashed, focused, focusedDashed };
}
