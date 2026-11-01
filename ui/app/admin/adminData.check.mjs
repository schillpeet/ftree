// Run with `node app/admin/adminData.check.mjs`: trash days, storage sizes, the purge confirmation, who is active, audit details, people, deleting them, the filters of the people, invitation, and tree cards, and the activity timeline.
import assert from 'node:assert/strict';
import {
  accessProblem,
  activityDays,
  auditCsv,
  dayKind,
  localDay,
  periodStart,
  auditDetails,
  confirmsName,
  confirmsPerson,
  daysLeft,
  deleteProblem,
  daysSince,
  formatBytes,
  initialsOf,
  inPeopleFilter,
  isOverdue,
  matchesSearch,
  nextPurgeIn,
  onlineTrees,
  ownerCandidates,
  personStatus,
  presenceRows,
  soleOwnedTrees,
  sortedPeople,
  treeListed,
} from './adminData.ts';

const now = Date.parse('2026-10-26T12:00:00Z');

// The last, partial day counts; a purge date in the past leaves none.
assert.equal(daysLeft('2026-11-25T12:00:00Z', now), 30);
assert.equal(daysLeft('2026-10-27T11:00:00Z', now), 1);
assert.equal(daysLeft('2026-10-26T12:00:01Z', now), 1);
assert.equal(daysLeft('2026-10-26T12:00:00Z', now), 0);
assert.equal(daysLeft('2026-10-20T12:00:00Z', now), 0);

assert.equal(formatBytes(0, 'en-GB'), '0 B');
assert.equal(formatBytes(1023, 'en-GB'), '1,023 B');
assert.equal(formatBytes(1536, 'en-GB'), '1.5 KB');
assert.equal(formatBytes(5 * 1024 * 1024, 'de-DE'), '5 MB');
assert.equal(formatBytes(2.25 * 1024 ** 3, 'de-DE'), '2,3 GB');

// Only the exact name confirms, spaces around it aside.
assert.equal(confirmsName('Marina', 'Marina'), true);
assert.equal(confirmsName('  Marina ', 'Marina'), true);
assert.equal(confirmsName('marina', 'Marina'), false);
assert.equal(confirmsName('', 'Marina'), false);
assert.equal(confirmsName(null, 'Marina'), false);

const entry = (email, familyId, since, overrides = {}) => ({
  userId: null,
  email,
  displayName: email.split('@')[0],
  admin: false,
  familyId,
  familySlug: familyId,
  familyName: familyId,
  viewing: null,
  editing: null,
  idle: false,
  since,
  ...overrides,
});

// Two tabs of one person in one tree become one row from the earlier tab; idle only when both are, editing when one is.
const rows = presenceRows([
  entry('ben@example.org', 'marina', '2026-10-26T11:50:00Z', { idle: true }),
  entry('ben@example.org', 'marina', '2026-10-26T11:40:00Z', { editing: 'b5f0c8e2-0000-4000-8000-000000000000' }),
  entry('ben@example.org', 'schiller', '2026-10-26T11:55:00Z', { idle: true }),
  entry('ada@example.org', 'marina', '2026-10-26T11:40:00Z', { admin: true }),
]);
assert.deepEqual(
  rows.map((row) => [row.displayName, row.familySlug, row.since, row.idle, row.editing]),
  [
    ['ada', 'marina', '2026-10-26T11:40:00Z', false, false],
    ['ben', 'marina', '2026-10-26T11:40:00Z', false, true],
    ['ben', 'schiller', '2026-10-26T11:55:00Z', true, false],
  ],
);
assert.equal(rows[0].admin, true);
assert.deepEqual(presenceRows([]), []);

// Audit details come in a fixed order, unknown keys last and alphabetical.
assert.deepEqual(auditDetails({ source: 'seed', zeta: '1', role: 'editor', alpha: '2', email: 'a@example.org' }), [
  ['email', 'a@example.org'],
  ['role', 'editor'],
  ['source', 'seed'],
  ['alpha', '2'],
  ['zeta', '1'],
]);
assert.deepEqual(auditDetails({}), []);

