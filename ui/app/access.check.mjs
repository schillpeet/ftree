// Run with `node app/access.check.mjs`: permission checks, the appearance fallback without `tree.appearance`,
// and which API answers count as a sign-in or permission problem.
import assert from 'node:assert/strict';
import { APPEARANCES, PUBLIC_APPEARANCE, allowedAppearance, authProblemOf, can } from './access.ts';

const me = { email: 'x@example.org', admin: false, developer: false, permissions: ['tree.appearance'], verified: true };
const visited = { role: 'visitor', permissions: ['tree.view'] };
const edited = { role: 'editor', permissions: ['tree.view', 'member.edit', 'family.edit', 'family.export'] };

// Permissions, never roles: what `/me` or the open family lists counts, and a missing `/me` allows nothing.
assert.ok(can(me, 'tree.appearance'));
assert.ok(!can(me, 'tree.view'));
assert.ok(can(me, 'tree.view', visited));
assert.ok(!can(me, 'member.edit', visited));
assert.ok(can(me, 'member.edit', edited));
assert.ok(!can(me, 'member.delete', edited));
assert.ok(!can({ ...me, admin: true }, 'family.manage', edited));
assert.ok(can({ ...me, permissions: ['family.manage'] }, 'family.manage', null));
assert.ok(!can(null, 'tree.view', edited));

// Appearance: without `tree.appearance` always experimental; with them the stored choice, organic by default.
assert.equal(PUBLIC_APPEARANCE, 'experimental');
for (const saved of [null, 'junk', ...APPEARANCES]) assert.equal(allowedAppearance(saved, false), 'experimental');
for (const saved of APPEARANCES) assert.equal(allowedAppearance(saved, true), saved);
assert.equal(allowedAppearance(null, true), 'organic');
assert.equal(allowedAppearance('junk', true), 'organic');
// While `/me` loads, the stored choice stays, so the tree does not switch.
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
