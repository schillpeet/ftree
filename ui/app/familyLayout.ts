import type { Point } from './pins';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

// Line segments (as point pairs) in family-tree style: from each parent a line drops to a bar
// joining them, from the middle of that bar a stem drops to a second bar, and each child hangs
// from it. Partners without shared children get a direct line instead. `along` orders bars within a
// row: the angle around the trunk by default, plain x for a flat tree.
const angle = ([x, , z]: Point) => Math.atan2(z, x);
export function relationLines(people: Person[], positions: Map<string, Point>, along = angle, fork = 0) {
  const parents: Point[] = [];
  const partners: Point[] = [];
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

  for (const p of people) {
    for (const id of p.partnerIds) {
      const haveChildren = families.has([p.id, id].sort().join());
      if (id > p.id && positions.has(id) && !haveChildren) partners.push(at(p.id), at(id));
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
  for (const { parentIds, childIds, parentY, drop, middle, lane } of plans) {
    const lanes = lanesByRow.get(parentY)!.length;
    // Lanes share the space between 60 % and 85 % of the way down to the children.
    const childBar = parentY - drop * (lanes > 1 ? 0.6 + (0.25 * lane) / (lanes - 1) : 0.75);
    const childXs = childIds.map((id) => at(id)[0]);
    const ends = parentIds.map((id) => {
      const [x, , z] = at(id);
      const others = parentIds.filter((other) => other !== id).map((other) => at(other)[0]);
      let endX = x;
      if (fork && familiesOf.get(id)! > 1)
        endX = others.length
          ? x + fork * Math.sign(others.reduce((a, b) => a + b) / others.length - x)
          : (Math.min(...childXs) + Math.max(...childXs)) / 2;
      const end: Point = [endX, parentY - drop / 2, z];
      if (endX === x) parents.push(at(id), end);
      else {
        const forkY = parentY - drop / 4;
        parents.push(at(id), [x, forkY, z], [x, forkY, z], [endX, forkY, z], [endX, forkY, z], end);
      }
      return end;
    });
    ends.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ends.length; i++) parents.push(ends[i - 1], ends[i]);
    const stem = ends.length === 1 ? ends[0] : middle;
    parents.push(stem, level(stem, childBar));
    for (const id of childIds) {
      parents.push(level(stem, childBar), level(at(id), childBar), level(at(id), childBar), at(id));
    }
  }
  return { parents, partners };
}
