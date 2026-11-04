// Run with `node app/names.check.mjs`: unknown names fall back to a placeholder.
import assert from 'node:assert/strict';
import { displayName, initialsOf, isNameless, nameOf, placeholderRole, shortFirstName, splitName } from './names.ts';

assert.equal(nameOf({ firstName: 'Anna', lastName: 'Alt' }, 'Unbekannt'), 'Anna Alt');
assert.equal(nameOf({ firstName: '', lastName: 'Alt' }, 'Unbekannt'), 'Alt');
assert.equal(nameOf({ firstName: '', lastName: '' }, 'Unbekannt'), 'Unbekannt');
assert.ok(isNameless({ firstName: '', lastName: '' }));
assert.ok(!isNameless({ firstName: 'Anna', lastName: '' }));
assert.equal(initialsOf({ firstName: 'Anna', lastName: '' }), 'A');
assert.equal(initialsOf({ firstName: '', lastName: '' }), '?');
assert.equal(shortFirstName('Johanne Katrin'), 'Johanne K.');
assert.equal(shortFirstName('Anna  Maria Theresia'), 'Anna M. T.');
assert.equal(shortFirstName('Anna'), 'Anna');
assert.equal(shortFirstName(''), '');
assert.deepEqual(splitName('  Anna Maria   Alt '), { firstName: 'Anna Maria', lastName: 'Alt' });
assert.deepEqual(splitName('Anna'), { firstName: 'Anna', lastName: '' });
assert.deepEqual(splitName('   '), { firstName: '', lastName: '' });

const roles = { parent: 'Elternteil', partner: 'Partner:in', child: 'Kind', person: 'Person' };
const nobody = { id: 'x', firstName: '', lastName: '', parentIds: [], partnerIds: [] };
const kid = { id: 'k', firstName: 'Ben', lastName: 'Alt', parentIds: ['x'], partnerIds: [] };
assert.equal(placeholderRole(nobody, [kid]), 'parent', 'someone below makes a placeholder a parent');
assert.equal(placeholderRole({ ...nobody, partnerIds: ['p'] }, []), 'partner');
assert.equal(placeholderRole({ ...nobody, parentIds: ['p'] }, []), 'child');
assert.equal(placeholderRole(nobody, []), 'person');
assert.equal(displayName(nobody, [kid], roles), 'Elternteil');
assert.equal(displayName(kid, [kid], roles), 'Ben Alt', 'a named person keeps their name');

console.log('names ok');
