# Light and Image of the 3D Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The 3D appearances get sky reflections, ambient occlusion, bloom, AgX tone mapping, a vignette and denser haze, while relation lines and TRON look exactly as before.

**Architecture:** A new `PostEffects.tsx` holds the effect composer, its two quality tiers, and an overlay pass that draws relation lines after the effects. `DaySky` in `Scene.tsx` renders a small copy of its sky into an environment cube that is rebuilt only when the sun has moved half a degree. Pure helpers for the environment and the tiers live in `sky.ts` and `postEffects.ts` and are covered by `node` checks.

**Tech Stack:** Next.js 16, React 19, @react-three/fiber 9, drei 10, three 0.187, new: `@react-three/postprocessing` ^3.2.2 with `postprocessing` ^6.39.6 (brings `n8ao`).

**Spec:** `docs/superpowers/specs/2026-11-16-scene-light-and-post-design.md`
**Changes while building:** see the spec's section of that name; where this plan says AgX, `PostEffects.tsx` or removing the exposure, the spec's changes apply.

## Global Constraints

- Effects only in the 3D appearances (`organic`, `organicExperimental`, the example family); the TRON branch (`experimental` in `Scene.tsx`) keeps today's pipeline and ACES tone mapping.
- `toneMappingExposure: 0.6` goes; brightness is calibrated with light intensities and `environmentIntensity`, never with exposure.
- Relation lines keep their exact token colours: no tone mapping, no haze, no bloom.
- Two tiers: **high** = N8AO + bloom + multisampling 4; **medium** = bloom, no AO, no multisampling. Fine pointers start high, coarse pointers medium.
- Lab checkbox "Nachbearbeitung" / "Post effects", on by default, stored per browser as `ftree.post`.
- The environment cube is never rendered every frame; it is rebuilt when the sun moved more than 0.5°.
- No commit without the user's approval of the staged diff and message (AGENTS.md); this plan commits once, at the end.
- Docs: `docs/project-overview.md` one sentence per line, new behaviour as new lines in the matching section.

## Review Focus

- Switching 3D → GRID → 3D while the scene runs: TRON must come back with ACES and unchanged colours, 3D with effects; no leftover `NoToneMapping`. (Task 2, Step 7)
- "Momentaufnahme" (html-to-image reads the canvas): the image must contain the effects and the lines, also right after toggling the checkbox. (Task 2, Step 8)
- Resizing the window or moving it to a screen with another pixel ratio: AO must not smear, lines must keep their width. (Task 2, Step 9)
- Scrubbing the time preview through a whole day: no black or flickering frames, GPU textures stay bounded. (Task 3, Step 6)
- A selected card, the own card and dimmed cards under the spotlight: halos stay amber, names stay as readable as before. (Task 3, Step 7)

---

### Task 1: Baseline and pure helpers

**Files:**
- Modify: `ui/app/sky.ts` (append two helpers)
- Modify: `ui/app/sky.check.mjs` (append assertions)
- Create: `ui/app/postEffects.ts`
- Create: `ui/app/postEffects.check.mjs`

**Interfaces:**
- Produces: `environmentIntensity(altitude: number): number` and `environmentKey(altitude: number, azimuth: number): string` in `sky.ts`; `type PostTier = 'high' | 'medium'`, `startTier(coarsePointer: boolean): PostTier`, `POST_KEY = 'ftree.post'` in `postEffects.ts` (no React imports, so `node` can load it).

- [x] **Step 1: Capture the baseline**

Run `./start.sh`, open `http://localhost:3000`, sign in as the local developer, open a family with at least three generations.
In the Evolution panel tick "Uhrzeit vorschauen" and take screenshots at 12:00, 15:30, 16:35 and 22:00 (on 2026-11-16 at the fallback location these are about 20°, 5°, −4° and −52° sun altitude) for: appearance "3D", appearance "Stufenbaum", and `/home/example`. Add one GRID screenshot. Keep them for Task 3.

- [x] **Step 2: Write the failing checks**

