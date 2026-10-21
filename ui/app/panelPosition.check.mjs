// Run with `node app/panelPosition.check.mjs`: a dragged person panel stays grabbable on screen,
// and only a stored {x, y} counts as a pinned position.
import assert from 'node:assert/strict';
import { BESIDE_GAP, CENTRE, EDGE_MARGIN, HEADER_HEIGHT, KEEP_VISIBLE, clampOffset, parsePin, placeBeside } from './panelPosition.ts';

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

// A panel opened beside another goes where there is more room and moves the other one over if needed.
assert.deepEqual(
  placeBeside({ left: 100, width: 560 }, 480, { width: 1400 }, true),
  { side: 'right', shift: 0, left: 100 + 560 + BESIDE_GAP },
  'more room on the right',
);
assert.equal(placeBeside({ left: 800, width: 560 }, 480, { width: 1400 }, true).side, 'left', 'more room on the left');
{
  // Centred on 1440 px: 440 px on each side are not enough for 480 + gap + margin.
  const placed = placeBeside({ left: 440, width: 560 }, 480, { width: 1440 }, true);
  assert.equal(placed.side, 'right');
  assert.equal(placed.shift, -(480 + BESIDE_GAP + EDGE_MARGIN - 440), 'the other panel moves just as far as needed');
  assert.equal(placed.left, 440 + placed.shift + 560 + BESIDE_GAP);
  assert.ok(placed.left + 480 <= 1440 - EDGE_MARGIN, 'both fit on screen');
}
assert.equal(placeBeside({ left: 440, width: 560 }, 480, { width: 1440 }, false).shift, 0, 'a pinned panel stays put');
assert.deepEqual(
  placeBeside({ left: 16, width: 343 }, 343, { width: 375 }, true),
  { side: 'right', shift: 0, left: 16 },
  'on a phone the new panel stays on screen, over the other one',
);

console.log('panelPosition checks passed');
