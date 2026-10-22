// Run with `node app/experimental/families.check.mjs`: layout and routing of whole families, each
// drawing proven by `verify`. A fixture shaped like a real five-generation family (synthetic ids, no
// real names or dates) and hundreds of random families. Print the failing seed on error.
import assert from 'node:assert/strict';
import { seededRandom } from '../random.ts';
import { simpleLayout } from '../simpleLayout.ts';
import { buildModel } from './model.ts';
import { route } from './routing.ts';
import { verify } from './verify.ts';

// A growing set of people with symmetric partnerships.
function builder() {
  const people = new Map();
  const add = (id, parentIds = [], extra = {}) => {
    people.set(id, { id, parentIds, partnerIds: [], partnerships: [], ...extra });
    return id;
  };
  const partner = (a, b, status = 'together') => {
    for (const [x, y] of [[a, b], [b, a]]) {
      const p = people.get(x);
      p.partnerIds.push(y);
      p.partnerships.push({ partnerId: y, status });
    }
  };
  return { people, add, partner, list: () => [...people.values()] };
}

// The drawing of a family: positions, routes and the violations `verify` finds.
function draw(list) {
  const model = buildModel(list);
  const at = new Map([...simpleLayout(list, model.gen)].map(([id, [x, y]]) => [id, [x, y]]));
  const routes = route(model, at);
  return { at, routes, violations: verify(model, at, routes), stubs: routes.stubs.map((s) => s.child) };
}

// Fixture A. Two grandparents with four children:
//   a1 married in a root family (w1 with parents), a2 has a separated, a current and a widowed
//   partner, a3 is single, a4 has a partner without parents (extended by the variants below).
// a1's daughter has a child with a biological father who is not her partner, and her partner stands
// in as step father; a3 has a child who has a child alone; a root couple, separated, has one child
// together and one child of one of them.
function fixtureA(more = () => {}) {
  const { add, partner, list } = builder();
  add('g1a');
  add('g1b', ['rp1', 'rp2']);
  partner('g1a', 'g1b', 'married');
  for (const id of ['a1', 'a2', 'a3', 'a4']) add(id, ['g1a', 'g1b']);
  // a1 married into w1's family: root couple wp+wq, w1 their child.
  add('wp');
  add('wq');
  partner('wp', 'wq', 'married');
  add('w1', ['wp', 'wq']);
  partner('a1', 'w1', 'married');
  // a2: separated partner with a child, current childless partner, widowed partner with a child.
  for (const id of ['s2', 'r2', 'h2']) add(id);
  partner('a2', 's2', 'separated');
  partner('a2', 'r2', 'together');
  partner('a2', 'h2', 'widowed');
  add('b2', ['a2', 's2']);
  add('m2', ['a2', 'h2']);
  // a4 and a partner without parents.
  add('w4');
  partner('a4', 'w4', 'married');
  add('c4', ['a4', 'w4']);
  // Three parents: m1 is a child of a1+w1, f1 is her child's biological father without a partnership,
  // st1 her partner and the child's step father.
  add('m1', ['a1', 'w1']);
  add('f1');
  add('st1');
  partner('m1', 'st1', 'together');
  add('t1', ['m1', 'f1', 'st1'], { parentLinks: [{ parentId: 'm1', kind: 'biological' }, { parentId: 'f1', kind: 'biological' }, { parentId: 'st1', kind: 'step' }] });
  // A single parent with a child, down to the fifth generation.
  add('a3k', ['a3']);
  add('a3kk', ['a3k']);
  add('a3kkk', ['a3kk']);
  // g1b is the child of a separated root couple, whose other child has only one of them as parent.
  add('rp1');
  add('rp2');
  partner('rp1', 'rp2', 'separated');
  add('rps', ['rp1']);
  more({ add, partner });
  return list();
}

const checkDrawn = (name, list, stubs) => {
  const { violations, stubs: got } = draw(list);
  assert.deepEqual(violations, [], name);
  assert.deepEqual(got.sort(), stubs.sort(), `${name}: stubs`);
};

// The child of rp1 alone would read as a child of rp1 and rp2, whose child hangs under the ex-partner.
// a2 stands inside with all partners beyond it, current first, so the line to the outer s2 passes
// over h2's union: m2's stem crosses it on a bridge.
checkDrawn('fixture A', fixtureA(), ['rps']);
assert.equal(draw(fixtureA()).routes.bridges.length, 1, 'fixture A: one bridge');

