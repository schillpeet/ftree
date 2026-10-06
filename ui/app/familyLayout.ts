import type { Point } from './pins';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

// Line segments (as point pairs) in family-tree style: from each parent a line drops to a bar
// joining them, from the middle of that bar a stem drops to a second bar, and each child hangs
// from it. Partners without shared children get a direct line instead.
export function relationLines(people: Person[], positions: Map<string, Point>) {
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
  const angle = ([x, , z]: Point) => Math.atan2(z, x);
  const plans = [...families.values()].map(({ parentIds, childIds }) => {
    const parentY = Math.min(...parentIds.map((id) => at(id)[1]));
    const drop = parentY - Math.max(...childIds.map((id) => at(id)[1]));
    const drops = parentIds.map((id) => level(at(id), parentY - drop / 2)).sort((a, b) => a[0] - b[0]);
    const middle = [0, 1, 2].map((k) => drops.reduce((sum, d) => sum + d[k], 0) / drops.length) as Point;
    const spans = [middle, ...childIds.map(at)].map(angle);
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

  for (const { parentIds, childIds, parentY, drop, drops, middle, lane } of plans) {
    const lanes = lanesByRow.get(parentY)!.length;
    // Lanes share the space between 60 % and 85 % of the way down to the children.
    const childBar = parentY - drop * (lanes > 1 ? 0.6 + (0.25 * lane) / (lanes - 1) : 0.75);
    for (const id of parentIds) parents.push(at(id), level(at(id), parentY - drop / 2));
    for (let i = 1; i < drops.length; i++) parents.push(drops[i - 1], drops[i]);
    parents.push(middle, level(middle, childBar));
    for (const id of childIds) {
      parents.push(level(middle, childBar), level(at(id), childBar), level(at(id), childBar), at(id));
    }
  }
  return { parents, partners };
}
