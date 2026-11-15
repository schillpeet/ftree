# Tiered tree growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Stufenbaum grows visibly when a member joins, and the Evolution panel can replay any family's growth.

**Architecture:** A pure module `ui/app/twinedGrowth.ts` orders members for replay and blends two `TwinedPlan`s into an in-between plan with a grown length per strand and twig. `TwinedTree.tsx` builds one mesh per strand/twig (instead of one merged mesh) and clips each by a `grown` uniform. A small hook in `Scene.tsx` runs the step animation (and the replay) and feeds the blended plan to the tree and the card layout.

**Tech Stack:** Next.js 16, React Three Fiber (`useFrame`), three.js `onBeforeCompile`; checks as plain `node app/<name>.check.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-14-tiered-tree-growth-design.md`

## Global Constraints

- Branch `feat/ui-grow-the-tiered-tree` (based on `feat/ui-rebuild-tiered-tree-as-twined-trunks`); PR title `feat(ui): grow the tiered tree`.
- Show the staged diff and wait for approval before every commit (AGENTS.md).
- Pure modules do not value-import `./pins`.
- Step duration `GROW_SECONDS = 2.5`; replay order generation → birth date (unknown last) → id.
- Growth only in the `organicExperimental` appearance; `prefers-reduced-motion: reduce` → no animation.
- New i18n keys in both languages: `tools.replayGrowth` = "Wachstum abspielen" / "Replay growth", `tools.stopGrowth` = "Stopp" / "Stop".

## Review Focus

- A member removed during or between steps: the tree must drop them without errors.
- Members added while a step is still running: the next step starts from the current in-between plan, no jump back.
- A family of one person and an empty family: replay must finish at once without errors.
- Switching appearance or family during a replay: the replay stops and the tree shows the full family.
- A generation added (depth grows): old strands must stretch, not detach from the ground.

---

### Task 1: Pure growth module

**Files:**
- Create: `ui/app/twinedGrowth.ts`
- Test: `ui/app/twinedGrowth.check.mjs`

**Interfaces:**
- Consumes: `TwinedPlan`, `Braid`, `Twig`, `PlanCard` from `ui/app/twinedLayout.ts`; `generations` from `ui/app/generations.ts`.
- Produces:
  ```ts
  type Person = { id: string; parentIds: string[]; partnerIds: string[]; birthDate?: string | null };
  // Members in replay order: generation, then birth date (unknown last), then id.
  export function growthOrder<T extends Person>(people: T[]): T[];
  // A plan between `from` and `to` at t ∈ [0, 1]: `depth` is fractional, card/braid/twig angles are
  // blended for members in both, new members sit at their `to` angle. `grown` (person id → 0..1)
  // is 1 for members already in `from`, and smoothstep(t) for new ones; members only in `from` are dropped.
  export type GrowingPlan = TwinedPlan & { grown: Map<string, number> };
  export function blendPlans(from: TwinedPlan, to: TwinedPlan, t: number): GrowingPlan;
  ```

- [ ] **Step 1: Write the failing checks** (`person(id, parentIds, partnerIds, birthDate)` helper as in `twinedLayout.check.mjs`):
  - `growthOrder` of the three-generation family from `twinedLayout.check.mjs` → ids `['grandpa', 'grandma', 'dad', 'mum', 'aunt', 'kid']` (generation 1 by birth date: dad 1958, mum 1960, aunt 1962); unknown birth dates sort last within their generation.
  - `blendPlans(a, b, 0)` equals `b`'s structure with `a`'s angles and depth for shared members; `blendPlans(a, b, 1)` deep-equals `{ ...b, grown }` with every `grown` value 1.
  - Adding `dad` to a plan with `mum` alone: at t = 0.5, `grown.get('dad')` is `0.5` (smoothstep), `grown.get('mum')` is 1.
  - Adding a generation: `blendPlans(a, b, 0.5).depth === (a.depth + b.depth) / 2`.
  - A member only in `from` is absent from braids, twigs, cards and `grown` at every t.
  - An empty `from` (`{ depth: 0, braids: [], twigs: [], cards: [] }`) works: depth blends from 0.

