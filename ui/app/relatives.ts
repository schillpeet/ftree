// A member's relatives as stored (parents, children, partners) and derived from shared parents
// (siblings, half-siblings). Pure, so `relatives.check.mjs` can test it.
import type { Member } from '../lib/api/generated/members';

type Person = Pick<Member, 'id' | 'parentIds' | 'partnerIds'>;

export function relativesOf<T extends Person>(member: T, members: T[]) {
  // Siblings have exactly the member's parents, half-siblings share only some or have others too.
  const shared = (m: T) => m.parentIds.filter((id) => member.parentIds.includes(id)).length;
  const sameParents = (m: T) => shared(m) === member.parentIds.length && m.parentIds.length === member.parentIds.length;
  const sharing = members.filter((m) => m.id !== member.id && shared(m) > 0);
  return {
    parents: members.filter((m) => member.parentIds.includes(m.id)),
    children: members.filter((m) => m.parentIds.includes(member.id)),
    partners: members.filter((m) => member.partnerIds.includes(m.id)),
    siblings: sharing.filter(sameParents),
    halfSiblings: sharing.filter((m) => !sameParents(m)),
  };
}

// Everyone the member descends from, through parents' parents up to the oldest generation in the
// list. Parents missing from the list end the line there; a loop in the data cannot hang it.
export function ancestorsOf<T extends Person>(member: T, members: T[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const found = new Set<string>();
  const queue = [...member.parentIds];
  while (queue.length) {
    const id = queue.pop()!;
    const parent = byId.get(id);
    if (found.has(id) || !parent) continue;
    found.add(id);
    queue.push(...parent.parentIds);
  }
  return found;
}

// A member's parents by blood: links without a kind count as biological, as in the experimental view.
type Linked = Person & { parentLinks?: readonly { parentId: string; kind: string }[] };
export const biologicalParentsOf = (member: Linked) =>
  member.parentIds.filter((id) => (member.parentLinks?.find((l) => l.parentId === id)?.kind ?? 'biological') === 'biological');

// Everyone the member is related to by blood, the member included: their biological ancestors and
// every biological descendant of those (siblings, half-siblings, aunts, cousins, nieces, children …).
// Partners, step, adoptive, and foster relatives stay out.
export function bloodRelativesOf<T extends Linked>(member: T, members: T[]) {
  const byId = new Map([...members, member].map((m) => [m.id, m]));
  const ancestors = new Set([member.id]);
  for (const queue = [member.id]; queue.length; )
    for (const id of biologicalParentsOf(byId.get(queue.pop()!)!))
      if (byId.has(id) && !ancestors.has(id)) {
        ancestors.add(id);
        queue.push(id);
      }
  const found = new Set(ancestors);
  const childrenOf = (id: string) => members.filter((m) => biologicalParentsOf(m).includes(id));
  for (const queue = [...ancestors]; queue.length; )
    for (const child of childrenOf(queue.pop()!))
      if (!found.has(child.id)) {
        found.add(child.id);
        queue.push(child.id);
      }
  return found;
}

// The selected person's lineage, which the tree lights up: the member, everyone they descend from,
// everyone descending from them, and their partners. Siblings, aunts, cousins, and the partners'
// own families stay out; a loop in the data cannot hang it.
export function lineageOf<T extends Person>(member: T, members: T[]) {
  const found = new Set([member.id, ...ancestorsOf(member, members), ...member.partnerIds]);
  for (const queue = [member.id]; queue.length; ) {
    const id = queue.pop()!;
    for (const child of members)
      if (child.parentIds.includes(id) && !found.has(child.id)) {
        found.add(child.id);
        queue.push(child.id);
      }
  }
  return found;
}
