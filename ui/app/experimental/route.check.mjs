// Run with `node app/experimental/route.check.mjs`: the experimental view's lines are routed like a
// circuit diagram (right angles, one track per line, T-junctions with dots, no crossings), and
// `verify` proves it and reads the relations back from the drawing.
import assert from 'node:assert/strict';
import { buildModel } from './model.ts';
import { NAME_H, route } from './routing.ts';
import { verify } from './verify.ts';
import { ROW_GAP as R } from '../simpleLayout.ts';

const person = (id, parentIds = [], partnerIds = [], extra = {}) => ({ id, parentIds, partnerIds, ...extra });
const partner = (id, partnerId, status, parentIds = []) =>
  person(id, parentIds, [partnerId], { partnerships: [{ partnerId, status }] });
const positions = (entries) => new Map(Object.entries(entries));
const horizontal = (s) => s.a[1] === s.b[1];
const span = (s) => [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])];
// The partnership line between p and q, joined from its pieces (it is split where a stem leaves it).
const lineBetween = (routes, at, p, q) => {
  const [lo, hi] = [Math.min(at.get(p)[0], at.get(q)[0]), Math.max(at.get(p)[0], at.get(q)[0])];
  const inside = routes.segments.filter((s) => horizontal(s) && span(s)[0] >= lo && span(s)[1] <= hi);
  for (const y of new Set(inside.map((s) => s.a[1]))) {
    const pieces = inside.filter((s) => s.a[1] === y).sort((s, t) => span(s)[0] - span(t)[0]);
    if (span(pieces[0])[0] === lo && pieces.every((s, i) => i === 0 || span(s)[0] === span(pieces[i - 1])[1]) && span(pieces.at(-1))[1] === hi)
      return { a: [lo, y], b: [hi, y], style: pieces[0].style, pieces };
  }
};
const glyphOf = (routes, p, q) => routes.glyphs.find((g) => g.people.includes(p) && g.people.includes(q));
// The vertical ending on top of a person's name.
const riser = (routes, at, id) => {
  const [x, y] = at.get(id);
  return routes.segments.find((s) => [s.a, s.b].some(([px, py]) => px === x && Math.abs(py - (y + NAME_H / 2)) < 1e-9));
};

// A married couple with two children: one ⚭, a dot where the stem leaves the line and one where it meets the bar.
const couple = buildModel([
  partner('a', 'b', 'married'),
  partner('b', 'a', 'married'),
  person('c', ['a', 'b']),
  person('d', ['a', 'b']),
]);
const coupleAt = positions({ a: [0, R], b: [9, R], c: [0, 0], d: [9, 0] });
const coupleRoutes = route(couple, coupleAt);
assert.deepEqual(verify(couple, coupleAt, coupleRoutes), []);
assert.equal(coupleRoutes.glyphs.length, 1);
assert.equal(coupleRoutes.glyphs[0].glyph, '⚭');
assert.equal(coupleRoutes.junctions.length, 2);
assert.equal(coupleRoutes.stubs.length, 0);

// The read-back is exact: a couple's drawing does not pass for a single parent's, nor the reverse.
{
  const people = (parentIds) => [partner('p', 'q', 'married'), partner('q', 'p', 'married'), person('c', parentIds), person('d', parentIds)];
  const [both, single] = [buildModel(people(['p', 'q'])), buildModel(people(['p']))];
  const at = positions({ p: [0, R], q: [9, R], c: [0, 0], d: [9, 0] });
  assert.deepEqual(verify(single, at, route(single, at)), []);
  assert.ok(verify(single, at, route(both, at)).some((v) => v.startsWith('read-back')));
  assert.ok(verify(both, at, route(single, at)).some((v) => v.startsWith('read-back')));
}

