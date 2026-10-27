// Run with `node app/live/liveEvents.check.mjs`: parsing the live events, the own-event filter, and the toast choice.
import assert from 'node:assert/strict';
import { isOwnEvent, parseLiveEvent, toastOf, whoOf } from './liveEvents.ts';

const changed = parseLiveEvent('member-changed', '{"memberId":"m1","by":"manuel@x.de"}');
assert.deepEqual(changed, { kind: 'member-changed', memberId: 'm1', by: 'manuel@x.de' });
assert.equal(parseLiveEvent('member-deleted', '{"memberId":"m1","by":"a@x"}')?.kind, 'member-deleted');
assert.deepEqual(parseLiveEvent('family-changed', '{"familyId":"f1","by":"a@x"}'), { kind: 'family-changed', familyId: 'f1', by: 'a@x' });

// Other events, malformed data, and missing fields are ignored.
assert.equal(parseLiveEvent('presence', '{"present":[]}'), null);
assert.equal(parseLiveEvent('member-changed', 'nope'), null);
assert.equal(parseLiveEvent('member-changed', 'null'), null);
assert.equal(parseLiveEvent('member-changed', '{"by":"a@x"}'), null);
assert.equal(parseLiveEvent('member-changed', '{"memberId":"m1"}'), null);
assert.equal(parseLiveEvent('family-changed', '{"memberId":"m1","by":"a@x"}'), null);

// Own events match the email case-insensitively; without a known user nothing is own; a resync is nobody's.
assert.equal(isOwnEvent(changed, 'Manuel@X.de'), true);
assert.equal(isOwnEvent(changed, 'anna@x.de'), false);
assert.equal(isOwnEvent(changed, null), false);
assert.equal(isOwnEvent({ kind: 'resync' }, 'manuel@x.de'), false);

assert.equal(whoOf('manuel.meier@x.de'), 'Manuel');
assert.equal(whoOf('anna@x.de'), 'Anna');
assert.equal(whoOf('@x.de'), '@x.de');

const name = (id) => (id === 'm1' ? 'Oma Erna' : 'Opa');
assert.deepEqual(toastOf(changed, 'anna@x.de', name, null), { kind: 'member-changed', who: 'Manuel', name: 'Oma Erna', conflict: false });
assert.equal(toastOf(changed, 'manuel@x.de', name, null), null);
assert.equal(toastOf({ kind: 'resync' }, 'anna@x.de', name, null), null);
// Changing the person being edited warns about the conflict; another person does not.
assert.equal(toastOf(changed, 'anna@x.de', name, 'm1')?.conflict, true);
assert.equal(toastOf(changed, 'anna@x.de', name, 'm2')?.conflict, false);
assert.deepEqual(toastOf({ kind: 'family-changed', familyId: 'f1', by: 'a@x' }, 'b@x', name, 'm1'), {
  kind: 'family-changed',
  who: 'A',
  name: null,
  conflict: false,
});
console.log('liveEvents ok');
