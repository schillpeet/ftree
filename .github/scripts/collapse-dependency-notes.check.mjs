// Run with `node .github/scripts/collapse-dependency-notes.check.mjs`: Dependabot updates become one changelog line.
import assert from 'node:assert/strict';
import { collapseDependencyNotes } from './collapse-dependency-notes.mjs';

const issue = (n) => `https://github.com/schillpeet/ftree/issues/${n}`;
const dep = (n, sha, text) => `* **ui:** ${text} ([#${n}](${issue(n)})) ([${sha}](https://github.com/schillpeet/ftree/commit/${sha}))`;

const older = `## [0.19.0](https://github.com/schillpeet/ftree/compare/v0.18.0...v0.19.0) (2026-10-23)


### Dependencies

${dep(1, 'aaaaaaa', 'bump a')}
${dep(2, 'bbbbbbb', 'bump b')}
`;

const changelog = `# Changelog

## [0.20.0](https://github.com/schillpeet/ftree/compare/v0.19.0...v0.20.0) (2026-10-30)


### Features

* **ui:** add something ([#180](${issue(180)})) ([1111111](https://github.com/schillpeet/ftree/commit/1111111))


### Dependencies

${dep(178, '3333333', 'bump next from 16.4.1 to 16.4.2 in /ui')}
${dep(175, '2222222', 'bump react from 19.2.0 to 19.2.1 in /ui')}
* **bff:** bump spring-boot from 4.0.0 to 4.0.1 ([#177](${issue(177)})) ([4444444](https://github.com/schillpeet/ftree/commit/4444444))

${older}`;

const collapsed = collapseDependencyNotes(changelog);
const expected = `* update dependencies with dependabot ([#175](${issue(175)}), [#177](${issue(177)}), [#178](${issue(178)}))`;
assert.equal(collapsed.split('\n').filter((line) => line === expected).length, 1);
assert.ok(!collapsed.includes('bump next from 16.4.1'));
assert.ok(collapsed.includes('* **ui:** add something'));
assert.ok(collapsed.endsWith(older), 'older releases stay untouched');
assert.equal(collapseDependencyNotes(collapsed), collapsed, 'collapsing is idempotent');

// A single update is also rewritten to the shared wording.
const single = `## [0.19.1](x) (2026-10-24)\n\n\n### Dependencies\n\n${dep(170, '3092d2c', 'bump next')}\n`;
assert.equal(
  collapseDependencyNotes(single),
  `## [0.19.1](x) (2026-10-24)\n\n\n### Dependencies\n\n* update dependencies with dependabot ([#170](${issue(170)}))\n`,
);

// Without a Dependencies section in the newest release nothing changes, even if older ones have one.
const withoutDeps = `# Changelog\n\n## [0.20.0](x) (2026-10-30)\n\n\n### Features\n\n* **ui:** add something\n\n${older}`;
assert.equal(collapseDependencyNotes(withoutDeps), withoutDeps);
assert.equal(collapseDependencyNotes('no release here'), 'no release here');

// The release pull request body ends with release-please's footer, which is kept.
const body = `:robot: I have created a release *beep* *boop*
---


## [0.19.1](https://github.com/schillpeet/ftree/compare/v0.19.0...v0.19.1) (2026-10-24)


### Dependencies

${dep(170, '3092d2c', 'bump next')}
${dep(171, '5555555', 'bump react')}

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).`;
const collapsedBody = collapseDependencyNotes(body);
assert.ok(collapsedBody.includes(`### Dependencies\n\n* update dependencies with dependabot ([#170](${issue(170)}), [#171](${issue(171)}))\n\n---\nThis PR was generated`));

console.log('collapse dependency notes ok');
