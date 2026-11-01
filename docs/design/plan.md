# Plan: Horizont redesign in ui/

The redesign lands in five pull requests; each is squash-merged into one commit with the title below (AGENTS.md).
Inside a PR, parallel agents may work on separate branches that are merged into the PR's branch before review.
Before implementing a PR, create a detailed implementation plan for it from this folder (brainstorming, then writing-plans).
Status: [ ] open · [~] in progress · [x] merged.
Journeys: N new user, I invited user, R returning user, V signed-out visitor ([journeys.md](journeys.md)).

## 1. [x] `feat(ui): introduce the horizont design system` (N I R V)

- Design tokens in `ui/`, `data-theme` from the appearance, fonts via `next/font`, appearances renamed to "3D" and "TRON" – [implementation plan](../superpowers/plans/2026-11-01-design-tokens.md).
- Header with family switcher, theme and language segments, and burger menu top right.
- Bottom dock; "Mitglied hinzufügen" moves out of the burger menu into the dock's "Person".
- Evolution panel only with "Entwicklertools", behind a header button with DEV badge; crown, spacing, and the tiered tree (`organicExperimental`) move behind it.
- Legal line at the bottom centre.

## 2. [x] `feat(bff): link members to signed-in users` (N I R)

- A member can be linked to one user per family; `/me` or the family answer names the caller's own member.
- Set when a tree is planted from the welcome card; "Nicht ich" removes the link; the API spec comes first, the UI client is regenerated.

## 3. [x] `feat(ui): add relatives from the tree and highlight lineages` (N R)

- Relative slots and quick-add popover around the selected person: only missing relations, mother → father chaining, toast with undo.
- Thin accent connection lines, the selected lineage highlighted; 3D keeps the papyrus scrolls, TRON uses glass pills (see components.md).

## 4. [x] `feat(ui): guide new, invited, and returning users` (N I R)

- Welcome card for signed-in users without a tree; replaces `ui/app/EmptyTree.tsx` for them.
- Invitation card on the first visit of a shared tree; sharing keeps granting access right away, so "Einladung annehmen" only closes the card and starts the tour.
- `/` opens the last tree and the camera settles on the own card with the "DU" badge.
- Three-step intro tour, shown once per user and remembered per browser.

## 5. [~] `feat(ui): add public landing page with example family` (V)

- Landing page at `/home`, public through a Cloudflare Access bypass (ftree-infra); `/` redirects there and the header logo links there – [implementation plan](../superpowers/plans/2026-11-01-landing-page.md).
- Read-only example family bundled with the UI, no BFF call.
- Lower and closer camera, warmer horizon light, and a new still for the landing.

## Order

1. PRs 1 and 2 in parallel.
2. PR 3 once PR 1 is merged; PR 4 once PRs 1 and 2 are merged; both in parallel.
3. PR 5 once PR 4 is merged; the Access bypass for `/home` lands in ftree-infra before it is deployed.
