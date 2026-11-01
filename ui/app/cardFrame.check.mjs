// Run with `node app/cardFrame.check.mjs`: how far the camera backs off from a selected card and where the card sits.
import assert from 'node:assert/strict';
import { NARROW, PANEL_SPACE, frameCard } from './cardFrame.ts';

const card = { width: 3.6, height: 4.8 };
const desktop = { width: 1440, height: 900 };
const tan = Math.tan((50 * Math.PI) / 360);
// Where on screen (pixels from the left) the card's middle lands for a camera offset.
const screenX = ({ distance, offsetX }, viewport) => {
  const visibleWidth = 2 * distance * tan * (viewport.width / viewport.height);
  return viewport.width / 2 - (offsetX / visibleWidth) * viewport.width;
};

// Without a panel the card stays in the middle, and the card alone fills well under half the height.
const plain = frameCard(card, desktop, 50, null);
assert.equal(plain.offsetX, 0);
assert.ok(card.height / (2 * plain.distance * tan) < 0.4, 'the card leaves room for its slots');
assert.ok(plain.distance > 12, 'farther than the old fixed distance');

// A panel on the right moves the card into the middle of the free left part, and the other way round.
const right = frameCard(card, desktop, 50, 'right');
assert.ok(Math.abs(screenX(right, desktop) - (desktop.width - PANEL_SPACE) / 2) < 1e-6);
const left = frameCard(card, desktop, 50, 'left');
assert.ok(Math.abs(screenX(left, desktop) - (PANEL_SPACE + (desktop.width - PANEL_SPACE) / 2)) < 1e-6);
// Less free width means backing off further.
assert.ok(right.distance >= plain.distance);

// Narrow screens: the panel covers the bottom, nothing is shifted.
const phone = { width: NARROW - 1, height: 800 };
assert.equal(frameCard(card, phone, 50, 'right').offsetX, 0);
assert.ok(frameCard(card, phone, 50, null).distance > plain.distance, 'portrait backs off further');

console.log('cardFrame ok');
