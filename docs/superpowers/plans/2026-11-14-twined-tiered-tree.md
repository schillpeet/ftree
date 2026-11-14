# Twined tiered tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiered tree ("Stufenbaum") with a simple tree of tubes in which every couple is a braid of their own strands, viewable on localhost.

**Architecture:** A pure module `ui/app/twinedLayout.ts` turns members plus generations into a `TwinedPlan` (braids, twigs, card angles); `ui/app/TwinedTree.tsx` turns the plan into one merged tube geometry plus a pin per card; `Scene.tsx` swaps the old tiered tree for the new one. `TieredTree.tsx`, `tieredLayout.ts` and `tieredLayout.check.mjs` are deleted.

**Tech Stack:** Next.js 16, React Three Fiber, three.js; checks as plain `node app/<name>.check.mjs` with `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-14-twined-tiered-tree-design.md`

## Global Constraints

- Branch `feat/ui-rebuild-tiered-tree-as-twined-trunks`; final PR title `feat(ui): rebuild the tiered tree as twined trunks`.
- Before every commit: show the staged diff and message and wait for the user's explicit approval (AGENTS.md).
- The pure layout module must not value-import `./pins` (plain node cannot resolve it); sizes come in as options.
- No leaves, no textures; tubes via the existing `tube()` and `ground()` from `ui/app/Tree.tsx`.
- The appearance key stays `organicExperimental`, labels "Stufenbaum" / "Tiered tree" stay.
- Code, comments, names and commits in English.

## Review Focus

- Empty family (no members): the scene must render the meadow with no tree and no crash.
- A partner id or parent id that is not in the tree: ignored, the person is treated as if the link did not exist.
- Partners in different generations: `generations()` already lifts them to the same tier; the plan must use one braid at that tier.
- A family wider than a full circle: all card angles shrink so no two cards on one tier are closer than the shrunken slot.
- Parent cycles in bad data: `generations()` stops after its round limit; `twinedPlan()` must still terminate.

---

### Task 1: Pure layout `twinedPlan()`

**Files:**
- Create: `ui/app/twinedLayout.ts`
- Test: `ui/app/twinedLayout.check.mjs`

**Interfaces:**
- Consumes: `generations(people)` from `ui/app/generations.ts` (id → tier, 0 at the top).
- Produces:
  ```ts
  type Person = { id: string; parentIds: string[]; partnerIds: string[]; birthDate?: string | null };
  // People whose strands wind together, ending on `tier`. `angle`: direction (radians, 0 = front)
  // in which the braid leaves the trunk; `offset`: distance of the braid's axis from the trunk axis
  // at the ground, 0 for the eldest root braid.
  export type Braid = { ids: string[]; tier: number; angle: number; offset: number };
  // A childless, partnerless person with parents in the tree; grows out of the parents' braid
  // (`from` = that braid's ids) on `tier`.
  export type Twig = { id: string; tier: number; angle: number; from: string[] };
  export type PlanCard = { id: string; tier: number; angle: number };
  export type TwinedPlan = { depth: number; braids: Braid[]; twigs: Twig[]; cards: PlanCard[] };
  export function twinedPlan(people: Person[], gen: Map<string, number>, slotAngle: number): TwinedPlan;
  ```

- [ ] **Step 1: Write the failing checks** in `twinedLayout.check.mjs` (header comment "Run with `node app/twinedLayout.check.mjs`: …", `person(id, parentIds, partnerIds, birthDate)` helper as in `tieredLayout.check.mjs`, `plan = (family) => twinedPlan(family, generations(family), 0.3)`, `ids = (p) => p.braids.map((b) => b.ids)`):
  - Empty: `deepEqual(plan([]), { depth: 0, braids: [], twigs: [], cards: [] })`.
  - One person: `deepEqual(ids(plan([solo])), [['solo']])`, no twigs, `braids[0].offset === 0`.
  - Couple: `deepEqual(ids(...), [['a', 'b']])`, both in `cards`.
  - Couple + two childless kids: one braid `['mum','dad']`; twigs `kid`, `kid2` on tier 1 with `from` `['mum','dad']`.
  - Three generations (grandpa+grandma; mum+dad with mum child of grandparents; aunt childless; kid of mum+dad): braids `[['grandpa','grandma'], ['mum','dad']]` with tiers 0 and 1; twig `aunt` tier 1 from grandparents; twig `kid` tier 2 from `['mum','dad']`; the non-root braid has `offset > 0`.
  - Single parent: `mum` with child `kid` and no partner → braid `['mum']`, twig `kid` from `['mum']`.
  - Second partner: `a` with partners `b` and `c` on one tier → one braid containing all three.
  - Unknown links: a partner id and a parent id not in the list are ignored (person alone → own braid).
  - Every member has exactly one card; on each tier sorted card angles differ by ≥ `slotAngle * 0.999` (or by ≥ the shrunk slot when more than `2π / slotAngle` cards exist — build a 30-children family with `slotAngle` 0.3 and check all cards fit in 2π).
  - A braid's `angle` is the middle of its members' card angles; a twig's angle equals its card's angle.
  - Couple where both partners have parents in the tree: exactly one braid contains both, placed under the elder partner's parents.

