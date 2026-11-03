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

## 5. [x] `feat(ui): add public landing page with example family` (V)

- Landing page at `/home`, public through a Cloudflare Access bypass (ftree-infra); `/` redirects there and the header logo links there – [implementation plan](../superpowers/plans/2026-11-01-landing-page.md).
- Read-only example family bundled with the UI, no BFF call.
- Lower and closer camera, warmer horizon light, and a new still for the landing.

## Planned, not built

These stood in the design before but are not in `ui/`; they stay ideas until a PR picks them up.

- Invitation card: the inviter's avatars and name, a "last activity" chip, the relation in the "Du hängst schon im Baum" row.
- Invitation task list: a fourth task, "a memory".
- Welcome card: an optional birth year and the link "Erst die Beispielfamilie ansehen".
- Quick-add popover: a "Jahr" field.
- Person panel: the eyebrow "AUSGEWÄHLT" in `--font-mono` and `--accent`.

## Next round: TRON redesign

- Worked out together in the click dummy ([dummy/](dummy/)) first, following "Working with the design system" in [README.md](README.md).
- Pay off the token debt listed under "Known deviations from the tokens" in [components.md](components.md): grid, line, glyph and legend colours on tokens, the pre-Horizont palette in boards and panels replaced.
- Decide whether TRON keeps a second highlight colour for blood relatives.
- Split into pull requests here once the dummy shows the target.
- [~] One PR, `feat(ui): rework the grid journey` (2026-11-03), preview in [dummy/grid.html](dummy/grid.html):
  - The headline stays after the ride back: the scanline mask sat on `<main>`, whose box ends below the headline, and `.landing-arriving` kept it.
  - TRON is called GRID in the UI ("TRON" is a Disney trademark); `data-theme='tron'` and the `tron-*` names stay.
  - Animations are on by default.
  - The ride into the tree takes 2.4 s with a light runner, the ride back 2 s; the tree's header and dock wait until the camera has arrived.
  - The GRID scene gets the landing's sky, horizon glow and section spacing, so both are one space.
  - The landing headline flickers softly every 8 s.
  - Signed out, the main button is "Anmelden" under a test-phase line, the header has no second "Anmelden"; new copy ("Deine Familie. Ein Baum, der mit euch wächst.", "Weiter zum Baum").
  - The burger menu has "Startseite", and the wordmark's tooltip says "Zur Startseite".
- Planned, only when the landing goes public: Access bypass (ftree-infra), privacy policy for visitors without an account (§1 names only the invited test group, §2 only users), and a check whether a public page needs an Impressum.

## Order

1. PRs 1 and 2 in parallel.
2. PR 3 once PR 1 is merged; PR 4 once PRs 1 and 2 are merged; both in parallel.
3. PR 5 once PR 4 is merged; the Access bypass for `/home` lands in ftree-infra before it is deployed.
