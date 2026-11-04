// The "+" slots around the selected person and how a person added through one is linked. Pure, so
// `slots.check.mjs` can test it.
import type { Member, ParentLink, Relatives } from '../lib/api/generated/members';
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

type Offered = Linked & Pick<Member, 'firstName' | 'lastName'>;

const byName = (a: Offered, b: Offered) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);

// Somebody with a name and no link at all: no parents, no partners, no children.
function unconnected(m: Offered, members: Linked[]) {
  return (
    Boolean(m.firstName || m.lastName) &&
    m.parentIds.length === 0 &&
    m.partnerIds.length === 0 &&
    !members.some((c) => c.parentIds.includes(m.id))
  );
}

// Everyone sharing a parent with `member`, full and half siblings alike.
function siblingsOf<T extends Linked>(member: Linked, members: T[]): T[] {
  return members.filter((m) => m.id !== member.id && m.parentIds.some((id) => member.parentIds.includes(id)));
}

// What a slot shows before anything is typed, so nobody is entered twice:
// - `linked`: who already has that place (the parents, partners, or children, or the full siblings), shown but not offered;
// - `suggested`: who the tree points to, offered first: for a sibling the half-siblings, for a parent the other parents
//   of the half-siblings and the partners of the parents (step-parents), for a partner co-parents without a partnership
//   and then everyone not connected yet, for a child the partners' children and then everyone not connected yet;
// - `others`: everyone else who fits the slot (`candidatesFor`), found by typing.
export function slotOffer<T extends Offered>(kind: SlotKind, member: Offered, members: T[]) {
  const candidates = candidatesFor(kind, member, members);
  const siblings = siblingsOf(member, members);
  const full = (m: Linked) => member.parentIds.every((id) => m.parentIds.includes(id));
  let linked: T[];
  let hinted: (m: T) => boolean;
  switch (kind) {
    case 'mother':
    case 'father':
    case 'parent': {
      linked = members.filter((m) => member.parentIds.includes(m.id));
      const fromSiblings = siblings.filter((h) => !full(h)).flatMap((h) => h.parentIds);
      hinted = (m) => fromSiblings.includes(m.id) || member.parentIds.some((id) => m.partnerIds.includes(id));
      break;
    }
    case 'partner':
      linked = members.filter((m) => member.partnerIds.includes(m.id));
      hinted = (m) => members.some((c) => c.parentIds.includes(member.id) && c.parentIds.includes(m.id));
      break;
    case 'child':
      linked = members.filter((m) => m.parentIds.includes(member.id));
      hinted = (m) => m.parentIds.some((id) => member.partnerIds.includes(id));
      break;
    case 'sibling':
      linked = siblings.filter(full);
      hinted = (m) => siblings.includes(m);
      break;
  }
  const loose = kind === 'partner' || kind === 'child' ? (m: T) => unconnected(m, members) : () => false;
  const suggested = [...candidates.filter(hinted).sort(byName), ...candidates.filter((m) => !hinted(m) && loose(m)).sort(byName)];
  return { linked: linked.sort(byName), suggested, others: candidates.filter((m) => !suggested.includes(m)) };
}

// Whether linking `existing` through the slot makes someone a parent of a partner's child, so the quick-add asks what
// kind of parent: a partner's child for a child, a parent's partner for a parent.
export function asksParentKind(kind: SlotKind, member: Linked, existing: Linked) {
  if (kind === 'child') return existing.parentIds.some((id) => member.partnerIds.includes(id));
  if (kind === 'mother' || kind === 'father' || kind === 'parent') return member.parentIds.some((id) => existing.partnerIds.includes(id));
  return false;
}

// The relatives of `child` with `parentId` added as a parent of `kind`; the kinds of the other parents stay.
export function withParentOfKind(
  child: Linked & Pick<Member, 'version' | 'parentLinks'>,
  parentId: string,
  kind: ParentLink['kind'],
  members: Linked[],
): Relatives {
  return {
    ...withParents(child, [...child.parentIds.filter((id) => id !== parentId), parentId], members),
    parentLinks: [...child.parentLinks.filter((link) => link.parentId !== parentId), { parentId, kind }],
  };
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
