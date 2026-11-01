# Guide New, Invited, and Returning Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR 4 `feat(ui): guide new, invited, and returning users`: a welcome card plants the first tree with the user in it, a shared tree greets its new member once, `/` reopens the last tree and flies to the user's own card with a "DU" badge, and a three-step intro tour runs once.

**Architecture:** Two parallel tracks on top of PR 1 (header, dock, tokens) and PR 2 (`FamilySummary.selfMemberId`, `PUT`/`DELETE /families/{familyId}/self`). Track W builds `WelcomeCard` and `InvitationCard`. Track R remembers the last tree, marks and focuses the own card, and adds `IntroTour`. Small pure helpers carry the decisions and are tested with `node` checks; per-browser memory uses `localStorage` like `appearance.ts`.

**Tech Stack:** Next.js 16, React 19, generated API client in `ui/lib/api/generated/members.ts`, plain CSS tokens, Node `assert` checks.

**Spec:** `docs/design/journeys.md`, `docs/design/components.md` (Welcome card, Invitation card, Intro tour, Person card), prototypes `Willkommen.dc.html`, `Einladung.dc.html`.

## Global Constraints

- Components use only tokens; texts in DE and EN; copy exactly as components.md where it gives German text.
- Permissions, never roles, except where the role itself is the fact shown ("owner" decides whether a tree was shared with the user).
- No year field: `birthDate` is a full date; a bare year would store a false 1 January (decided 2026-11-01). The welcome card asks first and last name only.
- `/me` carries no name: the welcome card's name fields start empty, first name focused.
- "Erst die Beispielfamilie ansehen" is left out until PR 5 builds the example family.
- Remembered per browser: the last tree (`ftree.lastTree`, a slug), seen invitations (`ftree.welcomedTrees`, family ids), the finished tour (`ftree.tourDone`).
- No API change.

## Review Focus

- Planting fails halfway (family created, member or self link fails): the user lands in the new tree with the error shown and can retry adding themselves; no second family is created on retry.
- A user at the family limit (`atFamilyLimit`) never sees the welcome card's primary action enabled; the card explains why, as `EmptyTree` does.
- `ftree.lastTree` names a tree that is gone or no longer visible: `/` falls back to today's `homePath` choice without a flash of "not found".
- "Nicht ich" removes the link, the card updates to the unlinked text, and the "DU" badge disappears without a reload.
- An admin without membership (`selfMemberId` null) sees no badge, no fly-to, and never the invitation card.

---

### Track W (welcome and invitation)

#### Task W1: Welcome card

**Files:**
- Create: `ui/app/WelcomeCard.tsx`, `ui/app/welcome.css`, `ui/app/plantTree.ts`
- Modify: `ui/app/FamilyTree.tsx` (render `WelcomeCard` instead of `EmptyTree` for `kind === 'noTree'`; `EmptyTree` stays for `noPeople`), `ui/app/i18n.ts`

