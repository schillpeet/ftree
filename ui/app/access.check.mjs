// Run with `node app/access.check.mjs`: permission checks, the appearance fallback without dev tools,
// and which API answers count as a sign-in or permission problem.
import assert from 'node:assert/strict';
import { APPEARANCES, PUBLIC_APPEARANCE, allowedAppearance, authProblemOf, can } from './access.ts';

const me = (permissions) => ({ email: 'x@example.org', role: 'visitor', permissions, verified: true });
const visitor = me(['tree.view']);
const editor = me(['tree.view', 'member.edit', 'family.edit', 'family.export']);

// Permissions, never roles: only what is listed counts, and a missing `/me` allows nothing.
assert.ok(can(visitor, 'tree.view'));
assert.ok(!can(visitor, 'member.edit'));
assert.ok(can(editor, 'member.edit'));
assert.ok(!can(editor, 'member.delete'));
assert.ok(!can({ ...editor, role: 'admin' }, 'family.manage'));
assert.ok(!can(null, 'tree.view'));

// Appearance: without dev tools always experimental; with them the stored choice, organic by default.
assert.equal(PUBLIC_APPEARANCE, 'experimental');
for (const saved of [null, 'junk', ...APPEARANCES]) assert.equal(allowedAppearance(saved, false), 'experimental');
for (const saved of APPEARANCES) assert.equal(allowedAppearance(saved, true), saved);
assert.equal(allowedAppearance(null, true), 'organic');
assert.equal(allowedAppearance('junk', true), 'organic');
// While `/me` loads, the stored choice stays, so an admin's tree does not switch.
assert.equal(allowedAppearance('organicExperimental', null), 'organicExperimental');

// Only this app's own API answers count.
const origin = 'https://ftree.example.org';
assert.equal(authProblemOf('/api/families', 403, origin), 'forbidden');
assert.equal(authProblemOf(`${origin}/api/me`, 401, origin), 'signedOut');
assert.equal(authProblemOf('/api/families', 404, origin), null);
assert.equal(authProblemOf('/api/families', 200, origin), null);
assert.equal(authProblemOf('/apix', 403, origin), null);
assert.equal(authProblemOf('/other/api/x', 403, origin), null);
assert.equal(authProblemOf('https://elsewhere.example.org/api/x', 403, origin), null);
