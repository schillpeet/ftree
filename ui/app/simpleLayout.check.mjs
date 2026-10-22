// Run with `node app/simpleLayout.check.mjs`: the flat family tree puts each generation on its own
// row, partners next to each other and children below their own parents, always the same way, in an
// order the experimental view's router can draw without crossings.
import assert from 'node:assert/strict';
import { buildModel } from './experimental/model.ts';
import { NAME_W, route } from './experimental/routing.ts';
import { verify } from './experimental/verify.ts';
import { FAMILY_GAP, NAME_GAP, ROW_GAP, simpleLayout } from './simpleLayout.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
const couple = (a, b, ...rest) => [person(a, [], [b]), person(b, [], [a]), ...rest];
// The sketch: Johann ── Maria with Peter ── Anna and Thomas ── Lisa, each with children.
const family = [
  person('johann', [], ['maria']),
  person('maria', [], ['johann']),
  person('peter', ['johann', 'maria'], ['anna']),
  person('anna', [], ['peter']),
  person('thomas', ['johann', 'maria'], ['lisa']),
  person('lisa', [], ['thomas']),
  person('max', ['peter', 'anna']),
  person('julia', ['peter', 'anna']),
  person('paul', ['thomas', 'lisa']),
];
const layout = (people) => simpleLayout(people, buildModel(people).gen);
// Layout, then routing: the drawing's violations, its stubs, and whether every row keeps names NAME_W apart.
const probe = (people) => {
  const model = buildModel(people);
  const at = new Map([...simpleLayout(people, model.gen)].map(([id, [px, py]]) => [id, [px, py]]));
  const routes = route(model, at);
  const rows = new Map();
  for (const [, [px, py]] of at) rows.set(py, [...(rows.get(py) ?? []), px].sort((p, q) => p - q));
  const spaced = [...rows.values()].every((xs) => xs.every((v, i) => !i || v - xs[i - 1] >= NAME_W));
  return { at, x: (id) => at.get(id)[0], violations: verify(model, at, routes), stubs: routes.stubs.map((s) => s.child), spaced };
};
// The drawing is valid; `stubs` lists the children expected to get a stub instead of a line.
const drawn = (people, stubs = []) => {
  const p = probe(people);
  assert.deepEqual(p.violations, []);
  assert.deepEqual([...p.stubs].sort(), [...stubs].sort());
  assert.ok(p.spaced);
  return p;
};
// Left-to-right order of ids in their row.
const inOrder = (x, ...ids) => ids.every((id, i) => !i || x(ids[i - 1]) < x(id));
const at = layout(family);
const x = (id) => at.get(id)[0];
const y = (id) => at.get(id)[1];

// Rows: one generation per row, top down.
assert.equal(y('johann'), 2 * ROW_GAP);
assert.equal(y('peter'), ROW_GAP);
assert.equal(y('anna'), y('peter'));
assert.equal(y('max'), 0);
// Partners sit next to each other.
assert.equal(Math.abs(x('johann') - x('maria')), NAME_GAP);
assert.equal(Math.abs(x('peter') - x('anna')), NAME_GAP);
assert.equal(Math.abs(x('thomas') - x('lisa')), NAME_GAP);
// Each family's children sit under their own parents: Peter's left of Thomas's.
const side = Math.sign(x('peter') - x('thomas'));
assert.equal(Math.sign(x('max') - x('paul')), side);
assert.equal(Math.sign(x('julia') - x('paul')), side);
// The tree is centred, and so is the top couple over it.
assert.equal(x('johann') + x('maria'), 0);
// Inverted U: every couple sits centred over its first and last child.
const mid = (...ids) => (Math.min(...ids.map(x)) + Math.max(...ids.map(x))) / 2;
assert.equal(mid('johann', 'maria'), mid('peter', 'thomas'));
assert.equal(mid('peter', 'anna'), mid('max', 'julia'));
assert.equal(mid('thomas', 'lisa'), x('paul'));
// Compact and uncrossed: married-in partners on the outside, cousins one family gap apart.
assert.ok(Math.abs(x('peter') - x('thomas')) >= NAME_GAP);
assert.ok(x('paul') - Math.max(x('max'), x('julia')) >= NAME_GAP + FAMILY_GAP);
assert.equal(Math.abs(x('julia') - x('max')), NAME_GAP);
// Same family in another order, same layout.
assert.deepEqual(layout([...family].reverse()), at);

