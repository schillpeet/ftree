// Run with `node app/selfMember.check.mjs`: the name the "add yourself" form starts with.
import assert from 'node:assert/strict';
import { selfNameOf } from './selfMember.ts';

// A display name of their own: the last word is the surname, the words before it the first names.
assert.deepEqual(selfNameOf({ customName: 'Peter Schill' }), { firstName: 'Peter', lastName: 'Schill' });
assert.deepEqual(selfNameOf({ customName: '  Anna  Maria   Berger ' }), { firstName: 'Anna Maria', lastName: 'Berger' });
// A single word is a first name.
assert.deepEqual(selfNameOf({ customName: 'Peter' }), { firstName: 'Peter', lastName: '' });
// No display name of their own (only the email's local part), or no user yet: both stay empty.
assert.deepEqual(selfNameOf({ customName: null }), { firstName: '', lastName: '' });
assert.deepEqual(selfNameOf({}), { firstName: '', lastName: '' });
assert.deepEqual(selfNameOf(null), { firstName: '', lastName: '' });

console.log('selfMember checks passed');
