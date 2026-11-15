// Run with `node app/twinedLayout.check.mjs`: every couple is a braid of their own strands, childless
// people without a partner are twigs of their parents' braid, every member gets one card, and cards
// on a tier never come closer than a slot.
import assert from 'node:assert/strict';
import { generations } from './generations.ts';
import { twinedPlan } from './twinedLayout.ts';

const SLOT = 0.3;
const person = (id, parentIds = [], partnerIds = [], birthDate = null) => ({ id, parentIds, partnerIds, birthDate });
const plan = (family, slot = SLOT) => twinedPlan(family, generations(family), slot);
const ids = (p) => p.braids.map((b) => b.ids);
const twig = (p, id) => p.twigs.find((t) => t.id === id);
const card = (p, id) => p.cards.find((c) => c.id === id);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

// Empty family: nothing to grow.
assert.deepEqual(plan([]), { depth: 0, braids: [], twigs: [], cards: [] });

// One person: a single strand, a sapling at the trunk axis.
{
  const p = plan([person('solo')]);
  assert.deepEqual(ids(p), [['solo']]);
  assert.deepEqual(p.twigs, []);
  assert.equal(p.braids[0].offset, 0);
  assert.equal(p.depth, 1);
}

// A couple: one braid of both strands, a card each.
{
  const p = plan([person('a', [], ['b'], '1950'), person('b', [], ['a'], '1952')]);
  assert.deepEqual(ids(p), [['a', 'b']]);
  assert.deepEqual(p.cards.map((c) => c.id).sort(), ['a', 'b']);
}

// A couple with two childless kids: the kids are twigs of their parents' braid, one tier below.
{
  const p = plan([
    person('mum', [], ['dad'], '1960'),
    person('dad', [], ['mum'], '1958'),
    person('kid', ['mum', 'dad'], [], '1990'),
    person('kid2', ['mum', 'dad'], [], '1992'),
  ]);
  assert.equal(p.braids.length, 1);
  assert.deepEqual([...p.braids[0].ids].sort(), ['dad', 'mum']);
  for (const id of ['kid', 'kid2']) {
    assert.equal(twig(p, id).tier, 1);
    assert.deepEqual(twig(p, id).from, p.braids[0].ids);
  }
}

// Three generations: the married child brings a strand of their own, the unmarried aunt is a twig.
const three = [
  person('grandpa', [], ['grandma'], '1930'),
  person('grandma', [], ['grandpa'], '1932'),
  person('mum', ['grandpa', 'grandma'], ['dad'], '1960'),
  person('dad', [], ['mum'], '1958'),
  person('aunt', ['grandpa', 'grandma'], [], '1962'),
  person('kid', ['mum', 'dad'], [], '1990'),
];
{
  const p = plan(three);
  // Blood relatives first in a braid.
  assert.deepEqual(ids(p), [['grandpa', 'grandma'], ['mum', 'dad']]);
  assert.deepEqual(p.braids.map((b) => b.tier), [0, 1]);
  assert.equal(p.braids[0].offset, 0);
  assert.ok(p.braids[1].offset > 0);
  assert.deepEqual(twig(p, 'aunt'), { ...twig(p, 'aunt'), tier: 1, from: ['grandpa', 'grandma'] });
  assert.deepEqual(twig(p, 'kid'), { ...twig(p, 'kid'), tier: 2, from: ['mum', 'dad'] });
  assert.equal(p.depth, 3);
}

// A single parent: one unwound strand that carries the child's twig.
{
  const p = plan([person('mum', [], [], '1960'), person('kid', ['mum'], [], '1990')]);
  assert.deepEqual(ids(p), [['mum']]);
  assert.deepEqual(twig(p, 'kid').from, ['mum']);
}

// A second partner on the same tier: a braid of three strands.
{
  const p = plan([person('a', [], ['b', 'c'], '1950'), person('b', [], ['a'], '1952'), person('c', [], ['a'], '1955')]);
  assert.equal(p.braids.length, 1);
  assert.deepEqual([...p.braids[0].ids].sort(), ['a', 'b', 'c']);
}

