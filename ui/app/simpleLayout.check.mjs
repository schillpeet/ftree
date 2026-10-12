// Run with `node app/simpleLayout.check.mjs`: the flat family tree puts each generation on its own
// row, partners next to each other and children below their own parents, always the same way.
import assert from 'node:assert/strict';
import { generations } from './generations.ts';
import { NAME_GAP, ROW_GAP, simpleLayout } from './simpleLayout.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
// The sketch: Johann ── Maria with Peter ── Anna and Thomas ── Lisa, each with children.
const family = [
  person('johann', [], ['maria']),
  person('maria', [], ['johann']),
  person('peter', ['johann', 'maria'], ['anna']),
  person('anna', [], ['peter']),
  person('thomas', ['johann', 'maria'], ['lisa']),
  person('lisa', [], ['thomas']),
  person('max', ['peter', 'anna']),
  person('julia', ['peter', 'anna']),
  person('paul', ['thomas', 'lisa']),
];
const layout = (people) => simpleLayout(people, generations(people));
const at = layout(family);
const x = (id) => at.get(id)[0];
const y = (id) => at.get(id)[1];

// Rows: one generation per row, top down.
assert.equal(y('johann'), 2 * ROW_GAP);
assert.equal(y('peter'), ROW_GAP);
assert.equal(y('anna'), y('peter'));
assert.equal(y('max'), 0);
// Partners sit next to each other.
assert.equal(Math.abs(x('johann') - x('maria')), NAME_GAP);
assert.equal(Math.abs(x('peter') - x('anna')), NAME_GAP);
assert.equal(Math.abs(x('thomas') - x('lisa')), NAME_GAP);
// Each family's children sit under their own parents: Peter's left of Thomas's.
const side = Math.sign(x('peter') - x('thomas'));
assert.equal(Math.sign(x('max') - x('paul')), side);
assert.equal(Math.sign(x('julia') - x('paul')), side);
// Rows are centred.
assert.equal(x('johann') + x('maria'), 0);
// Same family in another order, same layout.
assert.deepEqual(layout([...family].reverse()), at);
console.log('simpleLayout ok');
