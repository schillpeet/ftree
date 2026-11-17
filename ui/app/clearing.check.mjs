// Run with `node app/clearing.check.mjs`: the clearing's hill is 0 at the trunk and falls steadily to its foot, the
// ground is finite everywhere and clean on the hilltop, so the tree's foot never moves; the forest ring stands still,
// outside the clearing, and the camera inside it sees the whole tree.
import assert from 'node:assert/strict';
import { cameraLimit, fitDistance, groundAt, HAZE, hazeDensity, HILL, hillAt, ringRadius, ringTrees, ROOM } from './clearing.ts';

assert.ok(hillAt(0) === 0);
{
  let last = 0;
  for (let r = 0; r <= HILL.foot + 20; r += 0.5) {
    assert.ok(hillAt(r) <= last + 1e-9, `rises at ${r}`);
    last = hillAt(r);
  }
}
assert.ok(Math.abs(hillAt(HILL.foot) + HILL.height) < 1e-6);
for (const [x, z] of [[0, 0], [3, 4], [200, -50], [-4000, 4000]]) assert.ok(Number.isFinite(groundAt(x, z)), `${x} ${z}`);
for (const [x, z] of [[1, 1], [-6, 3], [0, 9]]) assert.ok(Math.abs(groundAt(x, z) - hillAt(Math.hypot(x, z))) < 1e-3, 'hilltop');

// The forest ring: the same trees for the same ring, none inside the clearing, a row's neighbours apart.
{
  const trees = ringTrees(60, 33);
  assert.deepEqual(ringTrees(60, 33), trees);
  assert.ok(trees.length > 40);
  for (const t of trees) {
    assert.ok(Math.hypot(t.x, t.z) >= 60 - 6, 'inside');
    assert.ok(t.height > 0 && Number.isFinite(t.height) && t.cell >= 0 && t.cell <= 2);
  }
  const front = trees.filter((t) => t.row === 0).sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  for (let i = 1; i < front.length; i++) assert.ok(Math.hypot(front[i].x - front[i - 1].x, front[i].z - front[i - 1].z) >= 3, 'crowded');
}

// The ring follows the tree: the camera can back off ROOM times the whole-tree distance and stays well inside it.
for (const top of [20, 33, 52]) {
  const radius = ringRadius(top);
  const { maxDistance, box } = cameraLimit(radius);
  assert.ok(box + maxDistance <= radius - 8, `camera ${top}`);
  assert.ok(maxDistance >= ROOM * fitDistance(top) - 1e-9, `room ${top}`);
}
assert.ok(ringRadius(52) > ringRadius(33));

// Haze: something `distance` away is `clearAt` visible under fogExp2.
assert.ok(Math.abs(hazeDensity(0.9, 50) - 0.0065) < 1e-4);
for (const [c, d] of [[0.6, 110], [0.95, 50]]) assert.ok(Math.abs(Math.exp(-((hazeDensity(c, d) * d) ** 2)) - c) < 1e-9);
assert.ok(Math.abs(Math.exp(-((HAZE * 50) ** 2)) - 0.95) < 1e-9);
