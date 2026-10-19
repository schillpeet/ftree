// Run with `node app/nameSearch.check.mjs`: the search ignores case and accents, needs every
// query word, ranks names that start with a word first, and caps the result list.
import assert from 'node:assert/strict';
import { memberLabel, searchMembers } from './nameSearch.ts';

const person = (id, firstName, lastName, birthName = null) => ({ id, firstName, lastName, birthName });
const ids = (list) => list.map((m) => m.id);

const members = [
  person('a', 'Anna Maria', 'Müller'),
  person('b', 'Marie', 'Schmidt', 'Meier'),
  person('c', 'José', 'Garcia'),
  person('d', 'Hans', 'Annabell'),
];

assert.deepEqual(searchMembers(members, ''), []);
assert.deepEqual(searchMembers(members, '   '), []);
assert.deepEqual(ids(searchMembers(members, 'MULLER')), ['a'], 'case and accents are ignored');
assert.deepEqual(ids(searchMembers(members, 'jose')), ['c']);
assert.deepEqual(ids(searchMembers(members, 'anna muller')), ['a'], 'every word has to match');
assert.deepEqual(ids(searchMembers(members, 'meier')), ['b'], 'the birth name is searched too');
assert.deepEqual(ids(searchMembers(members, 'ann')), ['a', 'd'], 'list order is kept for equal matches');
assert.deepEqual(ids(searchMembers(members, 'nna')), ['a', 'd'], 'substring matches are found');
assert.deepEqual(
  ids(searchMembers([person('e', 'Joanna', 'X'), person('f', 'Anna', 'Y')], 'anna')),
  ['f', 'e'],
  'names starting with the word come first',
);
assert.equal(searchMembers(members, 'a', 2).length, 2, 'the result list is capped');
assert.equal(memberLabel(person('x', '', 'Solo')), 'Solo');
assert.equal(memberLabel(person('y', '', '')), 'y');

console.log('nameSearch checks passed');
