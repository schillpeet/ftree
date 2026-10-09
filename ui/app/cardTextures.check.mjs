// Run with `node app/cardTextures.check.mjs`: card text wraps at word boundaries.
import assert from 'node:assert/strict';
import { wrap } from './cardTextures.ts';

// One unit per character.
const ctx = { measureText: (text) => ({ width: text.length }) };

assert.deepEqual(wrap(ctx, 'Anna Maria Schmidt', 10), ['Anna Maria', 'Schmidt']);
assert.deepEqual(wrap(ctx, 'Anna  Maria', 20), ['Anna Maria']);
// A word longer than the line stays whole on its own line.
assert.deepEqual(wrap(ctx, 'Al Wolfeschlegelsteinhausenberger Jr', 10), ['Al', 'Wolfeschlegelsteinhausenberger', 'Jr']);
assert.deepEqual(wrap(ctx, '', 10), []);

console.log('cardTextures ok');