Append to `sky.check.mjs`:

```js
import { environmentIntensity, environmentKey } from './sky.ts';
const rad = (d) => (d * Math.PI) / 180;
assert.equal(environmentIntensity(rad(30)), 1);
assert.ok(Math.abs(environmentIntensity(rad(-20)) - 0.12) < 1e-9);
for (let d = -10; d < 10; d++) assert.ok(environmentIntensity(rad(d + 1)) >= environmentIntensity(rad(d)));
assert.equal(environmentKey(rad(10.1), rad(40.1)), environmentKey(rad(10.2), rad(40.2)));
assert.notEqual(environmentKey(rad(10.0), rad(40)), environmentKey(rad(10.6), rad(40)));
assert.notEqual(environmentKey(rad(10), rad(40.0)), environmentKey(rad(10), rad(40.6)));
```

Create `postEffects.check.mjs` (header comment `// Run with \`node app/postEffects.check.mjs\`: …` like the other checks):

```js
import assert from 'node:assert/strict';
import { POST_KEY, startTier } from './postEffects.ts';
assert.equal(startTier(false), 'high');
assert.equal(startTier(true), 'medium');
assert.equal(POST_KEY, 'ftree.post');
```

- [x] **Step 3: Run them to see them fail**

Run: `cd ui && node app/sky.check.mjs; node app/postEffects.check.mjs`
Expected: both fail on the missing exports.

- [x] **Step 4: Implement the helpers**

`environmentIntensity`: `NIGHT_ENVIRONMENT + (1 - NIGHT_ENVIRONMENT) * daylight(altitude)` with `const NIGHT_ENVIRONMENT = 0.12`.
`environmentKey`: both angles in degrees, rounded to steps of 0.5°, joined as `"<alt>:<az>"`.
`startTier`: `coarsePointer ? 'medium' : 'high'`. One comment line each, in the file's style.

- [x] **Step 5: Run them to see them pass**

Run: `cd ui && node app/sky.check.mjs && node app/postEffects.check.mjs`
Expected: no output, exit code 0.

### Task 2: Effect pipeline, overlay for lines, lab checkbox

**Files:**
- Modify: `ui/package.json`, `ui/pnpm-lock.yaml` (via `pnpm`)
- Create: `ui/app/PostEffects.tsx`
- Modify: `ui/app/lines.ts` (export `useStoredSwitch`)
- Modify: `ui/app/Scene.tsx` (`Canvas` props around line 990, `Scrolls` lines around 719–725, Evolution "Ansichts-Labor" section around 1085)
- Modify: `ui/app/i18n.ts` (`tools.postEffects` in English near line 222 and German near line 1132)

**Interfaces:**
- Consumes: `PostTier`, `startTier`, `POST_KEY` (Task 1).
- Produces, all in `PostEffects.tsx`:
  - `usePostEffects(): readonly [boolean, (next: boolean) => void]` – `useStoredSwitch(POST_KEY, true)`.
  - `PostEffects({ start }: { start: PostTier })` – owns the tier state, `<PerformanceMonitor onDecline={→ 'medium'} onIncline={→ start}>`, and the composer.
  - `Overlay({ children }: { children: ReactNode })` – portal into its own `Scene`, drawn after the composer.
  - `RendererToneMapping({ mapping }: { mapping: ToneMapping })` – sets `gl.toneMapping` while mounted.

- [x] **Step 1: Add the dependency**

Run: `pnpm --dir ui add @react-three/postprocessing@^3.2.2 postprocessing@^6.39.6`
Expected: both appear in `ui/package.json` dependencies; `pnpm --dir ui typecheck` still passes.

- [x] **Step 2: Write `PostEffects.tsx`**

