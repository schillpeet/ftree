// Run with `node app/experimental/highlight.check.mjs`: the highlighted pairs, and that the routed
// lines light up only on the way between them.
import assert from 'node:assert/strict';
import { bloodLinks, lineageLinks, linkKey } from './highlight.ts';
import { buildModel } from './model.ts';
import { route } from './routing.ts';
import { ROW_GAP as R } from '../simpleLayout.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
const pairs = (links) => [...links].map((k) => k.split('\n').join('-')).sort();

// Grandparents g + h with three children; the right one, m, and her partner f have the focus, me.
const family = [
  person('g', [], ['h']),
  person('h', [], ['g']),
  person('aunt', ['g', 'h']),
  person('uncle', ['g', 'h']),
  person('m', ['g', 'h'], ['f']),
  person('f', [], ['m']),
  person('me', ['m', 'f']),
  person('sis', ['m', 'f']),
  person('half', ['f']),
];
const find = (id) => family.find((p) => p.id === id);

// Lineage: the lines up to the ancestors with the partnerships between them; siblings, half-siblings,
// aunts, and uncles stay out.
assert.deepEqual(pairs(lineageLinks(find('me'), family)), ['f-m', 'f-me', 'g-h', 'g-m', 'h-m', 'm-me']);
// From a grandparent: the partner, the children, and the grandchildren, but not the in-law or his own child.
assert.deepEqual(pairs(lineageLinks(find('g'), family)), ['aunt-g', 'aunt-h', 'g-h', 'g-m', 'g-uncle', 'h-m', 'h-uncle', 'm-me', 'm-sis']);

// Routed: of the grandparents' sibling bar only the piece from their stem to m stands out.
{
  const model = buildModel(family.filter((p) => p.id !== 'half'));
  const at = new Map(
    Object.entries({ g: [9, 2 * R], h: [18, 2 * R], aunt: [0, R], uncle: [9, R], m: [27, R], f: [36, R], me: [27, 0], sis: [36, 0] }),
  );
  const links = lineageLinks(find('me'), family);
  const lit = route(model, at).segments.filter((s) => s.links.some(([x, y]) => links.has(linkKey(x, y))));
  // The sibling bars hang in the lower half of a channel.
  const bar = lit.filter((s) => s.a[1] === s.b[1] && s.a[1] > R && s.a[1] < 1.5 * R);
  assert.equal(bar.length, 1);
  assert.deepEqual([Math.min(bar[0].a[0], bar[0].b[0]), Math.max(bar[0].a[0], bar[0].b[0])], [13.5, 27]);
  // Neither the aunt's nor the uncle's riser lights up.
  assert.ok(!lit.some((s) => s.a[0] === s.b[0] && (s.a[0] === 0 || s.a[0] === 9) && s.a[1] < 1.5 * R && s.b[1] < 1.5 * R));
}

// Blood relatives: the grandparents' lines to all their children and the half-sibling's line from
// the shared parent, and the partnerships between ancestors.
assert.deepEqual(pairs(bloodLinks(find('me'), family)), ['aunt-g', 'aunt-h', 'f-half', 'f-m', 'f-me', 'f-sis', 'g-h', 'g-m', 'g-uncle', 'h-m', 'h-uncle', 'm-me', 'm-sis']);

console.log('highlight checks passed');
