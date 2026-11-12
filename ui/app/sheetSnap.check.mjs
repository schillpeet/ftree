// Run with `node app/sheetSnap.check.mjs`: a tap on a sheet's grip steps through the heights, a drag rests at the nearest
// one, and pulling it far down closes it.
import assert from 'node:assert/strict';
import { CLOSE_BELOW, FULL_GAP, nextSnap, snapAfterDrag, snapHeight } from './sheetSnap.ts';

const viewport = 800;

assert.equal(snapHeight('full', viewport), viewport - FULL_GAP, 'a full sheet leaves a gap at the top');
assert.ok(snapHeight('peek', viewport) < snapHeight('half', viewport), 'peek is lower than half');

assert.equal(nextSnap('peek'), 'half');
assert.equal(nextSnap('half'), 'full');
assert.equal(nextSnap('full'), 'peek', 'a tap on a full sheet starts over');

assert.equal(snapAfterDrag('half', 400, 2, viewport), 'full', 'a tiny move is a tap');
assert.equal(snapAfterDrag('half', 416, -300, viewport), 'full', 'dragged up, it rests full');
assert.equal(snapAfterDrag('full', 752, 330, viewport), 'half', 'dragged halfway down, it rests at half');
assert.equal(snapAfterDrag('half', 416, 180, viewport), 'peek', 'dragged a bit further, it rests low');
assert.equal(snapAfterDrag('peek', 240, 240 - viewport * CLOSE_BELOW + 10, viewport), 'close', 'pulled far down, it closes');

console.log('sheetSnap ok');