// Regression: a lone couple at the row's edge with two children used to get a one-sided bar.
const edge = layout([
  person('a', [], ['b']),
  person('b', [], ['a']),
  person('c'),
  person('k1', ['a', 'b']),
  person('k2', ['a', 'b']),
]);
const ex = (id) => edge.get(id)[0];
assert.equal((ex('a') + ex('b')) / 2, (ex('k1') + ex('k2')) / 2);

// Wide families below interlock without their child bars overlapping.
const wide = layout([
  person('g1', [], ['g2']),
  person('g2', [], ['g1']),
  person('l', ['g1', 'g2']),
  person('r', ['g1', 'g2']),
  ...['l1', 'l2', 'l3'].map((id) => person(id, ['l'])),
  ...['r1', 'r2', 'r3'].map((id) => person(id, ['r'])),
]);
const wx = (id) => wide.get(id)[0];
assert.ok(wx('l3') + NAME_GAP + FAMILY_GAP <= wx('r1'));
assert.equal(wx('l'), wx('l2'));
assert.equal(wx('r'), wx('r2'));

// In-laws: Beth hangs under her parents, Jerry's parents sit right of them, centred over Jerry and
// his sister, who moves right to make room.
const inLaws = layout([
  person('rick', [], ['diane']),
  person('diane', [], ['rick']),
  person('joyce', [], ['leonard']),
  person('leonard', [], ['joyce']),
  person('beth', ['rick', 'diane'], ['jerry']),
  person('jerry', ['joyce', 'leonard'], ['beth']),
  person('space', ['rick', 'diane']),
  person('tammy', ['joyce', 'leonard']),
]);
const ix = (id) => inLaws.get(id)[0];
const order = (...ids) => ids.every((id, i) => !i || ix(ids[i - 1]) < ix(id));
assert.ok(order('space', 'beth', 'jerry', 'tammy'));
assert.ok(Math.max(ix('rick'), ix('diane')) + NAME_GAP + FAMILY_GAP <= Math.min(ix('joyce'), ix('leonard')));
assert.equal((ix('rick') + ix('diane')) / 2, (ix('space') + ix('beth')) / 2);
assert.equal((ix('joyce') + ix('leonard')) / 2, (ix('jerry') + ix('tammy')) / 2);

// Two partners: the person with several partners stands in the middle, the first partner with
// children (by nearestFirst) on the right, the second on the left; each couple's child hangs
// centred under its own adjacent pair.
const twicePeople = [
  person('gaia', [], ['morty']),
  person('morty', [], ['gaia', 'gwen']),
  person('gwen', [], ['morty']),
  person('naruto', ['gaia', 'morty']),
  person('junior', ['gwen', 'morty']),
];
const twice = drawn(twicePeople);
const tx = twice.x;
assert.ok(inOrder(tx, 'gwen', 'morty', 'gaia'));
assert.equal(tx('morty') - tx('gwen'), NAME_GAP);
assert.equal(tx('gaia') - tx('morty'), NAME_GAP);
assert.equal(tx('naruto'), (tx('gaia') + tx('morty')) / 2);
assert.equal(tx('junior'), (tx('gwen') + tx('morty')) / 2);

// The sketched scenarios. Person `a` has several partners; children are dated so the partner with
// the younger child is the newer one, and a partner without children is the current one.
const kid = (id, ...parents) => ({ ...person(id, parents), birthDate: id.slice(-4) });
const hubPeople = (partners, kids) => [
  person('a', [], partners),
  ...partners.map((id) => person(id, [], ['a'])),
  ...kids.map(([id, ...parents]) => kid(id, ...parents)),
];
const sketch = (partners, kids, stubs) => drawn(hubPeople(partners, kids), stubs);
const centredUnder = (x, p, q, ...ids) =>
  assert.equal((x(p) + x(q)) / 2, (Math.min(...ids.map(x)) + Math.max(...ids.map(x))) / 2);
