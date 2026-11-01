# Header, Dock, Evolution Panel, and Legal Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The rest of PR 1 `feat(ui): introduce the horizont design system`: the signed-in screens get the Horizont header, the bottom dock, the evolution panel behind "Entwicklertools", and the legal line.

**Architecture:** Two parallel tracks on top of the design tokens. Track A rebuilds the top of the screen (`Header.tsx` replaces the burger at the top left, the centred family name, and the right-hand buttons in `Scene.tsx`) and the footer. Track B adds `Dock.tsx` at the bottom and moves "add person", search, and sharing into it. Only `FamilyTree.tsx` is touched by both; each track changes only the lines it needs there.

**Tech Stack:** Next.js 16, React 19, plain CSS with the tokens in `ui/app/tokens.css`.

**Spec:** `docs/design/components.md` (Glass surface, Header, Burger menu, Evolution panel, Bottom dock, Legal line), `docs/design/README.md` (Principles, Decisions), prototype `docs/design/prototypes/Baum3D.dc.html`.

## Global Constraints

- Components use only tokens; nothing checks the theme.
- All texts in DE and EN in `ui/app/i18n.ts`; German labels exactly as in components.md ("Person", "Suchen", "Einladen", "Ansicht", "Familien", "Darstellung", "Momentaufnahme", "GEDCOM importieren", "Feedback", "Abmelden", "Evolution", "DEV").
- Permissions, never roles (`useCan` / `<Can>`); the BFF enforces the same rules.
- Evolution needs `dev.tools` (today `tree.appearance`); the theme segment needs `tree.appearance` as the appearance radio did.
- The tiered tree (`organicExperimental`) is no longer an appearance option in the UI; it is a "Stufenbaum" checkbox in the evolution panel that sets the stored appearance to `organicExperimental` (checked) or `organic` (unchecked). Stored values stay unchanged.
- The "Zeit" (time of day) button leaves the header and becomes a section of the evolution panel.
- Existing behaviour is kept unless named here: snapshot, feedback mail, admin link, profile board, family card, tree switcher list, GEDCOM import in the families board.
- No commits; the coordinator merges both tracks.

## Review Focus

- A visitor (`tree.view` only): dock shows Suchen and Ansicht; Person and Einladen are hidden or disabled with a reason, no dead buttons.
- No family open (empty account): header and dock render without errors; Person is disabled as the burger item was (`!activeFamily`).
- Snapshot still hides the UI and keeps the scene and family name: its filter must match the new header markup.
- Small screens (375px wide): header controls do not overlap; the dock fits or scrolls; the legal line stays below the dock.
- Escape and outside press close burger, evolution panel, and the dock's popovers; burger and evolution close each other.

---

### Task A1: Header (track A)

