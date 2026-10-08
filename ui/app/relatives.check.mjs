// Run with `node app/relatives.check.mjs`: parents, children, and partners follow the stored links,
// siblings share all parents, half-siblings only some.
import assert from 'node:assert/strict';
import { relativesOf } from './relatives.ts';

const person = (id, parentIds = [], partnerIds = []) => ({ id, parentIds, partnerIds });
const ids = (relatives) => Object.fromEntries(Object.entries(relatives).map(([key, list]) => [key, list.map((m) => m.id)]));

const members = [
  person('mum', [], ['dad']),
  person('dad', [], ['mum']),
  person('other'),
  person('me', ['mum', 'dad']),
  person('sister', ['mum', 'dad']),
  person('half', ['dad', 'other']),
  person('only-mum', ['mum']),
  person('kid', ['me']),
];
const find = (id) => members.find((m) => m.id === id);

// Full siblings have the same parent set; sharing only some (or having more) makes a half-sibling.
assert.deepEqual(ids(relativesOf(find('me'), members)), {
  parents: ['mum', 'dad'],
  children: ['kid'],
  partners: [],
  siblings: ['sister'],
  halfSiblings: ['half', 'only-mum'],
});

// One parent: someone with just that parent is a full sibling, someone with more is a half-sibling.
assert.deepEqual(ids(relativesOf(find('only-mum'), members)).siblings, []);
assert.deepEqual(ids(relativesOf(find('only-mum'), members)).halfSiblings, ['me', 'sister']);

// Without parents there are no (half-)siblings, only stored links.
assert.deepEqual(ids(relativesOf(find('dad'), members)), {
  parents: [],
  children: ['me', 'sister', 'half'],
  partners: ['mum'],
  siblings: [],
  halfSiblings: [],
});
console.log('relatives ok');
