# Night watch over the tiered tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At night the Stufenbaum's clearing looks like image D: a dark blue sky, gold scars that glow with the sun's altitude and breathe, a warm light at the trunk's foot, the moon behind the tree setting a cool edge, and fireflies over the grass, each part chosen by the user from lab variants.

**Architecture:** `ui/app/sky.ts` gets the pure night clock (`nightGlow`, `nightSky`, `breathing`, `moonPosition`), checked by `sky.check.mjs`. `DaySky` in `Scene.tsx` takes an optional `night` prop, set only under `organicExperimental`, which brings the night dome (`NightDome.tsx`, also drawn into the environment cube), the night haze, the moon on its new path and its light; the gold's glow and the moon edge are uniforms in `barkShader.ts`; the trunk light is a point light in `Scene.tsx`; fireflies are `Fireflies.tsx`. `useNightLab()` (`nightLab.ts`) keeps the open stage's variants under `ftree.night`.

**Tech Stack:** three 0.187, @react-three/fiber 9, @react-three/drei (`Sky`, `Stars`, `Environment`), @react-three/postprocessing (bloom threshold 3), TypeScript, `node app/*.check.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-17-night-watch-design.md`

## Setup

- Branch `feat/ui-let-the-tiered-tree-keep-night-watch` lives in the worktree `.claude/worktrees/nachtwache` (other sessions share the main checkout; never switch its branch).
- `pnpm --dir ui install` in the worktree; the main checkout's stack keeps running; restart it once from the main checkout with `APP_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001 ./restart.sh`, then run the worktree's UI with `pnpm --dir ui dev -p 3001` (background); review URL `http://localhost:3001`. Stop that UI at the end yourself.

## Global Constraints

- Only `organicExperimental` (Stufenbaum) changes; the organic tree ("3D"), GRID and the landing look as before, at noon and at night.
- Every stage starts with 2–3 variants in the lab group "Nachtwache"; screenshots set by the sun's altitude with the lab clock: start view at 3°, 9° and ≥ 18° below the horizon, a close view of the trunk's foot (about 25 m) at night, one card close up at night; the user picks; after the pick the losing variants and the stage's controls are deleted and the chosen values become constants.
- Commit only after the user approved the staged diff; one commit per stage; no pull request unless the user asks.
- No light is mounted or unmounted with the time of day: new lights stay mounted under `organicExperimental` and fade to intensity 0.
- At least 50 frames per second in the start view at post tier high on an M1 laptop; every stage reports its variants' frame rate against the frame rate before the stage, in the same browser; medium tier gets half the fireflies.
- By day the gold has no emission, with or without "Nachbearbeitung".
- Names on the cards stay as readable at night as before part 4.
- Commit messages lowercase, imperative, `feat(ui): …`; `docs/project-overview.md` one sentence per line, new lines only, in the tiered tree's section and "Sky and time of day".
- Before pushing: `git fetch origin && git rebase origin/main`, then `pnpm --dir ui typecheck && pnpm --dir ui lint` and every `ui/app/*.check.mjs`.

## Review Focus

- Sweeping the lab clock through twilight: no stutter, no shader recompiles. Task 3, Step 5 compares `gl.info.programs.length` before and after a sweep from 15:30 to 18:00.
- Switching Stufenbaum → "3D" at night: no dome, today's brownish sky, haze and moon, and no stale environment cube. Task 1, Step 6 screenshots "3D" at night before and after.
- A location far north (Tromsø, 69.6° N): in June the sun never sets, so no moon and no glow; in December it never rises, so the gold glows all day (about half at noon, when the sun stands about 3° below). Task 4, Step 1 checks `moonPosition` and `nightGlow` there for NaN and for the hidden moon.
- "Nachbearbeitung" off and post tier medium: glow, trunk light and fireflies still show, without a halo, nothing blown out. Task 2, Step 6 and Task 5, Step 5 add screenshots with post effects off.
- "Wachstum abspielen" at night: growing strands glow as their gold appears, the frame rate holds. Task 2, Step 6.

---

### Task 1: Night clock and night sky (stage 1)

**Files:**
- Modify: `ui/app/sky.ts`, `ui/app/sky.check.mjs`, `ui/app/Scene.tsx` (`DaySky`, `SkyEnvironment`, lab group), `ui/app/i18n.ts` (DE/EN labels)
- Create: `ui/app/nightLab.ts`, `ui/app/NightDome.tsx`

