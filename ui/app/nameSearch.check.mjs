// Run with `node app/nameSearch.check.mjs`: the search ignores case and accents, matches the start of name parts,
// looks only at given names for a single letter, ranks given names before surnames, and caps the result list.
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
assert.deepEqual(ids(searchMembers(members, 'ann')), ['a', 'd'], 'given names come before surnames');
assert.deepEqual(ids(searchMembers(members, 'nna')), [], 'the middle of a name is not a match');
assert.deepEqual(ids(searchMembers(members, 'maria')), ['a'], 'a second given name is found');
assert.deepEqual(ids(searchMembers(members, 'anna anna')), [], 'each word needs a part of its own');

const macis = [
  person('p', 'Peter', 'Maci'),
  person('m', 'Marie', 'Maci'),
  person('k', 'Karl Michael', 'Maci'),
  person('s', 'Sabine', 'Maci', 'Keller'),
  person('e', 'Emma', 'Maci'),
];
assert.deepEqual(ids(searchMembers(macis, 'm')), ['m', 'k'], 'a single letter only looks at given names');
assert.deepEqual(ids(searchMembers(macis, 'ma')), ['m', 'p', 'k', 's', 'e'], 'from two letters on surnames count, after given names');
assert.deepEqual(ids(searchMembers(macis, 'mi')), ['k'], 'a second given name counts as a given name');
assert.deepEqual(ids(searchMembers(macis, 'kel')), ['s'], 'the birth name counts as a surname');
assert.deepEqual(ids(searchMembers(macis, 'pe ma')), ['p'], 'several words narrow the list');
assert.deepEqual(ids(searchMembers([person('o', '', 'Ohne')], 'o')), ['o'], 'without a given name a letter finds the surname');
assert.deepEqual(ids(searchMembers([person('h', 'Hans', 'Müller-Lüdenscheidt')], 'lud')), ['h'], 'pieces of a double name count');
assert.equal(searchMembers(macis, 'ma', 2).length, 2, 'the result list is capped');
assert.equal(memberLabel(person('x', '', 'Solo')), 'Solo');
assert.equal(memberLabel(person('y', '', '')), 'y');

console.log('nameSearch checks passed');