// The partner who married in at the right edge has parents too: their couple stands over that partner.
{
  const list = fixtureA(({ add, partner }) => {
    add('xp');
    add('xq');
    partner('xp', 'xq', 'married');
  });
  list.find((p) => p.id === 'w4').parentIds = ['xp', 'xq'];
  const { violations, stubs, at } = draw(list);
  assert.deepEqual(violations, [], 'fixture A with parents of w4');
  assert.deepEqual(stubs.sort(), ['rps'], 'fixture A with parents of w4: stubs');
  const centre = (at.get('xp')[0] + at.get('xq')[0]) / 2;
  assert.equal(centre, at.get('w4')[0], 'the parents of w4 stand directly above w4');
}

// A third married-in partner with parents in the same sibling group: one in-law family is stubbed, not crossed.
{
  const list = fixtureA(({ add, partner }) => {
    add('xp');
    add('xq');
    partner('xp', 'xq', 'married');
    add('yp');
    add('yq');
    partner('yp', 'yq', 'married');
    add('y3');
    partner('a3', 'y3', 'married');
  });
  list.find((p) => p.id === 'w4').parentIds = ['xp', 'xq'];
  list.find((p) => p.id === 'y3').parentIds = ['yp', 'yq'];
  const { violations, stubs } = draw(list);
  assert.deepEqual(violations, [], 'fixture A with three in-law families');
  assert.deepEqual(stubs.sort(), ['rps', 'w1'], 'exactly one of the three in-law families is stubbed');
}

// A former couple with a shared child and a child of only one of them: the single parent's child would
// read as a child of the pair, so it becomes a stub (review finding).
for (const status of ['separated', 'divorced']) {
  const { add, partner, list } = builder();
  add('x');
  add('q');
  partner('x', 'q', status);
  add('c', ['x', 'q']);
  add('d', ['x']);
  checkDrawn(`${status} couple with a child of one of them`, list(), ['d']);
}

// Co-parents without a partnership who form a web of lines: no crossing, whatever is stubbed instead (review finding).
{
  const { add, partner, list } = builder();
  for (const id of ['p1', 'p2', 'p3', 'p4']) add(id);
  partner('p1', 'p2', 'divorced');
  partner('p2', 'p3', 'married');
  partner('p3', 'p4', 'together');
  add('k1', ['p3', 'p4']);
  add('k2', ['p3', 'p2']);
  add('k3', ['p3', 'p1']);
  assert.deepEqual(draw(list()).violations, [], 'co-parent web');
}

// Random families.
const STATUSES = ['together', 'married', 'separated', 'divorced', 'widowed'];
function randomFamily(seed) {
  const rand = seededRandom(seed);
  const int = (n) => Math.floor(rand() * n);
  const { people, add, partner, list } = builder();
  let n = 0;
  const fresh = (parentIds = [], extra = {}) => add(`p${++n}`, parentIds, extra);
  const status = () => STATUSES[int(STATUSES.length)];
  const first = [fresh(), fresh()];
  partner(first[0], first[1], status());
  let couples = [first];
  const depth = 1 + int(6);
  for (let g = 1; g < depth; g++) {
    const next = [];
    const adults = couples.flat();
    for (const [a, b] of couples) {
      for (let i = int(5); i > 0; i--) {
        let parents = [a, b];
        let links;
        const roll = rand();
        if (roll < 0.05) {
          // A step parent (a partner of a drawn parent) or an unrelated one, who becomes a stub.
          const extra = adults.find((p) => p !== a && p !== b && people.get(p).partnerIds.some((q) => q === a || q === b)) ?? adults[int(adults.length)];
          if (extra !== a && extra !== b) {
            parents = [a, b, extra];
            links = parents.map((parentId, k) => ({ parentId, kind: k < 2 ? 'biological' : 'step' }));
          }
        } else if (roll < 0.08) links = parents.map((parentId) => ({ parentId, kind: 'adoptive' }));
        if (!links && rand() < 0.05) parents = [a];
        const child = fresh(parents, links ? { parentLinks: links } : {});
        if (g === depth - 1 || rand() < 0.35) continue;
        // The child's partner, sometimes with parents of their own, sometimes a second partner.
        const mate = fresh();
        partner(child, mate, status());
        if (rand() < 0.3) {
          const mp = [fresh(), fresh()];
          partner(mp[0], mp[1], status());
          people.get(mate).parentIds = mp;
        }
        next.push([child, mate]);
        if (rand() < 0.2) {
          const other = fresh();
          partner(child, other, status());
          next.push([child, other]);
        }
      }
    }
    couples = next;
    if (!couples.length) break;
  }
  return list();
}

let drawings = 0;
let stubbed = 0;
for (let seed = 1; seed <= 500; seed++) {
  const list = randomFamily(seed);
  const { violations, stubs } = draw(list);
  assert.deepEqual(violations, [], `random family, seed ${seed}`);
  drawings++;
  stubbed += stubs.length;
}
console.log(`families checks passed (${drawings} random families, ${stubbed} stubs in total)`);
