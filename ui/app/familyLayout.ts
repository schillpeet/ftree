type Person = { id: string; parentIds: string[]; partnerIds: string[] };

// Scrolls hang on an arc in front of the tree, facing the start camera, one row per generation.
const TOP = 21;
const BOTTOM = 3;
const MAX_ROW_GAP = 7;
const RADIUS = 12;
const SLOT_ANGLE = 5 / RADIUS;
const FRONT = Math.atan2(50, 40);

// Generation 0 is the top row. Everyone sits below all of their parents and in the same row
// as their partners; someone without known parents (e.g. an in-law) sits right above their children.
export function generations(people: Person[]) {
  const ids = new Set(people.map((p) => p.id));
  const known = (list: string[]) => list.filter((id) => ids.has(id));
  const gen = new Map(people.map((p) => [p.id, 0]));
  let moved = true;
  const lower = (id: string, g: number) => {
    if (g > gen.get(id)!) {
      gen.set(id, g);
      moved = true;
    }
  };

  // The rules only ever move people down, so repeat until nothing moves. The pass limit stops
  // data the BFF should have rejected (a cycle) from looping forever.
  for (let pass = 0; moved && pass <= people.length; pass++) {
    moved = false;
    for (const p of people) {
      for (const id of known(p.parentIds)) lower(p.id, gen.get(id)! + 1);
      for (const id of known(p.partnerIds)) lower(p.id, gen.get(id)!);
      if (known(p.parentIds).length) continue;
      const childGens = people.filter((c) => c.parentIds.includes(p.id)).map((c) => gen.get(c.id)!);
      if (childGens.length) lower(p.id, Math.min(...childGens) - 1);
    }
  }
  return gen;
}

// Positions relative to the tree base. Within a row, partners sit side by side and siblings sit
// centred under their parents, so families stay stacked.
export function layoutScrolls(people: Person[]) {
  const gen = generations(people);
  const rows: Person[][] = [];
  const top = Math.min(...gen.values());
  people.forEach((p) => (rows[gen.get(p.id)! - top] ??= []).push(p));

  const gap = rows.length > 1 ? Math.min(MAX_ROW_GAP, (TOP - BOTTOM) / (rows.length - 1)) : 0;
  const slot = new Map<string, number>();
  const positions = new Map<string, [number, number, number]>();
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b) / values.length : 0);

  rows.forEach((row, g) => {
    const byId = new Map(row.map((p) => [p.id, p]));
    const parentSlots = (p: Person) => p.parentIds.filter((id) => slot.has(id)).map((id) => slot.get(id)!);

    // Partners in this row form one group, kept together.
    const seen = new Set<string>();
    const groups: Person[][] = [];
    for (const start of row) {
      if (seen.has(start.id)) continue;
      const group = [start];
      seen.add(start.id);
      for (let i = 0; i < group.length; i++) {
        for (const id of group[i].partnerIds) {
          const partner = byId.get(id);
          if (partner && !seen.has(id)) {
            seen.add(id);
            group.push(partner);
          }
        }
      }
      groups.push(group.sort((a, b) => mean(parentSlots(a)) - mean(parentSlots(b))));
    }
    const anchor = (group: Person[]) => {
      const slots = group.flatMap(parentSlots);
      return slots.length ? mean(slots) : null;
    };
    groups.sort((a, b) => (anchor(a) ?? 0) - (anchor(b) ?? 0));

    // Siblings hanging from the same parents form one block centred under them. A block that
    // would run into the previous one moves outward instead of mixing with it.
    const blocks: { anchor: number | null; people: Person[] }[] = [];
    for (const group of groups) {
      const last = blocks.at(-1);
      const a = anchor(group);
      if (last && a !== null && last.anchor === a) last.people.push(...group);
      else blocks.push({ anchor: a, people: [...group] });
    }

    const place = (p: Person, s: number) => {
      slot.set(p.id, s);
      const a = FRONT + s * SLOT_ANGLE;
      positions.set(p.id, [Math.cos(a) * RADIUS, TOP - g * gap, Math.sin(a) * RADIUS]);
    };
    const ordered = blocks.flatMap((b) => b.people);
    if (blocks.every((b) => b.anchor === null)) {
      ordered.forEach((p, i) => place(p, i - (ordered.length - 1) / 2));
      return;
    }
    let next = -Infinity;
    for (const { anchor: a, people: block } of blocks) {
      const half = (block.length - 1) / 2;
      const centre = a ?? (Number.isFinite(next) ? next + half : 0);
      const start = Math.max(centre - half, next);
      block.forEach((p, i) => place(p, start + i));
      next = start + block.length;
    }
  });
  return positions;
}

type Point = [number, number, number];

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