**Interfaces:**
- Produces in `sky.ts`:
  - `export const nightGlow = (altitude: number) => 1 - smoothstep(-6 * RAD, 0, altitude)`
  - `export function nightSky(altitude: number, from = -3 * RAD, to = -12 * RAD): number` – 0 above `from`, 1 below `to`, smoothstep between
  - `export const breathing = (t: number, amplitude: number, period: number, phase = 0) => 1 + amplitude * Math.sin((2 * Math.PI * t) / period + phase)`
- Produces in `nightLab.ts`: `export function useNightLab(): [NightLab, (next: Partial<NightLab>) => void]`, JSON under `ftree.night`, the `useStoredSwitch` pattern (`useSyncExternalStore` on `onStorage`, a `StorageEvent` for this tab); stage 1 fields `{ sky: 'goal' | 'deep' | 'moonlit'; skyFrom: number; skyTo: number }` (degrees, default `goal`, −3, −12); later tasks add fields.
- Produces in `NightDome.tsx`: `<NightDome opacity zenith horizon moon />` – `opacity: number`, `zenith`, `horizon: string`, `moon: [number, number, number]` (unit vector); a sphere of radius 450 (inside drei's sky box of size 1000) with `side: BackSide`, `transparent`, `depthWrite: false`, `fog: false`, `renderOrder: -1` so stars, moon and sun disc (transparent, order 0) draw over it.
- Produces in `Scene.tsx`: `DaySky` prop `night?: { zenith: string; horizon: string; from: number; to: number }`; when set: the dome at `nightSky(altitude, from, to)`, `NIGHT.haze` replaced by `horizon` and the hemisphere's night colours retuned so ring trees read dark blue, the dome inside `SkyEnvironment`'s children; `SkyEnvironment`'s key gets the variant and the dome's opacity rounded to 0.05.

- [ ] **Step 1: Write the failing checks** in `sky.check.mjs`:

```js
for (let a = -20; a < 20; a++) assert.ok(nightGlow(rad(a + 1)) <= nightGlow(rad(a)) && nightSky(rad(a + 1)) <= nightSky(rad(a)));
for (const a of [0, 0.01, 5, 30, 60]) assert.equal(nightGlow(rad(a)), 0);
for (const a of [-6, -7, -40]) assert.equal(nightGlow(rad(a)), 1);
assert.equal(nightSky(rad(-2)), 0);
assert.equal(nightSky(rad(-12)), 1);
assert.equal(nightSky(rad(-5), rad(-4), rad(-10)) > 0, true);
assert.equal(breathing(0, 0.12, 7), 1);
assert.ok(Math.abs(breathing(7 / 4, 0.12, 7) - 1.12) < 1e-9);
```

- [ ] **Step 2: Run** `cd ui && node app/sky.check.mjs` – Expected: fails, `nightGlow` is not exported.
- [ ] **Step 3: Implement** the three functions, `useNightLab`, `NightDome` (vertical gradient zenith → horizon by the view direction's height, a lighter band in the last few degrees above the horizon, a wide soft lightening around `moon`) and `DaySky`'s `night` prop; `Scene.tsx` passes `night` only when `tiered`.
- [ ] **Step 4: Lab group** "Nachtwache" in "Ansichts-Labor", only while `appearance === 'organicExperimental'`: a select "Nachthimmel" / "Night sky" with V1 "Zielbild" (`#162238` → `#1d2c43`), V2 "Tiefe Nacht" (`#080c18` → `#141c2e`), V3 "Mondhell" (`#1f2f50` → `#3a4c6e`), and two sliders for the dome's start and end (sun altitude, −1° to −16°).
- [ ] **Step 5: Calibrate:** with the lab clock at ≥ 18° below the horizon, read the canvas pixels at the top centre and just above the ring's tops (`preserveDrawingBuffer` is on, so `gl.readPixels` or a 2D copy of the canvas works) and tune each variant's dome colours until the screen shows the spec's colours within about 8 per channel.
- [ ] **Step 6: Run** `node app/sky.check.mjs`, `pnpm --dir ui typecheck && pnpm --dir ui lint`; record the start view's frame rate before and after; screenshots per variant (3°, 9°, ≥ 18° below, close view, card close up) and "3D" at night before and after; send them, ask for the pick.
- [ ] **Step 7: After the pick:** the chosen colours and fade become constants in `sky.ts` (`NIGHT_SKY = { zenith, horizon, from, to }`), the select and sliders go, `nightLab.ts` keeps only what later stages need; new lines in `docs/project-overview.md`; re-run Step 6's checks; show the staged diff with spec and plan; commit after approval: `feat(ui): turn the night over the tiered tree deep blue`.

### Task 2: Gold glow (stage 2)

**Files:**
- Modify: `ui/app/barkShader.ts`, `ui/app/Scene.tsx`, `ui/app/nightLab.ts`, `ui/app/i18n.ts`, `docs/project-overview.md`

**Interfaces:**
- Consumes: `nightGlow`, `breathing` (Task 1).
- Produces in `barkShader.ts`: `export const GLOW = { uGlow: { value: 0 }, uTime: { value: 0 }, uBreathAmp: { value: 0.12 }, uBreathPeriod: { value: 7 }, uWave: { value: 0 } }`, merged into every bark shader's uniforms by `patchBark` (one tree at a time, like `WIND` in `ClearingGround.tsx`); the emission line becomes `goldTex · gold · uGlow · (1 + uBreathAmp · sin(2π · uTime / uBreathPeriod − uWave · 2π · vBarkPos.y / 20))`, so with "Welle" one breath climbs 20 m of trunk per period.
- `Scene.tsx` sets, once per frame, `GLOW.uGlow.value = tiered ? nightGlow(altitude) · strength : 0` and `GLOW.uTime.value = clock.elapsedTime`.
- `NightLab` gains `{ glow: 'goal' | 'glimmer' | 'lantern'; wave: boolean }`.

- [ ] **Step 1: Remove** the constant `gold * 0.3` emission and add `GLOW`; by day `uGlow` is 0 for every appearance.
- [ ] **Step 2: Lab:** select "Glühen" / "Glow": V1 "Zielbild" (strength 4, ±12 %, 7 s), V2 "Glimmen" (2, ±8 %, 9 s), V3 "Laterne" (8, ±15 %, 6 s); select "Atmen" / "Breathing": "im Gleichtakt" / "Welle".
- [ ] **Step 3: Run** `pnpm --dir ui typecheck && pnpm --dir ui lint`, `node app/twinedForm.check.mjs && node app/twinedGrowth.check.mjs`.
- [ ] **Step 4: Check the day:** noon screenshot with post effects on and off; the gold shows no glow (compare a crop of a scar with and without the stage, the emission is gone).
- [ ] **Step 5: Frame rate** before and after, start view, high tier.
- [ ] **Step 6: Screenshots** per variant and breathing mode as in the Global Constraints, one night shot with "Nachbearbeitung" off, and one during "Wachstum abspielen" at night; send them, ask for the pick.
- [ ] **Step 7: After the pick:** constants `GOLD_GLOW = { strength, amplitude, period, wave }` in `sky.ts`, controls go, overview lines, staged diff, commit after approval: `feat(ui): let the gold scars glow after sunset`.

### Task 3: Light at the trunk (stage 3)

**Files:**
- Modify: `ui/app/Scene.tsx`, `ui/app/nightLab.ts`, `ui/app/i18n.ts`, `docs/project-overview.md`

**Interfaces:**
- Consumes: `nightGlow`, `breathing`, `GOLD_GLOW` (Tasks 1–2).
- Produces: under `tiered` a `<pointLight>` at `[0, TREE_BASE + 1.5, 0]`, `castShadow={false}`, `decay={2}`, `distance` = the variant's range, always mounted; its intensity set in `useFrame` through a ref to `nightGlow(altitude) · breathing(t, GOLD_GLOW.amplitude, GOLD_GLOW.period) · strength`.
- `NightLab` gains `{ trunk: 'goal' | 'wide' | 'near' }`.

- [ ] **Step 1: Implement** the light and the lab select "Licht am Stamm" / "Trunk light": V1 "Zielbild" (`#ffa850`, 12 m), V2 "Weit und schwach" (`#ffa850`, 25 m), V3 "Nah und stark" (`#ff9440`, 6 m); each variant's strength calibrated so its look matches the spec's words (V1: the lit ground about 5 m from the trunk reads close to image D's `#7c5729` on screen).
- [ ] **Step 2: Run** typecheck and lint.
- [ ] **Step 3: Frame rate** before and after, start view, high tier. If the light costs more than 3 frames per second, build the spec's fallback (a light pool in the ground's and the grass's shaders) as a fourth lab variant "Gemalt" and show both.
- [ ] **Step 4: Screenshots** per variant as in the Global Constraints; send, ask for the pick.
- [ ] **Step 5: No stutter at dusk:** in the browser, read `gl.info.programs.length` (through the canvas's R3F root), sweep the lab clock from 15:30 to 18:00 with the arrow keys, read it again; Expected: unchanged, and no frame-rate drop in the sweep.
- [ ] **Step 6: After the pick:** constant `TRUNK_LIGHT = { color, range, strength }` in `sky.ts`, controls go, overview lines, staged diff, commit after approval: `feat(ui): light the ground at the trunk's foot at night`.

### Task 4: Moon behind the tree (stage 4)

**Files:**
- Modify: `ui/app/sky.ts` (`sunPosition` also returns `declination`), `ui/app/sky.check.mjs`, `ui/app/barkShader.ts`, `ui/app/Scene.tsx` (`DaySky`), `ui/app/nightLab.ts`, `ui/app/i18n.ts`, `docs/project-overview.md`

**Interfaces:**
- Produces in `sky.ts`: `export function moonPosition(sun: { altitude: number; azimuth: number; declination: number }, latitude: number, span: number, highest: number): { altitude: number; azimuth: number }` (radians, `latitude` too):
  - `azimuth = span · wrap(sun.azimuth + π)`, `wrap` into (−π, π]
  - `lowest = |latitude + declination| − π/2` (the sun's lowest altitude that night); if `lowest ≥ 0` (the sun never sets) the moon is below the horizon (`altitude = −π/2`); otherwise `altitude = highest · sin(−sun.altitude) / sin(−lowest)`
- `DaySky`'s `night` prop gains `{ span, highest, moonLight, edge }`; with it, the moon disc, its halo, the dome's moon patch and the moon's directional light (from the disc's direction, at least `MIN_LIGHT_ALTITUDE`, intensity `moonLight · (1 − day)`) use `moonPosition`; without it, today's moon.
- Produces in `barkShader.ts`: `export const MOON_EDGE = { uMoonEdge: { value: 0 }, uMoonDir: { value: new Vector3() }, uMoonColor: { value: new Color('#9fb4ff') } }`, merged like `GLOW`; `Scene.tsx` sets `uMoonEdge = edge · (1 − daylight)` and `uMoonDir` (world) per frame.
- `NightLab` gains `{ moon: 'goal' | 'flat' | 'wide'; edge: 'light' | 'edge' | 'strong'; moonLight: number }`.

- [ ] **Step 1: Write the failing checks** in `sky.check.mjs` for Berlin on 2026-11-17 and 2026-06-21, and Tromsø (69.65° N, 18.96° E) on 2026-06-21 and 2026-12-21, every 10 minutes over a day, with `span = 0.35`, `highest = rad(25)`:
  - while the sun is below −6°: `|azimuth| ≤ 0.35 · π + 1e-9`, consecutive azimuths differ by less than `rad(3)` (continuous through midnight), azimuth < 0 in the evening and > 0 in the morning;
  - the largest altitude over the Berlin nights is within `rad(0.5)` of `rad(25)`; `altitude ≤ 0` while the sun is up;
  - Tromsø in June: never a moon above the horizon, no `NaN`; Tromsø in December: `nightGlow` is above 0 all day and 1 at midnight.
- [ ] **Step 2: Run** `node app/sky.check.mjs` – Expected: fails, `moonPosition` is not exported.
- [ ] **Step 3: Implement** `declination` in `sunPosition` (it already computes `dec`), `moonPosition`, `DaySky`'s moon under `night`, and the edge term in the bark shader (left to the builder in GLSL: a rim from `1 − |dot(normal, view)|`, weighted by how much the world normal faces `uMoonDir`, added to `totalEmissiveRadiance` in `uMoonColor`).
- [ ] **Step 4: Lab:** select "Mondbahn" / "Moon path": V1 "Zielbild" (0.35, 25°), V2 "Flach" (0.35, 17°), V3 "Weit" (0.5, 30°); select "Mondkante" / "Moon edge": "Nur Mondlicht", "Kante", "Kante stark"; slider "Mondlicht" 1 to 4 (default 1.5).
- [ ] **Step 5: Run** `node app/sky.check.mjs`, typecheck, lint; frame rate before and after.
- [ ] **Step 6: Screenshots** per path and edge at early night (sun about 18° below, the moon low on the left) and at the deepest point of the night, plus the close view and a card; send, ask for the pick.
- [ ] **Step 7: After the pick:** constants `MOON = { span, highest, light, edge }` in `sky.ts`, controls go, overview lines (the moon's line in "Sky and time of day" gets a new line for the Stufenbaum), staged diff, commit after approval: `feat(ui): set the moon behind the tiered tree`.

### Task 5: Fireflies (stage 5)

**Files:**
- Create: `ui/app/Fireflies.tsx`
- Modify: `ui/app/clearing.ts`, `ui/app/clearing.check.mjs`, `ui/app/HangingCard.tsx` (export the orb glow texture), `ui/app/Scene.tsx`, `ui/app/nightLab.ts`, `ui/app/i18n.ts`, `docs/project-overview.md`

**Interfaces:**
- Produces in `clearing.ts`: `export function fireflySpots(count: number, radius: number): [number, number][]` – seeded (`seededRandom`), every spot more than 4 m from the trunk and more than 3 m inside `radius` (the ring), denser around the hill's foot (`HILL.foot`) and the ring's edge.
- Produces in `HangingCard.tsx`: `export const glowTexture`.
- Produces: `<Fireflies count color blink heightAt radius tier glow />` – one `InstancedMesh` of camera-facing quads with `glowTexture()`, `AdditiveBlending`, `depthWrite: false`, `fog: false`, `toneMapped: false`, brightness times `useGlowGain()`; per instance a base point (`heightAt` + 0.2 to 2 m), a phase and a speed as attributes; the vertex shader wanders each one about 0.3 m/s around its base and faces the camera; `glow` (= `nightGlow`) is the opacity uniform; medium tier draws half.
- `NightLab` gains `{ fireflies: 'goal' | 'few' | 'green'; blink: boolean }`.

- [ ] **Step 1: Write the failing checks** in `clearing.check.mjs`: `fireflySpots(200, 70)` is deterministic (two calls equal), every spot has `4 < r < 67`, and the spots per square metre within 5 m of `HILL.foot` outnumber those between r = 10 and r = 20.
- [ ] **Step 2: Run** `node app/clearing.check.mjs` – Expected: fails, `fireflySpots` is not exported.
- [ ] **Step 3: Implement** `fireflySpots`, `Fireflies.tsx` ("Glimmen": brightness between half and full over 3 to 5 s per firefly; "Blinken": flashes of about 0.4 s every 2 to 6 s), and mount it under `tiered` (always mounted; opacity 0 by day).
- [ ] **Step 4: Lab:** select "Glühwürmchen" / "Fireflies": V1 "Zielbild" (200, `#fff2cc`, over the clearing), V2 "Wenige" (80, `#fff2cc`, only around the hill's foot), V3 "Grünlich" (200, `#d8f07a`); select "Licht": "Glimmen" / "Blinken".
- [ ] **Step 5: Run** `node app/clearing.check.mjs`, typecheck, lint; frame rate before and after at high and medium tier; screenshots as in the Global Constraints plus one with "Nachbearbeitung" off; send, ask for the pick.
- [ ] **Step 6: After the pick:** constants `FIREFLIES = { count, color, blink, near }` in `clearing.ts`, controls and `nightLab.ts` go (no stage left), overview lines, staged diff, commit after approval: `feat(ui): let fireflies fly over the clearing at night`.

### Task 6: Whole-branch check

**Files:**
- Modify: `docs/design/visions/README.md` (line "4. Night watch" → done, with a link to the spec), the spec's "Changes while building"

- [ ] **Step 1: Acceptance screenshots:** Stufenbaum at noon, 3°, 9° and ≥ 18° below, and the deepest point of the night; "3D", GRID and the landing at noon and at night, compared with the screenshots from before Task 1 (Smith-Vorschau).
- [ ] **Step 2: Frame rate** of the finished night against the frame rate before Task 1, start view, high tier; no stutter during a dusk sweep and during "Wachstum abspielen".
- [ ] **Step 3: Run** `git fetch origin && git rebase origin/main`, `pnpm --dir ui typecheck && pnpm --dir ui lint`, every `node app/*.check.mjs`.
- [ ] **Step 4: Review:** a fresh reviewer reads the whole branch against the spec; fix what it finds.
- [ ] **Step 5:** staged diff of the docs, commit after approval: `docs(repo): mark the night watch done`; push after the user's go; stop the UI on port 3001.
