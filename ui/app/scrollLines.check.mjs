// Run with `node app/scrollLines.check.mjs`: the 3D tree's partner line runs at card height between the
// cards, each child's line ends on the top edge of its card (the rod), no line runs through a card
// where another height avoids it, and only the lineage lights up.
import assert from 'node:assert/strict';
import { CARD } from './pins.ts';
import { BEND, crossings, roundedSegments, scrollLines, scrollPaths, throughCard } from './scrollLines.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const same = (p, q) => p.every((v, i) => near(v, q[i]));
const { width: W, height: H } = CARD;
const G = H + 0.32;

// The card outline: a line ending on its top edge, along its side, or from its bottom does not run
// through it; one into it or across it does.
assert.equal(throughCard([0, 3, 0], [0, 0, 0], [0, 0, 0]), false);
assert.equal(throughCard([W / 2, -1, 0], [9, -1, 0], [0, 0, 0]), false);
assert.equal(throughCard([0, -H, 0], [0, -H - 2, 0], [0, 0, 0]), false);
assert.equal(throughCard([0, 1, 0], [0, -1, 0], [0, 0, 0]), true);
assert.equal(throughCard([-5, -2, 0], [5, -2, 0], [0, 0, 0]), true);
assert.equal(throughCard([-5, -2, 3], [5, -2, 3], [0, 0, 0]), false);

// A couple hanging level with two children below.
const family = [person('mum', [], ['dad']), person('dad', [], ['mum']), person('me', ['mum', 'dad']), person('sis', ['mum', 'dad'])];
const placed = new Map([
  ['mum', [0, 20, 0]],
  ['dad', [6, 20, 0]],
  ['me', [-2, 20 - G - 2, 0]],
  ['sis', [8, 20 - G - 2, 0]],
]);
const paths = scrollPaths(family, placed, new Set());
const partner = paths.filter((p) => p.kind === 'partner');
// Two halves of one horizontal line at the cards' middle height, from the side of one card to the other.
assert.equal(partner.length, 2);
const ends = partner.flatMap((p) => p.points).sort((p, q) => p[0] - q[0]);
assert.ok(same(ends[0], [W / 2, 20 - H / 2, 0]) && same(ends[3], [6 - W / 2, 20 - H / 2, 0]));
assert.ok(same(ends[1], [3, 20 - H / 2, 0]) && same(ends[2], [3, 20 - H / 2, 0]));
// Each child: from the middle of that line down, across, and down onto the top edge of the child's card.
for (const id of ['me', 'sis']) {
  const { points } = paths.find((p) => p.kind === 'child' && same(p.points.at(-1), placed.get(id)));
  assert.equal(points.length, 4);
  assert.ok(same(points[0], [3, 20 - H / 2, 0]));
  assert.ok(near(points[0][0], points[1][0]) && near(points[1][1], points[2][1]) && near(points[2][0], points[3][0]));
  // The bend lies halfway between the bottom of the parents' cards and the child's top.
  assert.ok(near(points[1][1], (20 - H + placed.get(id)[1]) / 2));
}
assert.equal(paths.reduce((n, p) => n + crossings(p.points, placed.values()), 0), 0);

// A card hanging between the partners at their height: the line moves to a height it can pass, still
// one both cards share, so it does not run through the card.
{
  const at = new Map([
    ['a', [0, 20, 0]],
    ['b', [12, 18, 0]],
    ['x', [6, 22, 0]],
  ]);
  const people = [person('a', [], ['b']), person('b', [], ['a']), person('x')];
  const line = scrollPaths(people, at, new Set()).flatMap((p) => p.points);
  assert.equal(crossings(line, at.values()), 0);
  const y = line[0][1];
  assert.ok(line.every((p) => near(p[1], y)) && y < 18 && y > 20 - H);
}

// A card right above the child: the line runs across in the gap between it and the child, not
// through it, and still ends on the child's top edge.
{
  const at = new Map([
    ['p', [0, 30, 0]],
    ['kid', [10, 30 - 2 * G, 0]],
    ['above', [10, 30 - G, 0]],
  ]);
  const people = [person('p'), person('kid', ['p']), person('above')];
  const [path] = scrollPaths(people, at, new Set());
  assert.equal(crossings(path.points, at.values()), 0);
  assert.ok(same(path.points[0], [0, 30 - H, 0]));
  assert.ok(same(path.points.at(-1), at.get('kid')));
}

