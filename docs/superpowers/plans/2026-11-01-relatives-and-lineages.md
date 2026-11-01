# Relatives from the Tree and Lineage Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR 3 `feat(ui): add relatives from the tree and highlight lineages`: dashed "+" slots around the selected person open a quick-add popover, and thin accent lines connect the cards, with the selected lineage glowing.

**Architecture:** Two parallel tracks. Track S adds `RelativeSlots` (HTML via drei `Html`, like `Scroll.tsx`) around the selected card and a `QuickAdd` popover that creates the member and then links it with the existing create and relatives calls. Track L replaces the thick 3D lines in `Scene.tsx` (`Scrolls`) with thin token-coloured lines routed as components.md says, recolours the TRON lines in `SimpleTree.tsx` from tokens, and gives TRON people the glass pill. Three.js colours come from the CSS tokens through one hook, so components still never check the theme.

**Tech Stack:** Next.js 16, React 19, @react-three/fiber + drei, plain CSS tokens, Node `assert` checks.

**Spec:** `docs/design/components.md` (Person card, Relative slots, Connection lines), `docs/design/journeys.md` (new and returning user), prototypes `Baum3D.dc.html` and `Tron.dc.html`.

## Global Constraints

- Components use only tokens; nothing checks the theme. Three.js materials read token values through `useTokenColor` (Task L1) and re-render when `data-theme` changes.
- Slot labels exactly "+ Mutter", "+ Vater", "+ Partner:in", "+ Kind" (EN "+ Mother", "+ Father", "+ Partner", "+ Child").
- Slots only for relations still missing: Mutter/Vater while the person has fewer than two parents (both shown with none, the one not yet known with one; parents carry no sex in the data, so with one parent show a single "+ Elternteil" / "+ Parent"); Partner:in and Kind always.
- Slots and quick-add only with `member.edit` in the open family.
- Quick-add fields: Vorname (focused), Nachname (prefilled from the person for "+ Vater" and "+ Kind"). No year field: `birthDate` is a full date and a bare year would store a false 1 January (decided 2026-11-01); dates stay in the person panel.
- Enter saves, Esc closes; after saving a mother the popover moves on to "+ Vater"; a toast "<Name> wächst jetzt in deinem Baum" / "<Name> is now growing in your tree" with "Rückgängig" / "Undo" (deletes the new member).
- Lines: about 1.3px, `--line-dim`; the selected person's ancestors, descendants, and partners in `--line-on` with a soft `--glow` underneath. Partners: one horizontal line between the cards at card height. Children: from the middle of the partner line down, across, down to the top of the child's card (in 3D the scroll's rod). 3D rounds the two bends with an 8px-equivalent radius; TRON keeps right angles. Lines never pass through a card or end in empty space.
- 3D keeps the papyrus scrolls (`.scroll`), plus a soft `--glow` halo on the selected one; TRON draws a glass pill (`--size-person-pill`, `--radius-pill`, `--node`, avatar on `--avatar`, name, one line of years).
- People outside the highlighted lineage: `opacity .62`, scroll desaturated, or `--avatar-dim` in TRON.
- No API change.

## Review Focus

- A person with two parents, partners, and children gets only "+ Partner:in" and "+ Kind"; adding the second parent makes the parent slot disappear without a reload (live events already update `members`).
- A failed save (409 conflict, 403) keeps the popover open with the error, never a half-linked member: if linking fails after creating, delete the new member again.
- Undo after the mother → father chain removes only the member the toast names.
- Lineage of a person in a loop-free but wide tree (cousins, half-siblings) highlights only ancestors, descendants, and partners, not siblings.
- Switching 3D ↔ TRON while a person is selected keeps the selection and recolours the lines at once.

---

### Track S (slots and quick-add)

#### Task S1: Which slots a person gets

**Files:**
- Create: `ui/app/slots.ts`, `ui/app/slots.check.mjs`
- Modify: `.github/workflows/ci.yml` (run the check)

**Interfaces:**
- Produces: `export type SlotKind = 'mother' | 'father' | 'parent' | 'partner' | 'child'` and `export function missingSlots(member: Pick<Member, 'id' | 'parentIds'>): SlotKind[]` in `ui/app/slots.ts`; `export function prefilledLastName(kind: SlotKind, member: Pick<Member, 'lastName'>): string`.

- [ ] **Step 1: Write the failing check**

```js
assert.deepEqual(missingSlots({ id: 'a', parentIds: [] }), ['mother', 'father', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p'] }), ['parent', 'partner', 'child']);
assert.deepEqual(missingSlots({ id: 'a', parentIds: ['p', 'q'] }), ['partner', 'child']);
assert.equal(prefilledLastName('father', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('child', { lastName: 'Huber' }), 'Huber');
assert.equal(prefilledLastName('mother', { lastName: 'Huber' }), '');
```

- [ ] **Step 2:** `cd ui && node app/slots.check.mjs` → FAIL; implement; → PASS.

#### Task S2: Slots and quick-add in the scene

**Files:**
- Create: `ui/app/RelativeSlots.tsx`, `ui/app/QuickAdd.tsx`, `ui/app/slots.css`
- Modify: `ui/app/Scene.tsx` (render `RelativeSlots` next to the selected scroll in `Scrolls` and next to the selected person in `SimpleTree`; touch nothing else), `ui/app/SimpleTree.tsx` (only the slot mount point), `ui/app/FamilyTree.tsx` (pass `canEdit`, `familyId`, and an `onAdded(member)` for the toast), `ui/app/i18n.ts`

**Interfaces:**
- Consumes: `missingSlots`, `prefilledLastName` (S1); the existing create-member and relatives calls as used in `MembersControls.tsx` / `MemberFields.tsx`.
- Produces: `RelativeSlots({ member, members, familyId, position })` and `QuickAdd({ kind, member, familyId, onSaved(member, next: SlotKind | null), onClose })`.
- The dock's "Person" (ui/app/Dock.tsx) keeps opening the add dialog; it additionally shows the hint "Tippe auf ein + am Baum" / "Tap a + on the tree" for 4 seconds when a person is selected.

- [ ] **Step 1:** Build the components; slots are `--slot-border` dashed 1.5px, `--radius-pill`, `--size-slot` high.
- [ ] **Step 2:** Mother → father chaining and the toast with undo.
- [ ] **Step 3:** `cd ui && pnpm lint && pnpm typecheck && node app/slots.check.mjs` → pass.

### Track L (lines and cards)

#### Task L1: Token colours for Three.js

**Files:**
- Create: `ui/app/tokenColor.ts`

**Interfaces:**
- Produces: `export function useTokenColor(name: `--${string}`): string` — reads `getComputedStyle(document.documentElement).getPropertyValue(name)`, re-reads on `data-theme` changes (a `MutationObserver` on `<html>` via `useSyncExternalStore`), server snapshot `'#ffffff'`.

#### Task L2: Lineage

**Files:**
- Modify: `ui/app/relatives.ts`, `ui/app/relatives.check.mjs`

**Interfaces:**
- Produces: `export function lineageOf<T extends Person>(member: T, members: T[]): Set<string>` — the member, `ancestorsOf`, all descendants, and the member's partners.

- [ ] **Step 1: Failing assertions** in `relatives.check.mjs`: grandparent, child, grandchild, and partner are in; sibling, aunt, cousin, and the partner's parents are out; a parent loop terminates.
- [ ] **Step 2:** Implement; `node app/relatives.check.mjs` → PASS.

#### Task L3: Thin lines in 3D, tokens in TRON, glass pills

**Files:**
- Modify: `ui/app/Scene.tsx` (`Scrolls`' line drawing and the `.scroll` selected/dimmed state only), `ui/app/SimpleTree.tsx` (colours from `useTokenColor`, pill markup, dimming), `ui/app/Scroll.tsx` (selected halo, dimmed state via props), `ui/app/globals.css` (pill and halo styles; remove the thick-line leftovers)
- Test: a pure routing helper for the 3D partner/child path if one is extracted (e.g. `ui/app/scrollLines.ts` with `scrollLines.check.mjs`: partner segment at card height, child path ends at the rod, no segment crosses a card box).

- [ ] **Step 1:** Route and draw the 3D lines per the constraints; highlight via `lineageOf`.
- [ ] **Step 2:** TRON: `LINE_COLOR` / `FOCUS_COLOR` / `BLOOD_COLOR` constants give way to `--line-dim` / `--line-on` (blood keeps its own hue only if the legend still needs it; otherwise `--line-on`); pills per constraints.
- [ ] **Step 3:** `cd ui && pnpm lint && pnpm typecheck` and every check in ci.yml → pass.

### Task M: Merge and verify (coordinator)

- [ ] Merge track L into track S's branch; run all checks and `pnpm build`; check in the running app: 3D and TRON, a selected person with and without parents, the mother → father chain, undo, a visitor (no slots), 375px.