**Files:**
- Create: `ui/app/Header.tsx`, `ui/app/header.css`
- Modify: `ui/app/Dashboard.tsx` (burger moves into the header's right end; menu items per spec), `ui/app/TreeSwitcher.tsx` (styling only), `ui/app/FamilyTree.tsx` (render `Header` where `Dashboard` was), `ui/app/Scene.tsx` (remove `.dashboard-actions`; expose the evolution toggle, see Interfaces), `ui/app/i18n.ts`, `ui/app/globals.css` (remove styles that only the old top bar used)

**Interfaces:**
- Produces: `export default function Header(props: { families: FamilySummary[] | null; activeFamilyId: string | null; evolutionOpen: boolean; onEvolution: () => void; menu: ReactNode; onFamilyClick: () => void })` — left: f-monogram (`--accent`) and "ftree" in `--font-display`; centre: the family switcher (existing `TreeSwitcher` or the single family button); right: theme segment (3D | TRON, `useAppearance`), language segment (DE | EN, `useLanguage`), Evolution button with DEV badge (only `dev.tools`), then the burger (`menu`).
- `Scene` keeps owning the evolution panel and camera; it gets `evolutionOpen: boolean` and `onEvolutionClose: () => void` props instead of its own toolbar state for evolution.
- Burger items in order: Profil, Familien (`family.create`), Darstellung (inline 3D · TRON segment), Momentaufnahme, GEDCOM importieren (opens the families board, `family.create`), Feedback, Verwaltung (`users.view`), divider, Abmelden (`/cdn-cgi/access/logout`). "Mitglied hinzufügen" and the appearance board leave the menu.

- [ ] **Step 1:** Build `Header.tsx` and `header.css` from the prototype's header (`--size-control`, `--radius-control`, segments `--radius-pill`, active option `--segment-on` / `--segment-on-ink`).
- [ ] **Step 2:** Rework `Dashboard.tsx` into the burger menu content above; keep its outside-press/Escape handling and the snapshot (update the snapshot filter to keep the header's family switcher).
- [ ] **Step 3:** Wire it in `FamilyTree.tsx`; opening evolution closes the burger and vice versa.
- [ ] **Step 4:** Run from `ui/`: `pnpm lint && pnpm typecheck && node app/access.check.mjs && node app/tokens.check.mjs` → all pass.

### Task A2: Evolution panel only with `dev.tools`

**Files:**
- Modify: `ui/app/Scene.tsx` (`const evolution = useCan('dev.tools')`; add sections "Zeit" (today's time panel content) and the "Stufenbaum" checkbox), `ui/app/i18n.ts`

- [ ] **Step 1:** Change the gate, move the time panel into the evolution panel, add the Stufenbaum checkbox (disabled in TRON).
- [ ] **Step 2:** Run `pnpm lint && pnpm typecheck` → pass. Check that a user without `dev.tools` sees no Evolution button and no time controls.

### Task A3: Legal line

**Files:**
- Modify: `ui/app/layout.tsx` (footer), `ui/app/globals.css` (`.app-version`)

- [ ] **Step 1:** Footer becomes one line, bottom centre, 12px, `--muted`, no glass box: `v<version> · Nutzungsbedingungen · Datenschutz` (keep `LegalLinks`); it sits below the dock (dock bottom is 44px).
- [ ] **Step 2:** Check `/terms` and `/privacy` still show it.

### Task B1: Bottom dock (track B)

**Files:**
- Create: `ui/app/Dock.tsx`, `ui/app/dock.css`
- Modify: `ui/app/FamilyTree.tsx` (render `Dock`; pass handlers), `ui/app/MemberSearch.tsx` (open/close controlled from outside; its own top-left button goes away), `ui/app/Scene.tsx` (only a new `cameraView` prop and one effect near `lookFront`; do not touch the toolbar or evolution panel), `ui/app/i18n.ts`

**Interfaces:**
- Produces: `export default function Dock(props: { canAdd: boolean; canShare: boolean; onPerson: () => void; onSearch: () => void; onInvite: () => void; onView: (view: CameraView) => void })` and `export type CameraView = 'front' | 'above' | 'orbit'` in `ui/app/Dock.tsx`.
- `Scene` gets `cameraView: { view: CameraView; nonce: number } | null`; each new nonce runs today's `lookFront` / `lookFromAbove` / orbit toggle.
- Person: `--primary` / `--primary-ink`, `--size-dock-primary`, `--radius-dock-primary`, opens today's add-member flow (`addMember` in `FamilyTree.tsx`); the "+" slots come in PR 3. Suchen opens `MemberSearch`. Einladen opens today's `ShareDialog` for the open family (`family.share`). Ansicht opens a small glass popover above the dock with Front / Oben / Orbit.
- Dock: centred, `--radius-dock`, glass, 44px above the bottom edge, icon-over-label buttons (icons from the prototype's dock in `Baum3D.dc.html`, added to `ui/app/icons.tsx`).

- [ ] **Step 1:** Build `Dock.tsx` and `dock.css`.
- [ ] **Step 2:** Make `MemberSearch` controllable (`open`, `onClose` props) and drop its own trigger button.
- [ ] **Step 3:** Wire the handlers in `FamilyTree.tsx` and the `cameraView` prop in `Scene.tsx`.
- [ ] **Step 4:** Run from `ui/`: `pnpm lint && pnpm typecheck` → pass.

### Task C: Merge and verify (coordinator)

- [ ] **Step 1:** Merge track B's diff into the main checkout; resolve `FamilyTree.tsx` and `i18n.ts`.
- [ ] **Step 2:** Run all checks from `.github/workflows/ci.yml` and `pnpm build`.
- [ ] **Step 3:** In the running app check 3D and TRON, a visitor and an editor, 375px width, and the Review Focus list; then show the whole PR 1 diff for approval.
