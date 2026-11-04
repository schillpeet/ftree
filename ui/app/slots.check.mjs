// Run with `node app/slots.check.mjs`: the "+" slots around the selected person offer only the relations still
// missing, and the quick-add prefills the person's surname for a father and a child.
import assert from 'node:assert/strict';
import { candidatesFor, coParentCandidates, linkExisting, linkOf, missingSlots, nextSlot, prefilledLastName, slotOffer, asksParentKind, withParentOfKind } from './slots.ts';

assert.deepEqual(missingSlots({ id: 'a', parentIds: [] }), ['mother', 'father', 'sibling', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p'] }), ['parent', 'sibling', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p', 'q'] }), ['sibling', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p', 'q', 'r'] }), ['sibling', 'partner', 'child']);

assert.equal(prefilledLastName('father', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('child', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('sibling', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('mother', { lastName: 'Huber' }), '');
assert.equal(prefilledLastName('parent', { lastName: 'Huber' }), '');
assert.equal(prefilledLastName('partner', { lastName: 'Huber' }), '');

// Only a mother leads on, to the father; everything else closes the quick-add.
assert.equal(nextSlot('mother'), 'father');
for (const kind of ['father', 'parent', 'partner', 'child', 'sibling']) assert.equal(nextSlot(kind), null);

// The new person is linked to the selected one only, with their fresh version.
assert.deepEqual(linkOf('mother', 'a', 0), { version: 0, parentIds: [], childIds: ['a'], partnerIds: [] });
assert.deepEqual(linkOf('parent', 'a', 1), { version: 1, parentIds: [], childIds: ['a'], partnerIds: [] });
assert.deepEqual(linkOf('partner', 'a', 0), { version: 0, parentIds: [], childIds: [], partnerIds: ['a'] });
assert.deepEqual(linkOf('child', 'a', 0), { version: 0, parentIds: ['a'], childIds: [], partnerIds: [] });

// An existing person instead of a new one: the slot offers only who fits, and adds the link to what they have.
const family = [
  { id: 'g', parentIds: [], partnerIds: [], version: 0 },
  { id: 'm', parentIds: ['g'], partnerIds: [], version: 3 },
  { id: 'a', parentIds: ['m'], partnerIds: ['p'], version: 1 },
  { id: 'p', parentIds: [], partnerIds: ['a'], version: 2 },
  { id: 'k', parentIds: ['a', 'p'], partnerIds: [], version: 0 },
  { id: 'x', parentIds: [], partnerIds: [], version: 5 },
];
const a = family[2];
const idsOf = (list) => list.map((m) => m.id);
assert.deepEqual(idsOf(candidatesFor('parent', a, family)), ['g', 'p', 'x'], 'no own parent, no descendant');
assert.deepEqual(idsOf(candidatesFor('child', a, family)), ['p', 'x'], 'no ancestor, no own child');
assert.deepEqual(idsOf(candidatesFor('partner', a, family)), ['g', 'm', 'k', 'x'], 'no current partner');
assert.deepEqual(linkExisting('partner', family[5], 'a', family), { version: 5, parentIds: [], childIds: [], partnerIds: ['a'] });
assert.deepEqual(linkExisting('child', family[5], 'a', family), { version: 5, parentIds: ['a'], childIds: [], partnerIds: [] });
assert.deepEqual(
  linkExisting('father', family[1], 'x', family),
  { version: 3, parentIds: ['g'], childIds: ['a', 'x'], partnerIds: [] },
  'existing relatives are kept',
);

assert.deepEqual(linkOf('sibling', 'a', 0, ['p', 'q']), { version: 0, parentIds: ['p', 'q'], childIds: [], partnerIds: [] });
assert.deepEqual(idsOf(candidatesFor('sibling', family[4], family)), ['x'], 'no ancestor and no full sibling');
assert.deepEqual(
  linkExisting('sibling', family[5], 'k', family, ['a', 'p']),
  { version: 5, parentIds: ['a', 'p'], childIds: [], partnerIds: [] },
  'a sibling gets the shared parents',
);

// After a new partner, only the children with a single parent are asked about.
const kids = [
  { id: 'c1', parentIds: ['a'], partnerIds: [] },
  { id: 'c2', parentIds: ['a', 'q'], partnerIds: [] },
  { id: 'c3', parentIds: ['a', 'n'], partnerIds: [] },
  { id: 'c4', parentIds: ['z'], partnerIds: [] },
];
assert.deepEqual(idsOf(coParentCandidates({ id: 'a', parentIds: [], partnerIds: [] }, { id: 'n', parentIds: [], partnerIds: [] }, kids)), ['c1']);

// Before anything is typed, a slot shows who already has that place and offers who the tree points to.
const person = (id, extra = {}) => ({ id, firstName: id, lastName: '', parentIds: [], partnerIds: [], parentLinks: [], version: 0, ...extra });
const me = person('me', { parentIds: ['dad', 'mom'], partnerIds: ['wife'] });
const tree = [
  person('dad', { partnerIds: ['step'] }),
  person('mom'),
  person('step', { partnerIds: ['dad'] }),
  me,
  person('wife', { partnerIds: ['me'] }),
  person('sis', { parentIds: ['dad', 'mom'] }),
  person('half', { parentIds: ['dad', 'other'] }),
  person('other'),
  person('kid', { parentIds: ['me', 'wife'] }),
  person('stepkid', { parentIds: ['wife'], parentLinks: [{ parentId: 'wife', kind: 'biological' }], version: 4 }),
  person('love', { parentIds: ['me', 'coparent'] }),
  person('coparent'),
  person('loner'),
  { ...person('ph'), firstName: '' },
];
const offer = (kind) => {
  const { linked, suggested, others } = slotOffer(kind, me, tree);
  for (const m of suggested) assert.ok(!others.includes(m), `${m.id} is offered once`);
  return { linked: idsOf(linked), suggested: idsOf(suggested) };
};
assert.deepEqual(offer('parent'), { linked: ['dad', 'mom'], suggested: ['other', 'step'] }, "the half-sibling's other parent and a step-parent");
assert.deepEqual(offer('partner'), { linked: ['wife'], suggested: ['coparent', 'loner'] }, 'a co-parent, then the unconnected with a name');
assert.deepEqual(offer('child'), { linked: ['kid', 'love'], suggested: ['stepkid', 'loner'] }, "the partner's child, then the unconnected");
assert.deepEqual(offer('sibling'), { linked: ['sis'], suggested: ['half'] }, 'full siblings shown, half-siblings offered');

// Becoming the parent of a partner's child, or the child of a parent's partner, asks what kind of parent.
const byId = (id) => tree.find((m) => m.id === id);
assert.equal(asksParentKind('child', me, byId('stepkid')), true);
assert.equal(asksParentKind('child', me, byId('loner')), false);
assert.equal(asksParentKind('parent', me, byId('step')), true);
assert.equal(asksParentKind('parent', me, byId('other')), false);
assert.equal(asksParentKind('partner', me, byId('coparent')), false);
assert.deepEqual(withParentOfKind(byId('stepkid'), 'me', 'step', tree), {
  version: 4,
  parentIds: ['wife', 'me'],
  childIds: [],
  partnerIds: [],
  parentLinks: [
    { parentId: 'wife', kind: 'biological' },
    { parentId: 'me', kind: 'step' },
  ],
});

console.log('slots checks passed');
