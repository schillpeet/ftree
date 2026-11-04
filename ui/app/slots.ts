// The "+" slots around the selected person and how a person added through one is linked. Pure, so
// `slots.check.mjs` can test it.
import type { Member, Relatives } from '../lib/api/generated/members';
import { ancestorsOf } from './relatives.ts';

// Parents carry no sex in the data: with one parent known the other slot is just "parent".
export type SlotKind = 'mother' | 'father' | 'parent' | 'partner' | 'child' | 'sibling';

// Mother and father while the person has no parent, one "parent" while they have one; sibling, partner, and child
// always. Siblings share parents, so for a person without any the sibling slot adds a placeholder parent first.
export function missingSlots(member: Pick<Member, 'id' | 'parentIds'>): SlotKind[] {
  const parents: SlotKind[] = member.parentIds.length === 0 ? ['mother', 'father'] : member.parentIds.length === 1 ? ['parent'] : [];
  return [...parents, 'sibling', 'partner', 'child'];
}

// A father, a child, and a sibling usually share the person's surname.
export function prefilledLastName(kind: SlotKind, member: Pick<Member, 'lastName'>): string {
  return kind === 'father' || kind === 'child' || kind === 'sibling' ? member.lastName : '';
}

// After a mother the quick-add moves on to the father.
export function nextSlot(kind: SlotKind): SlotKind | null {
  return kind === 'mother' ? 'father' : null;
}

// The relatives of the newly created person: the selected one as their child, partner, or parent, or for a sibling the
// selected one's parents (`parentIds`). Siblings and details are left out, so nothing else changes.
export function linkOf(kind: SlotKind, memberId: string, version: number, parentIds: string[] = []): Relatives {
  return {
    version,
    parentIds: kind === 'child' ? [memberId] : kind === 'sibling' ? parentIds : [],
    childIds: kind === 'mother' || kind === 'father' || kind === 'parent' ? [memberId] : [],
    partnerIds: kind === 'partner' ? [memberId] : [],
  };
}

type Linked = Pick<Member, 'id' | 'parentIds' | 'partnerIds'>;

// Everyone below `member`: children, their children, and so on; a loop in the data cannot hang it.
function descendantsOf(member: Linked, members: Linked[]) {
  const found = new Set<string>();
  const queue = [member.id];
  while (queue.length) {
    const id = queue.pop()!;
    for (const m of members) {
      if (m.parentIds.includes(id) && !found.has(m.id)) {
        found.add(m.id);
        queue.push(m.id);
      }
    }
  }
  return found;
}

// Who a slot may suggest instead of a new person: not the person themself, nobody already linked that way, and nobody
// who would make someone their own ancestor (the BFF refuses that too).
export function candidatesFor<T extends Linked>(kind: SlotKind, member: Linked, members: T[]): T[] {
  const below = descendantsOf(member, members);
  const above = ancestorsOf(member, members);
  return members.filter((m) => {
    if (m.id === member.id) return false;
    switch (kind) {
      case 'mother':
      case 'father':
      case 'parent':
        return !member.parentIds.includes(m.id) && !below.has(m.id);
      case 'child':
        return !m.parentIds.includes(member.id) && !above.has(m.id);
      case 'partner':
        return !member.partnerIds.includes(m.id);
      case 'sibling':
        // Not a full sibling already, and neither above nor below the person.
        return (
          !below.has(m.id) &&
          !above.has(m.id) &&
          !(member.parentIds.length > 0 && member.parentIds.every((id) => m.parentIds.includes(id)))
        );
    }
  });
}

// The relatives of an existing person chosen in a slot: what they have plus the link to `member`. Siblings, kinds, and
// partnership details are left out, so they stay as they are; a new partner starts as "together".
// For a sibling, `parentIds` are the parents the two are to share; they are added to the existing person's own.
export function linkExisting(
  kind: SlotKind,
  existing: Linked & { version: number },
  memberId: string,
  members: Linked[],
  parentIds: string[] = [],
): Relatives {
  const childIds = members.filter((m) => m.parentIds.includes(existing.id)).map((m) => m.id);
  const add = (ids: string[]) => [...ids.filter((id) => id !== memberId), memberId];
  return {
    version: existing.version,
    parentIds:
      kind === 'child'
        ? add(existing.parentIds)
        : kind === 'sibling'
          ? [...existing.parentIds, ...parentIds.filter((id) => !existing.parentIds.includes(id))]
          : existing.parentIds,
    childIds: kind === 'mother' || kind === 'father' || kind === 'parent' ? add(childIds) : childIds,
    partnerIds: kind === 'partner' ? add(existing.partnerIds) : existing.partnerIds,
  };
}

// The relatives of `person` with `parentIds` as their parents and everything else as it is.
export function withParents(person: Linked & { version: number }, parentIds: string[], members: Linked[]): Relatives {
  return {
    version: person.version,
    parentIds,
    childIds: members.filter((m) => m.parentIds.includes(person.id)).map((m) => m.id),
    partnerIds: person.partnerIds,
  };
}

// The children of `member` whom their new `partner` may also be a parent of: not already, and with room for a second
// parent. The quick-add asks about them one by one.
export function coParentCandidates<T extends Linked>(member: Linked, partner: Linked, members: T[]): T[] {
  return members.filter((m) => m.parentIds.includes(member.id) && !m.parentIds.includes(partner.id) && m.parentIds.length < 2 && m.id !== partner.id);
}