- [ ] **Step 2: Run** `cd ui && node app/twinedLayout.check.mjs` — expected: fails, module not found.

- [ ] **Step 3: Implement `twinedPlan()`.** Units = a person plus partners on the same tier (as in today's `tieredPlan`), blood relatives first, then by birth date. A unit is twig-only when it has one member who has parents in the tree, no partner and no children in the tree; every other unit is a braid. Each unit belongs under the unit of its eldest blood member's parents. Angles: a unit's wedge = max(own cards, sum of its children's wedges) in slots; roots share the circle by age, centred on angle 0; if the total exceeds 2π, shrink `slotAngle` to fit. Braid offset: 0 for the first root, otherwise `0.5 + 0.15 * tier` (geometry scales it).

- [ ] **Step 4: Run** `cd ui && node app/twinedLayout.check.mjs && node app/generations.check.mjs` — expected: no output, exit 0.

- [ ] **Step 5: Commit** (after showing the staged diff and getting approval): `feat(ui): add the twined tree layout`.

### Task 2: Geometry and scene wiring

**Files:**
- Create: `ui/app/TwinedTree.tsx`
- Modify: `ui/app/Scene.tsx:26-27` (imports), `ui/app/Scene.tsx:846-852` (plan, build, layout), `ui/app/Scene.tsx:980` (component)
- Delete: `ui/app/TieredTree.tsx`, `ui/app/tieredLayout.ts`, `ui/app/tieredLayout.check.mjs`

**Interfaces:**
- Consumes: `twinedPlan`, `TwinedPlan` from Task 1; `tube`, `ground` from `./Tree`; `CARD`, `CARD_GAP`, `Point` from `./pins`.
- Produces:
  ```ts
  export const TWINED_SLOT_ANGLE: number; // angle one card needs at the card radius
  export function buildTwinedTree(plan: TwinedPlan, front: number): { bark: BufferGeometry; pins: Map<string, Point> };
  export default function TwinedTree(props: { tree: ReturnType<typeof buildTwinedTree>; position: Point }): JSX.Element;
  ```

- [ ] **Step 1: Implement `buildTwinedTree()`.** Keep today's tier heights (`TIER_GAP = CARD.height + CARD_GAP + 1.2`, `LOWEST = CARD.height + 2.5`, `tierY(t) = LOWEST + (depth - 1 - t) * TIER_GAP`) and a card radius of about 6 so cards hang free of the trunk.
  - Braid axis: from `offset` (scaled to ~0.6 units per 1.0) towards `front + angle` at the ground, easing to the trunk axis halfway up, so all braids form one trunk.
  - Strands: for member *i* of *n*, a helix around the braid axis with phase `2πi/n`, braid radius ~0.35, about one turn per tier height, tube radius ~0.22 (a single strand: no helix, a slight wobble).
  - At `tierY(tier)` each strand bends out along `front + card angle` to the card radius and droops a little; the pin is that end, minus the tube radius.
  - Twigs: thinner tube (~0.12) from the parents' braid axis at `tierY(tier) - 0.4` out to the card radius at `front + angle`.
  - A short, thick flare into the ground per braid (no roots).
  - Vertex colours: one warm bark tone, each strand lightness shifted by ±10 % so the winding reads; material `meshStandardMaterial vertexColors roughness 0.9`.
  - Dispose the geometry on change, as `TieredTree` did.

- [ ] **Step 2: Wire into `Scene.tsx`.** Replace the tiered imports and lines 846-852 with `twinedPlan(members, generations(members), TWINED_SLOT_ANGLE)` (memoised via the JSON string as today), `buildTwinedTree(plan, VIEW_FRONT)`, and the same `cardTop([x, TREE_BASE + y, z])` mapping into the `layout` map; render `<TwinedTree … />` in place of `<TieredTree … />`. Delete the three old files.

- [ ] **Step 3: Run** `cd ui && pnpm typecheck && pnpm lint && for f in app/*.check.mjs; do node "$f" || echo "FAIL $f"; done` — expected: no errors, no `FAIL`.

- [ ] **Step 4: Commit** (after approval): `feat(ui): rebuild the tiered tree as twined trunks`.

### Task 3: Look on localhost and update the overview

**Files:**
- Modify: `docs/project-overview.md:107-111`

- [ ] **Step 1: Run** `./start.sh`, open `http://localhost:3000` in the browser pane, open a tree, Evolution panel → "Ansichts-Labor" → Darstellung "Stufenbaum".
- [ ] **Step 2: Check the six sketch scenarios** (one person, couple, couple with kids, three generations, two families marry, second partner) with the test family tools or by adding members; screenshot each; check console for errors. Expected: strands visibly wind, trunk thickest at the ground, every card hangs free on its tier, oldest on top.
- [ ] **Step 3: Replace overview lines 107-111** with one sentence per line describing the twined tree: couples as braids of their own strands from the ground to their tier, childless partnerless children as twigs, trunk thickest at the ground, rebuilt when generations change, cards not draggable.
- [ ] **Step 4: Show the user the screenshots and the URL**, then commit after approval: `docs(repo): describe the twined tiered tree` (or fold into the Task 2 commit if the user prefers one commit).