// Three children centred under a couple: one bar, and a single dot where the stem and the line to the
// middle child meet it, besides the dot at the stem top.
{
  const model = buildModel([person('a', [], ['b']), person('b', [], ['a']), person('x', ['a', 'b']), person('y', ['a', 'b']), person('z', ['a', 'b'])]);
  const at = positions({ a: [0, R], b: [9, R], x: [-4.5, 0], y: [4.5, 0], z: [13.5, 0] });
  const routes = route(model, at);
  assert.deepEqual(verify(model, at, routes), []);
  assert.equal(routes.junctions.length, 2);
  const bars = routes.segments.filter((s) => horizontal(s) && s.a[1] < R / 2);
  assert.equal(new Set(bars.map((s) => s.a[1])).size, 1);
}

// k R h: the couple (k, h) hangs straight below h, the outer partner. A child of h alone joins their
// children; without any shared child it would draw the same as theirs, so verify reports that shape as
// ambiguous for a single parent.
{
  const model = buildModel([person('k', [], ['r', 'h']), person('r', [], ['k']), person('h', [], ['k']), person('m', ['k', 'h']), person('n', ['h'])]);
  const at = positions({ k: [0, R], r: [9, R], h: [18, R], m: [18, 0], n: [27, 0] });
  const routes = route(model, at);
  assert.deepEqual(verify(model, at, routes), []);
  assert.deepEqual(routes.stubs, []);
  assert.equal(riser(routes, at, 'm').a[0], 18);
  const alone = buildModel([person('k', [], ['r', 'h']), person('r', [], ['k']), person('h', [], ['k']), person('m', ['h'])]);
  assert.ok(verify(alone, at, routes).some((v) => v.startsWith('ambiguous')));
}

// The Kirsten case in order S K R H: S separated with child B, R together and childless, H widowed with child M.
{
  const model = buildModel([
    person('k', [], ['s', 'r', 'h'], {
      partnerships: [
        { partnerId: 's', status: 'separated' },
        { partnerId: 'r', status: 'together' },
        { partnerId: 'h', status: 'widowed' },
      ],
    }),
    partner('s', 'k', 'separated'),
    partner('r', 'k', 'together'),
    partner('h', 'k', 'widowed'),
    person('b', ['s', 'k']),
    person('m', ['k', 'h']),
  ]);
  const at = positions({ s: [0, R], k: [9, R], r: [18, R], h: [27, R], b: [0, 0], m: [27, 0] });
  const routes = route(model, at);
  assert.deepEqual(verify(model, at, routes), []);
  assert.equal(routes.stubs.length, 0);
  assert.equal(riser(routes, at, 'b').a[0], 0);
  assert.equal(riser(routes, at, 'm').a[0], 27);
  assert.ok(lineBetween(routes, at, 'k', 'h').a[1] < lineBetween(routes, at, 'k', 'r').a[1]);
  assert.equal(lineBetween(routes, at, 's', 'k').style, 'dashed');
  assert.equal(glyphOf(routes, 's', 'k'), undefined);
  assert.equal(glyphOf(routes, 'k', 'r').glyph, '⚯');
  assert.equal(glyphOf(routes, 'k', 'h').glyph, '⚭');
}

// A third partner with children nested inside the outer ones cannot be reached without crossing:
// that union's stem crosses the line to the outer partner on a bridge, and no union becomes a stub.
{
  const model = buildModel([
    person('k', [], ['a', 'b', 'c']),
    person('a', [], ['k']),
    person('b', [], ['k']),
    person('c', [], ['k']),
    person('ka', ['a', 'k']),
    person('kb', ['b', 'k']),
    person('kc', ['c', 'k']),
  ]);
  const at = positions({ a: [0, R], k: [9, R], b: [18, R], c: [27, R], ka: [4.5, 0], kb: [13.5, 0], kc: [27, 0] });
  const routes = route(model, at);
  assert.deepEqual(verify(model, at, routes), []);
  assert.deepEqual(routes.stubs, []);
  assert.equal(riser(routes, at, 'kb').a[0], 13.5);
  assert.deepEqual(routes.bridges.map(([x]) => x), [13.5]);
  assert.equal(routes.bridges[0][1], lineBetween(routes, at, 'k', 'c').a[1]);
  // Without the bridge it is a crossing again; a bridge where nothing crosses is reported too.
  assert.ok(verify(model, at, { ...routes, bridges: [] }).some((v) => v.startsWith('crossing')));
  assert.ok(verify(model, at, { ...routes, bridges: [...routes.bridges, [20, routes.bridges[0][1]]] }).some((v) => v.startsWith('bridge')));
}

