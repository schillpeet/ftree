// Run with `node app/share.check.mjs`: problem codes of sharing, the email pre-check, and which rows may be changed.
import assert from 'node:assert/strict';
import { INVITE_ROLES, canTransferTo, isLastOwner, isSelf, ownerCount, plausibleEmail, roleChoices, shareProblem } from './share.ts';

const entry = (role, email = 'a@example.org') => ({ userId: role + email, email, displayName: 'A', role, status: 'active', grantedAt: '', lastSeen: null });

assert.equal(shareProblem('INVALID_REQUEST'), 'lastOwner');
assert.equal(shareProblem('VALIDATION_FAILED'), 'invalid');
assert.equal(shareProblem('NOT_FOUND'), 'notFound');
assert.equal(shareProblem('FORBIDDEN'), 'forbidden');
assert.equal(shareProblem('SEATS_EXHAUSTED'), 'seatsExhausted');
assert.equal(shareProblem('INTERNAL_ERROR'), 'failed');
assert.equal(shareProblem(null), 'failed');

assert.ok(plausibleEmail('anna@example.org'));
assert.ok(plausibleEmail('  anna.b+x@mail.example.org '));
assert.ok(!plausibleEmail(''));
assert.ok(!plausibleEmail('anna'));
assert.ok(!plausibleEmail('anna@example'));
assert.ok(!plausibleEmail('an na@example.org'));
assert.ok(!plausibleEmail('@example.org'));
assert.ok(!plausibleEmail('anna@@example.org'));
assert.ok(!plausibleEmail(`${'a'.repeat(320)}@example.org`));

const alone = [entry('owner'), entry('editor', 'b@example.org')];
const two = [entry('owner'), entry('owner', 'c@example.org')];
assert.equal(ownerCount(alone), 1);
assert.ok(isLastOwner(alone[0], alone));
assert.ok(!isLastOwner(alone[1], alone));
assert.ok(!isLastOwner(two[0], two));

assert.deepEqual(INVITE_ROLES, ['editor', 'visitor']);
assert.deepEqual(roleChoices(entry('owner')), ['owner', 'editor', 'visitor']);
assert.deepEqual(roleChoices(entry('visitor')), ['editor', 'visitor']);
assert.ok(canTransferTo(entry('editor')));
assert.ok(!canTransferTo(entry('owner')));

assert.ok(isSelf(entry('owner', 'Anna@Example.org'), 'anna@example.org'));
assert.ok(!isSelf(entry('owner'), 'b@example.org'));
assert.ok(!isSelf(entry('owner'), null));
