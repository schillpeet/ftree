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
// Flat rows: ordered by x, two families side by side in one row get their own bar heights where
// they overlap and share one where they do not.
const flat = (x, y) => [x, y, 0];
const flatBar = (layout, id) => {
  const lines = relationLines(big, layout, ([x]) => x).parents;
  const at = layout.get(id);
  for (let i = 0; i < lines.length; i += 2) if (lines[i + 1] === at && lines[i][0] === at[0]) return lines[i][1];
};
const overlapping = new Map([
  ['A', flat(0, 10)], ['B', flat(4, 10)], ['C', flat(8, 10)], ['D', flat(12, 10)],
  ['a1', flat(1, 0)], ['a2', flat(11, 0)], ['c1', flat(6, 0)],
]);
assert.notEqual(flatBar(overlapping, 'a1'), flatBar(overlapping, 'c1'));
const apart = new Map([...overlapping, ['a2', flat(3, 0)], ['c1', flat(10, 0)]]);
assert.equal(flatBar(apart, 'a1'), flatBar(apart, 'c1'));
// With a fork, B (children by A and by C) gets one bar per couple instead of one long bar.
const twice = new Map([['A', flat(0, 10)], ['B', flat(6, 10)], ['C', flat(12, 10)], ['ab', flat(3, 0)], ['bc', flat(9, 0)]]);
const forked = relationLines(
  [
    { id: 'A', parentIds: [], partnerIds: ['B'] },
    { id: 'B', parentIds: [], partnerIds: ['A', 'C'] },
    { id: 'C', parentIds: [], partnerIds: ['B'] },
    { id: 'ab', parentIds: ['A', 'B'], partnerIds: [] },
    { id: 'bc', parentIds: ['B', 'C'], partnerIds: [] },
  ],
  twice,
  ([x]) => x,
  1.5,
).parents;
const coupleBars = [];
for (let i = 0; i < forked.length; i += 2)
  if (forked[i][1] === 5 && forked[i + 1][1] === 5) coupleBars.push([forked[i][0], forked[i + 1][0]].sort((a, b) => a - b));
assert.deepEqual(coupleBars.sort((a, b) => a[0] - b[0]), [[0, 4.5], [7.5, 12]]);
// B's child by nobody else hangs from the child bar of the couple nearest to it (B and C), stem straight above it.
const withSolo = new Map([...twice, ['solo', flat(18, 0)]]);
const soloLines = relationLines(
  [
    { id: 'A', parentIds: [], partnerIds: ['B'] },
    { id: 'B', parentIds: [], partnerIds: ['A', 'C'] },
    { id: 'C', parentIds: [], partnerIds: ['B'] },
    { id: 'ab', parentIds: ['A', 'B'], partnerIds: [] },
    { id: 'bc', parentIds: ['B', 'C'], partnerIds: [] },
    { id: 'solo', parentIds: ['B'], partnerIds: [] },
  ],
  withSolo,
  ([x]) => x,
  1.5,
).parents;
const intoSolo = soloLines.findIndex((p, i) => i % 2 === 1 && p === withSolo.get('solo'));
assert.equal(soloLines[intoSolo - 1][0], 18);
const childBarY = (x) => soloLines.find((p, i) => i % 2 === 1 && p[0] === x && p[1] > 0 && p[1] < 5)[1];
assert.equal(childBarY(18), childBarY(9));
// A person at the row's edge with two partners on one side drops straight down (no fork), and the
// bars to both partners run at one height, the farther one reaching further.
const edge = new Map([['H', flat(0, 10)], ['P', flat(6, 10)], ['Q', flat(12, 10)], ['hp', flat(3, 0)], ['hq', flat(12, 0)]]);
const edgeLines = relationLines(
  [
    { id: 'H', parentIds: [], partnerIds: ['P', 'Q'] },
    { id: 'P', parentIds: [], partnerIds: ['H'] },
    { id: 'Q', parentIds: [], partnerIds: ['H'] },
    { id: 'hp', parentIds: ['H', 'P'], partnerIds: [] },
    { id: 'hq', parentIds: ['H', 'Q'], partnerIds: [] },
  ],
  edge,
  ([x]) => x,
  1.5,
).parents;
const barY = (from, to) =>
  edgeLines.find((p, i) => i % 2 === 0 && p[0] === from && edgeLines[i + 1][0] === to && edgeLines[i + 1][1] === p[1])[1];
assert.equal(barY(0, 6), 5);
assert.equal(barY(0, 12), 5);
assert.ok(edgeLines.some((p, i) => i % 2 === 0 && p[0] === 0 && p[1] === 10 && edgeLines[i + 1][0] === 0 && edgeLines[i + 1][1] === 5));
// A separated couple's bar is dashed, and their child hangs straight below the partner who is not
// the one with several families.
const apartPeople = [
  { id: 'H', parentIds: [], partnerIds: ['P', 'Q'], partnerships: [{ partnerId: 'P', status: 'together' }, { partnerId: 'Q', status: 'separated' }] },
  { id: 'P', parentIds: [], partnerIds: ['H'], partnerships: [{ partnerId: 'H', status: 'together' }] },
  { id: 'Q', parentIds: [], partnerIds: ['H'], partnerships: [{ partnerId: 'H', status: 'separated' }] },
  { id: 'hp', parentIds: ['H', 'P'], partnerIds: [] },
  { id: 'hq', parentIds: ['H', 'Q'], partnerIds: [] },
];
const dashedLines = relationLines(apartPeople, edge, ([x]) => x, 1.5);
assert.ok(dashedLines.dashed.length > 0);
assert.ok(dashedLines.dashed.some((p, i) => i % 2 === 0 && p[0] === 0 && dashedLines.dashed[i + 1][0] === 12));
// No dashes without a separated couple.
assert.equal(relationLines(apartPeople.map((p) => ({ ...p, partnerships: [] })), edge, ([x]) => x, 1.5).dashed.length, 0);
// A separated couple without children gets a dashed line under their names.
const childless = relationLines(
  [
    { id: 'X', parentIds: [], partnerIds: ['Y'], partnerships: [{ partnerId: 'Y', status: 'separated' }] },
    { id: 'Y', parentIds: [], partnerIds: ['X'], partnerships: [{ partnerId: 'X', status: 'separated' }] },
  ],
  new Map([['X', flat(0, 10)], ['Y', flat(6, 10)]]),
  ([x]) => x,
  1.5,
);
assert.ok(childless.dashed.some((p) => p[0] === 0) && childless.dashed.some((p) => p[0] === 6));
// A separated partner without shared children is reached by a dashed line at the bar height of the
// person's own family, and drops straight down to it.
const noKids = relationLines(
  apartPeople.filter((p) => p.id !== 'hq'),
  edge,
  ([x]) => x,
  1.5,
);
assert.ok(noKids.dashed.some((p, i) => i % 2 === 0 && p[0] === 0 && p[1] === 5 && noKids.dashed[i + 1][0] === 12 && noKids.dashed[i + 1][1] === 5));
assert.ok(noKids.parents.some((p, i) => i % 2 === 0 && p[0] === 12 && p[1] === 10 && noKids.parents[i + 1][0] === 12 && noKids.parents[i + 1][1] === 5));
console.log('familyLayout ok');