Composer: `<EffectComposer frameBufferType={HalfFloatType} multisampling={tier === 'high' ? 4 : 0}>` with, in order, `N8AO` (high only; `halfRes`, start at `aoRadius={2}`, `intensity={2}`), `Bloom` (`mipmapBlur`, start at `luminanceThreshold={1}`, `intensity={0.6}`), `ToneMapping` (`mode={ToneMappingMode.AGX}`), `Vignette` (start at `offset={0.3}`, `darkness={0.45}`).
Build the two tiers as two separate composer trees keyed by tier, since the composer takes no `false` children.
`Overlay`: `const scene = useMemo(() => new Scene(), [])`; return `createPortal(children, scene)`; in `useFrame(…, 2)` set `gl.autoClear = false`, `gl.clearDepth()`, `gl.render(scene, camera)`, then restore `gl.autoClear = true`. Priority 2 runs after the composer's render at priority 1.
`RendererToneMapping`: `useThree((s) => s.gl)`; in an effect set `gl.toneMapping = mapping` and restore the previous value on cleanup.

- [x] **Step 3: Wire it into `Scene.tsx`**

- `Canvas`: `gl={{ preserveDrawingBuffer: true }}`; delete the exposure comment.
- `const [postOn, setPostOn] = usePostEffects(); const post = postOn && !experimental;`
- `start` tier: state initialised to `'high'`, set once in a mount effect from `startTier(matchMedia('(pointer: coarse)').matches)`.
- Inside the `Canvas`: `{post ? <PostEffects start={start} /> : <RendererToneMapping mapping={experimental ? ACESFilmicToneMapping : AgXToneMapping} />}`.
- `Scrolls` gets `overlayLines: boolean` (pass `post`); when true, its three relation `<Line>` elements render inside `<Overlay>`, otherwise where they are today.

- [x] **Step 4: Add the lab checkbox**

In "Ansichts-Labor", after the growth button: a `debug-check` label with a checkbox bound to `postOn`/`setPostOn`, `disabled={experimental}`, text `t.tools.postEffects` ("Post effects" / "Nachbearbeitung").

- [x] **Step 5: Static checks**

Run: `pnpm --dir ui typecheck && pnpm --dir ui lint`
Expected: both pass.

- [x] **Step 6: Look at it**

Reload `http://localhost:3000`. Expected: in 3D, darker contact zones under roots and cards, a halo around the light orbs at 22:00; with "Nachbearbeitung" off, no AO, no halo, colours close to the baseline.

- [x] **Step 7: Appearance round trip (Review Focus)**

Switch 3D → GRID → 3D. Expected: the GRID screenshot matches the Task 1 GRID baseline (same colours, no washed-out or darker grid); 3D shows effects again.

- [x] **Step 8: Lines and snapshot (Review Focus)**

Select a person so their lines light up. In the page, count canvas pixels within ±3 per channel of the `--line-on` token (from `canvas.toDataURL()`, drawn into a 2D canvas) with the checkbox on and off. Expected: the counts differ by less than 10 %. Toggle the checkbox and check again right after. This is the data "Momentaufnahme" uses.

- [x] **Step 9: Resize (Review Focus)**

Resize the browser pane to the mobile preset and back. Expected: lines keep their pixel width, AO stays sharp at contact edges, no stretched frame.

### Task 3: Environment light, calibration, gold

**Files:**
- Modify: `ui/app/Scene.tsx` (`DaySky`, around lines 424–480)
- Modify: `ui/app/TwinedTree.tsx` (`growingBark`, `metalness` and its comment)

**Interfaces:**
- Consumes: `environmentIntensity`, `environmentKey` (Task 1).

- [x] **Step 1: Environment cube**

In `DaySky`, extract the visible sky's props into `const SKY = { turbidity: 10, rayleigh: 3, mieCoefficient: 0.006, mieDirectionalG: 0.9 }` and add
`<Environment key={environmentKey(skyAltitude, azimuth)} resolution={64} frames={1} background={false} environmentIntensity={environmentIntensity(altitude)}><Sky sunPosition={sun} {...SKY} /></Environment>`,
where `skyAltitude` is the altitude already used for `sun` (twilight-raised) and `altitude` the real one.

- [x] **Step 2: Lights and haze, start values**

