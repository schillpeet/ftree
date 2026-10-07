// Run with `node app/pins.check.mjs`: pins keep their distance, and dropping a card follows the
// docking and occupancy rules.
import assert from 'node:assert/strict';
import { CARD, CARD_GAP, PIN_RADIUS, assignPins, cardTop, clear, dropTarget, pickPins } from './pins.ts';

const W = CARD.width + CARD_GAP;
const H = CARD.height + CARD_GAP;
assert.ok(2 * PIN_RADIUS < CARD_GAP);

// Spacing: either far enough apart horizontally (in x/z) or vertically.
assert.ok(clear([0, 0, 0], [W, 0, 0]));
assert.ok(clear([0, 0, 0], [0, 0, W]));
assert.ok(clear([0, 0, 0], [0, H, 0]));
assert.ok(!clear([0, 0, 0], [W - 0.01, H - 0.01, 0]));
assert.ok(!clear([0, 0, 0], [W * 0.7, 0, W * 0.7])); // diagonal in x/z still too close

// Picking: too-close candidates are dropped, the top wins, and every pair keeps its distance.
const candidates = [];
for (let i = 0; i < 400; i++) candidates.push([Math.sin(i * 12.9898) * 20, (i * 7.31) % 25, Math.cos(i * 78.233) * 20]);
const pins = pickPins(candidates);
assert.ok(pins.length > 1 && pins.length < candidates.length);
for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) assert.ok(clear(pins[i], pins[j]));
assert.equal(pins[0][1], Math.max(...candidates.map((c) => c[1])));
assert.deepEqual(pickPins([[0, 0, 0], [1, 1, 0], [10, 0, 0]]), [[1, 1, 0], [10, 0, 0]]);
// Deterministic ids: same candidates in another order give the same list.
assert.deepEqual(pickPins([...candidates].reverse()), pins);

// The card hangs right below its pin.
assert.deepEqual(cardTop([1, 10, 2]), [1, 10 - PIN_RADIUS, 2]);

// Docking: the card is a screen rectangle; pins inside it are touched.
const card = { left: 100, top: 100, right: 280, bottom: 340 };
const pin = (id, x, y, r = 0) => ({ id, x, y, r });
assert.equal(dropTarget(card, [pin(0, 50, 50), pin(1, 400, 200)], new Set()), 'free');
assert.deepEqual(dropTarget(card, [pin(0, 190, 300), pin(1, 195, 110)], new Set()), { pin: 1 }); // nearest to the top edge
assert.equal(dropTarget(card, [pin(0, 190, 110)], new Set([0])), 'reject'); // occupied: bounce back
assert.deepEqual(dropTarget(card, [pin(0, 190, 110), pin(1, 150, 300)], new Set([0])), { pin: 1 }); // a free one wins
assert.equal(dropTarget(card, [pin(0, 50, 50)], new Set([0])), 'free'); // occupied but not touched
assert.equal(dropTarget(card, [pin(0, 190, 95, 6)], new Set([0])), 'reject'); // the pin's edge touches the card
assert.equal(dropTarget(card, [pin(0, 190, 95, 4)], new Set([0])), 'free');

// Auto-placement: stored pins stay, the rest fill free pins oldest first, overflow and free
// positions are left out.
const m = (id, birthDate = null, extra = {}) => ({ id, firstName: 'A', lastName: 'B', birthDate, ...extra });
const assigned = assignPins(
  [
    m('stored', '2000-01-01', { pinId: 1 }),
    m('young', '1990-05-05'),
    m('unknown'),
    m('old', '1950-01-01'),
    m('loose', null, { position: { x: 0, y: 0, z: 0 } }),
    m('lost', '1980-01-01', { pinId: 9 }),
    m('b', '1970-01-01', { lastName: 'Z' }),
    m('a', '1970-01-01', { lastName: 'Y' }),
  ],
  6,
);
assert.deepEqual(Object.fromEntries(assigned), { stored: 1, old: 0, a: 2, b: 3, lost: 4, young: 5 });
assert.equal(new Set(assigned.values()).size, assigned.size); // no pin used twice
assert.ok(!assigned.has('unknown') && !assigned.has('loose')); // overflow and free position wait
assert.deepEqual(assignPins([m('x', null, { firstName: 'B' }), m('y', null, { firstName: 'A' })], 1), new Map([['y', 0]]));
console.log('pins ok');