// 1–3: one couple with one, two, or three children, centred under the bar.
for (const n of [1, 2, 3]) {
  const ids = Array.from({ length: n }, (_, i) => `ab${i}2000`);
  const { x } = sketch(['b'], ids.map((id) => [id, 'a', 'b']));
  centredUnder(x, 'a', 'b', ...ids);
}
// 4: two partners, one child each: a in the middle, the newer partner (younger child) on the right,
// each child centred under its adjacent pair.
const s4 = sketch(['b', 'c'], [['ab2010', 'a', 'b'], ['ac2000', 'a', 'c']]);
assert.ok(inOrder(s4.x, 'c', 'a', 'b'));
assert.equal(s4.x('ab2010'), (s4.x('a') + s4.x('b')) / 2);
assert.equal(s4.x('ac2000'), (s4.x('a') + s4.x('c')) / 2);
// 5: one child with the newer partner, two with the older: the older stands left, its children left
// of the newer couple's child, the two families as close to their pairs as they fit.
const s5 = sketch(['b', 'c'], [['ab2010', 'a', 'b'], ['ac1990', 'a', 'c'], ['ac1992', 'a', 'c']]);
assert.ok(inOrder(s5.x, 'c', 'a', 'b'));
assert.ok(inOrder(s5.x, 'ac1990', 'ac1992', 'ab2010'));
assert.equal(s5.x('ac1992') - s5.x('ac1990'), NAME_GAP);
// 6: two children with the newer partner, one with the older.
const s6 = sketch(['b', 'c'], [['ab2010', 'a', 'b'], ['ab2012', 'a', 'b'], ['ac1990', 'a', 'c']]);
assert.ok(inOrder(s6.x, 'c', 'a', 'b'));
assert.ok(inOrder(s6.x, 'ac1990', 'ab2010', 'ab2012'));
// 7: three partners: the current one without children inside on the right, the one with the younger
// child outermost right, the oldest outermost left. The right union is not adjacent, so its child
// hangs straight below the outer partner c; the left one is centred under its pair.
const s7 = sketch(['b', 'c', 'd'], [['ac2005', 'a', 'c'], ['ad1995', 'a', 'd']]);
assert.ok(inOrder(s7.x, 'd', 'a', 'b', 'c'));
assert.equal(s7.x('ac2005'), s7.x('c'));
assert.equal(s7.x('ad1995'), (s7.x('a') + s7.x('d')) / 2);
// A third partner with children goes beyond the right outer one; that line passes over b's union,
// so routing stubs one of the two (its choice), and draws the rest.
const s8 = probe(hubPeople(['b', 'c', 'd'], [['ab2010', 'a', 'b'], ['ac2000', 'a', 'c'], ['ad1990', 'a', 'd']]));
assert.deepEqual(s8.violations, []);
assert.ok(inOrder(s8.x, 'c', 'a', 'b', 'd'));
assert.equal(s8.stubs.length, 1);
assert.ok(['ab2010', 'ad1990'].includes(s8.stubs[0]));

