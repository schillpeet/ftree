// Run with `node app/properties.check.ts`: property-based checks with fast-check, which feed hundreds of random
// inputs to the pure helpers that handle typed names and URL segments and assert what must hold for every one of them.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { normalize, searchMembers } from './nameSearch.ts';
import { shortFirstName, splitName } from './names.ts';
import { RESERVED_SLUGS, familyOfSlug, isTreeSlug } from './slugRoute.ts';

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

// Typed text mixes words, whitespace runs and accented or non-Latin letters.
const typed = fc.array(fc.oneof(fc.string(), fc.constantFrom(' ', '  ', '\t', 'é', 'Ü', 'ß', '李')), { maxLength: 12 }).map((parts) => parts.join(''));

// Splitting a typed name loses no word and leaves a single word as the surname.
fc.assert(
  fc.property(typed, (query) => {
    const { firstName, lastName } = splitName(query);
    assert.deepEqual(words(`${firstName} ${lastName}`), words(query));
    assert.ok(!/\s/.test(lastName));
    if (words(query).length >= 2) assert.notEqual(lastName, '');
  }),
);

// Shortened first names keep the first given name and the number of names, and shortening twice changes nothing.
fc.assert(
  fc.property(typed, (firstName) => {
    const short = shortFirstName(firstName);
    assert.equal(words(short).length, words(firstName).length);
    assert.equal(words(short)[0], words(firstName)[0]);
    assert.equal(shortFirstName(short), short);
  }),
);

const member = fc.record({ id: fc.uuid(), firstName: typed, lastName: typed, birthName: fc.option(typed, { nil: null }) });

// Search results come from the list and respect the limit, and every member is found by its own full name, unless
// the name is only marks that the search drops, such as `^` or a lone combining accent.
fc.assert(
  fc.property(fc.array(member, { maxLength: 20 }), typed, fc.nat({ max: 10 }), (members, query, limit) => {
    const found = searchMembers(members, query, limit);
    assert.ok(found.length <= limit);
    assert.ok(found.every((m) => members.includes(m)));
    for (const m of members) {
      const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
      if (words(normalize(name)).length > 0) assert.ok(searchMembers(members, name, members.length).includes(m));
    }
  }),
);

const family = fc.record({ id: fc.uuid(), name: fc.string(), slug: fc.oneof(fc.string(), fc.constantFrom(...RESERVED_SLUGS)) });

// A URL segment opens only a family with exactly that slug, and never one with a reserved or malformed slug.
fc.assert(
  fc.property(fc.array(family, { maxLength: 10 }), fc.oneof(fc.string(), fc.constantFrom(...RESERVED_SLUGS)), (families, slug) => {
    const opened = familyOfSlug(families, slug);
    if (opened === null) return;
    assert.equal(opened.slug, slug);
    assert.ok(isTreeSlug(slug));
    assert.ok(!(RESERVED_SLUGS as readonly string[]).includes(slug));
  }),
);

console.log('property checks passed');
