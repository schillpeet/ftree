// Run with `node app/names.check.mjs`: unknown names fall back to a placeholder.
import assert from 'node:assert/strict';
import { initialsOf, isNameless, nameOf, shortFirstName, splitName } from './names.ts';

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

console.log('names ok');
