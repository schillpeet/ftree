// Run with `node app/welcomed.check.mjs`: which trees greet the user with the invitation card.
import assert from 'node:assert/strict';
import { needsWelcome } from './welcomed.ts';

const tree = (invitationPending, id = 'f1') => ({ id, invitationPending });

assert.equal(needsWelcome(tree(true), []), true);
assert.equal(needsWelcome(tree(false), []), false);
assert.equal(needsWelcome(tree(true), ['f1']), false);
assert.equal(needsWelcome(tree(true), ['other']), true);
assert.equal(needsWelcome(tree(undefined), []), false);
assert.equal(needsWelcome(null, []), false);

console.log('welcomed ok');
