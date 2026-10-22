# Experimental View Circuit Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The experimental view draws its relation lines like a circuit diagram. It uses only right angles, every horizontal line has its own track, every junction is a T with a dot, and no line crosses or overlaps another. A checker proves this for fixtures and for hundreds of random families.

**Architecture:** A new pure pipeline in `ui/app/experimental/`:
- `model.ts` turns members into persons, unions and partnerships.
- `simpleLayout.ts` (existing) places names, with updated ordering rules.
- `routing.ts` assigns tracks per channel and emits segments, junctions, symbols and stubs.
- `verify.ts` checks the invariants and reads the relations back from the drawing.

`SimpleTree.tsx` renders the routes. The organic and tiered trees keep `relationLines` unchanged.

**Tech Stack:**
- TypeScript, run as `.mjs` check scripts with Node 26 (it imports `.ts` directly, see `ui/app/simpleLayout.check.mjs`).
- React Three Fiber / drei `Line` and `Html` for rendering.

**Spec:** `docs/superpowers/specs/2026-10-22-experimental-view-routing-design.md` (on branch `docs/repo-add-experimental-view-routing-design`, PR #150; a copy is in the SDD workspace).

## Global Constraints

- Only right angles. Vertical segments sit only at a person's x or a union node's x.
- Every horizontal segment gets a track by left-edge interval assignment, so overlapping segments never share a track. Parallel horizontals keep at least `MIN_TRACK = 0.3` apart.
- No point joins four segments. Every junction where three segments meet gets a dot.
- No segment crosses another. A link that cannot be drawn without crossing becomes a stub instead.
- Partnership symbols sit on the partnership line:
  - ⚭ for married and widowed.
  - ⚯ for together.
  - ⚮ for divorced.
  - No symbol for separated.
  - Separated and divorced lines are dashed. Widowed is solid.
- † precedes the name of every deceased person in the experimental view.
- Parent links:
  - A child hangs from the union of its biological parents in the tree.
  - Without biological parents in the tree, it hangs from the union of all its parents, drawn dotted.
  - A non-biological parent who is a partner of one of the drawn parents gets no extra line; the partnership line shows the step relation.
  - Any other non-biological parent becomes a stub.
- Co-parents of a child share a row like partners, even without a stored partnership.
- Union node:
  - Adjacent partners (nobody standing between them): the middle of their line.
  - Otherwise: straight below the outer partner, the one with fewer partners. On a tie, the one farther from the row's other members of the group.
  - A single parent: below that parent.
- Partner group order:
  - The person with several partners stands in the middle.
  - Partners with shared children stand outermost, at most one per side. The first by the existing `nearestFirst` order goes right, the second left.
  - Childless partners stand inside, between the person and the right outer partner, in `nearestFirst` order.
  - Further partners with children go beyond the right outer one; routing turns their crossing links into stubs.
- Sibling group: a child who married into a displayed family stands at the edge facing that family. There are at most two edges, left and right.
- Stub text: „▲ Eltern von <Vorname>“ / "▲ parents of <first name>". A click opens the first parent's profile.
- Test fixtures use synthetic people only, never names or dates from the developer's real families (AGENTS.md: identifying information is sensitive).
- Do not commit per task: stage only. One commit at the end, after the user approves the staged diff (AGENTS.md).
- PR title `feat(ui): route experimental view lines like a circuit diagram`. The branch `feat/ui-route-experimental-view-lines-like-a-circuit-diagram` is stacked on PR #151.

## Review Focus

- Kirsten case: a person with a separated partner with a child, a current childless partner, and a widowed partner with a child. Expected order: `sep | person | current | widowed`. Benjamin hangs straight below the separated partner and Michaela straight below the widowed one, with no crossing. Owner: Task 3, fixture in Task 4.
- A child with three parents (biological father without partnership, mother, stepfather who is the mother's partner): the child hangs under father+mother, the father stands in the mother's row, and the stepfather gets no extra line. Owner: Tasks 1 and 3.
- In-law ancestry on both edges of one sibling group (the Fridolin/Iris case with Oswald's parents added) draws without stubs. A third in-law family in the same group becomes a stub, not a crossing. Owner: Tasks 3 and 4.
- The focus highlight (open person panel) still marks exactly the lines to the relatives the panel lists. Owner: Task 5.
- Hiding lines ("Verbindungslinien" off) hides segments, dots, symbols and stubs. Owner: Task 5.

---

### Task 1: Model

**Files:**
- Create: `ui/app/experimental/model.ts`
- Test: `ui/app/experimental/model.check.mjs`

**Interfaces:**
- Produces:
```ts
export type Person = { id: string; firstName?: string; parentIds: string[]; partnerIds: string[];
  partnerships?: readonly { partnerId: string; status: string }[];
  parentLinks?: readonly { parentId: string; kind: string }[]; birthDate?: string | null; deathDate?: string | null };
export type Status = 'together' | 'married' | 'separated' | 'divorced' | 'widowed' | null; // null: co-parents without partnership
export type Union = { id: string; parents: string[]; children: string[]; dotted: boolean };
export type Partnership = { a: string; b: string; status: Status };
export type Hidden = { child: string; parent: string; reason: 'stepPartner' | 'stub' };
export type Model = { gen: Map<string, number>; unions: Union[]; partnerships: Partnership[]; hidden: Hidden[] };
export function buildModel(people: Person[]): Model;
```
`Union.id` is the sorted parent ids joined by `+`. `partnerships` holds every stored pair once (`a < b`), plus co-parent pairs of a two-parent union with `status: null`. `gen` comes from `generations()` (`ui/app/generations.ts`), called with partnerIds extended by co-parents, so co-parents share a row.

- [ ] **Step 1: Write failing checks** in `model.check.mjs`:
  - A couple with two children gives one union `a+b` with both children, not dotted.
  - Three parents (`f` biological without partnership, `m`, and `s` with kind `step`, who is `m`'s partner): the child is in union `f+m`. `hidden` contains `{child, parent: 's', reason: 'stepPartner'}`. `gen('f') === gen('m')`, and `partnerships` contains `{a:'f', b:'m', status:null}`.
  - A child with only adoptive parents `p+q` gets union `p+q` with `dotted: true`.
  - A step parent who is not a partner of a drawn parent → `hidden` has `reason: 'stub'`.
  - A child of one parent → union `p` (single).
  - Status mapping: a stored `widowed` pair → `status: 'widowed'`.
- [ ] **Step 2:** Run `node app/experimental/model.check.mjs` from `ui/`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `buildModel`. Missing `parentLinks` entries count as biological.
- [ ] **Step 4:** Run it again. Expected: exits 0.
- [ ] **Step 5:** Stage.

### Task 2: Routing and checker

**Files:**
- Create: `ui/app/experimental/routing.ts`, `ui/app/experimental/verify.ts`
- Test: `ui/app/experimental/route.check.mjs`

**Interfaces:**
- Consumes: `Model`, `buildModel` (Task 1); positions as `Map<string, [number, number]>` (x, y; rows `ROW_GAP` apart, from `simpleLayout`).
- Produces:
```ts
export type XY = [number, number];
export type Segment = { a: XY; b: XY; style: 'solid' | 'dashed' | 'dotted'; people: string[] }; // people: the persons this line connects (for focus)
export type Glyph = { at: XY; glyph: '⚭' | '⚯' | '⚮'; people: [string, string] };
export type Stub = { child: string; parents: string[]; at: XY };
export type Routes = { segments: Segment[]; junctions: XY[]; glyphs: Glyph[]; stubs: Stub[] };
export const NAME_W = 7, NAME_H = 1.6, NAME_CLEAR = 1.1, TRACK = 0.6, MIN_TRACK = 0.3;
export function route(model: Model, at: Map<string, XY>): Routes;
// verify.ts
export function verify(model: Model, at: Map<string, XY>, routes: Routes): string[]; // human-readable violations; [] = valid
```
- Channel between row y and the row below: from `y - NAME_CLEAR` down to `y - ROW_GAP + NAME_CLEAR`.
  - Partner tracks are numbered from the top.
  - Sibling-bar tracks are numbered from the bottom.
  - If the tracks do not fit at `TRACK`, compress the spacing evenly, but never below `MIN_TRACK`. If even that does not fit, record a violation.
- Partnership line: each partner drops from the name to the pair's track; the horizontal runs between them.
- Track order constraint:
  - A partnership line that spans another person's drop goes on a deeper track than where that drop ends.
  - Example: Kirsten–Helmut runs below Robert's drop, which ends on Kirsten–Robert's track.
- Union stem: a vertical from the union node on its partnership track down to its sibling-bar track. The children rise from the bar to their names.
  - A single child with the node at its own x gets one straight vertical and no bar.
- A union whose stem or bar would cross another segment:
  - Turn its children's links into stubs, placed just above each child.
  - Prefer stubbing the union whose parents form a root (in-law) family.
  - Repeat until there are no crossings.
- `verify` checks, each violation as a line of text:
  1. Every segment is horizontal or vertical.
  2. No collinear overlap. Parallel horizontals are at least `MIN_TRACK` apart where their x ranges overlap.
  3. No segment enters a name box (`NAME_W × NAME_H` around a position) other than its own endpoint's.
  4. No proper crossing, and no point with four segment ends or passes.
  5. Read-back: build a graph from the segments, joining segments at shared endpoints and at T-points.
     - Every union's parents and children must lie in one component that contains no other person.
     - Every partnership pair must be joined by a horizontal in the right style with the right glyph, or by no glyph for separated.
     - Every link in `hidden` with reason `stub`, and every stubbed union, must have a stub and no line.

- [ ] **Step 1: Write failing checks** in `route.check.mjs`, with hand-placed positions:
  - A couple with two children: `verify` returns `[]`; there is one ⚭ glyph; there are 2 junctions (stem top, bar middle).
  - The Kirsten case in order `S K R H` (S separated with child B, R together and childless, H widowed with child M):
    - `verify` returns `[]`.
    - B's vertical has `x === x(S)`, and M's vertical has `x === x(H)`.
    - The K–H horizontal lies deeper than the K–R horizontal.
    - The S–K line is dashed with no glyph. K–R has ⚯, and K–H has ⚭.
  - A deliberately bad position set (a third partner with children nested inside) gives stubs and no crossing, and `verify` returns `[]`.
  - A segment list with an injected crossing, given to `verify` directly, reports a crossing. An injected overlap reports an overlap. A missing child line reports a read-back error. Each violation class is tested.
- [ ] **Step 2:** Run `node app/experimental/route.check.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement `route` and `verify`.
- [ ] **Step 4:** Run it again. Expected: exits 0.
- [ ] **Step 5:** Stage.

### Task 3: Ordering rules in the layout

**Files:**
- Modify: `ui/app/simpleLayout.ts` (partner order `partnerOrder`/`nearestFirst`, union x for children via `meanX`, in-law edges, generations from the model)
- Modify: `ui/app/simpleLayout.check.mjs` (the scenarios whose expected order changes: 4–7, separated, current+former)

**Interfaces:**
- Consumes: `buildModel(...).gen` and `.unions` (Task 1).
- Produces: `simpleLayout(people, gen)` keeps its signature, so `SimpleTree` passes `buildModel(members).gen` instead of `generations(members)`. Positions follow the Global Constraints' ordering and union-node rules.

- [ ] **Step 1:** Update the scenario checks to the new rules:
  - Hub in the middle.
  - Partners with children outermost, one per side (first by `nearestFirst` on the right).
  - Childless partners inside on the right.
  - Children of a non-adjacent union straight below the outer partner; children of adjacent partners centred under the pair.
  - Add the three-parent case: the biological co-parent stands beside the mother.
  - Add the two-edge in-law case: siblings `x1 x2 x3 x4`, where `x1` married into a family placed left and `x4`'s partner has parents (a root family) placed right. `x1` stands leftmost and `x4` rightmost, and both in-law couples stand directly above the married-in partner.
- [ ] **Step 2:** Run `node app/simpleLayout.check.mjs`. Expected: FAIL on the changed scenarios.
- [ ] **Step 3:** Change the layout. Remove rules that only existed for the old line drawing; the routing now handles those cases. Examples: a separated outer partner stepping over a child alone, and a single-parent child joining the couple's bar. Keep the tidy-tree packing and the centring.
- [ ] **Step 4:** Run `node app/simpleLayout.check.mjs` and `node app/experimental/route.check.mjs`. Expected: both exit 0.
- [ ] **Step 5:** Stage.

### Task 4: Property check over fixtures and random families

**Files:**
- Create: `ui/app/experimental/families.check.mjs`
- Modify: `.github/workflows/ci.yml` (add `node app/experimental/model.check.mjs`, `route.check.mjs`, `families.check.mjs`, and the existing but missing `simpleLayout.check.mjs`)

**Interfaces:**
- Consumes: `buildModel`, `simpleLayout`, `route`, `verify`.

- [ ] **Step 1:** Write the checks:
  - Fixture A: a synthetic copy of the fam-schiller shape, with neutral ids and no real names or dates. It has 5 generations, a three-parent child with a step parent, a person with a separated, a current and a widowed partner, two in-law root families, a separated root couple with a child of one parent, and a single parent with a child.
    - `verify` returns `[]`, and there are 0 stubs.
  - Fixture A plus the parents of the partner who married in at the right edge (the Oswald case): `[]` and 0 stubs. Their couple stands directly above that partner.
  - Fixture A plus parents of a third married-in partner in the same sibling group: `[]`, and exactly that union is stubbed.
  - 500 random families from `seededRandom` (`ui/app/random.ts`), seeds 1..500:
    - 1–6 generations and 0–4 children per couple.
    - 20% of people get a second partner, and every status occurs.
    - 5% of children get a step or adoptive parent.
    - `verify` returns `[]` for every seed. Print the failing seed on error.
- [ ] **Step 2:** Run `node app/experimental/families.check.mjs`. Expected: violations show where Tasks 2–3 are incomplete. Fix them in `routing.ts`/`simpleLayout.ts` (owned code) until it exits 0.
- [ ] **Step 3:** Add the CI lines and run every check listed in `ci.yml` from `ui/`. Expected: all exit 0.
- [ ] **Step 4:** Stage.

### Task 5: Render

**Files:**
- Modify: `ui/app/SimpleTree.tsx` (use `buildModel` → `simpleLayout` → `route`; drop `relationLines`, `FORK` and the rings; draw segments, dots, glyphs and stubs; † before deceased names)
- Modify: `ui/app/globals.css` (glyph, dot and stub styles; remove `.simple-rings`)
- Modify: `ui/app/i18n.ts` (stub text de/en)

**Interfaces:**
- Consumes: `Routes` (Task 2).

- [ ] **Step 1:**
  - Group the segments by style into three drei `<Line segments>`:
    - solid: as today.
    - dashed: `dashSize 0.6`, `gapSize 0.5`.
    - dotted: `dashSize 0.12`, `gapSize 0.25`.
  - When a person is focused, draw the segments whose `people` include the focus and one of the relatives `ui/app/relatives.ts` lists in `FOCUS_COLOR` at width 3.
  - Draw junction dots as small `Html` or instanced circles of radius 0.18 in the line colour.
  - Draw glyphs as `Html` at `at`, offset 0.5 above the line.
  - Draw stubs as `Html` buttons that call `onOpen(parents[0])`.
  - When `showLines` is false, hide segments, dots, glyphs and stubs.
- [ ] **Step 2:** Run `pnpm --dir ui lint && pnpm --dir ui typecheck && pnpm --dir ui build`. Expected: pass.
- [ ] **Step 3:** Stage.

### Task 6: Overview and verification

**Files:**
- Modify: `docs/project-overview.md` ("Scene and camera" experimental-view lines; "Code Map")
- Add: this plan file

- [ ] **Step 1:** Replace the experimental-view sentences about forks, rings, dashed lines at family-bar height, and outer partners stepping over children with the new rules, one sentence per line:
  - tracks
  - T-junction dots
  - glyphs
  - dotted non-biological links
  - union node placement
  - partner and sibling order
  - stubs
  - the checker in CI

  Keep the sentences about rows, centring, packing and in-laws that still hold.
- [ ] **Step 2:** Run all CI checks (`./gradlew build` is unaffected; skip it unless BFF files changed), plus `pnpm lint/typecheck/build`.
- [ ] **Step 3:** The controller restarts `./start.sh`, checks fam-schiller in the browser (Kirsten, Horst Behrendt, the Schiller children), opens the diff pane, gives the review URLs, and asks for commit approval.
