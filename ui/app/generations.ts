// Keeps generations ordered top to bottom: parents hang above their children. Display-only and
// pure, so `generations.check.mjs` can test it without a scene.
// Free and waiting cards are not moved, only kept in order when dragging.
import type { Point } from './pins';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

// Member id → generation, 0 at the top. A child is at least one below each parent, partners share
// the later of their two generations. Links to unknown ids are ignored; the round limit stops
// ancestor cycles.
export function generations(people: Person[]) {
  const g = new Map(people.map((p) => [p.id, 0]));
  for (let round = 0; round <= people.length; round++) {
    let changed = false;
    const raise = (id: string, to: number) => {
      if (g.get(id)! >= to) return;
      g.set(id, to);
      changed = true;
    };
    for (const p of people) {
      for (const parent of p.parentIds) if (g.has(parent)) raise(p.id, g.get(parent)! + 1);
      for (const partner of p.partnerIds)
        if (g.has(partner)) {
          raise(p.id, g.get(partner)!);
          raise(partner, g.get(p.id)!);
        }
    }
    if (!changed) break;
  }
  return g;
}

// Moves cards that hang too high down to free pins, so each card hangs at least `gap` below its
// pinned parents. Earlier generations go first; a card that already fits, or has no pinned parent,
// keeps its pin. Otherwise it takes the nearest free pin that fits, else the nearest free pin that
// is at least lower than the parents, else it stays.
// ponytail: ancestors are never pushed up, so a root hanging low can leave its descendants without
// room; lift ancestors too if that shows up in real trees.
export function layerPins(people: Person[], pins: Point[], pinOf: Map<string, number>, gap: number) {
  const gen = generations(people);
  const parentsOf = new Map(people.map((p) => [p.id, p.parentIds]));
  const result = new Map(pinOf);
  const taken = new Set(pinOf.values());
  const y = (id: string) => pins[result.get(id)!][1];
  const order = [...pinOf.keys()].sort((a, b) => (gen.get(a) ?? 0) - (gen.get(b) ?? 0) || y(b) - y(a) || a.localeCompare(b));
  for (const id of order) {
    const bound = Math.min(...(parentsOf.get(id) ?? []).filter((p) => result.has(p)).map(y));
    const at = result.get(id)!;
    // The own pin is an option too: at distance 0 it wins whenever it fits.
    const options = pins.flatMap((_, i) => (i === at || !taken.has(i) ? [i] : []));
    const distance = (i: number) => Math.hypot(...pins[i].map((v, k) => v - pins[at][k]));
    const nearest = (fits: (pinY: number) => boolean) =>
      options.filter((i) => fits(pins[i][1])).sort((a, b) => distance(a) - distance(b) || a - b)[0];
    const to = nearest((pinY) => pinY <= bound - gap) ?? nearest((pinY) => pinY < bound) ?? at;
    taken.delete(at);
    taken.add(to);
    result.set(id, to);
  }
  return result;
}

// Heights a member's card may be dropped between: at least `gap` below its lowest parent and above
// its highest child. `at` holds the placed cards only (pinned or free), so waiting relatives do not
// count.
export function generationBounds(id: string, people: Person[], at: Map<string, Point>, gap: number) {
  const ys = (ids: string[]) => ids.flatMap((other) => (at.has(other) ? [at.get(other)![1]] : []));
  const parents = people.find((p) => p.id === id)?.parentIds ?? [];
  const children = people.filter((p) => p.parentIds.includes(id)).map((p) => p.id);
  return { lowest: Math.max(...ys(children)) + gap, highest: Math.min(...ys(parents)) - gap };
}