// Status beats guessing: a separated partner sorts after a current one, so it stands left even when
// its child is the younger.
const status = (id, partnerId, kind) => ({ id, partnerships: [{ partnerId, status: kind }] });
const withStatus = drawn([
  { ...person('a', [], ['b', 'c']), partnerships: [{ partnerId: 'b', status: 'together' }, { partnerId: 'c', status: 'separated' }] },
  { ...person('b', [], ['a']), ...status('b', 'a', 'together') },
  { ...person('c', [], ['a']), ...status('c', 'a', 'separated') },
  kid('ab2000', 'a', 'b'),
  kid('ac2010', 'a', 'c'),
]);
assert.ok(inOrder(withStatus.x, 'c', 'a', 'b'));
// A current childless partner stands inside, the former partner with a child outermost on the right;
// that child hangs straight below the outer partner.
const former = drawn([
  { ...person('k', [], ['r', 'h']), partnerships: [{ partnerId: 'r', status: 'together' }, { partnerId: 'h', status: 'separated' }] },
  { ...person('r', [], ['k']), ...status('r', 'k', 'together') },
  { ...person('h', [], ['k']), ...status('h', 'k', 'separated') },
  person('child', ['k', 'h']),
]);
assert.ok(inOrder(former.x, 'k', 'r', 'h'));
assert.equal(former.x('child'), former.x('h'));
// The Kirsten case: a separated partner with a child, a current childless partner and a widowed
// partner with a child stand `sep | person | current | widowed`, drawn without a stub.
const kirsten = drawn([
  { ...person('k', [], ['s', 'r', 'h']), partnerships: [{ partnerId: 's', status: 'separated' }, { partnerId: 'r', status: 'together' }, { partnerId: 'h', status: 'widowed' }] },
  { ...person('s', [], ['k']), ...status('s', 'k', 'separated') },
  { ...person('r', [], ['k']), ...status('r', 'k', 'together') },
  { ...person('h', [], ['k']), ...status('h', 'k', 'widowed') },
  person('b', ['s', 'k']),
  person('m', ['k', 'h']),
]);
assert.ok(inOrder(kirsten.x, 's', 'k', 'r', 'h'));
// Children of a separated couple hang straight below the ex-partner, even side by side.
assert.equal(kirsten.x('b'), kirsten.x('s'));
assert.equal(kirsten.x('m'), kirsten.x('h'));
// A former partner with a child of their own, not shared, counts as "with children" and stands
// outside, so that child hangs straight below them without a stub.
const edgeEx = drawn([
  { ...person('p', [], ['q', 's']), partnerships: [{ partnerId: 'q', status: 'together' }, { partnerId: 's', status: 'separated' }] },
  { ...person('q', [], ['p']), ...status('q', 'p', 'together') },
  { ...person('s', [], ['p']), ...status('s', 'p', 'separated') },
  person('pq1', ['p', 'q']),
  person('pq2', ['p', 'q']),
  person('pq3', ['p', 'q']),
  person('sk', ['s']),
]);
assert.ok(inOrder(edgeEx.x, 's', 'p', 'q'));
assert.ok(inOrder(edgeEx.x, 'sk', 'pq1', 'pq2', 'pq3'));
assert.equal(edgeEx.x('pq2'), (edgeEx.x('p') + edgeEx.x('q')) / 2);
const soloEx = drawn([
  { ...person('a', [], ['b', 'c', 'd']), partnerships: [{ partnerId: 'b', status: 'together' }, { partnerId: 'c', status: 'separated' }, { partnerId: 'd', status: 'separated' }] },
  { ...person('b', [], ['a']), ...status('b', 'a', 'together') },
  { ...person('c', [], ['a']), ...status('c', 'a', 'separated') },
  { ...person('d', [], ['a']), ...status('d', 'a', 'separated') },
  { ...person('ad1', ['a', 'd']), birthDate: '1978' },
  person('c1', ['c']),
], ['c1']);
assert.ok(inOrder(soloEx.x, 'd', 'a', 'b', 'c'));
assert.equal(soloEx.x('ad1'), soloEx.x('d'));

// A former partner with a child of their own, standing beside a couple with several children: the child
// hangs on a straight line below them, the parent steps outward for it.
const aside = drawn([
  { ...person('x', [], ['t']), partnerships: [{ partnerId: 't', status: 'separated' }] },
  { ...person('t', [], ['x', 'v']), partnerships: [{ partnerId: 'x', status: 'separated' }, { partnerId: 'v', status: 'together' }] },
  { ...person('v', [], ['t']), ...status('v', 't', 'together') },
  person('m1', ['t', 'v']),
  person('m2', ['t', 'v']),
  person('m3', ['t', 'v']),
  person('e', ['x']),
]);
assert.equal(aside.x('e'), aside.x('x'));

