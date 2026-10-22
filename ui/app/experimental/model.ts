// What the experimental view's circuit diagram draws, derived from relations only: unions (parents
// with the children hanging from them) and partnerships; `model.check.mjs` tests it. A child hangs
// from the union of its biological parents; without any it hangs dotted from all its parents.
import { generations } from '../generations.ts';

export type Person = {
  id: string;
  firstName?: string;
  parentIds: string[];
  partnerIds: string[];
  partnerships?: readonly { partnerId: string; status: string }[];
  parentLinks?: readonly { parentId: string; kind: string }[];
  birthDate?: string | null;
  deathDate?: string | null;
};
// null: co-parents without a stored partnership.
export type Status = 'together' | 'married' | 'separated' | 'divorced' | 'widowed' | null;
export type Union = { id: string; parents: string[]; children: string[]; dotted: boolean };
export type Partnership = { a: string; b: string; status: Status };
// A parent link that is not drawn as a line: a step partner is shown by the partnership, a stub by a label.
export type Hidden = { child: string; parent: string; reason: 'stepPartner' | 'stub' };
export type Model = { gen: Map<string, number>; unions: Union[]; partnerships: Partnership[]; hidden: Hidden[] };

const pairKey = (x: string, y: string) => (x < y ? `${x}\n${y}` : `${y}\n${x}`);

export function buildModel(people: Person[]): Model {
  const known = new Set(people.map((p) => p.id));
  const stored = new Map<string, Status>();
  for (const p of people) {
    for (const other of p.partnerIds) if (known.has(other) && !stored.has(pairKey(p.id, other))) stored.set(pairKey(p.id, other), 'together');
    for (const { partnerId, status } of p.partnerships ?? []) if (known.has(partnerId)) stored.set(pairKey(p.id, partnerId), status as Status);
  }
  const partnered = (x: string, y: string) => stored.has(pairKey(x, y));

  const unions = new Map<string, Union>();
  const hidden: Hidden[] = [];
  for (const child of people) {
    const kindOf = new Map((child.parentLinks ?? []).map((l) => [l.parentId, l.kind]));
    const parents = child.parentIds.filter((id) => known.has(id));
    const biological = parents.filter((id) => (kindOf.get(id) ?? 'biological') === 'biological');
    const drawn = biological.length ? biological : parents;
    if (!drawn.length) continue;
    for (const parent of parents.filter((id) => !drawn.includes(id)))
      hidden.push({ child: child.id, parent, reason: drawn.some((d) => partnered(d, parent)) ? 'stepPartner' : 'stub' });
    const sorted = [...drawn].sort();
    const id = sorted.join('+');
    const union = unions.get(id) ?? { id, parents: sorted, children: [], dotted: !biological.length };
    union.children.push(child.id);
    unions.set(id, union);
  }

  // A child of one parent hangs with the children of that parent's current couple (nearest by birth
  // date, then the larger family), so it stands among its siblings. Former couples keep it apart.
  const byId = new Map(people.map((p) => [p.id, p]));
  const born = (id: string) => Date.parse(byId.get(id)?.birthDate ?? '') || 0;
  for (const single of [...unions.values()].filter((u) => u.parents.length === 1 && !u.dotted)) {
    const couples = [...unions.values()].filter(
      (u) => u.parents.length === 2 && u.parents.includes(single.parents[0]) && ['together', 'married', 'widowed'].includes(stored.get(pairKey(u.parents[0], u.parents[1])) ?? ''),
    );
    const gap = (u: Union) => Math.min(...u.children.flatMap((c) => single.children.map((d) => (born(c) && born(d) ? Math.abs(born(c) - born(d)) : Infinity))));
    const target = couples.sort((p, q) => gap(p) - gap(q) || q.children.length - p.children.length || p.id.localeCompare(q.id))[0];
    if (!target) continue;
    target.children.push(...single.children);
    unions.delete(single.id);
  }

  // Co-parents share a row like partners, even without a stored partnership.
  const partnerships: Partnership[] = [...stored].map(([key, status]) => {
    const [a, b] = key.split('\n');
    return { a, b, status };
  });
  const extended = new Map(people.map((p) => [p.id, new Set(p.partnerIds)]));
  for (const { parents } of unions.values())
    for (const x of parents)
      for (const y of parents)
        if (x !== y) extended.get(x)!.add(y);
  for (const { parents } of unions.values())
    if (parents.length === 2 && !partnered(parents[0], parents[1])) partnerships.push({ a: parents[0], b: parents[1], status: null });
  partnerships.sort((p, q) => p.a.localeCompare(q.a) || p.b.localeCompare(q.b));

  const gen = generations(people.map((p) => ({ id: p.id, parentIds: p.parentIds, partnerIds: [...extended.get(p.id)!] })));
  return { gen, unions: [...unions.values()], partnerships, hidden };
}
