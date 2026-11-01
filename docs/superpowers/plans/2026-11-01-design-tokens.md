# Design Tokens for 3D and TRON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ui/` reads every colour, radius, size, and font from the design tokens, and the root element carries `data-theme="3d"` or `"tron"` from the appearance setting.

**Architecture:** A copy of `docs/design/tokens.css` lives in `ui/app/tokens.css` and is imported by the root layout; a drift check keeps both equal. The existing `--glass-*` variables are replaced by token names everywhere, so the TRON appearance turns every glass surface cyan without any component knowing the theme. The stored appearance values (`organic`, `organicExperimental`, `experimental`) stay as they are; only their labels change, and `themeOf()` maps them to a theme.

**Tech Stack:** Next.js 16 (`next/font/google`), plain CSS custom properties, Node `assert` checks (`node app/*.check.mjs`).

**Spec:** `docs/design/README.md`, `docs/design/components.md`, `docs/design/tokens.json`, `docs/design/plan.md` (Foundation).

## Global Constraints

- Components never branch on the theme; only tokens change.
- `3d` is the default theme; `organic` and `organicExperimental` are `3d`, `experimental` is `tron` (decided 2026-11-01).
- Labels: `organic` → "3D" (DE and EN), `experimental` → "TRON" (DE and EN); `organicExperimental` → "Stufenbaum (experimentell)" / "Tiered tree (experimental)" until the evolution panel takes it over.
- No visual change beyond colours and fonts; layout, sizes, and behaviour stay.
- Fonts: Instrument Serif (400), Inter, JetBrains Mono, all via `next/font/google`, latin subset.
- Tokens the spec lacks and `ui/` needs are added to `docs/design/tokens.json` and `tokens.css` first: `hover` and `danger`.
- This is the first part of PR 1 `feat(ui): introduce the horizont design system` (see `docs/design/plan.md`); its commits stay local and are squashed into that PR.

## Review Focus

- A user with `experimental` stored reloads: the page must not stay amber after hydration; `data-theme` follows the appearance once `/me` is loaded.
- A user without `tree.appearance` (forced to `experimental`): the theme must be `tron` even if `organic` is stored.
- `/terms`, `/privacy`, and `/admin` have no appearance hook: they must render with the `3d` default, not unstyled.
- Focus outlines, checkboxes (`accent-color`), and danger texts keep enough contrast in both themes.
- `pnpm build` in Docker needs network for `next/font/google`; if the image build has none, switch to `next/font/local` with the files in `ui/app/fonts/`.

---

### Task 1: Tokens in `ui/` with a drift check

**Files:**
- Modify: `docs/design/tokens.json`, `docs/design/tokens.css` (add `hover`, `danger` to both themes)
- Create: `ui/app/tokens.css`
- Create: `ui/app/tokens.check.mjs`
- Modify: `.github/workflows/ci.yml` (run the check next to `access.check.mjs`)

**Interfaces:**
- Produces: CSS custom properties `--font-display`, `--font-ui`, `--font-mono`, `--radius-*`, `--size-*`, `--blur-glass`, and per theme `--bg`, `--text`, `--muted`, `--accent`, `--accent-ink`, `--panel`, `--panel-strong`, `--border`, `--node`, `--primary`, `--primary-ink`, `--primary-glow`, `--segment-on`, `--segment-on-ink`, `--slot-border`, `--line-on`, `--line-dim`, `--glow`, `--avatar`, `--avatar-dim`, `--hover`, `--danger`.

New values: `3d` `hover: rgba(255,255,255,.12)`, `danger: #FF8F7A`; `tron` `hover: rgba(72,229,255,.14)`, `danger: #FF8F7A`.

- [ ] **Step 1: Write the failing check `ui/app/tokens.check.mjs`**

Reads `../../docs/design/tokens.json` and `./tokens.css`, parses the `[data-theme="3d"]` and `[data-theme="tron"]` blocks into `{ name: value }`, and asserts:

```js
// every theme key in tokens.json appears as --kebab-name with the same value (whitespace-insensitive)
for (const theme of ['3d', 'tron']) assert.deepEqual(cssTheme(theme), jsonTheme(theme));
// no --glass-* variable is left anywhere in ui/app
assert.deepEqual(filesUsing(/--glass-/), []);
```

The font tokens are the exception: in `ui/` they point at the `next/font` variables (Task 3), so compare only `radius`, `size`, `blur`, and `theme`.

- [ ] **Step 2: Run it** — `cd ui && node app/tokens.check.mjs` → FAIL (`tokens.css` missing).
- [ ] **Step 3: Add `hover` and `danger` to both docs files, then create `ui/app/tokens.css`** as a copy of `docs/design/tokens.css` with `:root, [data-theme="3d"]` and `[data-theme="tron"]` blocks; fonts as `--font-ui: var(--font-inter), Inter, system-ui, sans-serif` (same for `--font-display` → `--font-instrument-serif`, `--font-mono` → `--font-jetbrains-mono`).
- [ ] **Step 4: Run it** → still FAIL only on `--glass-` (Task 2 removes them).

