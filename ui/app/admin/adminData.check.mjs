// Run with `node app/admin/adminData.check.mjs`: trash days, storage sizes, the purge confirmation, who is active, and audit details.
import assert from 'node:assert/strict';
import { auditDetails, confirmsName, daysLeft, formatBytes, presenceRows } from './adminData.ts';

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

console.log('adminData checks passed');
