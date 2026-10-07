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

// Moves cards so each hangs at least `gap` below its pinned parents. Earlier generations go first;
// a card keeps its pin if it fits there. Otherwise it takes the nearest free pin that fits, else
// the nearest free pin that is at least lower than the parents, else it stays. A card with pinned
// descendants only fits where enough pins hang below it, `gap` per generation (or at least lower
// when the crown is too small for that), so ancestors that hang too low move up and make room.
// ponytail: the room count includes pins held by unrelated cards, so a crowded crown can leave a
// child less than `gap` below its parents; reserve pins per family if that shows up in real trees.
export function layerPins(people: Person[], pins: Point[], pinOf: Map<string, number>, gap: number) {
  const gen = generations(people);
  const parentsOf = new Map(people.map((p) => [p.id, p.parentIds]));
  const childrenOf = new Map<string, string[]>();
  for (const p of people)
    if (pinOf.has(p.id)) for (const parent of p.parentIds) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), p.id]);
  // `need[k]`: pinned descendants k + 1 or more generations below; they need that many pins at
  // least (k + 1) * gap lower.
  const needOf = (id: string) => {
    const counts: number[] = [];
    const seen = new Set([id]);
    for (let level = childrenOf.get(id) ?? []; level.length; level = level.flatMap((c) => childrenOf.get(c) ?? [])) {
      level = [...new Set(level)].filter((c) => !seen.has(c));
      level.forEach((c) => seen.add(c));
      if (level.length) counts.push(level.length);
    }
    return counts.map((_, k) => counts.slice(k).reduce((a, b) => a + b));
  };
  // n pins hang at or below y exactly when the nth lowest pin does.
  const lowest = pins.map((p) => p[1]).sort((a, b) => a - b);
  const result = new Map(pinOf);
  const taken = new Set(pinOf.values());
  const y = (id: string) => pins[result.get(id)!][1];
  const order = [...pinOf.keys()].sort((a, b) => (gen.get(a) ?? 0) - (gen.get(b) ?? 0) || y(b) - y(a) || a.localeCompare(b));
  for (const id of order) {
    const bound = Math.min(...(parentsOf.get(id) ?? []).filter((p) => result.has(p)).map(y));
    const need = needOf(id);
    // Enough pins hang below for all descendants, `step` per generation; with step 0 just lower.
    const roomy = (step: number) => (pinY: number) =>
      need.every((n, k) => (step ? pinY - (k + 1) * step >= lowest[n - 1] : pinY > lowest[n - 1]));
    const at = result.get(id)!;
    // The own pin is an option too: at distance 0 it wins whenever it fits.
    const options = pins.flatMap((_, i) => (i === at || !taken.has(i) ? [i] : []));
    const distance = (i: number) => Math.hypot(...pins[i].map((v, k) => v - pins[at][k]));
    const nearest = (...fits: ((pinY: number) => boolean)[]) =>
      options.filter((i) => fits.every((f) => f(pins[i][1]))).sort((a, b) => distance(a) - distance(b) || a - b)[0];
    const clear = (pinY: number) => pinY <= bound - gap;
    const lower = (pinY: number) => pinY < bound;
    const to =
      nearest(clear, roomy(gap)) ??
      nearest(clear, roomy(0)) ??
      nearest(lower, roomy(0)) ??
      nearest(clear) ??
      nearest(lower) ??
      at;
    taken.delete(at);
    taken.add(to);
    result.set(id, to);
  }
  // Last resort when the crown is too small or crowded: a child still hanging above a parent swaps
  // pins with them. Each swap moves a later generation down, so the rounds settle.
  for (let round = 0, swapped = true; swapped && round <= people.length; round++) {
    swapped = false;
    for (const p of people)
      for (const parent of p.parentIds)
        if (result.has(p.id) && result.has(parent) && y(p.id) > y(parent)) {
          const pin = result.get(p.id)!;
          result.set(p.id, result.get(parent)!).set(parent, pin);
          swapped = true;
        }
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