// Trees a person is online in, once each however many tabs; people without a user row are left out.
const online = onlineTrees([
  entry('ben@example.org', 'marina', '2026-10-26T11:40:00Z', { userId: 'u-ben', familyName: 'Marina' }),
  entry('ben@example.org', 'marina', '2026-10-26T11:41:00Z', { userId: 'u-ben', familyName: 'Marina' }),
  entry('ben@example.org', 'schiller', '2026-10-26T11:42:00Z', { userId: 'u-ben', familyName: 'Schiller' }),
  entry('guest@example.org', 'marina', '2026-10-26T11:40:00Z'),
]);
assert.deepEqual([...online], [['u-ben', ['Marina', 'Schiller']]]);

// Online first, then last seen, then invited, else never signed in.
const person = (overrides) => ({ status: 'active', lastSeen: null, invitedAt: null, ...overrides });
assert.deepEqual(personStatus(person({ lastSeen: '2026-10-25T10:00:00Z' }), ['Marina']), { kind: 'online', trees: ['Marina'] });
assert.deepEqual(personStatus(person({ lastSeen: '2026-10-25T10:00:00Z' }), []), { kind: 'seen', at: '2026-10-25T10:00:00Z' });
assert.deepEqual(personStatus(person({ status: 'invited', invitedAt: '2026-10-24T10:00:00Z' }), undefined), {
  kind: 'invited',
  at: '2026-10-24T10:00:00Z',
});
assert.deepEqual(personStatus(person(), undefined), { kind: 'never' });

// People by name, ties by email.
assert.deepEqual(
  sortedPeople([
    { displayName: 'Ben', email: 'b2@example.org' },
    { displayName: 'Ada', email: 'a@example.org' },
    { displayName: 'Ben', email: 'b1@example.org' },
  ]).map((user) => user.email),
  ['a@example.org', 'b1@example.org', 'b2@example.org'],
);

// Problem codes become readable messages; unknown ones and answers without a code are a plain failure.
assert.equal(accessProblem('INVALID_REQUEST'), 'lastOwner');
assert.equal(accessProblem('VALIDATION_FAILED'), 'invalid');
assert.equal(accessProblem('NOT_FOUND'), 'notFound');
assert.equal(accessProblem('FORBIDDEN'), 'forbidden');
assert.equal(accessProblem('INTERNAL_ERROR'), 'failed');
assert.equal(accessProblem(null), 'failed');
assert.equal(accessProblem('ACCESS_UNAVAILABLE'), 'unavailable');
assert.equal(accessProblem('SEATS_EXHAUSTED'), 'seatsExhausted');

// Deleting: INVALID_REQUEST is the caller or a file admin here, USER_OWNS_TREES names the trees to hand over.
assert.equal(deleteProblem('INVALID_REQUEST'), 'cannotDelete');
assert.equal(deleteProblem('USER_OWNS_TREES'), 'ownsTrees');
assert.equal(deleteProblem('NOT_FOUND'), 'notFound');
assert.equal(deleteProblem(null), 'failed');

// Only trees without another owner need a new one; a tree the families do not list counts too.
const tree = (familyId, role) => ({ familyId, familyName: familyId.toUpperCase(), familySlug: familyId, role });
const owner = { trees: [tree('a', 'owner'), tree('b', 'owner'), tree('c', 'editor'), tree('d', 'owner')] };
const families = [
  { id: 'a', memberships: { owner: 1, editor: 0, visitor: 0 } },
  { id: 'b', memberships: { owner: 2, editor: 0, visitor: 0 } },
  { id: 'c', memberships: { owner: 1, editor: 1, visitor: 0 } },
];
assert.deepEqual(soleOwnedTrees(owner, families).map((entry) => entry.familyId), ['a', 'd']);
assert.deepEqual(soleOwnedTrees({ trees: [] }, families), []);

