// Run with `node app/twinedGrowth.check.mjs`: replay order grows the tree tier by tier, and a plan
// between two family states keeps old members grown while new strands and twigs grow in.
import assert from 'node:assert/strict';
import { generations } from './generations.ts';
import { blendPlans, growthOrder } from './twinedGrowth.ts';
import { twinedPlan } from './twinedLayout.ts';

const SLOT = 0.3;
const person = (id, parentIds = [], partnerIds = [], birthDate = null) => ({ id, parentIds, partnerIds, birthDate });
const plan = (family) => twinedPlan(family, generations(family), SLOT);
const EMPTY = { depth: 0, braids: [], twigs: [], cards: [] };
const three = [
  person('grandpa', [], ['grandma'], '1930'),
  person('grandma', [], ['grandpa'], '1932'),
  person('mum', ['grandpa', 'grandma'], ['dad'], '1960'),
  person('dad', [], ['mum'], '1958'),
  person('aunt', ['grandpa', 'grandma'], [], '1962'),
  person('kid', ['mum', 'dad'], [], '1990'),
];
const ids = (members) => members.map((m) => m.id);

// Eldest first, tier by tier; in a generation blood relatives by age, each followed by their partners.
assert.deepEqual(ids(growthOrder(three)), ['grandpa', 'grandma', 'mum', 'dad', 'aunt', 'kid']);
// Unknown birth dates come last in their generation.
assert.deepEqual(ids(growthOrder([person('b'), person('a', [], [], '1950')])), ['a', 'b']);
assert.deepEqual(growthOrder([]), []);
// Every prefix keeps the married-in partner next to their partner, never alone on top.
{
  const order = growthOrder(three);
  const k = ids(order).indexOf('dad') + 1;
  const g = generations(order.slice(0, k));
  assert.equal(g.get('dad'), g.get('mum'));
}

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
const cardAngle = (p, id) => p.cards.find((c) => c.id === id).angle;

// From mum alone to mum with dad.
const before = plan([person('mum', [], [], '1960')]);
const after = plan([person('mum', [], ['dad'], '1960'), person('dad', [], ['mum'], '1958')]);
{
  const start = blendPlans(before, after, 0);
  close(cardAngle(start, 'mum'), cardAngle(before, 'mum'));
  close(cardAngle(start, 'dad'), cardAngle(after, 'dad'));
  assert.deepEqual(start.braids.map((b) => b.ids), after.braids.map((b) => b.ids));
  const mid = blendPlans(before, after, 0.5);
  assert.equal(mid.grown.get('dad'), 0.5);
  assert.equal(mid.grown.get('mum'), 1);
  assert.ok(blendPlans(before, after, 0.25).grown.get('dad') < 0.25);
  const end = blendPlans(before, after, 1);
  assert.deepEqual({ ...end, grown: undefined }, { ...after, grown: undefined });
  assert.ok([...end.grown.values()].every((g) => g === 1));
}

// A new generation: depth blends, so the tree rises while the new tier grows in.
{
  const a = plan(three.slice(0, 5));
  const b = plan(three);
  assert.equal(blendPlans(a, b, 0.5).depth, (a.depth + b.depth) / 2);
  assert.equal(blendPlans(a, b, 0.5).grown.get('kid'), 0.5);
}

// A member who left is gone at once.
{
  const p = blendPlans(plan(three), plan(three.filter((m) => m.id !== 'aunt')), 0.3);
  assert.ok(!p.cards.some((c) => c.id === 'aunt'));
  assert.ok(!p.twigs.some((t) => t.id === 'aunt'));
  assert.ok(!p.grown.has('aunt'));
}

// From nothing: the first strand grows at the final height.
{
  const p = blendPlans(EMPTY, before, 0.5);
  assert.equal(p.depth, before.depth);
  assert.equal(p.grown.get('mum'), 0.5);
}

// A child who was a twig and gets a partner turns into a strand: it grows anew.
{
  const a = plan([person('mum', [], [], '1960'), person('kid', ['mum'], [], '1990')]);
  const b = plan([person('mum', [], [], '1960'), person('kid', ['mum'], ['wife'], '1990'), person('wife', [], ['kid'], '1991')]);
  assert.equal(blendPlans(a, b, 0.5).grown.get('kid'), 0.5);
  assert.equal(blendPlans(a, b, 0.5).grown.get('mum'), 1);
}