**Interfaces:**
- Produces: `export async function plantTree(input: { firstName: string; lastName: string }): Promise<{ family: FamilySummary; memberId: string }>` in `ui/app/plantTree.ts` — `createEmptyFamily` named "Familie <Nachname>" ("<Last name> family" in EN, "Familie" / "Family" alone with an empty last name), then `createFamilyMember`, then `setSelfMember`.
- `WelcomeCard({ onPlanted(family, memberId), onImport })` — glass card on the left over the blurred scene: eyebrow "Willkommen bei ftree", title "Lass uns deinen Baum pflanzen.", "Er beginnt mit dir – stimmt das so?", live preview of the user's card (scroll in 3D, pill in TRON via the same markup classes the scene uses), Vorname, Nachname, primary "Baum pflanzen", link "Stammbaum-Datei importieren (GEDCOM)" (opens the families board as `EmptyTree` does).
- After planting: navigate to the new tree, focus the own member, start the tour (Track R's `startTour()`).

- [ ] **Step 1:** Build `plantTree` and the card; the blurred scene is `backdrop-filter` on a full-screen layer behind the card.
- [ ] **Step 2:** `cd ui && pnpm lint && pnpm typecheck` → pass.

#### Task W2: Invitation card on the first visit of a shared tree

**Files:**
- Create: `ui/app/welcomed.ts`, `ui/app/welcomed.check.mjs`, `ui/app/InvitationCard.tsx`
- Modify: `ui/app/FamilyTree.tsx`, `ui/app/i18n.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `export function needsWelcome(family: Pick<FamilySummary, 'id' | 'role'> | null, welcomed: readonly string[]): boolean` (true for a visible family whose role is not `owner` and whose id is not in `welcomed`; false for null and for admins' views without a role) and `useWelcomed(): [string[], (familyId: string) => void]` in `ui/app/welcomed.ts`.
- `InvitationCard({ family, members, onAccept, onNotMe })` — centred glass card: "Du wurdest in den Baum <Familienname> eingeladen." (the inviter is not in the API; do not invent one), chips with people count and generations (`generations.ts`), the row "Du hängst schon im Baum als <Name> · <Geburtsjahr> · <Beziehung zum Besitzer, if derivable, else omitted>" with a "Nicht ich" link when `selfMemberId` is set; primary "Einladung annehmen".
- Accept: mark welcomed, focus the own member if any, start the tour, then show a small dismissible glass task list: "Deine Daten prüfen" (opens the own person panel), "Foto hinzufügen" (same panel), "Deinen Zweig ergänzen" (selects the own card so the "+" slots appear once PR 3 is in).

- [ ] **Step 1: Failing check** `welcomed.check.mjs`: owner → false; editor not welcomed → true; editor welcomed → false; visitor not welcomed → true; null → false.
- [ ] **Step 2:** `node app/welcomed.check.mjs` → FAIL; implement; → PASS.
- [ ] **Step 3:** Build the card and the task list; "Nicht ich" calls `clearSelfMember` and reloads the families.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck` → pass.

### Track R (returning user and tour)

#### Task R1: Open the last tree

**Files:**
- Modify: `ui/app/slugRoute.ts`, `ui/app/slugRoute.check.mjs`, `ui/app/FamilyTree.tsx` (store the open tree's slug; pass it to `homePath`)

**Interfaces:**
- Produces: `homePath(families, lastSlug?: string | null): string | null` — the last tree if still visible, else today's choice.

- [ ] **Step 1: Failing assertions:** last slug visible → its path; last slug gone → the "default" family's path; no families → null.
- [ ] **Step 2:** Implement; `node app/slugRoute.check.mjs` → PASS.

#### Task R2: "DU" badge and fly to the own card

**Files:**
- Modify: `ui/app/FamilyTree.tsx` (`selfId = activeFamily?.selfMemberId ?? null`; on opening a tree with a `selfId` and no other focus, `setFocus({ id: selfId })` once), `ui/app/Scene.tsx` (pass `selfId` down to `Scrolls` and `SimpleTree`; nothing else), `ui/app/Scroll.tsx` and `ui/app/SimpleTree.tsx` (`data-self` on the card root plus the badge element), `ui/app/globals.css`, `ui/app/i18n.ts` ("DU" / "YOU")

- [ ] **Step 1:** Badge: small `--accent` / `--accent-ink` label on the scroll's rod in 3D; in TRON a ring and glow (`--line-on`, `--glow`) on the person's card; both through `[data-self]` CSS only.
- [ ] **Step 2:** `pnpm lint && pnpm typecheck` → pass.

#### Task R3: Intro tour

**Files:**
- Create: `ui/app/IntroTour.tsx`, `ui/app/tour.css`, `ui/app/tour.ts`
- Modify: `ui/app/FamilyTree.tsx`, `ui/app/i18n.ts`

**Interfaces:**
- Produces: `useTour(): { active: boolean; step: 0 | 1 | 2; startTour(): void; next(): void; skip(): void }` in `ui/app/tour.ts` — `startTour` does nothing once `ftree.tourDone` is set; `skip` and finishing set it.
- `IntroTour({ step, onNext, onSkip })` — three glass tooltips: "Das bist du." (near the own card or the screen centre; drag to turn, scroll to zoom), "Tippe auf ein +" (beside the selected card), "Alles Wichtige unten" (above the dock, `.dock-root`; mentions the header too). "Weiter" / "Überspringen".

- [ ] **Step 1:** Build hook and component; Esc skips.
- [ ] **Step 2:** `pnpm lint && pnpm typecheck` → pass.

### Task M: Merge and verify (coordinator)

- [ ] Merge track R into track W's branch; regenerate nothing; run all checks and `pnpm build`; check in the running app with a fresh user without trees, a user with a shared tree (editor, visitor), and a returning owner, in 3D and TRON.