- [ ] **Step 2: Run** `cd ui && node app/twinedGrowth.check.mjs` — expected: fails, module not found.
- [ ] **Step 3: Implement** both functions; braid angle blends as the middle of its blended cards; a braid whose member set changed (a partner joined) keeps the `to` ids and blends its angle from the shared member's old card.
- [ ] **Step 4: Run** `cd ui && node app/twinedGrowth.check.mjs && node app/twinedLayout.check.mjs` — expected: exit 0.

### Task 2: Partial strands in the tree

**Files:**
- Modify: `ui/app/TwinedTree.tsx`

**Interfaces:**
- Consumes: `GrowingPlan` from Task 1.
- Produces:
  ```ts
  // Per strand or twig its tube and the person it belongs to; `pins` as before.
  export function buildTwinedTree(plan: TwinedPlan | GrowingPlan, front: number): { pieces: { id: string; geometry: BufferGeometry }[]; pins: Map<string, Point> };
  export default function TwinedTree(props: { tree: ReturnType<typeof buildTwinedTree>; grown?: Map<string, number>; position: Point }): JSX.Element;
  ```

- [ ] **Step 1:** Make `tierY` work with a fractional `depth` (it already is linear in depth) and return one piece per strand/twig instead of a merged geometry; drop vertex colours in favour of one `meshStandardMaterial` per piece with `color` set from the same shade rule.
- [ ] **Step 2:** Clip by growth: a shared `onBeforeCompile` that passes `uv.x` to the fragment shader and `discard`s when `vUv.x > uGrown`; `uGrown` per material from `grown.get(id) ?? 1`. Dispose all piece geometries and materials on change.
- [ ] **Step 3:** Pins: a member whose `grown` < 1 gets no pin (its card is not shown yet).
- [ ] **Step 4: Run** `cd ui && pnpm typecheck && pnpm lint` — expected: no errors.

### Task 3: Animation and replay in the scene

**Files:**
- Create: `ui/app/useGrowth.ts`
- Modify: `ui/app/Scene.tsx` (tiered tree memo near line 846, `<TwinedTree>` near line 980, Ansichts-Labor section near line 1036), `ui/app/i18n.ts` (`tools` in both languages)

**Interfaces:**
- Consumes: `growthOrder`, `blendPlans` (Task 1); `buildTwinedTree`, `TwinedTree` (Task 2); `twinedPlan`, `generations`.
- Produces:
  ```ts
  // Returns the plan to draw this frame; animates whenever `target` changes, and replays `members`
  // in growth order while `replaying` is true, calling `onReplayEnd` after the last step.
  export function useGrowth(members: Member[], target: TwinedPlan, opts: { enabled: boolean; replaying: boolean; onReplayEnd: () => void }): GrowingPlan;
  ```

- [ ] **Step 1:** Implement `useGrowth` with `useFrame`: keep `from`, `to`, `start`; on a new target start a step from the current blended plan; while replaying, each step's target is `twinedPlan(first k members in growthOrder, …)` for k = 1…n; `enabled` false or reduced motion → return the target with every `grown` 1.
- [ ] **Step 2:** In `Scene.tsx` feed `useGrowth(...)` into `buildTwinedTree` (memoised on the plan's JSON so idle frames rebuild nothing), pass `grown` to `<TwinedTree>`, and keep `tieredLayout` derived from the returned pins. Stop the replay when the appearance or family changes.
- [ ] **Step 3:** Add the "Wachstum abspielen" / "Stopp" button under the Darstellung select, enabled only for the Stufenbaum; i18n keys from Global Constraints.
- [ ] **Step 4: Run** `cd ui && pnpm typecheck && pnpm lint && for f in app/*.check.mjs; do node "$f" || echo "FAIL $f"; done` — expected: no errors, no `FAIL`.
- [ ] **Step 5: Check in the browser** (`http://localhost:3000`, Stufenbaum): replay "Stufen 4 Drei Generationen" and "Stufen 7 Grosse Familie", take screenshots mid-step; add a partner to "Stufen 1 Person" and watch the second strand wind up; console without errors; the frame rate during a step on the large family stays smooth.
- [ ] **Step 6:** Add to `docs/project-overview.md` after the Stufenbaum lines: one sentence per line on growth and the replay button. Show the diff and screenshots, commit after approval: `feat(ui): grow the tiered tree`.