// Cards right below and right above the middle of the partners' line: the child's line leaves the
// line further out instead of running through either, and still starts on it.
{
  const at = new Map([
    ['a', [0, 20, 0]],
    ['b', [16, 20, 0]],
    ['below', [8, 20 - G, 0]],
    ['above', [8, 20 + G, 0]],
    ['kid', [8, 20 - 2 * G - 1, 0]],
  ]);
  const people = [person('a', [], ['b']), person('b', [], ['a']), person('below'), person('above'), person('kid', ['a', 'b'])];
  const paths = scrollPaths(people, at, new Set());
  assert.equal(paths.reduce((n, p) => n + crossings(p.points, at.values()), 0), 0);
  const kid = paths.find((p) => p.kind === 'child').points;
  assert.ok(near(kid[0][1], 20 - H / 2) && kid[0][0] > W / 2 && kid[0][0] < 16 - W / 2 && !near(kid[0][0], 8));
  assert.ok(same(kid.at(-1), at.get('kid')));
}

// Partners with a card level between them: the line runs over it from both tops.
{
  const at = new Map([
    ['a', [0, 20, 0]],
    ['b', [12, 20, 0]],
    ['x', [6, 20, 0]],
  ]);
  const line = scrollPaths([person('a', [], ['b']), person('b', [], ['a']), person('x')], at, new Set()).flatMap((p) => p.points);
  assert.equal(crossings(line, at.values()), 0);
  assert.ok(same(line[0], at.get('a')) || same(line[0], at.get('b')));
  assert.ok(line.some((p) => p[1] > 20));
}

// A child hanging higher than its single parent is reached from below, at its bottom edge.
{
  const at = new Map([
    ['p', [0, 10, 0]],
    ['kid', [8, 30, 0]],
  ]);
  const [path] = scrollPaths([person('p'), person('kid', ['p'])], at, new Set());
  assert.ok(same(path.points.at(-1), [8, 30 - H, 0]));
  assert.equal(crossings(path.points, at.values()), 0);
}

// Partners stacked above each other: from the bottom of the upper card to the top of the lower one.
{
  const at = new Map([
    ['a', [0, 20, 0]],
    ['b', [0.5, 20 - G, 0]],
  ]);
  const line = scrollPaths([person('a', [], ['b']), person('b', [], ['a'])], at, new Set()).flatMap((p) => p.points);
  assert.ok(same(line[0], [0, 20 - H, 0]) && same(line.at(-1), at.get('b')));
}

// The lineage lights the partners' line and the line to its child, not the line to the sibling. A
// co-parent outside the lineage keeps their half of the line dim.
{
  const lit = (paths) => paths.filter((p) => p.lit);
  const mine = scrollPaths(family, placed, new Set(['me', 'mum', 'dad']));
  assert.equal(lit(mine).filter((p) => p.kind === 'partner').length, 2);
  assert.deepEqual(lit(mine).filter((p) => p.kind === 'child').map((p) => p.points.at(-1)), [placed.get('me')]);
  const coParents = [person('mum'), person('dad'), person('me', ['mum', 'dad'])];
  const halves = scrollPaths(coParents, placed, new Set(['me', 'mum'])).filter((p) => p.kind === 'partner');
  // mum hangs at x = 0, dad at x = 6.
  assert.deepEqual(halves.filter((p) => p.lit).flatMap((p) => p.points.map(([x]) => x)).sort(), [W / 2, 3]);
}

// Bends are rounded with BEND, and the rounded line keeps its ends.
{
  const segments = roundedSegments([[0, 10, 0], [0, 5, 0], [4, 5, 0], [4, 0, 0]]);
  assert.ok(same(segments[0], [0, 10, 0]) && same(segments.at(-1), [4, 0, 0]));
  assert.ok(same(segments[1], [0, 5 + BEND, 0]));
  assert.ok(segments.every((p) => p[1] <= 10 && p[1] >= 0 && p[0] >= 0 && p[0] <= 4));
  // Straight segments pairwise: every piece starts where the last ended.
  for (let i = 2; i < segments.length; i += 2) assert.ok(same(segments[i], segments[i - 1]));
  const lines = scrollLines(family, placed, new Set(['me']));
  assert.equal(lines.lit.length % 2, 0);
  assert.equal(lines.dim.length % 2, 0);
}

console.log('scroll lines ok');