// Links to people outside the tree are ignored.
{
  const p = plan([person('lone', ['ghost-parent'], ['ghost-partner'])]);
  assert.deepEqual(ids(p), [['lone']]);
  assert.deepEqual(p.twigs, []);
}

// Partners in different generations share the later one: one braid on that tier.
{
  const p = plan([
    person('old', [], [], '1930'),
    person('young', ['old'], ['spouse'], '1960'),
    person('spouse', [], ['young'], '1961'),
  ]);
  const braid = p.braids.find((b) => b.ids.includes('spouse'));
  assert.deepEqual([...braid.ids].sort(), ['spouse', 'young']);
  assert.equal(braid.tier, 1);
}

// Two families marry: one braid holds the couple, in the elder partner's family.
{
  const p = plan([
    person('a1', [], ['a2'], '1930'),
    person('a2', [], ['a1'], '1931'),
    person('b1', [], ['b2'], '1935'),
    person('b2', [], ['b1'], '1936'),
    person('x', ['a1', 'a2'], ['y'], '1960'),
    person('y', ['b1', 'b2'], ['x'], '1962'),
    person('kid', ['x', 'y'], [], '1990'),
  ]);
  const couples = p.braids.filter((b) => b.ids.includes('x') || b.ids.includes('y'));
  assert.equal(couples.length, 1);
  assert.deepEqual(couples[0].ids, ['x', 'y']);
  const aFamily = p.braids.find((b) => b.ids.includes('a1'));
  const bFamily = p.braids.find((b) => b.ids.includes('b1'));
  assert.ok(Math.abs(couples[0].angle - aFamily.angle) < Math.abs(couples[0].angle - bFamily.angle));
}

// Every member has exactly one card; braids leave the trunk in the middle of their cards, twigs
// point at their card; cards on a tier keep a slot apart.
const spaced = (p, slot) => {
  for (let t = 0; t < p.depth; t++) {
    const angles = p.cards.filter((c) => c.tier === t).map((c) => c.angle).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) assert.ok(angles[i] - angles[i - 1] >= slot * 0.999, `tier ${t}: ${angles}`);
  }
};
{
  const p = plan(three);
  assert.deepEqual(p.cards.map((c) => c.id).sort(), three.map((m) => m.id).sort());
  for (const b of p.braids) {
    const as = b.ids.map((id) => card(p, id).angle);
    close(b.angle, (Math.min(...as) + Math.max(...as)) / 2);
  }
  for (const t of p.twigs) close(t.angle, card(p, t.id).angle);
  spaced(p, SLOT);
}

// A family wider than the circle shrinks every slot so all cards still fit around the trunk.
{
  const kids = Array.from({ length: 30 }, (_, i) => person(`kid${i}`, ['mum'], [], `19${50 + i}`));
  const p = plan([person('mum', [], [], '1930'), ...kids]);
  const row = p.cards.filter((c) => c.tier === 1).map((c) => c.angle);
  assert.ok(Math.max(...row) - Math.min(...row) < Math.PI * 2);
  spaced(p, (Math.PI * 2) / 32);
}

// The front stays free so the trunk can be seen: no card hangs within three quarters of a slot of
// it, whether a tier has an odd or an even number of cards.
const frontFree = (p, slot) => p.cards.forEach((c) => assert.ok(Math.abs(c.angle) >= slot * 0.75 - 1e-9, `${c.id} at ${c.angle}`));
frontFree(plan(three), SLOT);
frontFree(plan([person('a', [], ['b'], '1950'), person('b', [], ['a'], '1952')]), SLOT);
frontFree(plan([person('mum', [], [], '1960'), person('kid', ['mum'], [], '1990'), person('kid2', ['mum'], [], '1991'), person('kid3', ['mum'], [], '1992')]), SLOT);

// Bad data with a parent cycle still terminates.
plan([person('a', ['b']), person('b', ['a'])]);
