// Fixed positions for the experimental view's flat family tree: one row per generation, partners
// side by side, children below their parents. Pure and derived from the relations only, so the same
// family always looks the same; `simpleLayout.check.mjs` tests it. `gen` comes from `generations()`
// (passed in, so the check can import both without a bundler).
import type { Point } from './pins';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

export const NAME_GAP = 6;
export const FAMILY_GAP = 2;
export const ROW_GAP = 6;

// ponytail: rows are ordered by the parents' average x and centred, but parents are not centred
// over their children, so tangled families can cross lines; a Reingold–Tilford pass fixes that.
export function simpleLayout(people: Person[], gen: Map<string, number>) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const last = Math.max(0, ...gen.values());
  const at = new Map<string, Point>();
  // Average x of the placed parents, or null for none.
  const key = (p: Person) => {
    const xs = p.parentIds.flatMap((id) => (at.has(id) ? [at.get(id)![0]] : []));
    return xs.length ? xs.reduce((a, b) => a + b) / xs.length : null;
  };
  const order = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity) || 0;
  for (let g = 0; g <= last; g++) {
    const row = people.filter((p) => gen.get(p.id) === g).sort((a, b) => a.id.localeCompare(b.id));
    // Partners in the same row form a unit and stay together.
    const seen = new Set<string>();
    const units: Person[][] = [];
    for (const p of row) {
      if (seen.has(p.id)) continue;
      const unit: Person[] = [];
      for (const queue = [p]; queue.length; ) {
        const next = queue.shift()!;
        if (seen.has(next.id)) continue;
        seen.add(next.id);
        unit.push(next);
        for (const id of next.partnerIds) if (gen.get(id) === g) queue.push(byId.get(id)!);
      }
      unit.sort((a, b) => order(key(a), key(b)));
      units.push(unit);
    }
    const unitKey = (unit: Person[]) => {
      const keys = unit.map(key).filter((k) => k != null);
      return keys.length ? keys.reduce((a, b) => a + b) / keys.length : null;
    };
    units.sort((a, b) => order(unitKey(a), unitKey(b)));
    const xs: [string, number][] = [];
    let x = 0;
    units.forEach((unit, i) => {
      if (i) x += FAMILY_GAP;
      for (const p of unit) {
        xs.push([p.id, x]);
        x += NAME_GAP;
      }
    });
    const shift = (x - NAME_GAP) / 2;
    for (const [id, px] of xs) at.set(id, [px - shift, (last - g) * ROW_GAP, 0]);
  }
  return at;
}
