// Run with `node app/generations.check.mjs`: generations follow parent and partner links, cards move
// so children hang a gap below their parents, and dragging is bounded by placed parents and children.
import assert from 'node:assert/strict';
import { generationBounds, generations, layerPins } from './generations.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });

// Generations: children below parents, partners equalized (also a married-in partner), unknown
// ids ignored.
const family = [
  person('kid', ['mum', 'dad']),
  person('mum', ['granny']),
  person('dad', [], ['mum']),
  person('granny', ['nobody']),
  person('aunt', ['granny'], ['inlaw']),
  person('inlaw'),
  person('loner'),
];
assert.deepEqual(Object.fromEntries(generations(family)), { kid: 2, mum: 1, dad: 1, granny: 0, aunt: 1, inlaw: 1, loner: 0 });
// Cycle guard: an ancestor loop terminates.
assert.equal(generations([person('a', ['b']), person('b', ['a'])]).size, 2);

// Repair: pins in a column with uneven steps, top-down. The family was auto-assigned to the top
// pins; the loner sits in between.
const gap = 2;
const pins = [10, 9.5, 9, 8.5, 8, 7.2, 6.9, 6, 5.5, 3].map((y) => [0, y, 0]);
const people = [person('child', ['parent']), person('parent', ['grand']), person('grand'), person('loner'), person('partner', [], ['parent'])];
const start = new Map([['grand', 0], ['parent', 1], ['partner', 2], ['loner', 3], ['child', 5]]);
const copy = new Map(start);
const layered = layerPins(people, pins, start, gap);
assert.deepEqual(start, copy);
assert.deepEqual(Object.fromEntries(layered), { grand: 0, parent: 4, partner: 2, loner: 3, child: 7 });
for (const p of people) for (const parent of p.parentIds) assert.ok(pins[layered.get(parent)][1] - pins[layered.get(p.id)][1] >= gap);
assert.equal(new Set(layered.values()).size, layered.size); // no pin used twice
assert.deepEqual(layerPins([...people].reverse(), pins, new Map([...start].reverse()), gap), layered); // deterministic
assert.deepEqual(layerPins(people, pins, layered, gap), layered); // valid cards stay
// No room a full gap below: the card still moves below its parent if it can, otherwise it stays.
const tight = [10, 9.5, 9, 8.5].map((y) => [0, y, 0]);
const fallback = layerPins(people, tight, new Map([['grand', 0], ['child', 1], ['parent', 2]]), gap);
assert.deepEqual(Object.fromEntries(fallback), { grand: 0, child: 3, parent: 2 });
// Members off the pins (free or waiting) do not bound their children.
assert.deepEqual(layerPins([person('a'), person('b', ['a'])], pins, new Map([['b', 0]]), gap), new Map([['b', 0]]));

// Drag bounds: at least `gap` below the lowest placed parent and above the highest placed child.
const at = new Map([['mum', [0, 8, 0]], ['dad', [0, 6, 0]], ['kid', [0, 1, 0]], ['kid2', [0, 3, 0]]]);
const tree = [person('me', ['mum', 'dad', 'away']), person('kid', ['me']), person('kid2', ['me']), person('mum'), person('dad')];
assert.deepEqual(generationBounds('me', tree, at, 1), { lowest: 4, highest: 5 });
assert.deepEqual(generationBounds('kid', tree, new Map(), 1), { lowest: -Infinity, highest: Infinity }); // nobody placed
console.log('generations ok');
