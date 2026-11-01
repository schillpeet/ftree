// Run with `node app/slugRoute.check.mjs`: which tree a URL opens, where `/` leads, and the switcher's entries.
import assert from 'node:assert/strict';
import { RESERVED_SLUGS, emptyTreeOf, familyOfSlug, firstFamily, homePath, isTreeSlug, pathOf, switcherEntries } from './slugRoute.ts';

const marina = { id: 'm', name: 'Marina', slug: 'marina' };
const other = { id: 'o', name: 'Schiller', slug: 'schiller-2' };
const fallback = { id: 'd', name: 'Default', slug: 'default' };

// A slug opens the visible family with exactly that slug.
assert.equal(familyOfSlug([marina, other], 'marina'), marina);
assert.equal(familyOfSlug([marina, other], 'schiller-2'), other);
// Unknown or invisible (not listed by the BFF), malformed, or no slug at all: no family.
assert.equal(familyOfSlug([marina], 'schiller-2'), null);
assert.equal(familyOfSlug([marina], 'Marina'), null);
assert.equal(familyOfSlug([marina], 'marina/'), null);
assert.equal(familyOfSlug([marina], ''), null);
assert.equal(familyOfSlug([marina], undefined), null);
assert.equal(familyOfSlug([], 'marina'), null);

// Reserved routes never name a tree, even when a family carries that slug.
for (const slug of RESERVED_SLUGS) {
  assert.ok(!isTreeSlug(slug));
  assert.equal(familyOfSlug([{ id: 'x', name: slug, slug }], slug), null);
}
assert.ok(isTreeSlug('admin-2'));
assert.ok(isTreeSlug('a1-b2'));
assert.ok(!isTreeSlug('a--b'));
assert.ok(!isTreeSlug('-a'));
assert.ok(!isTreeSlug('ä'));

// `/` leads to the family named "default" (any case), else the first one, else stays.
assert.equal(firstFamily([marina, fallback]), fallback);
assert.equal(firstFamily([marina, { ...fallback, name: 'DEFAULT' }]).id, 'd');
assert.equal(firstFamily([other, marina]), other);
assert.equal(firstFamily([]), null);
assert.equal(homePath([marina, fallback]), '/default');
assert.equal(homePath([other]), '/schiller-2');
assert.equal(homePath([]), null);
assert.equal(pathOf(marina), '/marina');
// The last open tree wins while it is visible; a gone, malformed or missing one falls back to the default choice.
assert.equal(homePath([marina, fallback], 'marina'), '/marina');
assert.equal(homePath([marina, fallback], 'gone'), '/default');
assert.equal(homePath([other], 'marina'), '/schiller-2');
assert.equal(homePath([marina, fallback], null), '/default');
assert.equal(homePath([marina, fallback], 'admin'), '/default');
assert.equal(homePath([], 'marina'), null);

// The switcher lists every family by name and marks the open one.
assert.deepEqual(switcherEntries([other, marina], 'o'), [
  { id: 'm', name: 'Marina', href: '/marina', active: false },
  { id: 'o', name: 'Schiller', href: '/schiller-2', active: true },
]);
assert.deepEqual(
  switcherEntries([marina], null).map((entry) => entry.active),
  [false],
);

// The empty state: no tree at `/`, or an open tree without people; nothing while loading or when people exist.
assert.equal(emptyTreeOf([], undefined, null, null), 'noTree');
assert.equal(emptyTreeOf(null, undefined, null, null), null);
assert.equal(emptyTreeOf([], 'marina', null, null), null);
assert.equal(emptyTreeOf([marina], undefined, null, null), null);
assert.equal(emptyTreeOf([marina], 'marina', marina, []), 'noPeople');
assert.equal(emptyTreeOf([marina], 'marina', marina, null), null);
assert.equal(emptyTreeOf([marina], 'marina', marina, [{ id: 'p' }]), null);
