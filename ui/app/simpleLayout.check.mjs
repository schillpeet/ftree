// Run with `node app/simpleLayout.check.mjs`: the flat family tree puts each generation on its own
// row, partners next to each other and children below their own parents, always the same way.
import assert from 'node:assert/strict';
import { generations } from './generations.ts';
import { FAMILY_GAP, NAME_GAP, ROW_GAP, simpleLayout } from './simpleLayout.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
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
const layout = (people) => simpleLayout(people, generations(people));
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

// Two partners: the person with several partners stands at the edge, the partners beside them, and
// each couple's child hangs under its own bar.
const twice = layout([
  person('gaia', [], ['morty']),
  person('morty', [], ['gaia', 'gwen']),
  person('gwen', [], ['morty']),
  person('naruto', ['gaia', 'morty']),
  person('junior', ['gwen', 'morty']),
]);
const tx = (id) => twice.get(id)[0];
assert.equal(Math.abs(tx('morty') - tx('gaia')), NAME_GAP);
assert.equal(Math.abs(tx('gaia') - tx('gwen')), NAME_GAP);
assert.equal(Math.abs(tx('morty') - tx('gwen')), 2 * NAME_GAP);
assert.equal(tx('naruto'), (tx('gaia') + tx('morty')) / 2);
assert.equal(tx('junior'), tx('gwen'));

// The sketched scenarios. Person `a` has several partners; children are dated so the partner with
// the younger child is the newer one, and a partner without children is the current one.
const kid = (id, ...parents) => ({ ...person(id, parents), birthDate: id.slice(-4) });
const hubbed = (partners, kids) =>
  layout([
    person('a', [], partners),
    ...partners.map((id) => person(id, [], ['a'])),
    ...kids.map(([id, ...parents]) => kid(id, ...parents)),
  ]);
const sketch = (partners, kids) => {
  const at = hubbed(partners, kids);
  return { x: (id) => at.get(id)[0] };
};
// 1–3: one couple with one, two, or three children, centred under the bar.
for (const n of [1, 2, 3]) {
  const { x } = sketch(['b'], Array.from({ length: n }, (_, i) => [`ab${i}2000`, 'a', 'b']));
  const ids = Array.from({ length: n }, (_, i) => `ab${i}2000`);
  assert.equal((x('a') + x('b')) / 2, (Math.min(...ids.map(x)) + Math.max(...ids.map(x))) / 2);
}
// 4: two partners, one child each; the newer partner (younger child) stands next to a.
const s4 = sketch(['b', 'c'], [['ab2010', 'a', 'b'], ['ac2000', 'a', 'c']]);
assert.ok(Math.abs(s4.x('a') - s4.x('b')) < Math.abs(s4.x('a') - s4.x('c')));
assert.equal(s4.x('ab2010'), (s4.x('a') + s4.x('b')) / 2);
assert.equal(s4.x('ac2000'), s4.x('c'));
// 5: one child with the newer partner, two with the older: those two hang centred under the older one.
const s5 = sketch(['b', 'c'], [['ab2010', 'a', 'b'], ['ac1990', 'a', 'c'], ['ac1992', 'a', 'c']]);
assert.equal((s5.x('ac1990') + s5.x('ac1992')) / 2, s5.x('c'));
assert.ok(s5.x('ab2010') < s5.x('ac1990') && s5.x('ac1990') < s5.x('ac1992'));
// 6: two children with the newer partner, one with the older.
const s6 = sketch(['b', 'c'], [['ab2010', 'a', 'b'], ['ab2012', 'a', 'b'], ['ac1990', 'a', 'c']]);
assert.equal((s6.x('ab2010') + s6.x('ab2012')) / 2, (s6.x('a') + s6.x('b')) / 2);
assert.equal(s6.x('ac1990'), s6.x('c'));
assert.ok(s6.x('ab2012') + NAME_GAP <= s6.x('ac1990'));
// 7: three partners: the current one without children next to a, then the one with the younger
// child, then the oldest; each child hangs under its own partner and nothing overlaps.
const s7 = sketch(['b', 'c', 'd'], [['ac2005', 'a', 'c'], ['ad1995', 'a', 'd']]);
const toward = Math.sign(s7.x('b') - s7.x('a'));
assert.deepEqual(['a', 'b', 'c', 'd'].map((id) => toward * s7.x(id)), ['a', 'b', 'c', 'd'].map((id) => toward * s7.x(id)).sort((p, q) => p - q));
assert.equal(s7.x('ac2005'), s7.x('c'));
assert.equal(s7.x('ad1995'), s7.x('d'));

// Status beats guessing: a separated partner stands outside, even when their child is the younger.
const status = (id, partnerId, kind) => ({ id, partnerships: [{ partnerId, status: kind }] });
const withStatus = layout([
  { ...person('a', [], ['b', 'c']), partnerships: [{ partnerId: 'b', status: 'together' }, { partnerId: 'c', status: 'separated' }] },
  { ...person('b', [], ['a']), ...status('b', 'a', 'together') },
  { ...person('c', [], ['a']), ...status('c', 'a', 'separated') },
  kid('ab2000', 'a', 'b'),
  kid('ac2010', 'a', 'c'),
]);
const wx2 = (id) => withStatus.get(id)[0];
assert.equal(Math.sign(wx2('a') - wx2('b')), -Math.sign(wx2('a') - wx2('c')));
// A person with a current and a former partner stands between them; no one stands next to the other's ex.
const former = layout([
  { ...person('k', [], ['r', 'h']), partnerships: [{ partnerId: 'r', status: 'together' }, { partnerId: 'h', status: 'separated' }] },
  { ...person('r', [], ['k']), ...status('r', 'k', 'together') },
  { ...person('h', [], ['k']), ...status('h', 'k', 'separated') },
  person('child', ['k', 'h']),
]);
const fx = (id) => former.get(id)[0];
assert.equal(Math.sign(fx('k') - fx('r')), -Math.sign(fx('k') - fx('h')));
assert.equal(fx('child'), (fx('k') + fx('h')) / 2);

