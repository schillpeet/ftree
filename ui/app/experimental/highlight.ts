// Which drawn connections stand out for the person whose panel is open: a set of pairs (a parent and
// a child, or two partners), matched against the links each routed segment carries, so only the
// pieces of line on the way between two highlighted people light up. `highlight.check.mjs` tests it.
import { ancestorsOf, relativesOf } from '../relatives.ts';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };

export const linkKey = (x: string, y: string) => (x < y ? `${x}\n${y}` : `${y}\n${x}`);

// The core family: the lines from the person to everyone the panel lists (parents, partners,
// children, and siblings and half-siblings through the parents they share), and the line of descent
// from every ancestor down to the person, with the partnerships between those ancestors.
export function coreFamilyLinks<T extends Person>(focus: T, members: T[]) {
  const r = relativesOf(focus, members);
  const ancestors = ancestorsOf(focus, members);
  const links = new Set<string>();
  for (const m of [...r.parents, ...r.partners, ...r.children]) links.add(linkKey(focus.id, m.id));
  for (const sib of [...r.siblings, ...r.halfSiblings])
    for (const id of sib.parentIds.filter((id) => focus.parentIds.includes(id))) links.add(linkKey(id, sib.id));
  for (const m of members.filter((m) => m.id === focus.id || ancestors.has(m.id)))
    for (const id of m.parentIds.filter((id) => ancestors.has(id))) links.add(linkKey(id, m.id));
  for (const m of members.filter((m) => ancestors.has(m.id)))
    for (const id of m.partnerIds.filter((id) => ancestors.has(id))) links.add(linkKey(m.id, id));
  return links;
}
