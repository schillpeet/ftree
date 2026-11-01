// Run with `node app/adminHost.check.mjs`: which requests the admin host and the tree's host let through, redirect, or hide.
import assert from 'node:assert/strict';
import { hostDecision, isAdminPath, isLandingPath } from './adminHost.ts';

const adminUrl = 'https://ftree-admin.example.org/';
const adminHost = 'ftree-admin.example.org';
const treeHost = 'ftree.example.org';
const toAdmin = { kind: 'toAdmin', url: 'https://ftree-admin.example.org/admin' };
const next = { kind: 'next' };

// The landing page and its example family are not served on the admin host; it opens on /admin instead.
for (const path of ['/', '/home', '/home/', '/home/example']) assert.deepEqual(hostDecision(adminUrl, adminHost, path), toAdmin, path);
assert.deepEqual(hostDecision(adminUrl, adminHost.toUpperCase(), '/home'), toAdmin);
// A trailing slash or a path in the configured address does not change where it leads.
assert.deepEqual(hostDecision(' https://ftree-admin.example.org// ', adminHost, '/home'), toAdmin);

// The admin page, trees, `/start`, and the legal pages stay reachable on the admin host.
for (const path of ['/admin', '/admin/people', '/start', '/privacy', '/terms', '/schiller', '/homework']) {
  assert.deepEqual(hostDecision(adminUrl, adminHost, path), next, path);
}

// The tree's host has no /admin, keeps the landing page, and sends `/` there.
for (const path of ['/admin', '/admin/people']) assert.deepEqual(hostDecision(adminUrl, treeHost, path), { kind: 'notFound' }, path);
assert.deepEqual(hostDecision(adminUrl, treeHost, '/'), { kind: 'toHome' });
for (const path of ['/home', '/home/example', '/start', '/schiller']) assert.deepEqual(hostDecision(adminUrl, treeHost, path), next, path);
assert.deepEqual(hostDecision(adminUrl, null, '/home'), next);

// Without an admin host, as locally, both live together.
for (const unset of [undefined, '', 'not a url']) {
  assert.deepEqual(hostDecision(unset, 'localhost:3000', '/admin'), next);
  assert.deepEqual(hostDecision(unset, 'localhost:3000', '/home'), next);
  assert.deepEqual(hostDecision(unset, 'localhost:3000', '/'), { kind: 'toHome' });
}

assert.ok(isLandingPath('/home/example') && !isLandingPath('/homework'));
assert.ok(isAdminPath('/admin/trees') && !isAdminPath('/administrators'));