// A current couple whose members both have former partners: each person's exes stand on their own
// outer side (a2 a1 A B b1 b2); with exes on one side only, the other partner stands on the other side.
const exes = (id, partnerId) => ({ id, partnerships: [{ partnerId, status: 'separated' }] });
const togetherWith = (id, partnerId) => ({ id, partnerships: [{ partnerId, status: 'together' }] });
const sides = layout([
  { ...person('ca', [], ['cb', 'a1', 'a2']), partnerships: [{ partnerId: 'cb', status: 'together' }, { partnerId: 'a1', status: 'separated' }, { partnerId: 'a2', status: 'separated' }] },
  { ...person('cb', [], ['ca', 'b1', 'b2']), partnerships: [{ partnerId: 'ca', status: 'together' }, { partnerId: 'b1', status: 'separated' }, { partnerId: 'b2', status: 'separated' }] },
  { ...person('a1', [], ['ca']), ...exes('a1', 'ca') },
  { ...person('a2', [], ['ca']), ...exes('a2', 'ca') },
  { ...person('b1', [], ['cb']), ...exes('b1', 'cb') },
  { ...person('b2', [], ['cb']), ...exes('b2', 'cb') },
  person('ka1', ['ca', 'a1']),
  person('ka2', ['ca', 'a2']),
  person('kb2', ['cb', 'b2']),
]);
const sx = (id) => sides.get(id)[0];
const row = ['a2', 'a1', 'ca', 'cb', 'b1', 'b2'].map(sx);
const dir = Math.sign(row[5] - row[0]);
assert.deepEqual(row.map((v) => dir * v), row.map((v) => dir * v).sort((p, q) => p - q));
for (let i = 1; i < 6; i++) assert.equal(Math.abs(row[i] - row[i - 1]), NAME_GAP);
// The child of the nearer ex hangs between them, the one of the farther ex under that ex.
assert.equal(sx('ka1'), (sx('ca') + sx('a1')) / 2);
assert.equal(sx('ka2'), sx('a2'));
assert.equal(sx('kb2'), sx('b2'));
const oneSided = layout([
  { ...person('oa', [], ['ob', 'x1', 'x2']), partnerships: [{ partnerId: 'ob', status: 'together' }, { partnerId: 'x1', status: 'separated' }, { partnerId: 'x2', status: 'separated' }] },
  { ...person('ob', [], ['oa']), ...togetherWith('ob', 'oa') },
  { ...person('x1', [], ['oa']), ...exes('x1', 'oa') },
  { ...person('x2', [], ['oa']), ...exes('x2', 'oa') },
]);
const ox = (id) => oneSided.get(id)[0];
const orow = ['x2', 'x1', 'oa', 'ob'].map(ox);
const odir = Math.sign(orow[3] - orow[0]);
assert.deepEqual(orow.map((v) => odir * v), orow.map((v) => odir * v).sort((p, q) => p - q));
assert.ok(orow.every((v, i) => i === 0 || Math.abs(v - orow[i - 1]) === NAME_GAP));

// Parents of a shared child stand together even without a stored partnership; a child of one of
// them alone hangs with the couple's children on that parent's side, as one family centred over the couple.
const coParents = layout([
  person('p1'),
  person('p2'),
  person('c1', ['p1', 'p2']),
  person('c2', ['p1', 'p2']),
  person('solo', ['p1']),
]);
const cx = (id) => coParents.get(id)[0];
assert.equal(Math.abs(cx('p1') - cx('p2')), NAME_GAP);
const family3 = ['c1', 'c2', 'solo'].map(cx);
assert.equal((cx('p1') + cx('p2')) / 2, (Math.min(...family3) + Math.max(...family3)) / 2);
// solo stands on p1's side of the couple's children, one name gap apart like siblings.
const p1Side = Math.sign(cx('p1') - cx('p2'));
assert.ok(['c1', 'c2'].every((id) => p1Side * (cx('solo') - cx(id)) >= NAME_GAP));
assert.equal(new Set(family3).size, 3);

// Regression: a wife's parents hang right above her, to the right of the family her husband hangs
// under; her siblings stand on the outside, and no child bar crosses.
const couple = (a, b, ...rest) => [person(a, [], [b]), person(b, [], [a]), ...rest];
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
  const at = layout(renamed);
  const px = (id) => at.get(name(id))[0];
  const toward = Math.sign(px('kim') - px('jon'));
  // The wife's siblings stand beyond her, on the side away from her husband.
  for (const id of ['lou', 'moe', 'noa']) assert.equal(Math.sign(px(id) - px('kim')), toward);
  // Her parents stand over their children, beyond the family her husband hangs under.
  const kids = ['kim', 'lou', 'moe', 'noa'].map(px);
  assert.ok(px('dan') >= Math.min(...kids) && px('dan') <= Math.max(...kids));
  for (const id of ['cleo', 'dan', 'eli']) assert.equal(Math.sign(px(id) - px('bea')), toward);
}
console.log('simpleLayout ok');
