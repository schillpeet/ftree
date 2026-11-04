// Run with `node app/slots.check.mjs`: the "+" slots around the selected person offer only the relations still
// missing, and the quick-add prefills the person's surname for a father and a child.
import assert from 'node:assert/strict';
import { candidatesFor, linkExisting, linkOf, missingSlots, nextSlot, prefilledLastName } from './slots.ts';

assert.deepEqual(missingSlots({ id: 'a', parentIds: [] }), ['mother', 'father', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p'] }), ['parent', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p', 'q'] }), ['partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p', 'q', 'r'] }), ['partner', 'child']);

assert.equal(prefilledLastName('father', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('child', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('mother', { lastName: 'Huber' }), '');
assert.equal(prefilledLastName('parent', { lastName: 'Huber' }), '');
assert.equal(prefilledLastName('partner', { lastName: 'Huber' }), '');

// Only a mother leads on, to the father; everything else closes the quick-add.
assert.equal(nextSlot('mother'), 'father');
for (const kind of ['father', 'parent', 'partner', 'child']) assert.equal(nextSlot(kind), null);

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

console.log('slots checks passed');
