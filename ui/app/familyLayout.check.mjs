// Run with `node app/familyLayout.check.mjs`: relation lines join parents, children, and partners.
import assert from 'node:assert/strict';
import { relationLines } from './familyLayout.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
// Cards sit wherever they were placed; here on an arc around the tree like pinned cards would.
const onArc = (angle, y) => [Math.cos(angle) * 12, y, Math.sin(angle) * 12];
const people = [
  person('mum', [], ['dad']),
  person('dad', [], ['mum']),
  person('kid', ['mum', 'dad']),
  person('a', [], ['b']),
  person('b', [], ['a']),
];
const layout = new Map([
  ['mum', onArc(0.8, 20)],
  ['dad', onArc(1.2, 20)],
  ['kid', onArc(1, 13)],
  ['a', onArc(2, 13)],
  ['b', onArc(2.4, 13)],
]);

// Mum and dad each drop to a shared bar; from its middle a stem goes down to the kid, and
// the couple gets no direct partner line because the bar already joins them.
const lines = relationLines(people, layout);
const [mx, , mz] = [0, 1, 2].map((k) => (layout.get('mum')[k] + layout.get('dad')[k]) / 2);
const segments = [];
for (let i = 0; i < lines.parents.length; i += 2) segments.push([lines.parents[i], lines.parents[i + 1]]);
const vertical = ([a, b]) => a[0] === b[0] && a[2] === b[2] && a[1] !== b[1];
const near = (a, b) => Math.abs(a - b) < 1e-9;
assert.ok(segments.some(([a, b]) => a === layout.get('mum') && vertical([a, b])));
assert.ok(segments.some(([a, b]) => vertical([a, b]) && near(a[0], mx) && near(a[2], mz) && a[1] < 20 && b[1] > 13));
assert.ok(segments.some(([, b]) => b === layout.get('kid')));
// The childless couple gets a direct partner line.
assert.deepEqual(lines.partners, [layout.get('a'), layout.get('b')]);

// Two families in one row whose child spans overlap get child bars at different heights.
const big = [
  person('A', [], ['B']), person('B', [], ['A']), person('C', [], ['D']), person('D', [], ['C']),
  person('a1', ['A', 'B']), person('a2', ['A', 'B']), person('c1', ['C', 'D']),
];
const bigLayout = new Map([
  ['A', onArc(0, 20)], ['B', onArc(0.4, 20)], ['C', onArc(0.6, 20)], ['D', onArc(1, 20)],
  ['a1', onArc(0.1, 13)], ['a2', onArc(0.9, 13)], ['c1', onArc(0.5, 13)],
]);
const bigLines = relationLines(big, bigLayout).parents;
const barAbove = (id) => {
  const at = bigLayout.get(id);
  for (let i = 0; i < bigLines.length; i += 2) {
    const [a, b] = [bigLines[i], bigLines[i + 1]];
    if (b === at && a[0] === at[0] && a[2] === at[2]) return a[1];
  }
};
assert.notEqual(barAbove('a1'), barAbove('c1'));
console.log('familyLayout ok');
