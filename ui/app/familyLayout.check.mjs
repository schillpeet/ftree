// Run with `node app/familyLayout.check.mjs`: parents must hang above their children.
import assert from 'node:assert/strict';
import { generations, layoutScrolls } from './familyLayout.ts';

const people = [
  { id: 'grandma', parentIds: [] },
  { id: 'mum', parentIds: ['grandma'] },
  { id: 'dad', parentIds: [] },
  { id: 'kid', parentIds: ['mum', 'dad'] },
];
const gen = generations(people);
assert.deepEqual([...gen], [['grandma', 0], ['mum', 1], ['dad', 1], ['kid', 2]]);

const y = (id) => layoutScrolls(people).get(id)[1];
assert.ok(y('grandma') > y('mum') && y('mum') > y('kid') && y('dad') > y('kid'));

// A cyclic record must not hang the layout.
generations([{ id: 'a', parentIds: ['b'] }, { id: 'b', parentIds: ['a'] }]);
console.log('familyLayout ok');
