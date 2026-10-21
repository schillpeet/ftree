// Run with `node app/panelPosition.check.mjs`: a dragged person panel stays grabbable on screen,
// and only a stored {x, y} counts as a pinned position.
import assert from 'node:assert/strict';
import { CENTRE, HEADER_HEIGHT, KEEP_VISIBLE, clampOffset, parsePin } from './panelPosition.ts';

const viewport = { width: 1200, height: 800 };
const box = { left: 320, top: 104, width: 560 };

assert.deepEqual(clampOffset(CENTRE, box, viewport), CENTRE, 'the default spot is kept');
assert.deepEqual(clampOffset({ x: -150, y: 200 }, box, viewport), { x: -150, y: 200 }, 'moves within the screen are kept');
assert.equal(clampOffset({ x: 0, y: -500 }, box, viewport).y, -box.top, 'the header never leaves the top edge');
assert.equal(
  clampOffset({ x: 0, y: 5000 }, box, viewport).y,
  viewport.height - HEADER_HEIGHT - box.top,
  'the header stays above the bottom edge',
);
assert.equal(
  clampOffset({ x: -5000, y: 0 }, box, viewport).x,
  KEEP_VISIBLE - box.width - box.left,
  'part of the panel stays visible on the left',
);
assert.equal(
  clampOffset({ x: 5000, y: 0 }, box, viewport).x,
  viewport.width - KEEP_VISIBLE - box.left,
  'part of the panel stays visible on the right',
);
assert.deepEqual(
  clampOffset({ x: 0, y: 100 }, { left: 16, top: 104, width: 343 }, { width: 375, height: 40 }),
  { x: 0, y: -104 },
  'a viewport too small for the rules pins the header to the top',
);

assert.deepEqual(parsePin('{"x":12,"y":-30}'), { x: 12, y: -30 });
assert.equal(parsePin(null), null);
assert.equal(parsePin('not json'), null);
assert.equal(parsePin('{"x":"1","y":2}'), null, 'non-numbers are ignored');

console.log('panelPosition checks passed');
