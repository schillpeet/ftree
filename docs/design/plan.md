# Plan: Horizont redesign in ui/

Each item is meant to become one pull request (titles follow AGENTS.md).
Before implementing an item, create a detailed implementation plan for it from this folder (brainstorming, then writing-plans).
Status: [ ] open · [~] in progress · [x] merged.

## Foundation

- [ ] `refactor(ui): introduce design tokens for 3d and tron themes`
  - Add `docs/design/tokens.css` values to `ui/` (for example `ui/app/tokens.css`) and set `data-theme` on the root from the appearance setting.
  - Map the existing `--glass-*` variables in `ui/app/globals.css` onto the new names, then remove them; no visual change beyond colours.
  - Load Instrument Serif, Inter, and JetBrains Mono via `next/font`.
  - Rename the appearance options to "3D" and "TRON" (DE and EN).

## Navigation

- [ ] `feat(ui): add header with family switcher, theme and language segments, and burger menu top right`
- [ ] `feat(ui): add bottom action dock`
  - Move "Mitglied hinzufügen" out of the burger menu into the dock's "Person".
- [ ] `feat(ui): show evolution panel only with dev tools permission`
  - Header button with DEV badge; hidden without "Entwicklertools"; crown and spacing controls move back behind it.
- [ ] `feat(ui): add legal line at the bottom centre`

## Adding people

- [ ] `feat(ui): add relative slots and quick-add popover around the selected person`
  - Slots only for missing relations; mother → father chaining; toast with undo.
- [ ] `feat(ui): draw thin accent connection lines between scrolls and highlight the selected lineage`
  - 3D keeps the papyrus scrolls; TRON uses glass pills (see components.md).

## Onboarding

- [ ] `feat(ui): add welcome card for signed-in users without a tree`
  - Replaces the current empty-tree card (`ui/app/EmptyTree.tsx`) for users without any visible tree.
- [ ] `feat(ui): add three-step intro tour`
  - Shown once per user; remembered server-side or per browser.
- [ ] `feat(ui): add invitation landing that shows the invited member`

## Landing

- [ ] `feat(ui): add public landing page at /`
  - Needs `/` reachable without Cloudflare Access (see README open questions); signed-in users are redirected to their tree.
- [ ] `feat(ui): add read-only example family`

## 3D scene (separate from UI work)

- [ ] Lower and closer camera, warmer horizon light; then a new still for the landing.
