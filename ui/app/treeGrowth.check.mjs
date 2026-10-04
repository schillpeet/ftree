// Run with `node app/treeGrowth.check.mjs`: the crown space tracks the tree scale, while the
// card footprint stays constant.
import assert from 'node:assert/strict';
import {
  BASE_TREE_BOUNDS,
  CARD_WORLD_SIZE,
  SLOT_MARGINS,
  VIEW_FRONT,
  crownSpaceForScale,
} from './treeGrowth.ts';
import { layoutScrollsInSpace } from './familyLayout.ts';

const at1 = crownSpaceForScale(1, BASE_TREE_BOUNDS, CARD_WORLD_SIZE, SLOT_MARGINS);
assert.ok(at1.topY === BASE_TREE_BOUNDS.crownTop - SLOT_MARGINS.top);
assert.ok(at1.radius === BASE_TREE_BOUNDS.crownRadius - SLOT_MARGINS.side);
assert.ok(at1.slotArcLength === CARD_WORLD_SIZE.width + SLOT_MARGINS.slotGap);
assert.ok(at1.maxRowGap === CARD_WORLD_SIZE.height + SLOT_MARGINS.rowGap);
assert.ok(at1.bottomY === SLOT_MARGINS.bottomCenter);
assert.ok(at1.front === VIEW_FRONT);

// Crown dimensions scale linearly; the card gap and the bottom clamp do not.
const atHalf = crownSpaceForScale(0.5, BASE_TREE_BOUNDS, CARD_WORLD_SIZE, SLOT_MARGINS);
assert.ok(atHalf.topY === 0.5 * BASE_TREE_BOUNDS.crownTop - SLOT_MARGINS.top);
assert.ok(atHalf.radius === 0.5 * BASE_TREE_BOUNDS.crownRadius - SLOT_MARGINS.side);
assert.ok(atHalf.slotArcLength === at1.slotArcLength);
assert.ok(atHalf.maxRowGap === at1.maxRowGap);
assert.ok(atHalf.bottomY === at1.bottomY);

// At the default scale the layout still keeps parents above their children.
const people = [
  { id: 'grand', parentIds: [], partnerIds: [] },
  { id: 'child', parentIds: ['grand'], partnerIds: [] },
];
const positions = layoutScrollsInSpace(people, at1);
assert.ok(positions.get('grand')[1] > positions.get('child')[1]);

console.log('treeGrowth ok');