### Task 2: Replace `--glass-*` with token names

**Files:**
- Modify: `ui/app/globals.css:727-735` (delete the `--glass-*` block) and every `var(--glass-*)` in `globals.css`, `share.css`, `conflict.css`, `legal.css`, `treeRoute.css`, `live/presence.css`, `admin/admin.css`
- Modify: `ui/app/layout.tsx` (import `./tokens.css` before `./globals.css`)

**Interfaces:**
- Consumes: the custom properties from Task 1.

Mapping (exact): `--glass-bg` → `--panel`, `--glass-border` → `--border`, `--glass-hover` → `--hover`, `--glass-muted` → `--muted`, `--glass-accent` → `--accent`, `--glass-danger` → `--danger`.
Also in `.glass`: `color: #fff` → `var(--text)`, `backdrop-filter` → `var(--blur-glass)`, `border-radius: 12px` → `var(--radius-control)`. Hard-coded `#7fd6ff` / `#ff8f7a` elsewhere → `var(--accent)` / `var(--danger)`.

- [ ] **Step 1: Replace** with one `sed` per mapping over the seven files.
- [ ] **Step 2: Run** `cd ui && node app/tokens.check.mjs` → PASS.
- [ ] **Step 3: Run** `cd ui && pnpm lint && pnpm typecheck` → no errors.

### Task 3: Fonts via `next/font`

**Files:**
- Create: `ui/app/fonts.ts`
- Modify: `ui/app/layout.tsx`, `ui/app/globals.css` (`.glass` and the other `font-family: Arial, sans-serif` → `var(--font-ui)`; `Georgia` on the scrolls stays)

**Interfaces:**
- Produces: `export const fontVariables: string` in `ui/app/fonts.ts` — the three `.variable` class names joined by a space; `layout.tsx` puts it on `<html className={fontVariables}>`.

`Instrument_Serif({ weight: '400', subsets: ['latin'], variable: '--font-instrument-serif' })`, `Inter({ subsets: ['latin'], variable: '--font-inter' })`, `JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })`, all `display: 'swap'`.

- [ ] **Step 1: Add `fonts.ts`, wire `layout.tsx`, swap the Arial declarations.**
- [ ] **Step 2: Run** `cd ui && pnpm build` → succeeds, and `.next/static/media` contains the font files.

### Task 4: `data-theme` from the appearance, labels "3D" and "TRON"

**Files:**
- Modify: `ui/app/access.ts` (add `themeOf`), `ui/app/access.check.mjs`
- Create: `ui/app/ThemeRoot.tsx`
- Modify: `ui/app/(tree)/layout.tsx` (render `<ThemeRoot />` inside `PermissionsProvider`), `ui/app/layout.tsx` (`<html data-theme="3d">`)
- Modify: `ui/app/i18n.ts` (`appearance.organic`, `.organicExperimental`, `.experimental` in EN and DE)

**Interfaces:**
- Produces: `export type Theme = '3d' | 'tron'` and `export function themeOf(appearance: Appearance): Theme` in `ui/app/access.ts`; `export default function ThemeRoot(): null` in `ui/app/ThemeRoot.tsx` — sets `document.documentElement.dataset.theme = themeOf(appearance)` in an effect and resets it to `'3d'` on unmount (leaving for `/admin`).

- [ ] **Step 1: Write the failing assertions in `access.check.mjs`**

```js
assert.equal(themeOf('organic'), '3d');
assert.equal(themeOf('organicExperimental'), '3d');
assert.equal(themeOf('experimental'), 'tron');
// Without `tree.appearance` the forced appearance decides the theme.
assert.equal(themeOf(allowedAppearance('organic', false)), 'tron');
```

- [ ] **Step 2: Run** `cd ui && node app/access.check.mjs` → FAIL (`themeOf` not exported).
- [ ] **Step 3: Implement `themeOf`, `ThemeRoot`, the root `data-theme="3d"`, and the labels.**
- [ ] **Step 4: Run** `cd ui && node app/access.check.mjs && node app/tokens.check.mjs && pnpm lint && pnpm typecheck` → all pass.

### Task 5: Verify in the running app and open the PR

- [ ] **Step 1:** `./start.sh`; open `http://localhost:3000`, switch Darstellung to "3D" and "TRON"; check menu, families board, share dialog, presence bar, `/admin`, `/terms` in both. Glass surfaces amber-accented in 3D, cyan in TRON, nothing unstyled.
- [ ] **Step 2:** Mark PR 1 in `docs/design/plan.md` as `[~]`; add one line to `docs/project-overview.md` ("Current State", UI) that the UI reads design tokens and switches between the 3D and TRON themes.
- [ ] **Step 3:** Commit locally on the PR 1 branch; no PR yet, the header, dock, evolution panel, and legal line follow on the same branch.
