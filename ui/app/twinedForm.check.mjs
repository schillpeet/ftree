// Run with `node app/twinedForm.check.mjs`: the tree's shape is a rule over the plan. Every member
// gets wood and a pin, the wood can grow, free branches depend on nothing but their name, and a
// couple with single children leaves the trunk lower so their twigs rise out of its limb.
import assert from 'node:assert/strict';
import { generations } from './generations.ts';
import { buildTwinedTree, seeded, TWINED_SLOT_ANGLE } from './twinedForm.ts';
import { blendPlans } from './twinedGrowth.ts';
import { twinedPlan } from './twinedLayout.ts';

const person = (id, parentIds = [], partnerIds = [], birthDate = null) => ({ id, parentIds, partnerIds, birthDate });
const plan = (family) => twinedPlan(family, generations(family), TWINED_SLOT_ANGLE);
const three = [
  person('grandpa', [], ['grandma'], '1930'),
  person('grandma', [], ['grandpa'], '1932'),
  person('mum', ['grandpa', 'grandma'], ['dad'], '1960'),
  person('dad', [], ['mum'], '1958'),
  person('aunt', ['grandpa', 'grandma'], [], '1962'),
  person('kid', ['mum', 'dad'], [], '1990'),
];
const piece = (tree, id) => tree.pieces.find((p) => p.id === id);
const points = (p) => p.geometry.attributes.position;
const spots = (p) => Array.from({ length: points(p).count }, (_, i) => [points(p).getX(i), points(p).getY(i), points(p).getZ(i)]);

// The same name always gives the same chance, another name another one.
assert.equal(seeded('a')(), seeded('a')());
assert.notEqual(seeded('a')(), seeded('b')());
{
  const values = Array.from({ length: 200 }, seeded('family'));
  assert.ok(values.every((v) => v >= 0 && v < 1));
  assert.ok(new Set(values).size > 190);
}

// Nothing to draw for an empty family.
assert.deepEqual(buildTwinedTree(plan([]), 0).pieces, []);

const tree = buildTwinedTree(plan(three), 0);
{
  // Every member has a pin and a piece of wood of their own that follows their growth.
  for (const m of three) {
    assert.ok(tree.pins.has(m.id), m.id);
    assert.equal(piece(tree, m.id).follows, m.id);
  }
  // Piece ids are unique, and everything else is free wood that follows a member.
  assert.equal(new Set(tree.pieces.map((p) => p.id)).size, tree.pieces.length);
  const ids = new Set(three.map((m) => m.id));
  for (const p of tree.pieces) {
    assert.ok(ids.has(p.follows), p.id);
    if (!ids.has(p.id)) assert.ok(p.id.startsWith('free:'), p.id);
  }
  assert.ok(tree.pieces.some((p) => p.id.startsWith('free:crown')));
  // Every piece can grow: `along` runs from 0 at its start to 1 at its tip, and no number is broken.
  for (const p of tree.pieces) {
    const along = p.geometry.attributes.along;
    assert.equal(along.getX(0), 0);
    assert.equal(along.getX(along.count - 1), 1);
    assert.ok(Array.from(points(p).array).every(Number.isFinite), p.id);
    assert.ok(Array.from(p.geometry.attributes.uv.array).every(Number.isFinite), p.id);
  }
  // Strands start as roots below the hilltop; pins hang a tier apart, the eldest on top.
  for (const id of ['grandpa', 'mum']) assert.ok(Math.min(...spots(piece(tree, id)).map((s) => s[1])) < 0);
  assert.ok(tree.pins.get('grandpa')[1] > tree.pins.get('mum')[1] + 5);
  assert.ok(tree.pins.get('mum')[1] > tree.pins.get('kid')[1] + 5);
}

// The same family gives the same tree, point for point.
{
  const again = buildTwinedTree(plan(three), 0);
  assert.deepEqual(again.pieces.map((p) => p.id), tree.pieces.map((p) => p.id));
  for (const p of tree.pieces) assert.deepEqual(Array.from(points(piece(again, p.id)).array), Array.from(points(p).array));
}

// A twig on a couple's limb only rises: it ends above where it leaves the limb and never dips
// below that by more than its own thickness, although its parents' cards hang above it.
{
  const ys = spots(piece(tree, 'kid')).map((s) => s[1]);
  assert.ok(tree.pins.get('kid')[1] > ys[0]);
  assert.ok(Math.min(...ys) > ys[0] - 0.6, `${Math.min(...ys)} vs ${ys[0]}`);
}

// A couple leaves the trunk lower once a single child hangs below it: with the tiers at the same
// heights, its strand stays close to the trunk's axis for a shorter way up.
{
  const upTo = (t) => Math.max(...spots(piece(t, 'mum')).filter((s) => Math.hypot(s[0], s[2]) < 2.6 && s[1] > 3).map((s) => s[1]));
  const childless = buildTwinedTree({ ...plan(three.filter((m) => m.id !== 'kid')), depth: 3 }, 0);
  assert.ok(upTo(tree) < upTo(childless) - 2, `${upTo(tree)} vs ${upTo(childless)}`);
}

// Free wood keeps its shape when the family grows somewhere else: a new twig of the grandparents
// leaves the shoots on mum's limb as they are.
{
  const more = buildTwinedTree(plan([...three, person('uncle', ['grandpa', 'grandma'], [], '1964')]), 0);
  const before = tree.pieces.filter((p) => p.id.startsWith('free:mum:'));
  assert.ok(before.length > 0);
  for (const p of before) assert.equal(points(piece(more, p.id)).count, points(p).count, p.id);
}

// While a step grows, the tree between two family states can be built at every moment.
{
  const from = plan(three.slice(0, 4));
  const to = plan(three);
  for (const t of [0, 0.01, 0.5, 0.99, 1]) {
    const growing = buildTwinedTree(blendPlans(from, to, t), 0);
    for (const p of growing.pieces) assert.ok(Array.from(points(p).array).every(Number.isFinite), `${p.id} at ${t}`);
    assert.equal(growing.pins.size, three.length);
  }
}