// A single parent with a partner: the child hangs below the parent; a step parent who is nobody's
// partner gets a stub; adoptive parents only hang dotted.
{
  const model = buildModel([
    partner('p', 'q', 'married'),
    partner('q', 'p', 'married'),
    person('x'),
    person('c', ['p', 'x'], [], { parentLinks: [{ parentId: 'p', kind: 'biological' }, { parentId: 'x', kind: 'step' }] }),
    person('u'),
    person('v'),
    person('w', ['u', 'v'], [], { parentLinks: [{ parentId: 'u', kind: 'adoptive' }, { parentId: 'v', kind: 'adoptive' }] }),
  ]);
  const at = positions({ p: [0, R], q: [9, R], x: [18, R], u: [36, R], v: [45, R], c: [0, 0], w: [40.5, 0] });
  const routes = route(model, at);
  assert.deepEqual(verify(model, at, routes), []);
  assert.deepEqual(routes.stubs.map((s) => [s.child, s.parents]), [['c', ['x']]]);
  assert.equal(riser(routes, at, 'w').style, 'dotted');
}

// `verify` catches every violation class on its own, given a broken drawing directly.
{
  const broken = (change) => {
    const routes = structuredClone(coupleRoutes);
    change(routes);
    return verify(couple, coupleAt, routes);
  };
  const reports = (violations, kind) => assert.ok(violations.some((v) => v.startsWith(kind)), `${kind} in ${violations.join('; ')}`);
  const stem = coupleRoutes.segments.find((s) => s.a[0] === 4.5 && s.b[0] === 4.5);
  const [top, bottom] = [Math.max(stem.a[1], stem.b[1]), Math.min(stem.a[1], stem.b[1])];
  const bar = coupleRoutes.segments.find((s) => horizontal(s) && s.a[1] === bottom);
  const add = (a, b) => (routes) => routes.segments.push({ a, b, style: 'solid', people: [] });

  reports(broken(add([20, 2], [21, 3])), 'angle');
  reports(broken(add([1, bar.a[1]], [12, bar.a[1]])), 'overlap');
  reports(broken(add([0, bar.a[1] + 0.1], [9, bar.a[1] + 0.1])), 'spacing');
  reports(broken(add([-5, R], [5, R])), 'name');
  reports(broken(add([-5, R + 0.2], [-1, R + 0.2])), 'name');
  reports(broken(add([3, (top + bottom) / 2], [6, (top + bottom) / 2])), 'crossing');
  reports(broken((routes) => {
    add([4.5, bottom], [4.5, bottom - 0.2])(routes);
    add([4.5, bottom], [4.5, bottom - 0.3])(routes);
  }), 'four-way');
  reports(broken((routes) => routes.junctions.pop()), 'dot');
  reports(broken(add([100, R - 0.5], [101, R - 0.5])), 'channel');
  reports(broken((routes) => (routes.segments = routes.segments.filter((s) => s !== riser(routes, coupleAt, 'd')))), 'read-back');
  reports(broken((routes) => (routes.glyphs[0].glyph = '⚮')), 'read-back');
  reports(broken((routes) => routes.stubs.push({ child: 'c', parents: ['a', 'b'], at: [0, 1.3] })), 'read-back');
  assert.deepEqual(broken(() => {}), []);
}

console.log('route checks passed');
