// Run with `node app/familyLayout.check.mjs`: parents hang above their children, partners side by side.
import assert from 'node:assert/strict';
import { generations, layoutScrolls, relationLines } from './familyLayout.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
const people = [
  person('grandma'),
  person('mum', ['grandma'], ['dad']),
  person('aunt', ['grandma']),
  person('dad', [], ['mum']),
  person('kid', ['mum', 'dad']),
];
const gen = generations(people);
assert.deepEqual(Object.fromEntries(gen), { grandma: 0, mum: 1, aunt: 1, dad: 1, kid: 2 });

const layout = layoutScrolls(people);
const y = (id) => layout.get(id)[1];
assert.ok(y('grandma') > y('mum') && y('mum') > y('kid') && y('dad') === y('mum'));

// Partners are neighbours in their row: no one sits between mum and dad.
const row = ['mum', 'aunt', 'dad'].sort((a, b) => layout.get(a)[0] - layout.get(b)[0]);
assert.notEqual(row[1], 'aunt');

// Mum and dad each drop to a shared bar; from its middle a stem goes down to the kid, and
// the couple gets no direct partner line because the bar already joins them.
const lines = relationLines(people, layout);
const [mx, , mz] = [0, 1, 2].map((k) => (layout.get('mum')[k] + layout.get('dad')[k]) / 2);
const segments = [];
for (let i = 0; i < lines.parents.length; i += 2) segments.push([lines.parents[i], lines.parents[i + 1]]);
const vertical = ([a, b]) => a[0] === b[0] && a[2] === b[2] && a[1] !== b[1];
const near = (a, b) => Math.abs(a - b) < 1e-9;
assert.ok(segments.some(([a, b]) => a === layout.get('mum') && vertical([a, b])));
assert.ok(segments.some(([a, b]) => vertical([a, b]) && near(a[0], mx) && near(a[2], mz) && a[1] < y('mum') && b[1] > y('kid')));
assert.equal(lines.partners.length, 0);

// A childless partner joins their partner's row instead of floating at the top.
assert.equal(generations([person('a'), person('b', ['a'], ['c']), person('c', [], ['b'])]).get('c'), 1);

// A cyclic record must not hang the layout.
generations([person('a', ['b']), person('b', ['a'])]);
console.log('familyLayout ok');
