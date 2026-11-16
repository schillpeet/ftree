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
  // Every piece can grow: `along` runs from 0 where it starts (a strand's foot, so its root grows out)
  // to 1 at its farthest end, and no number is broken.
  for (const p of tree.pieces) {
    const along = Array.from(p.geometry.attributes.along.array);
    assert.equal(Math.min(...along), 0, p.id);
    assert.equal(Math.max(...along), 1, p.id);
    assert.ok(Array.from(points(p).array).every(Number.isFinite), p.id);
    assert.ok(Array.from(p.geometry.attributes.uv.array).every(Number.isFinite), p.id);
  }
  // Strands start as roots below the hilltop; pins hang a tier apart, the eldest on top.
  for (const id of ['grandpa', 'mum']) assert.ok(Math.min(...spots(piece(tree, id)).map((s) => s[1])) < 0);
  assert.ok(tree.pins.get('grandpa')[1] > tree.pins.get('mum')[1] + 5);
  assert.ok(tree.pins.get('mum')[1] > tree.pins.get('kid')[1] + 5);
}

// Even one person stands on a base trunk of eight roots, and on the same ones once a partner joins,
// older or younger; while the partner grows in, the base trunk stays grown.
{
  const rooted = (t) => t.pieces.filter((p) => spots(p).some((s) => s[1] < 0)).map((p) => p.id);
  const alonePlan = plan([person('me')]);
  const alone = buildTwinedTree(alonePlan, 0, 'family');
  const bases = Array.from({ length: 7 }, (_, j) => `free:base${j}`);
  assert.deepEqual(rooted(alone), ['me', 'free:roots:me', 'free:collar', ...bases]);
  assert.ok(alone.pins.get('me')[1] > 14, `${alone.pins.get('me')[1]}`);
  assert.equal(rooted(tree).filter((id) => id.startsWith('free:base')).length, 7);
  for (const born of ['1900', '2100']) {
    const pairPlan = plan([person('me', [], ['you'], '2000'), person('you', [], ['me'], born)]);
    const pair = buildTwinedTree(pairPlan, 0, 'family');
    for (const id of bases) assert.deepEqual(Array.from(points(piece(pair, id)).array), Array.from(points(piece(alone, id)).array), `${id} ${born}`);
    const growing = blendPlans(alonePlan, pairPlan, 0.5);
    assert.equal(growing.grown.get(piece(buildTwinedTree(growing, 0, 'family'), 'free:base0').follows), 1, born);
  }
  // Another family stands on other roots.
  assert.notDeepEqual(Array.from(points(piece(buildTwinedTree(alonePlan, 0, 'other'), 'free:base0')).array), Array.from(points(piece(alone, 'free:base0')).array));
}

// Every person, a twig too, brings a root that creeps out over the hill, and it keeps its shape
// when someone joins without making the trunk thicker. Around a thicker trunk roots reach further.
{
  const fine = (t, id) => spots(piece(t, `free:roots:${id}`)).filter((s) => Math.hypot(s[0], s[2]) > 2.5);
  for (const m of three) assert.ok(fine(tree, m.id).length > 0, m.id);
  const more = buildTwinedTree(plan([...three, person('uncle', ['grandpa', 'grandma'], [], '1964')]), 0);
  for (const m of three) assert.deepEqual(fine(more, m.id), fine(tree, m.id), m.id);
  assert.ok(fine(more, 'uncle').length > 0);
  const reach = (t) => Math.max(...t.pieces.flatMap((p) => spots(p).filter((s) => s[1] < 1.5).map((s) => Math.hypot(s[0], s[2]))));
  const couples = Array.from({ length: 6 }, (_, k) => [person(`c${k}`, ['grandpa', 'grandma'], [`p${k}`]), person(`p${k}`, [], [`c${k}`])]).flat();
  assert.ok(reach(buildTwinedTree(plan([...three, ...couples]), 0)) > reach(tree) + 3);
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

// Bark v2: thick wood has more sides, and the bark is tiled in metres with a whole number of tiles
// around every tube, so there is no seam and plates are the same size on thick and thin wood.
{
  const { sidesFor, tilesAround, TILE_AROUND, TILE_ALONG } = await import('./twinedForm.ts');
  assert.equal(sidesFor(0.42, 9), 27);
  assert.equal(sidesFor(0.03, 6), 6);
  assert.equal(sidesFor(1, 9), 32);
  assert.equal(tilesAround([0.01, 0.005]), 1);
  assert.equal(tilesAround([0.4, 0.4]), Math.round((2 * Math.PI * 0.4) / TILE_AROUND));
  const blender = (await import('node:fs')).readFileSync(new URL('../../docs/design/blender/tree.py', import.meta.url), 'utf8');
  assert.equal(Number(/^TILE_AROUND = ([\d.]+)/m.exec(blender)?.[1]), TILE_AROUND);
  assert.equal(Number(/^TILE_ALONG = ([\d.]+)/m.exec(blender)?.[1]), TILE_ALONG);
  const tree = buildTwinedTree(plan(three), 0, 'fam-1');
  for (const p of tree.pieces) {
    const uv = p.geometry.attributes.uv;
    const pos = p.geometry.attributes.position;
    // A ring is a run of vertices with the same uv.x; its first and last vertex sit at the same place.
    let start = 0;
    for (let i = 1; i <= uv.count; i++) {
      if (i < uv.count && uv.getX(i) === uv.getX(start)) continue;
      const span = uv.getY(i - 1) - uv.getY(start);
      assert.ok(Math.abs(span - Math.round(span)) < 1e-4 && Math.round(span) >= 1, `${p.id}: seam (${span})`);
      assert.ok(Math.abs(pos.getX(i - 1) - pos.getX(start)) < 1e-4, `${p.id}: ring not closed`);
      start = i;
    }
  }
}
