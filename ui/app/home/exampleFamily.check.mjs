import assert from 'node:assert/strict';
import { EXAMPLE_MEMBERS } from './exampleFamily.ts';

const ids = new Set(EXAMPLE_MEMBERS.map((member) => member.id));
assert.equal(ids.size, EXAMPLE_MEMBERS.length, 'ids are unique');

// Every link points at a member of the family, and partnerships go both ways.
for (const member of EXAMPLE_MEMBERS) {
  for (const id of [...member.parentIds, ...member.partnerIds]) assert.ok(ids.has(id), `${member.id} → ${id}`);
  for (const id of member.partnerIds) {
    assert.ok(EXAMPLE_MEMBERS.find((other) => other.id === id).partnerIds.includes(member.id), `${id} ↔ ${member.id}`);
  }
}

// Four generations: the longest chain of parents has four people.
const byId = new Map(EXAMPLE_MEMBERS.map((member) => [member.id, member]));
const depth = (member) => 1 + Math.max(0, ...member.parentIds.map((id) => depth(byId.get(id))));
assert.equal(Math.max(...EXAMPLE_MEMBERS.map(depth)), 4);
