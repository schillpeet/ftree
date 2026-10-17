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

// Two partners: each couple's child hangs straight below that couple.
const twice = layout([
  person('gaia', [], ['morty']),
  person('morty', [], ['gaia', 'gwen']),
  person('gwen', [], ['morty']),
  person('naruto', ['gaia', 'morty']),
  person('junior', ['gwen', 'morty']),
]);
const tx = (id) => twice.get(id)[0];
assert.equal(Math.abs(tx('morty') - tx('gaia')), NAME_GAP);
assert.equal(Math.abs(tx('morty') - tx('gwen')), NAME_GAP);
assert.equal(tx('naruto'), (tx('gaia') + tx('morty')) / 2);
assert.equal(tx('junior'), (tx('gwen') + tx('morty')) / 2);

// Parents of a shared child stand together even without a stored partnership; children of one of
// them alone stand outside on that parent's side, so the couple's children stay centred.
const coParents = layout([
  person('p1'),
  person('p2'),
  person('c1', ['p1', 'p2']),
  person('c2', ['p1', 'p2']),
  person('solo', ['p1']),
]);
const cx = (id) => coParents.get(id)[0];
assert.equal(Math.abs(cx('p1') - cx('p2')), NAME_GAP);
assert.equal((cx('p1') + cx('p2')) / 2, (cx('c1') + cx('c2')) / 2);
// solo stands beyond both c1 and c2, on p1's side.
const p1Side = Math.sign(cx('p1') - cx('p2'));
assert.ok(['c1', 'c2'].every((id) => p1Side * (cx('solo') - cx(id)) >= NAME_GAP));
// Regression (fam-schiller): Liselotte's parents hang right above her, to the right of the family
// her husband Eberhard hangs under; her siblings stand on the outside, and no child bar crosses.
const couple = (a, b, ...rest) => [person(a, [], [b]), person(b, [], [a]), ...rest];
const schollFamily = [
  ...couple('hans', 'elise'),
  ...couple('hild', 'horst'),
  ...couple('jos', 'kh'),
  person('th', [], ['va', 'pichl']),
  person('va', [], ['th']),
  person('pichl', [], ['th']),
  person('hm', ['hans', 'elise'], ['karin']),
  person('karin', ['hild', 'horst'], ['hm']),
  person('rosw', ['hild', 'horst']),
  person('monika', ['hild', 'horst']),
  person('eb', ['jos', 'kh'], ['lis']),
  person('lis', ['th', 'va'], ['eb']),
  person('maria', ['th', 'va']),
  person('max', ['th', 'va']),
  person('emilie', ['th', 'pichl']),
  person('andreas', ['hm', 'karin']),
  person('christine', ['hm', 'karin']),
  person('sabine', ['eb', 'lis']),
  person('iris', ['eb', 'lis']),
  person('eberhard', ['eb', 'lis']),
  person('karlheinz', ['eb', 'lis']),
];
// Whatever the id order (so whichever family comes first), the result is the same up to mirroring.
let seed = 7;
const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
for (let round = 0; round < 60; round++) {
  const order = schollFamily.map((p) => p.id).sort(() => random() - 0.5);
  const name = (id) => `x${String(order.indexOf(id)).padStart(2, '0')}`;
  const renamed = schollFamily.map((p) => person(name(p.id), p.parentIds.map(name), p.partnerIds.map(name)));
  const at = layout(renamed);
  const px = (id) => at.get(name(id))[0];
  const toward = Math.sign(px('lis') - px('eb'));
  // Liselotte's siblings stand beyond her, on the side away from her husband.
  for (const id of ['maria', 'max', 'emilie']) assert.equal(Math.sign(px(id) - px('lis')), toward);
  // Her parents stand over their children, beyond the family her husband hangs under.
  const kids = ['lis', 'maria', 'max', 'emilie'].map(px);
  for (const id of ['th', 'va']) assert.ok(px(id) >= Math.min(...kids) && px(id) <= Math.max(...kids));
  for (const id of ['th', 'va', 'pichl']) assert.equal(Math.sign(px(id) - px('kh')), toward);
}
console.log('simpleLayout ok');