Hemisphere light `intensity={0.5 - 0.3 * day}`; haze density `0.0016` (from `0.0009`); sun `5 * day` and moon `1.5 * (1 - day)` stay as start values.

- [x] **Step 3: Gold is metal**

`growingBark`: `metalness: 1` (the gold map's blue channel keeps bark at 0); rewrite the comment above it: the gold is metal now that the scene has an environment, and glows only faintly.

- [x] **Step 4: Calibrate**

Take the twelve 3D screenshots of Task 1, Step 1 again and compare them with the baseline. Tune hemisphere, sun, moon, haze density, the `NIGHT`/`DUSK`/`NOON` haze colours, bloom and AO until the light orbs and the moon have a soft halo without flooding the frame, and until: noon is not brighter than the baseline sky, the sun side and the shade side differ clearly, the meadow fades into haze before the horizon, the gold on the Stufenbaum shows sky reflections, and night is dark blue, not grey.

- [x] **Step 5: Static checks**

Run: `pnpm --dir ui typecheck && pnpm --dir ui lint`
Expected: both pass.

- [x] **Step 6: Scrub the day (Review Focus)**

Note `performance.memory.usedJSHeapSize` in the page, drag the time preview once around the full clock, note it again after a few seconds. Expected: no black or flickering frame while dragging, the heap is back within 10 % of where it started.

- [x] **Step 7: Cards under the new light (Review Focus)**

Select a person (spotlight), look at the own card and a dimmed card at 12:00 and 22:00. Expected: the selected halo is amber, the own card's halo is amber, names on dimmed cards are as readable as in the baseline; if not, tune their halo opacity or emissive in `HangingCard.tsx`.

### Task 4: Docs, CI, measurement, commit

**Files:**
- Modify: `docs/project-overview.md` ("Sky and time of day", "Debug panel")
- Modify: `docs/design/blender/README.md` (line 47)
- Modify: `.github/workflows/ci.yml` (check list, around lines 116–155)

- [x] **Step 1: Overview lines**

Add to "Sky and time of day":
- In the 3D appearances a small copy of the sky is rendered into an environment cube whenever the sun has moved half a degree, so metal reflects the sky and surfaces get sky light from above; at night it fades to a low level.
- The 3D appearances draw through post effects (`ui/app/PostEffects.tsx`): ambient occlusion, bloom on highlights, AgX tone mapping, and a vignette; TRON draws as before.
- Relation lines are drawn after the post effects, so they keep their exact token colours.
- Coarse pointers start without ambient occlusion and multisampling, and any device drops them while the frame rate is low.

Add to "Debug panel":
- The "Ansichts-Labor" section has a "Nachbearbeitung" checkbox, on by default and remembered per browser (`ftree.post`), that switches the post effects off to compare.

- [x] **Step 2: Blender README**

Line 47 becomes: "Gold: Blender and the app both show real reflections; the app takes them from an environment cube rendered from its sky."

- [x] **Step 3: CI**

Add `- run: node app/sky.check.mjs` and `- run: node app/postEffects.check.mjs` to the check list in `ci.yml`.

- [x] **Step 4: All checks**

Run: `cd ui && pnpm typecheck && pnpm lint && for f in app/*.check.mjs app/*/*.check.mjs; do node "$f" || echo "FAIL $f"; done`
Expected: no `FAIL` line.

- [x] **Step 5: Frame rate**

With the browser pane visible, start view, tier high, count frames for 5 s with `requestAnimationFrame` in the page. Expected: at least 50 fps on the M1; report the number either way.

- [x] **Step 6: Review package for the user**

Put the before/after screenshots side by side for the user, give the review URL `http://localhost:3000`, open the diff pane.

- [x] **Step 7: Commit after approval**

Stage the code, the spec and this plan; show the staged diff and the message `feat(ui): light the 3d scene with sky reflections and post effects`; commit only after the user's explicit approval. Then `git fetch origin && git rebase origin/main`, rerun Step 4, and push and open the PR only after the user agrees.
