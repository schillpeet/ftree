type Person = { id: string; parentIds: string[] };

// Scrolls hang on an arc in front of the tree, facing the start camera, one row per generation.
const TOP = 21;
const BOTTOM = 3;
const MAX_ROW_GAP = 7;
const RADIUS = 12;
const SLOT_ANGLE = 5 / RADIUS;
const FRONT = Math.atan2(50, 40);

// Generation 0 is the top row; everyone sits at least one row below all of their parents.
export function generations(people: Person[]) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const gen = new Map<string, number>();
  const visit = (id: string): number => {
    const known = gen.get(id);
    if (known !== undefined) return known;
    gen.set(id, 0); // The BFF rejects cycles; this only stops a bad record from recursing forever.
    const parents = byId.get(id)!.parentIds.filter((p) => byId.has(p));
    const g = parents.length ? 1 + Math.max(...parents.map(visit)) : 0;
    gen.set(id, g);
    return g;
  };
  people.forEach((p) => visit(p.id));
  // Someone without known parents (e.g. an in-law) moves down to sit right above their children.
  people.forEach((p) => {
    if (p.parentIds.some((id) => byId.has(id))) return;
    const childGens = people.filter((c) => c.parentIds.includes(p.id)).map((c) => gen.get(c.id)!);
    if (childGens.length) gen.set(p.id, Math.max(0, Math.min(...childGens) - 1));
  });
  return gen;
}

// Positions relative to the tree base. Within a row, people sit near the average slot of
// their parents so families stay roughly stacked.
export function layoutScrolls(people: Person[]) {
  const gen = generations(people);
  const rows: Person[][] = [];
  const top = Math.min(...gen.values());
  people.forEach((p) => (rows[gen.get(p.id)! - top] ??= []).push(p));

  const gap = rows.length > 1 ? Math.min(MAX_ROW_GAP, (TOP - BOTTOM) / (rows.length - 1)) : 0;
  const slot = new Map<string, number>();
  const positions = new Map<string, [number, number, number]>();

  rows.forEach((row, g) => {
    const anchor = (p: Person) => {
      const s = p.parentIds.filter((id) => slot.has(id)).map((id) => slot.get(id)!);
      return s.length ? s.reduce((a, b) => a + b) / s.length : 0;
    };
    const ordered = g === 0 ? row : [...row].sort((a, b) => anchor(a) - anchor(b));
    ordered.forEach((p, i) => {
      const s = i - (ordered.length - 1) / 2;
      slot.set(p.id, s);
      const a = FRONT + s * SLOT_ANGLE;
      positions.set(p.id, [Math.cos(a) * RADIUS, TOP - g * gap, Math.sin(a) * RADIUS]);
    });
  });
  return positions;
}
