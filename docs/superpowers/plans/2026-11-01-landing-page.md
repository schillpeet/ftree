# Landing Page and Example Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR 5 `feat(ui): add public landing page with example family`: a public landing page at `/home`, a read-only example tree at `/home/example`, `/` and the header logo leading there, and a lower, closer, warmer 3D start view.

**Architecture:** `/home` lives outside the `(tree)` route group, so it loads no `/me` and needs no sign-in; Cloudflare Access gets a bypass for `/home` and the static assets (ftree-infra). The tree's entry, today `/`, moves to `/start`; `/` redirects to `/home` in `proxy.ts`. The example tree renders the existing `Scene` with members bundled in the UI and no BFF call.

**Tech Stack:** Next.js 16, React 19, @react-three/fiber, plain CSS with the tokens.

**Spec:** `docs/design/README.md` (Decisions: landing at `/home`), `docs/design/components.md` (Landing), `docs/design/journeys.md` (Signed-out visitor), prototype `docs/design/prototypes/Landing.dc.html`.

## Global Constraints

- Texts in DE and EN in `ui/app/i18n.ts`; German copy exactly as in components.md and the prototype: chip "Privat · nur für eure Familie · Open Source", title "Eure Familie. Ein Baum, der mitwächst.", sentence "Leg dich selbst an, lade deine Familie ein und seht gemeinsam zu, wie aus Namen eine Geschichte wird.", buttons "Baum anlegen" and "Beispielfamilie ansehen", nav "So funktioniert’s", "Privatsphäre", "Beispielfamilie", "Anmelden", steps 01 "Dich anlegen" / "In 30 Sekunden steht dein Platz", 02 "Familie einladen" / "Jede:r pflegt den eigenen Ast", 03 "Gemeinsam wachsen" / "Fotos, Daten, Geschichten".
- Nothing under `/home` calls the BFF except the optional `/api/me` probe that tells a signed-in visitor apart (an Access redirect or an error means signed out).
- `home` and `start` become reserved slugs.
- Components use only tokens; the landing follows the 3D/TRON segment like the tree.

## Review Focus

- Signed-out visitor on `/home` behind Access: the page and its scripts, fonts, and still load without a sign-in; the `/api/me` probe fails quietly.
- Signed-in user on `/home`: "Anmelden" reads "Zu deinem Baum" and `/start` opens the last tree (or the welcome card).
- Old links to `/` (bookmarks, the sign-in return URL) land on `/home`, not in a loop.
- Admin host: `/` still opens `/admin`.
- 375px wide: landing title, buttons, and step cards fit without horizontal scrolling.

---

### Task 1: Routes

**Files:** Modify `ui/proxy.ts`, `ui/app/slugRoute.ts`, `ui/app/slugRoute.check.mjs`, `ui/app/FamilyTree.tsx` (fallbacks `'/'` → `'/start'`), `ui/app/Header.tsx` (logo links to `/home`); move `ui/app/(tree)/page.tsx` to `ui/app/(tree)/start/page.tsx`.

- [ ] `proxy.ts`: after the admin-host rules, `/` redirects (307) to `/home`; matcher gains `/home`.
- [ ] `RESERVED_SLUGS` gains `home` and `start`; assert `isTreeSlug('home') === false` and `isTreeSlug('start') === false`.

### Task 2: Landing page

**Files:** Create `ui/app/home/page.tsx`, `ui/app/home/Landing.tsx`, `ui/app/home/landing.css`, `ui/public/landing.jpg` (the 3D still); modify `ui/app/i18n.ts`, `ui/app/Header.tsx` (export `LanguageSegment`).

- Header row: logo and wordmark (link to `/home`), glass nav (`#steps`, `/privacy`, `/home/example`, `/start`), theme and language segments.
- Centre block and three step cards (`id="steps"`) above the legal line; background the still in 3D, the TRON grid (CSS) in TRON.
- `ThemeRoot` on the page so the theme segment switches the tokens.

### Task 3: Example family

**Files:** Create `ui/app/home/example/page.tsx`, `ui/app/home/ExampleTree.tsx`, `ui/app/home/exampleFamily.ts`, `ui/app/home/exampleFamily.check.mjs` (every parent, child, and partner id exists; three generations), add it to `.github/workflows/ci.yml`.

- About 12 members over three generations with partnerships, fixed ids, no photos.
- `Scene` read-only: no `onPlace`, no `onAdded`, evolution closed; a click highlights the lineage and shows a small glass card with name and life span; a bar with logo, segments, and "Eigenen Baum anlegen" (`/start`).

### Task 4: Camera and light (parallel agent)

**Files:** Modify `ui/app/Scene.tsx` (camera constants, hemisphere/sky colours only), `ui/app/sky.ts` if needed.

- Start view lower and closer: tree ~50–60 % of the screen height, horizon ~55 %; warmer horizon light; `scrollLines`, cards, and slots unchanged.

### Task 5: Verify

- [ ] All checks from `.github/workflows/ci.yml`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] Browser: `/` → `/home`; 3D and TRON; DE and EN; 375px; example tree click; `/start` with a signed-in dev user.
- [ ] Mark PR 4 `[x]`, PR 5 `[~]` in `docs/design/plan.md`.
