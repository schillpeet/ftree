// Run with `node app/growth.check.mjs`: each outer ring grows over half a crown scale step.
import assert from 'node:assert/strict';
import { growth } from './growth.ts';

for (const scale of [0.3, 1, 2]) assert.equal(growth(1, scale), 1);
assert.deepEqual([0.9, 1, 1.25, 1.5, 2].map((s) => growth(2, s)), [0, 0, 0.5, 1, 1]);
assert.deepEqual([1.25, 1.5, 1.75, 2].map((s) => growth(3, s)), [0, 0, 0.5, 1]);
console.log('growth ok');
