// Run with `node app/live/presence.check.mjs`: idle detection, reconnect delays, merging tabs, sorting, who is at a
// person, following, and parsing.
import assert from 'node:assert/strict';
import { IDLE_AFTER_MS, followTarget, hintAt, isIdle, othersAt, parsePresence, peopleOf, reconnectDelay, stateOf } from './presence.ts';

assert.equal(isIdle(false, 0, IDLE_AFTER_MS - 1), false);
assert.equal(isIdle(false, 0, IDLE_AFTER_MS), true);
assert.equal(isIdle(true, 0, 0), true);

assert.equal(reconnectDelay(0), 1_000);
assert.equal(reconnectDelay(99), 30_000);

const tab = (clientId, email, extra = {}) => ({ clientId, email, initials: email.slice(0, 2).toUpperCase(), admin: false, idle: false, ...extra });

// Me first, then active people, then idle ones, each by email; my email matches case-insensitively.
const sorted = peopleOf(
  [tab('1', 'zoe@x'), tab('2', 'anna@x', { idle: true }), tab('3', 'bert@x'), tab('4', 'me@x')],
  'Me@x',
);
assert.deepEqual(
  sorted.map((person) => [person.email, person.me, person.idle]),
  [
    ['me@x', true, false],
    ['bert@x', false, false],
    ['zoe@x', false, false],
    ['anna@x', false, true],
  ],
);
assert.equal(peopleOf([tab('1', 'a@x')], null)[0].me, false);

// Two tabs are one person: idle only when both are, admin when either says so, and the active tab's member wins.
const [merged] = peopleOf(
  [tab('1', 'a@x', { idle: true, viewing: 'old', admin: true }), tab('2', 'a@x', { viewing: 'new', editing: null })],
  null,
);
assert.deepEqual(merged, { email: 'a@x', initials: 'A@', admin: true, me: false, idle: false, viewing: 'new', editing: null });
assert.equal(peopleOf([tab('1', 'a@x', { idle: true }), tab('2', 'a@x', { idle: true, viewing: 'm' })], null)[0].viewing, 'm');
assert.equal(peopleOf([tab('1', 'a@x', { idle: true }), tab('2', 'a@x', { idle: true })], null)[0].idle, true);

assert.equal(stateOf({ idle: true, editing: 'm', viewing: 'm' }), 'idle');
assert.equal(stateOf({ idle: false, editing: 'm', viewing: 'm' }), 'editing');
assert.equal(stateOf({ idle: false, editing: null, viewing: 'm' }), 'viewing');
assert.equal(stateOf({ idle: false, editing: null, viewing: null }), 'here');

// At a person: never me, editors first, then active viewers, then idle ones.
const crowd = peopleOf(
  [
    tab('1', 'me@x', { viewing: 'm' }),
    tab('2', 'anna@x', { viewing: 'm', idle: true }),
    tab('3', 'bert@x', { viewing: 'm' }),
    tab('4', 'carl@x', { viewing: 'm', editing: 'm' }),
    tab('5', 'dora@x', { viewing: 'other' }),
  ],
  'me@x',
);
const atM = othersAt(crowd, 'm');
assert.deepEqual(atM.map((person) => person.email), ['carl@x', 'bert@x', 'anna@x']);
assert.deepEqual(othersAt(crowd, 'nobody'), []);
// One tab edits a person while another views someone else: the person is at both.
const split = peopleOf([tab('1', 'a@x', { viewing: 'v' }), tab('2', 'a@x', { editing: 'e' })], null);
assert.equal(othersAt(split, 'v').length, 1);
assert.equal(othersAt(split, 'e').length, 1);

// The panel names an editor (idle or not) over viewers, and idle viewers not at all.
assert.deepEqual(hintAt(atM, 'm'), { kind: 'editing', email: 'carl@x', more: 0 });
assert.deepEqual(hintAt(atM.slice(1), 'm'), { kind: 'viewing', email: 'bert@x', more: 0 });
assert.equal(hintAt(atM.slice(2), 'm'), null);
const idleEditor = peopleOf([tab('1', 'a@x', { editing: 'm', idle: true }), tab('2', 'b@x', { editing: 'm' })], null);
assert.deepEqual(hintAt(othersAt(idleEditor, 'm'), 'm'), { kind: 'editing', email: 'b@x', more: 1 });
assert.equal(hintAt([], 'm'), null);

// Following leads to the edited person over the viewed one, nowhere while they look at the tree, and ends when they
// leave; I cannot follow myself.
const followed = peopleOf([tab('1', 'a@x', { viewing: 'v' }), tab('2', 'b@x', { viewing: 'v', editing: 'e' }), tab('3', 'c@x'), tab('4', 'me@x', { viewing: 'v' })], 'me@x');
assert.equal(followTarget(followed, 'a@x'), 'v');
assert.equal(followTarget(followed, 'b@x'), 'e');
assert.equal(followTarget(followed, 'c@x'), null);
assert.equal(followTarget(followed, 'gone@x'), undefined);
assert.equal(followTarget(followed, 'me@x'), undefined);
assert.equal(followTarget(followed, null), undefined);

assert.deepEqual(parsePresence(JSON.stringify({ present: [tab('1', 'a@x')] })), [tab('1', 'a@x')]);
assert.deepEqual(parsePresence(JSON.stringify({ present: [null, { email: 'a@x' }] })), []);
assert.equal(parsePresence('{"present":3}'), null);
assert.equal(parsePresence('not json'), null);

console.log('presence checks passed');
