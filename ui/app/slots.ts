// The "+" slots around the selected person and how a person added through one is linked. Pure, so
// `slots.check.mjs` can test it.
import type { Member, Relatives } from '../lib/api/generated/members';

// Parents carry no sex in the data: with one parent known the other slot is just "parent".
export type SlotKind = 'mother' | 'father' | 'parent' | 'partner' | 'child';

// Mother and father while the person has no parent, one "parent" while they have one; partner and child always.
export function missingSlots(member: Pick<Member, 'id' | 'parentIds'>): SlotKind[] {
  const parents: SlotKind[] = member.parentIds.length === 0 ? ['mother', 'father'] : member.parentIds.length === 1 ? ['parent'] : [];
  return [...parents, 'partner', 'child'];
}

// A father and a child usually share the person's surname.
export function prefilledLastName(kind: SlotKind, member: Pick<Member, 'lastName'>): string {
  return kind === 'father' || kind === 'child' ? member.lastName : '';
}

// After a mother the quick-add moves on to the father.
export function nextSlot(kind: SlotKind): SlotKind | null {
  return kind === 'mother' ? 'father' : null;
}

// The relatives of the newly created person: the selected one as their child, partner, or parent. Siblings and
// details are left out, so nothing else changes.
export function linkOf(kind: SlotKind, memberId: string, version: number): Relatives {
  return {
    version,
    parentIds: kind === 'child' ? [memberId] : [],
    childIds: kind === 'mother' || kind === 'father' || kind === 'parent' ? [memberId] : [],
    partnerIds: kind === 'partner' ? [memberId] : [],
  };
}
