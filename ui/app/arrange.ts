// Moves related members onto nearby pins, so families cluster instead of spreading around the
// crown. Pure, so `arrange.check.mjs` can test it without a scene.
import type { Point } from './pins';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

// Parent and partner links between pinned members should be about `distance` long. Members without
// such links keep their pin and block it.
// ponytail: links to free-positioned or waiting members are ignored, and this is a local search
// from `base` (single moves and swaps), not a global optimum.
export function arrangePins(people: Person[], pins: Point[], base: Map<string, number>, distance: number) {
  // Members by index: `at[i]` is the pin of `ids[i]`, `links[i]` its linked members.
  const ids = [...base.keys()];
  const index = new Map(ids.map((id, i) => [id, i]));
  const at = ids.map((id) => base.get(id)!);
  const links = ids.map(() => new Set<number>());
  for (const p of people) {
    const a = index.get(p.id);
    for (const other of [...p.parentIds, ...p.partnerIds]) {
      const b = index.get(other);
      if (a === undefined || b === undefined || a === b) continue;
      links[a].add(b);
      links[b].add(a);
    }
  }
  const neighbours = links.map((s) => [...s]);

  const cost = (i: number) => {
    const [x, y, z] = pins[at[i]];
    let sum = 0;
    for (const n of neighbours[i]) {
      const [nx, ny, nz] = pins[at[n]];
      sum += (Math.sqrt((x - nx) ** 2 + (y - ny) ** 2 + (z - nz) ** 2) - distance) ** 2;
    }
    return sum;
  };
  const movable = people.flatMap((p) => {
    const i = index.get(p.id);
    return i !== undefined && neighbours[i].length ? [i] : [];
  });
  const taken = new Set(at);
  const free = new Set(pins.flatMap((_, i) => (taken.has(i) ? [] : [i])));

  for (let pass = 0; pass < 20; pass++) {
    let improved = false;
    for (const m of movable) {
      for (const q of [...free]) {
        const [p, before] = [at[m], cost(m)];
        at[m] = q;
        if (cost(m) < before) {
          free.delete(q);
          free.add(p);
          improved = true;
        } else at[m] = p;
      }
      for (const o of movable) {
        if (o === m) continue;
        const [p, q, before] = [at[m], at[o], cost(m) + cost(o)];
        // A link between m and o keeps its length and counts on both sides alike.
        [at[m], at[o]] = [q, p];
        if (cost(m) + cost(o) < before) improved = true;
        else [at[m], at[o]] = [p, q];
      }
    }
    if (!improved) break;
  }
  return new Map(ids.map((id, i) => [id, at[i]]));
}

// Link length for the relation spacing slider (−10…+10): −10 is `minDistance` (two cards side by
// side), 0 twice that, +10 the widest distance between any two pins, interpolated logarithmically.
// `minDistance` is a parameter because plain node cannot resolve a value import of './pins'.
// ponytail: O(n²) scan over all pins, fine for the few hundred pins a crown has.
export function relationDistance(spacing: number, pins: Point[], minDistance: number) {
  const near = 2 * minDistance;
  if (spacing <= 0) return minDistance * 2 ** ((spacing + 10) / 10);
  let far = near;
  pins.forEach(([x, y, z], i) => {
    for (const [nx, ny, nz] of pins.slice(i + 1)) far = Math.max(far, Math.hypot(x - nx, y - ny, z - nz));
  });
  return near * (far / near) ** (spacing / 10);
}