// A current couple whose members both have former partners with children. The hub with the most
// partners (ca, by id on a tie) orders its own: a1 and a2 have children, so they stand outermost,
// cb inside on the right with its own partners beyond it (childless first). cb's union with b2 then
// sits under ca's line to a1, so routing stubs it.
const exes = (id, partnerId) => ({ id, partnerships: [{ partnerId, status: 'separated' }] });
const togetherWith = (id, partnerId) => ({ id, partnerships: [{ partnerId, status: 'together' }] });
const sides = drawn([
  { ...person('ca', [], ['cb', 'a1', 'a2']), partnerships: [{ partnerId: 'cb', status: 'together' }, { partnerId: 'a1', status: 'separated' }, { partnerId: 'a2', status: 'separated' }] },
  { ...person('cb', [], ['ca', 'b1', 'b2']), partnerships: [{ partnerId: 'ca', status: 'together' }, { partnerId: 'b1', status: 'separated' }, { partnerId: 'b2', status: 'separated' }] },
  { ...person('a1', [], ['ca']), ...exes('a1', 'ca') },
  { ...person('a2', [], ['ca']), ...exes('a2', 'ca') },
  { ...person('b1', [], ['cb']), ...exes('b1', 'cb') },
  { ...person('b2', [], ['cb']), ...exes('b2', 'cb') },
  person('ka1', ['ca', 'a1']),
  person('ka2', ['ca', 'a2']),
  person('kb2', ['cb', 'b2']),
], ['kb2']);
assert.ok(inOrder(sides.x, 'a2', 'ca', 'cb', 'b1', 'b2', 'a1'));
for (const [p, q] of [['a2', 'ca'], ['ca', 'cb'], ['cb', 'b1'], ['b1', 'b2'], ['b2', 'a1']]) assert.equal(sides.x(q) - sides.x(p), NAME_GAP);
assert.equal(sides.x('ka2'), sides.x('a2'));
assert.equal(sides.x('ka1'), sides.x('a1'));
// Only childless partners: all of them on the right, current first.
const oneSided = drawn([
  { ...person('oa', [], ['ob', 'x1', 'x2']), partnerships: [{ partnerId: 'ob', status: 'together' }, { partnerId: 'x1', status: 'separated' }, { partnerId: 'x2', status: 'separated' }] },
  { ...person('ob', [], ['oa']), ...togetherWith('ob', 'oa') },
  { ...person('x1', [], ['oa']), ...exes('x1', 'oa') },
  { ...person('x2', [], ['oa']), ...exes('x2', 'oa') },
]);
assert.ok(inOrder(oneSided.x, 'oa', 'ob', 'x1', 'x2'));
assert.equal(oneSided.x('x2') - oneSided.x('oa'), 3 * NAME_GAP);

// Parents of a shared child stand together even without a stored partnership; their children are
// centred under the pair, and a child of one of them alone hangs from its own line on that parent's side.
const coParents = drawn([person('p1'), person('p2'), person('c1', ['p1', 'p2']), person('c2', ['p1', 'p2']), person('solo', ['p1'])]);
const cx = coParents.x;
assert.equal(Math.abs(cx('p1') - cx('p2')), NAME_GAP);
assert.equal((cx('p1') + cx('p2')) / 2, (cx('c1') + cx('c2')) / 2);
const p1Side = Math.sign(cx('p1') - cx('p2'));
assert.ok(['c1', 'c2'].every((id) => p1Side * (cx('solo') - cx(id)) >= NAME_GAP));

// Three parents: the biological father without a partnership stands beside the mother in her row,
// the child hangs centred under the two, and the stepfather (her partner) needs no line of his own.
const threeParents = drawn([
  { ...person('mo', [], ['st']), partnerships: [{ partnerId: 'st', status: 'married' }] },
  { ...person('st', [], ['mo']), partnerships: [{ partnerId: 'mo', status: 'married' }] },
  person('fa'),
  {
    ...person('ch', ['mo', 'fa', 'st']),
    parentLinks: [{ parentId: 'mo', kind: 'biological' }, { parentId: 'fa', kind: 'biological' }, { parentId: 'st', kind: 'step' }],
  },
]);
assert.equal(threeParents.at.get('fa')[1], threeParents.at.get('mo')[1]);
assert.equal(Math.abs(threeParents.x('fa') - threeParents.x('mo')), NAME_GAP);
assert.equal(threeParents.x('ch'), (threeParents.x('fa') + threeParents.x('mo')) / 2);

