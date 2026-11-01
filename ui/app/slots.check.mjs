// Run with `node app/slots.check.mjs`: the "+" slots around the selected person offer only the relations still
// missing, and the quick-add prefills the person's surname for a father and a child.
import assert from 'node:assert/strict';
import { linkOf, missingSlots, nextSlot, prefilledLastName } from './slots.ts';

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

console.log('slots checks passed');
