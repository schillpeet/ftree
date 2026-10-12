// Run with `node app/tieredLayout.check.mjs`: one tier per generation, every family in its own
// wedge, a couple right above the middle of their children's branch, cards never too close.
import assert from 'node:assert/strict';
import { generations } from './generations.ts';
import { tieredPlan } from './tieredLayout.ts';

const options = { slot: 4, minRadius: 6, widening: 2.5 };
const person = (id, parentIds = [], partnerIds = [], birthDate = null) => ({ id, parentIds, partnerIds, birthDate });
const family = [
  person('grandpa', [], ['grandma'], '1930'),
  person('grandma', [], ['grandpa'], '1932'),
  person('greatuncle', [], [], '1920'),
  person('cousin', ['greatuncle'], [], '1950'),
  person('mum', ['grandpa', 'grandma'], ['dad'], '1960'),
  person('dad', [], ['mum'], '1958'),
  person('aunt', ['grandpa', 'grandma'], [], '1962'),
  person('kid', ['mum', 'dad'], [], '1990'),
  person('kid2', ['mum', 'dad'], [], '1992'),
];
const plan = tieredPlan(family, generations(family), options);
const ids = plan.map((tier) => tier.branches.map((b) => b.units.map((u) => u.map((c) => c.id))));
const cardsOf = (tier) => tier.branches.flatMap((b) => b.units.flat());
const angle = new Map(plan.flatMap((tier) => cardsOf(tier).map((c) => [c.id, c.angle])));
const middle = (cards) => (Math.min(...cards.map((c) => c.angle)) + Math.max(...cards.map((c) => c.angle))) / 2;
const spans = (cards, a) => Math.min(...cards.map((c) => c.angle)) <= a && a <= Math.max(...cards.map((c) => c.angle));

// Founders by age, each unit on its own branch; partners in one unit.
assert.deepEqual(ids[0], [[['greatuncle']], [['grandpa', 'grandma']]]);
// Children of one unit share a branch, the married-in dad in mum's unit, siblings by age.
assert.deepEqual(ids[1], [[['cousin']], [['mum', 'dad'], ['aunt']]]);
assert.deepEqual(ids[2], [[['kid'], ['kid2']]]);
// Each children's branch leaves the trunk right below the middle of their parents, who hang
// above their children's cards.
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
close(plan[1].branches[1].angle, middle(plan[0].branches[1].units[0]));
close(plan[2].branches[0].angle, middle(plan[1].branches[1].units[0]));
assert.ok(spans(plan[1].branches[1].units.flat(), plan[1].branches[1].angle));
close(middle(plan[1].branches[1].units[0]), middle(plan[2].branches[0].units.flat()));
close(angle.get('greatuncle'), angle.get('cousin'));
// Families do not overlap: the cousin's wedge lies apart from mum's family.
assert.ok(angle.get('cousin') < angle.get('mum'));
// Neighbouring cards on a tier keep at least a slot apart.
for (const tier of plan) {
  const sorted = cardsOf(tier).map((c) => c.angle).sort((a, b) => a - b);
  const chord = (a) => 2 * tier.radius * Math.sin(a / 2);
  sorted.slice(1).forEach((a, i) => assert.ok(chord(a - sorted[i]) >= options.slot - 1e-9));
  if (sorted.length > 1) assert.ok(chord(sorted[0] + Math.PI * 2 - sorted.at(-1)) >= options.slot - 1e-9);
}
// Everyone appears once.
assert.equal(angle.size, family.length);

// A large family pushes the tiers further out, so all cards still fit around the trunk.
const many = Array.from({ length: 30 }, (_, i) => person(`c${i}`, ['root']));
const big = tieredPlan([person('root'), ...many], generations([person('root'), ...many]), options);
assert.ok(big[1].radius > options.minRadius + options.widening);
assert.ok(big[1].radius * Math.PI * 2 >= 30 * options.slot);
// A single founder hangs at the front, their children close beside them instead of all round.
const few = [person('root'), person('a', ['root']), person('b', ['root'])];
const small = tieredPlan(few, generations(few), options);
close(small[0].branches[0].units[0][0].angle, 0);
close(middle(small[1].branches[0].units.flat()), 0);
assert.ok(Math.max(...small[1].branches[0].units.flat().map((c) => Math.abs(c.angle))) < Math.PI / 2);

assert.deepEqual(tieredPlan([], new Map(), options), []);
console.log('tieredLayout ok');
