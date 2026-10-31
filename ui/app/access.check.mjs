// Run with `node app/access.check.mjs`: permission checks, the appearance fallback without `tree.appearance`,
// and which API answers count as a sign-in or permission problem.
import assert from 'node:assert/strict';
import { hostOf, APPEARANCES, MAX_OWNED_FAMILIES, atFamilyLimit, PUBLIC_APPEARANCE, allowedAppearance, authProblemOf, can, failedCallNeedsProbe, signedOutByProbe } from './access.ts';

const me = { email: 'x@example.org', admin: false, canCreateTrees: false, permissions: ['tree.appearance'], verified: true };
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

// The family limit counts owned families only, and never applies to admins or before `/me` and the list are loaded.
const owned = (count) => Array.from({ length: count }, () => ({ role: 'owner' }));
assert.equal(MAX_OWNED_FAMILIES, 5);
assert.ok(!atFamilyLimit(me, owned(4)));
assert.ok(atFamilyLimit(me, owned(5)));
assert.ok(atFamilyLimit(me, owned(6)));
assert.ok(!atFamilyLimit(me, [...owned(4), visited, edited]));
assert.ok(!atFamilyLimit({ ...me, admin: true }, owned(5)));
assert.ok(!atFamilyLimit(null, owned(5)));
assert.ok(!atFamilyLimit(me, null));

// Appearance: without `tree.appearance` always experimental; with them the stored choice, organic by default.
assert.equal(PUBLIC_APPEARANCE, 'experimental');
for (const saved of [null, 'junk', ...APPEARANCES]) assert.equal(allowedAppearance(saved, false), 'experimental');
for (const saved of APPEARANCES) assert.equal(allowedAppearance(saved, true), saved);
assert.equal(allowedAppearance(null, true), 'organic');
assert.equal(allowedAppearance('junk', true), 'organic');
// While `/me` loads, the stored choice stays, so the tree does not switch.
assert.equal(allowedAppearance('organicExperimental', null), 'organicExperimental');

// Only this app's own API answers count, by their problem code.
const origin = 'https://ftree.example.org';
assert.equal(authProblemOf('/api/families', 403, 'FORBIDDEN', origin), 'forbidden');
assert.equal(authProblemOf(`${origin}/api/me`, 401, 'UNAUTHENTICATED', origin), 'signedOut');
assert.equal(authProblemOf('/api/families/x', 404, 'NOT_FOUND', origin), null);
assert.equal(authProblemOf('/api/families', 409, 'NAME_TAKEN', origin), null);
assert.equal(authProblemOf('/api/families', 200, null, origin), null);
assert.equal(authProblemOf('/apix', 403, 'FORBIDDEN', origin), null);
assert.equal(authProblemOf('/other/api/x', 403, 'FORBIDDEN', origin), null);
assert.equal(authProblemOf('https://elsewhere.example.org/api/x', 403, 'FORBIDDEN', origin), null);
// Answers without a code (Cloudflare Access, the proxy) fall back to the status.
assert.equal(authProblemOf('/api/families', 403, null, origin), 'forbidden');
assert.equal(authProblemOf('/api/me', 401, null, origin), 'signedOut');
assert.equal(authProblemOf('/api/families', 404, null, origin), null);

// A failed own API call is probed; a redirect to the Access sign-in means signed out, anything else does not.
assert.ok(failedCallNeedsProbe('/api/families', origin));
assert.ok(!failedCallNeedsProbe('https://elsewhere.example/api/x', origin));
assert.ok(signedOutByProbe('opaqueredirect'));
assert.ok(!signedOutByProbe('basic'));
assert.ok(!signedOutByProbe('error'));

// The admin page lives under /admin on the administration's host, with or without a trailing slash in its address.
assert.equal(hostOf('https://Admin.example.org/'), 'admin.example.org');
assert.equal(hostOf(' http://admin.localhost:3000 '), 'admin.localhost:3000');
assert.equal(hostOf(''), null);
assert.equal(hostOf(undefined), null);
assert.equal(hostOf('not a url'), null);
