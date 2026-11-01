// Run with `node app/welcomed.check.mjs`: which trees greet the user with the invitation card.
import assert from 'node:assert/strict';
import { needsWelcome } from './welcomed.ts';

const tree = (role, id = 'f1') => ({ id, role });

assert.equal(needsWelcome(tree('owner'), []), false);
assert.equal(needsWelcome(tree('editor'), []), true);
assert.equal(needsWelcome(tree('editor'), ['f1']), false);
assert.equal(needsWelcome(tree('editor'), ['other']), true);
assert.equal(needsWelcome(tree('visitor'), []), true);
assert.equal(needsWelcome(tree('visitor'), ['f1']), false);
assert.equal(needsWelcome(null, []), false);
assert.equal(needsWelcome(tree('admin'), []), false);
assert.equal(needsWelcome(tree(undefined), []), false);

console.log('welcomed ok');
