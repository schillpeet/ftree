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
