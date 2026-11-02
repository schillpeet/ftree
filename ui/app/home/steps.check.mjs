import assert from 'node:assert/strict';
import { doneSteps } from './steps.ts';

assert.deepEqual(doneSteps([]), [false, false, false], 'no tree, nothing done');
assert.deepEqual(doneSteps([{ selfMemberId: 'a', accessCount: 1, memberCount: 1 }]), [true, false, false], 'just planted');
assert.deepEqual(doneSteps([{ selfMemberId: null, accessCount: 2, memberCount: 3 }]), [false, true, true], 'shared and grown, not linked');
assert.deepEqual(
  doneSteps([
    { selfMemberId: 'a', accessCount: 1, memberCount: 2 },
    { selfMemberId: null, accessCount: 3, memberCount: 9 },
  ]),
  [true, true, true],
  'any tree counts',
);