// Candidates for a tree: everyone else in it, editors before visitors, then by name.
const member = (id, displayName, trees) => ({ id, displayName, trees });
const people = [
  member('u1', 'Ada', [tree('a', 'owner')]),
  member('u2', 'Zoe', [tree('a', 'editor')]),
  member('u3', 'Ben', [tree('a', 'visitor'), tree('b', 'owner')]),
  member('u4', 'Cleo', [tree('a', 'editor')]),
  member('u5', 'Dan', [tree('b', 'editor')]),
];
assert.deepEqual(ownerCandidates(people, 'u1', 'a').map((entry) => [entry.id, entry.role]), [
  ['u4', 'editor'],
  ['u2', 'editor'],
  ['u3', 'visitor'],
]);
assert.deepEqual(ownerCandidates(people, 'u1', 'zzz'), []);

// The person's name as shown, or their email in any case, confirms the deletion; nothing else does.
const ada = { displayName: 'Ada Lovelace', email: 'ada@example.org' };
assert.equal(confirmsPerson('Ada Lovelace', ada), true);
assert.equal(confirmsPerson('  ADA@example.org ', ada), true);
assert.equal(confirmsPerson('ada lovelace', ada), false);
assert.equal(confirmsPerson('', ada), false);
assert.equal(confirmsPerson(null, ada), false);

// Avatars take two letters: of the first two words, or the first two of a single word; nothing gives a question mark.
assert.equal(initialsOf('Ada Lovelace'), 'AL');
assert.equal(initialsOf('ada'), 'AD');
assert.equal(initialsOf('anna.mueller'), 'AM');
assert.equal(initialsOf('  Éva  Ötvös  Kiss'), 'ÉÖ');
assert.equal(initialsOf(''), '?');

// The filter chips: online beats inactive, invited means never signed in, inactive needs an old sign-in.
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const someone = (overrides = {}) => ({ admin: false, status: 'active', lastSeen: daysAgo(1), ...overrides });
assert.equal(inPeopleFilter(someone(), 'all', undefined, now), true);
assert.equal(inPeopleFilter(someone(), 'online', ['Marina'], now), true);
assert.equal(inPeopleFilter(someone(), 'online', [], now), false);
assert.equal(inPeopleFilter(someone({ status: 'invited', lastSeen: null }), 'invited', undefined, now), true);
assert.equal(inPeopleFilter(someone(), 'invited', undefined, now), false);
assert.equal(inPeopleFilter(someone({ lastSeen: daysAgo(90) }), 'inactive', undefined, now), true);
assert.equal(inPeopleFilter(someone({ lastSeen: daysAgo(89) }), 'inactive', undefined, now), false);
assert.equal(inPeopleFilter(someone({ lastSeen: daysAgo(200) }), 'inactive', ['Marina'], now), false);
assert.equal(inPeopleFilter(someone({ lastSeen: null, status: 'invited' }), 'inactive', undefined, now), false);
assert.equal(inPeopleFilter(someone({ admin: true }), 'admins', undefined, now), true);
assert.equal(inPeopleFilter(someone(), 'admins', undefined, now), false);
assert.equal(inPeopleFilter(someone({ canCreateTrees: true }), 'devTools', undefined, now), true);
assert.equal(inPeopleFilter(someone({ admin: true, canCreateTrees: false }), 'devTools', undefined, now), true);
assert.equal(inPeopleFilter(someone({ canCreateTrees: false }), 'devTools', undefined, now), false);

// Searching ignores case, accents, and spaces around the query; an empty query matches everybody.
assert.equal(matchesSearch('  mÜller ', 'Anna Müller', 'anna@example.org'), true);
assert.equal(matchesSearch('ANNA@', 'Anna', 'anna@example.org'), true);
assert.equal(matchesSearch('ben', 'Anna', null), false);
assert.equal(matchesSearch('', 'Anna'), true);

