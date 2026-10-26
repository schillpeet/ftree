// Run with `node app/conflict.check.mjs`: only a 409 with code EDIT_CONFLICT is an edit conflict.
import assert from 'node:assert/strict';
import { isEditConflict, withVersion } from './conflict.ts';

const problem = (status, code) => ({ status, data: { type: 'urn:ftree:problem:x', title: 'x', status, code } });
assert.equal(isEditConflict(problem(409, 'EDIT_CONFLICT')), true);
assert.equal(isEditConflict(problem(409, 'NAME_TAKEN')), false);
assert.equal(isEditConflict(problem(400, 'EDIT_CONFLICT')), false);
assert.equal(isEditConflict({ status: 409, data: {} }), false);
assert.equal(isEditConflict({ status: 409 }), false);
assert.equal(isEditConflict({ status: 200, data: { id: 'x' } }), false);

assert.deepEqual(withVersion({ firstName: 'A' }, 3, false), { firstName: 'A', version: 3 });
assert.deepEqual(withVersion({ firstName: 'A' }, 3, true), { firstName: 'A' });
