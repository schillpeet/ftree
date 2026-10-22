// Run with `node app/experimental/model.check.mjs`: the experimental view's circuit diagram starts
// from unions (parents and the children hanging from them) and partnerships, derived from relations only.
import assert from 'node:assert/strict';
import { buildModel } from './model.ts';

const person = (id, parentIds = [], partnerIds = [], extra = {}) => ({ id, parentIds, partnerIds, ...extra });
const union = (model, id) => model.unions.find((u) => u.id === id);

// A couple with two children: one union, both children, solid.
{
  const m = buildModel([person('a', [], ['b']), person('b', [], ['a']), person('c', ['a', 'b']), person('d', ['a', 'b'])]);
  assert.equal(m.unions.length, 1);
  assert.deepEqual(union(m, 'a+b'), { id: 'a+b', parents: ['a', 'b'], children: ['c', 'd'], dotted: false });
  assert.deepEqual(m.partnerships, [{ a: 'a', b: 'b', status: 'together' }]);
}

// Three parents: the child hangs from the biological pair, the step partner of one is hidden, and the
// co-parents share a row without a stored partnership.
{
  const m = buildModel([
    person('f'),
    person('m', [], ['s']),
    person('s', [], ['m']),
    person('c', ['f', 'm', 's'], [], {
      parentLinks: [
        { parentId: 'f', kind: 'biological' },
        { parentId: 'm', kind: 'biological' },
        { parentId: 's', kind: 'step' },
      ],
    }),
  ]);
  assert.deepEqual(union(m, 'f+m').children, ['c']);
  assert.deepEqual(m.hidden, [{ child: 'c', parent: 's', reason: 'stepPartner' }]);
  assert.equal(m.gen.get('f'), m.gen.get('m'));
  assert.ok(m.partnerships.some((p) => p.a === 'f' && p.b === 'm' && p.status === null));
}

// Only adoptive parents: the union of all of them, dotted.
{
  const m = buildModel([
    person('p'),
    person('q'),
    person('c', ['p', 'q'], [], { parentLinks: [{ parentId: 'p', kind: 'adoptive' }, { parentId: 'q', kind: 'adoptive' }] }),
  ]);
  assert.deepEqual(union(m, 'p+q'), { id: 'p+q', parents: ['p', 'q'], children: ['c'], dotted: true });
}

// A step parent who is no partner of a drawn parent becomes a stub.
{
  const m = buildModel([
    person('p'),
    person('x'),
    person('c', ['p', 'x'], [], { parentLinks: [{ parentId: 'p', kind: 'biological' }, { parentId: 'x', kind: 'step' }] }),
  ]);
  assert.deepEqual(m.hidden, [{ child: 'c', parent: 'x', reason: 'stub' }]);
  assert.deepEqual(union(m, 'p').children, ['c']);
}

// A child of one parent, whose current partner has children with them, hangs with those children from
// the couple's union; with a former partner it keeps a union of its own.
{
  const couple = (status) => [
    person('a', [], ['b'], { partnerships: [{ partnerId: 'b', status }] }),
    person('b', [], ['a'], { partnerships: [{ partnerId: 'a', status }] }),
    person('c', ['a', 'b']),
    person('d', ['a']),
  ];
  for (const status of ['together', 'married', 'widowed']) {
    const m = buildModel(couple(status));
    assert.deepEqual(union(m, 'a+b').children, ['c', 'd'], status);
    assert.equal(union(m, 'a'), undefined, status);
  }
  for (const status of ['separated', 'divorced']) assert.deepEqual(union(buildModel(couple(status)), 'a').children, ['d'], status);
}

// A child of one parent: a single-parent union.
{
  const m = buildModel([person('p'), person('c', ['p'])]);
  assert.deepEqual(union(m, 'p'), { id: 'p', parents: ['p'], children: ['c'], dotted: false });
}

// Stored statuses carry over; each pair once, a < b.
{
  const m = buildModel([
    person('b', [], ['a'], { partnerships: [{ partnerId: 'a', status: 'widowed' }] }),
    person('a', [], ['b'], { partnerships: [{ partnerId: 'b', status: 'widowed' }] }),
  ]);
  assert.deepEqual(m.partnerships, [{ a: 'a', b: 'b', status: 'widowed' }]);
}

console.log('model checks passed');
