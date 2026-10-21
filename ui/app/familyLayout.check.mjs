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
// The solid bar to P runs first, so the dashed one to Q starts where it ends instead of lying on top of it.
assert.ok(dashedLines.dashed.some((p, i) => i % 2 === 0 && p[0] === 6 && dashedLines.dashed[i + 1][0] === 12));
assert.ok(!dashedLines.dashed.some((p) => p[0] < 6 && p[1] === 5), 'no dashes over the solid bar');
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
// It starts where the solid bar to the current partner P ends.
assert.ok(noKids.dashed.some((p, i) => i % 2 === 0 && p[0] === 6 && p[1] === 5 && noKids.dashed[i + 1][0] === 12 && noKids.dashed[i + 1][1] === 5));
assert.ok(noKids.dashed.some((p, i) => i % 2 === 0 && p[0] === 12 && p[1] === 10 && noKids.dashed[i + 1][0] === 12 && noKids.dashed[i + 1][1] === 5));
assert.ok(!noKids.parents.some((p) => p[0] === 12), 'the former partner drops dashed, not solid');
// Focused on the former partner, nothing solid joins the two: flat trees draw no direct partner line.
{
  const focusedEx = relationLines(apartPeople.filter((p) => p.id !== 'hq'), edge, ([x]) => x, 1.5, 'Q');
  assert.ok(!focusedEx.focused.some((p) => p[0] === 12), `solid focused line to Q: ${JSON.stringify(focusedEx.focused)}`);
  assert.ok(focusedEx.focusedDashed.some((p) => p[0] === 12));
}
// Several former partners at one height share one dashed line instead of overlapping ones whose dashes
// would add up to a solid line: K's exes A and B have a child each, C has none.
{
  const exes = ['A', 'B', 'C'];
  const lines = relationLines(
    [
      { id: 'K', parentIds: [], partnerIds: exes, partnerships: exes.map((partnerId) => ({ partnerId, status: 'divorced' })) },
      ...exes.map((id) => ({ id, parentIds: [], partnerIds: ['K'], partnerships: [{ partnerId: 'K', status: 'separated' }] })),
      { id: 'ka', parentIds: ['A', 'K'], partnerIds: [] },
      { id: 'kb', parentIds: ['B', 'K'], partnerIds: [] },
    ],
    new Map([['A', flat(0, 10)], ['B', flat(6, 10)], ['C', flat(12, 10)], ['K', flat(18, 10)], ['ka', flat(0, 0)], ['kb', flat(6, 0)]]),
    ([x]) => x,
    1.5,
  );
  const runs = [];
  for (let i = 0; i < lines.dashed.length; i += 2) {
    const [a, b] = [lines.dashed[i], lines.dashed[i + 1]];
    if (a[1] === b[1]) runs.push([Math.min(a[0], b[0]), Math.max(a[0], b[0]), a[1]]);
  }
  for (const r of runs)
    assert.ok(!runs.some((o) => o !== r && o[2] === r[2] && o[0] < r[1] && r[0] < o[1]), `dashed runs overlap: ${JSON.stringify(runs)}`);
  assert.ok(runs.some(([from, to]) => from === 0 && to === 18), 'one dashed line from the farthest ex to K');
}
// A current partner without shared children drops solid to the person's family bar, and the dashed line
// to a former partner farther out starts only after it.
{
  const lines = relationLines(
    [
      { id: 'K', parentIds: [], partnerIds: ['R', 'X'], partnerships: [{ partnerId: 'R', status: 'together' }, { partnerId: 'X', status: 'divorced' }] },
      { id: 'R', parentIds: [], partnerIds: ['K'], partnerships: [{ partnerId: 'K', status: 'together' }] },
      { id: 'X', parentIds: [], partnerIds: ['K'], partnerships: [{ partnerId: 'K', status: 'divorced' }] },
      { id: 'kx', parentIds: ['K', 'X'], partnerIds: [] },
    ],
    new Map([['K', flat(0, 10)], ['R', flat(6, 10)], ['X', flat(12, 10)], ['kx', flat(12, 0)]]),
    ([x]) => x,
    1.5,
  );
  const has = (list, [x1, y1], [x2, y2]) =>
    list.some((p, i) => i % 2 === 0 && p[0] === x1 && p[1] === y1 && list[i + 1][0] === x2 && list[i + 1][1] === y2);
  assert.ok(has(lines.parents, [0, 5], [6, 5]) && has(lines.parents, [6, 10], [6, 5]), 'solid to the current partner');
  assert.ok(has(lines.dashed, [6, 5], [12, 5]), `dashed only beyond the current partner: ${JSON.stringify(lines.dashed)}`);
}
// A widowed partner without shared children drops solid, but the line over to the person is dashed beyond
// the current partner's solid one.
{
  const lines = relationLines(
    [
      { id: 'K', parentIds: [], partnerIds: ['R', 'W', 'X'], partnerships: [{ partnerId: 'R', status: 'together' }, { partnerId: 'W', status: 'widowed' }, { partnerId: 'X', status: 'divorced' }] },
      { id: 'R', parentIds: [], partnerIds: ['K'], partnerships: [{ partnerId: 'K', status: 'together' }] },
      { id: 'W', parentIds: [], partnerIds: ['K'], partnerships: [{ partnerId: 'K', status: 'widowed' }] },
      { id: 'X', parentIds: [], partnerIds: ['K'], partnerships: [{ partnerId: 'K', status: 'divorced' }] },
      { id: 'kx', parentIds: ['K', 'X'], partnerIds: [] },
    ],
    new Map([['K', flat(0, 10)], ['R', flat(6, 10)], ['W', flat(12, 10)], ['X', flat(18, 10)], ['kx', flat(18, 0)]]),
    ([x]) => x,
    1.5,
  );
  const has = (list, [x1, y1], [x2, y2]) =>
    list.some((p, i) => i % 2 === 0 && p[0] === x1 && p[1] === y1 && list[i + 1][0] === x2 && list[i + 1][1] === y2);
  assert.ok(has(lines.parents, [12, 10], [12, 5]), 'the widowed partner drops solid');
  assert.ok(has(lines.parents, [0, 5], [6, 5]), 'solid only to the current partner');
  assert.ok(!lines.parents.some((p, i) => i % 2 === 0 && p[1] === 5 && lines.parents[i + 1][1] === 5 && Math.max(p[0], lines.parents[i + 1][0]) > 6));
  assert.ok(has(lines.dashed, [6, 5], [18, 5]), `dashed from the current partner on: ${JSON.stringify(lines.dashed)}`);
}
// With a focused person, exactly the lines to their relatives are focused, and nothing is drawn twice.
const pairs = (points) => {
  const out = [];
  for (let i = 0; i < points.length; i += 2) out.push(`${points[i]}|${points[i + 1]}`);
  return out;
};
const touches = (points, at) => points.some((p) => p === at);
const family = [
  { id: 'gm', parentIds: [], partnerIds: ['gp'] },
  { id: 'gp', parentIds: [], partnerIds: ['gm', 'step'] },
  { id: 'step', parentIds: [], partnerIds: ['gp'] },
  { id: 'me', parentIds: ['gm', 'gp'], partnerIds: ['wife', 'ex'] },
  { id: 'sis', parentIds: ['gm', 'gp'], partnerIds: [] },
  { id: 'half', parentIds: ['gp', 'step'], partnerIds: [] },
  { id: 'wife', parentIds: [], partnerIds: ['me'] },
  { id: 'ex', parentIds: [], partnerIds: ['me'] },
  { id: 'kid', parentIds: ['me', 'wife'], partnerIds: [] },
  { id: 'cousin', parentIds: ['other'], partnerIds: [] },
  { id: 'other', parentIds: [], partnerIds: [] },
];
const familyLayout = new Map([
  ['gm', flat(0, 20)], ['gp', flat(6, 20)], ['step', flat(12, 20)], ['other', flat(20, 20)],
  ['me', flat(2, 10)], ['sis', flat(5, 10)], ['half', flat(10, 10)], ['wife', flat(-4, 10)], ['ex', flat(-10, 10)], ['cousin', flat(20, 10)],
  ['kid', flat(-1, 0)],
]);
const plain = relationLines(family, familyLayout, ([x]) => x);
assert.equal(plain.focused.length, 0);
const mine = relationLines(family, familyLayout, ([x]) => x, 0, 'me');
const all = (lines) => [...lines.parents, ...lines.partners, ...lines.focused].length;
assert.equal(all(mine), all(plain));
for (const id of ['gm', 'gp', 'me', 'sis', 'half', 'wife', 'ex', 'kid']) assert.ok(touches(mine.focused, familyLayout.get(id)), id);
// The step-parent and the unrelated family stay as they are.
for (const id of ['step', 'other', 'cousin']) assert.ok(!touches(mine.focused, familyLayout.get(id)), id);
assert.ok(touches(mine.parents, familyLayout.get('step')));
// The half-sibling's bar only runs from the shared parent to the stem, not on to the step-parent.
assert.ok(!pairs(mine.focused).some((pair) => pair.includes('12,15,0')));
// Focused on the kid, the grandparents' lines stay plain.
const kids = relationLines(family, familyLayout, ([x]) => x, 0, 'kid');
assert.ok(touches(kids.focused, familyLayout.get('me')) && touches(kids.focused, familyLayout.get('wife')));
assert.ok(!touches(kids.focused, familyLayout.get('gm')) && !touches(kids.focused, familyLayout.get('ex')));
console.log('familyLayout ok');
