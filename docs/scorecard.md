# OpenSSF Scorecard

[OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/schillpeet/ftree) rates the repository's supply-chain practices from 0 to 10; the README badge shows the latest result.
`.github/workflows/scorecard.yml` runs it every Monday and on demand, not on pushes (see [Timing](#timing)).
This page explains where the missing points come from, so a lower badge is not mistaken for a gap nobody looked at.
The decisions behind each accepted check are reviewed on 2027-04-30.

## How the score is computed

Each check scores 0 to 10 and carries a weight by risk: Critical 10, High 7.5, Medium 5, Low 2.5.
The overall score is the weighted average; the 18 checks weigh 105 in total, so one missing point in a High check costs 7.5 / 105 ≈ 0.07 overall.

## Where the points are lost

As of 2026-10-31 the score is 7.0; every check not listed scores 10.

| Check | Score | Weight | Overall cost | Why | Outlook |
|---|---|---|---|---|---|
| Maintained | 0 | High | 0.71 | The repository is younger than 90 days. | 10 from 2026-12-31 on, with no change needed. |
| Signed-Releases | 0 | High | 0.71 | No release so far carries provenance; it was added after 0.29.1. | `release-images.yml` attaches `ftree-<version>.tgz.intoto.jsonl` to every release; Scorecard rates the last five, so the check fills up with the next five releases. |
| Code-Review | 0 | High | 0.71 | Scorecard counts merged pull requests approved by someone other than their author. | Accepted: changes are reviewed by the maintainer, go through a PR, and need the required checks; it rises only if another person reviews. |
| Branch-Protection | 4 | High | 0.43 | The `main` ruleset blocks deletion and force pushes and requires a PR and the `validate` and `ci-ok` checks, but requires no approval. | Accepted: a required approval with an admin bypass would raise it to about 8 without anyone reviewing; it is not worth that. |
| Contributors | 0 | Low | 0.24 | Scorecard wants recent contributors from at least three organizations. | Accepted: it follows from who contributes, not from the code. |
| CII-Best-Practices | 5 | Low | 0.12 | The [OpenSSF Best Practices badge](https://www.bestpractices.dev/projects/16096) is at Passing. | Silver would add 0.05 and needs mostly documentation (governance, roles, access continuity, an assurance case) plus signed releases; Gold needs two-person review and is out of reach for now. |
| Binary-Artifacts | 9 | High | 0.07 | `bff/gradle/wrapper/gradle-wrapper.jar`. | 10 once Scorecard sees a successful `gradle-wrapper.yml` run for the scanned commit; see [Timing](#timing). |
| SAST | 9 | Medium | 0.05 | A merged commit without a finished CodeQL run counts as unscanned. | CodeQL stays optional for merging; the weekly run usually finds every commit scanned. |

Maintained and Signed-Releases bring the score to about 8.5 within a few months.
The accepted checks cost about 1.4 points as long as one person maintains ftree alone.

## Timing

Binary-Artifacts and SAST depend on other workflows having finished for the commit Scorecard scans.
On a push to `main` Scorecard starts in the same second as CI, CodeQL (about four minutes) and the Gradle wrapper check, and counts the commit as unscanned or the wrapper as unvalidated while they still run.
The weekly run starts long after the last merge, so it sees the finished runs.

## Ignored advisories

`ui/osv-scanner.toml` and `api/osv-scanner.toml` let the Vulnerabilities check skip advisories that do not apply, each with a reason and an `ignoreUntil` date.
Today that is only GHSA-g3hv-75wg-m249 in `minimatch`, which only ESLint and Spectral use and which is in no image, until 2027-01-31.