// In-laws on both edges of one sibling group: x1's partner y1 has parents f1–f2 (placed left), x4's
// partner y4 has parents g1–g2 (placed right). x1 stands leftmost, x4 rightmost, each partner outside
// them, and both in-law couples stand directly above their own married-in child. Drawn without stubs.
const twoEdges = [
  ...couple('gp1', 'gp2'),
  person('pa', ['gp1', 'gp2'], ['pb']),
  person('pb', [], ['pa']),
  ...couple('f1', 'f2'),
  ...couple('g1', 'g2'),
  person('x1', ['pa', 'pb'], ['y1']),
  person('x2', ['pa', 'pb']),
  person('x3', ['pa', 'pb']),
  person('x4', ['pa', 'pb'], ['y4']),
  person('y1', ['f1', 'f2'], ['x1']),
  person('y4', ['g1', 'g2'], ['x4']),
];
const edges = drawn(twoEdges);
assert.ok(inOrder(edges.x, 'y1', 'x1', 'x2', 'x3', 'x4', 'y4'));
assert.equal((edges.x('f1') + edges.x('f2')) / 2, edges.x('y1'));
assert.equal((edges.x('g1') + edges.x('g2')) / 2, edges.x('y4'));
assert.ok(inOrder(edges.x, 'f1', 'f2', 'pa', 'pb', 'g1', 'g2'));
// The same with a sibling for each married-in partner: their couples stay over their children, on
// the outer side, and still nothing needs a stub.
drawn([...twoEdges, person('y0', ['f1', 'f2']), person('y5', ['g1', 'g2'])]);

// Regression: a wife's parents hang right above her, to the right of the family her husband hangs
// under; her siblings stand on the outside, and no child bar crosses.
const inLawFamily = [
  ...couple('ole', 'una'),
  ...couple('ida', 'kai'),
  ...couple('abe', 'bea'),
  person('cleo', [], ['dan', 'eli']),
  person('dan', [], ['cleo']),
  person('eli', [], ['cleo']),
  person('fay', ['ole', 'una'], ['gus']),
  person('gus', ['ida', 'kai'], ['fay']),
  person('hal', ['ida', 'kai']),
  person('ivy', ['ida', 'kai']),
  person('jon', ['abe', 'bea'], ['kim']),
  person('kim', ['cleo', 'dan'], ['jon']),
  person('lou', ['cleo', 'dan']),
  person('moe', ['dan']),
  person('noa', ['eli']),
  person('oz', ['fay', 'gus']),
  person('pia', ['fay', 'gus']),
  person('quin', ['jon', 'kim']),
  person('rae', ['jon', 'kim']),
  person('sol', ['jon', 'kim']),
  person('tom', ['jon', 'kim']),
];
// Whatever the id order (so whichever family comes first), the result is the same up to mirroring.
let seed = 7;
const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
for (let round = 0; round < 60; round++) {
  const order = inLawFamily.map((p) => p.id).sort(() => random() - 0.5);
  const name = (id) => `x${String(order.indexOf(id)).padStart(2, '0')}`;
  const renamed = inLawFamily.map((p) => person(name(p.id), p.parentIds.map(name), p.partnerIds.map(name)));
  const p = probe(renamed);
  assert.deepEqual(p.violations, []);
  assert.ok(p.spaced);
  const px = (id) => p.x(name(id));
  const toward = Math.sign(px('kim') - px('jon'));
  // The wife's sibling stands beyond her, on the side away from her husband.
  assert.equal(Math.sign(px('lou') - px('kim')), toward);
  // Her parents stand over their children, on her side of the family her husband hangs under.
  for (const id of ['cleo', 'dan', 'eli']) assert.equal(Math.sign(px(id) - px('bea')), toward);
  // The two in-law families each stand over their married-in child's side.
  assert.equal(Math.sign(px('ole') - px('ida')), Math.sign(px('fay') - px('gus')));
}
console.log('simpleLayout ok');
