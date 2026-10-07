// Run with `node app/arrange.check.mjs`: related members move closer together or further apart,
// unrelated ones stay, and no pin holds two cards.
import assert from 'node:assert/strict';
import { arrangePins, relationDistance } from './arrange.ts';
import { CARD, CARD_GAP } from './pins.ts';

const W = CARD.width + CARD_GAP;
const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
const distance = (pins, map, a, b) => Math.hypot(...pins[map.get(a)].map((v, i) => v - pins[map.get(b)][i]));

// Twelve pins in a row, W apart.
const line = Array.from({ length: 12 }, (_, i) => [i * W, 0, 0]);

// Slider to link length: −10 cards side by side, 0 twice that, +10 the widest pin pair (11 W on
// the line), rising steadily; with pins closer than 2 W, +10 stays at 2 W.
const near = (a, b) => Math.abs(a - b) < 1e-9;
assert.ok(near(relationDistance(-10, line, W), W));
assert.ok(near(relationDistance(0, line, W), 2 * W));
assert.ok(near(relationDistance(10, line, W), 11 * W));
const steps = Array.from({ length: 21 }, (_, i) => relationDistance(i - 10, line, W));
assert.ok(steps.every((d, i) => i === 0 || d > steps[i - 1]));
assert.ok(near(relationDistance(10, [[0, 0, 0], [W, 0, 0]], W), 2 * W));
assert.ok(near(relationDistance(10, [], W), 2 * W));

// On the line, a parent and child start at both ends, two unrelated members sit in between.
const people = [person('parent'), person('child', ['parent']), person('loner'), person('other')];
const base = new Map([['parent', 0], ['child', 11], ['loner', 5], ['other', 6]]);
const copy = new Map(base);
const tight = arrangePins(people, line, base, relationDistance(-10, line, W));
const spread = arrangePins(people, line, base, relationDistance(10, line, W));
assert.deepEqual(base, copy);
for (const map of [tight, spread]) {
  assert.equal(map.get('loner'), 5);
  assert.equal(map.get('other'), 6);
  assert.equal(new Set(map.values()).size, map.size);
}
assert.ok(distance(line, tight, 'parent', 'child') < distance(line, spread, 'parent', 'child'));
assert.deepEqual(arrangePins(people, line, base, relationDistance(-10, line, W)), tight);

// Members off the pins (free or waiting) are not linked and do not block a pin.
assert.deepEqual(arrangePins([person('a'), person('b', ['a'])], line, new Map([['b', 3]]), W), new Map([['b', 3]]));

// Benchmark: 250 members, of which 80 sit on a grid of 80 pins, all in families.
const grid = Array.from({ length: 80 }, (_, i) => [(i % 10) * W, Math.floor(i / 10) * W, 0]);
const crowd = Array.from({ length: 250 }, (_, i) => person(`m${i}`, i > 1 ? [`m${Math.floor(i / 3)}`] : [], i % 2 ? [`m${i - 1}`] : []));
const seats = new Map(crowd.slice(0, 80).map((p, i) => [p.id, (i * 37) % 80]));
const start = performance.now();
const crowded = arrangePins(crowd, grid, seats, relationDistance(-10, grid, W));
const ms = performance.now() - start;
assert.equal(new Set(crowded.values()).size, 80);
console.log(`arrange ok (${ms.toFixed(1)} ms for 250 members on 80 pins)`);