// Invitations count whole days and are overdue after two weeks.
assert.equal(daysSince(daysAgo(0), now), 0);
assert.equal(daysSince(daysAgo(13.9), now), 13);
assert.equal(isOverdue(daysAgo(13.9), now), false);
assert.equal(isOverdue(daysAgo(14), now), true);

// Trees: real ones by default, test ones on demand, all together, and by name or slug.
const real = { name: 'Marina', slug: 'k3x9a', test: false };
const test = { name: 'Zufall 1', slug: 'q7p2m', test: true };
assert.equal(treeListed(real, 'real', ''), true);
assert.equal(treeListed(test, 'real', ''), false);
assert.equal(treeListed(test, 'test', ''), true);
assert.equal(treeListed(real, 'all', 'K3X'), true);
assert.equal(treeListed(real, 'all', 'zufall'), false);

// The trash's next purge is its soonest one; an empty trash has none.
assert.equal(nextPurgeIn([], now), null);
assert.equal(nextPurgeIn([{ purgeAt: '2026-11-20T12:00:00Z' }, { purgeAt: '2026-10-30T12:00:00Z' }], now), 4);

// The timeline: days by local date, newest first; a burst of content edits by one person in one tree reads as one line.
const audit = (id, at, overrides = {}) => ({
  id,
  at,
  actor: 'ada@example.org',
  actorId: 'u1',
  category: 'content',
  action: 'member.updated',
  targetType: 'family',
  targetId: 'f1',
  targetName: 'Marina',
  details: {},
  ...overrides,
});
const noon = (day, minutes = 0) => new Date(`${day}T12:00:00`).getTime() + minutes * 60 * 1000;
const iso = (time) => new Date(time).toISOString();
const days = activityDays([
  audit(9, iso(noon('2026-10-26', 50))),
  audit(8, iso(noon('2026-10-26', 30))),
  audit(7, iso(noon('2026-10-26', 0))),
  audit(6, iso(noon('2026-10-26', -40))),
  audit(5, iso(noon('2026-10-26', -45)), { actorId: 'u2', actor: 'ben@example.org' }),
  audit(4, iso(noon('2026-10-26', -50)), { action: 'member.created' }),
  audit(3, iso(noon('2026-10-26', -55)), { category: 'access', action: 'membership.granted' }),
  audit(2, iso(noon('2026-10-26', -56)), { category: 'access', action: 'membership.granted' }),
  audit(1, iso(noon('2026-10-25'))),
]);
assert.deepEqual(
  days.map((day) => [day.day, day.groups.map((group) => group.map((entry) => entry.id))]),
  [
    ['2026-10-26', [[9, 8, 7], [6], [5], [4], [3], [2]]],
    ['2026-10-25', [[1]]],
  ],
);
assert.deepEqual(activityDays([]), []);

// Today and yesterday by the local calendar, anything older by its date.
assert.equal(localDay(noon('2026-10-26')), '2026-10-26');
assert.equal(dayKind('2026-10-26', noon('2026-10-26')), 'today');
assert.equal(dayKind('2026-10-25', noon('2026-10-26')), 'yesterday');
assert.equal(dayKind('2026-10-24', noon('2026-10-26')), 'earlier');

// A period starts whole days back; "all" has no start.
assert.equal(periodStart('7', now), '2026-10-19T12:00:00.000Z');
assert.equal(periodStart('all', now), undefined);

// CSV quotes every field and doubles quotes inside, one line per entry after the header.
const csv = auditCsv([audit(1, '2026-10-26T12:00:00Z', { targetName: 'Die "Alten"', details: { fields: 'note,firstName' } })]);
assert.equal(
  csv,
  '"at","category","actor","action","targetType","target","details"\r\n' +
    '"2026-10-26T12:00:00Z","content","ada@example.org","member.updated","family","Die ""Alten""","fields=note,firstName"\r\n',
);

console.log('adminData checks passed');
