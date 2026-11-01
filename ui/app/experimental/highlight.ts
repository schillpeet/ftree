// Which drawn connections stand out for the person whose panel is open: a set of pairs (a parent and
// a child, or two partners), matched against the links each routed segment carries, so only the
// pieces of line on the way between two highlighted people light up. `highlight.check.mjs` tests it.
import { biologicalParentsOf, bloodRelativesOf, lineageOf } from '../relatives.ts';

type Person = { id: string; parentIds: string[]; partnerIds: string[]; parentLinks?: readonly { parentId: string; kind: string }[] };

export const linkKey = (x: string, y: string) => (x < y ? `${x}\n${y}` : `${y}\n${x}`);

// The lineage (`lineageOf`): every line from a parent to a child and between two partners when both
// belong to it, so the way up to the ancestors, down to the descendants, and over to the partners
// lights up, but not the branches off it to siblings, aunts, or cousins.
export function lineageLinks<T extends Person>(focus: T, members: T[]) {
  const lineage = lineageOf(focus, members);
  const links = new Set<string>();
  for (const m of members.filter((m) => lineage.has(m.id)))
    for (const id of [...m.parentIds, ...m.partnerIds].filter((id) => lineage.has(id))) links.add(linkKey(id, m.id));
  return links;
}

// Blood relatives (`bloodRelativesOf`): every line from a biological parent to a child when both are
// related to the person by blood, and the partnerships between two of them, such as grandparents.
// Toward a partner who married in, only the piece from the blood relative to their children stands out.
export function bloodLinks<T extends Person>(focus: T, members: T[]) {
  const blood = bloodRelativesOf(focus, members);
  const links = new Set<string>();
  for (const m of members.filter((m) => blood.has(m.id))) {
    for (const id of biologicalParentsOf(m).filter((id) => blood.has(id))) links.add(linkKey(id, m.id));
    for (const id of m.partnerIds.filter((id) => blood.has(id))) links.add(linkKey(m.id, id));
  }
  return links;
}
