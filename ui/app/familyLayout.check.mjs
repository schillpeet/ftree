// Run with `node app/familyLayout.check.mjs`: parents hang above their children, partners side by side.
import assert from 'node:assert/strict';
import { DEFAULT_SPACE, generations, layoutScrolls, layoutScrollsInSpace, relationLines } from './familyLayout.ts';

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
// The parameterised layout with the default space must reproduce the legacy fixed arc exactly.
assert.deepEqual(layoutScrollsInSpace(people, DEFAULT_SPACE), layout);
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

// Two couples side by side with 6 children and 1 child: siblings stay centred under their parents
// where there is room, and the two families' child bars never overlap at the same height.
const big = [
  person('A', [], ['B']), person('B', [], ['A']), person('C', [], ['D']), person('D', [], ['C']),
  ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) => person(id, ['A', 'B'])),
  person('c1', ['C', 'D']),
];
const bigLayout = layoutScrolls(big);
const angle = (pt) => Math.atan2(pt[2], pt[0]);
const meanAngle = (ids) => ids.reduce((sum, id) => sum + angle(bigLayout.get(id)), 0) / ids.length;
assert.ok(Math.abs(meanAngle(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) - meanAngle(['A', 'B'])) < 1e-9);
assert.ok(Math.max(...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) => angle(bigLayout.get(id)))) < Math.min(...['c1'].map((id) => angle(bigLayout.get(id)))));
// Height of the bar a child hangs from: the vertical segment ending at the child.
const bigLines = relationLines(big, bigLayout).parents;
const barAbove = (id) => {
  const at = bigLayout.get(id);
  for (let i = 0; i < bigLines.length; i += 2) {
    const [a, b] = [bigLines[i], bigLines[i + 1]];
    if (b === at && a[0] === at[0] && a[2] === at[2]) return a[1];
  }
};
const span = (parents, kids) => {
  const middle = (angle(bigLayout.get(parents[0])) + angle(bigLayout.get(parents[1]))) / 2;
  const all = [middle, ...kids.map((id) => angle(bigLayout.get(id)))];
  return [Math.min(...all), Math.max(...all)];
};
const [ab, cd] = [span(['A', 'B'], ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']), span(['C', 'D'], ['c1'])];
const spansOverlap = Math.min(ab[1], cd[1]) > Math.max(ab[0], cd[0]);
assert.ok(!spansOverlap || barAbove('a1') !== barAbove('c1'));

// A childless partner joins their partner's row instead of floating at the top.
assert.equal(generations([person('a'), person('b', ['a'], ['c']), person('c', [], ['b'])]).get('c'), 1);

// A cyclic record must not hang the layout.
generations([person('a', ['b']), person('b', ['a'])]);
console.log('familyLayout ok');
