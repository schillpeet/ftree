# Light and image of the 3D scene – design

## Intent

The 3D scene should look natural and a little epic instead of like a game from around 2000: gold that reflects the sky, bark that is lit by the sky from above, contact shadows where wood meets the ground, glowing things with a soft halo, and real contrast between the lit and the shaded side.
This is part 1 of the direction the user chose on 2026-11-16 from the concept renders ("Baumvisionen"): **Lichtung** (a clearing with a ring of forest, by day) and **Nachtwache** (the same clearing at night, the tree glowing from its gold scars).

## The whole direction, and where this part sits

1. **Light and image** (this document): environment light from the sky, tone mapping, ambient occlusion, bloom, haze. For **all 3D appearances**: the organic tree ("3D"), the tiered tree ("Stufenbaum"), and the example family.
2. **Bark v2** (Stufenbaum only): more sides for thick strands, bark tiled in centimetres instead of once around each tube, an AO and height map, gold sunk below the bark with a raised rim, baked again in Blender.
3. **Clearing** (Stufenbaum only, lab first): hill, a ring of forest as billboards, rocks, dry grass moving in the wind, light shafts.
4. **Night watch** (Stufenbaum only, lab first): the gold's glow follows the sun's altitude, a warm light at the trunk, the moon as a rim light.

Lab first (decided 2026-11-16): parts 2 to 4 live only under the `organicExperimental` appearance until the user switches the default in one step; the family sees the new world only when it is finished.
Part 1 is shared, because the organic tree profits from it too.

## What the user sees

- Gold on the Stufenbaum is metal: it reflects the sky and the sun, warm by day and dark at night.
- Bark, cards and the hill get sky-coloured light from above and darker undersides.
- Contact shadows sit where roots meet the hill, in the forks of limbs, under the cards, and between twined strands.
- Glowing things get a soft halo: the light orbs above the cards, the moon, the faint glow of the gold, and the brightest part of the sky around a low sun.
- Haze lets the far meadow and hills fade into the sky colour, so the tree stands out in front.
- A subtle vignette holds the eye in the middle.
- Relation lines look exactly as today: token colour, on top, no haze, no tone mapping, no halo.
- The TRON view ("GRID") looks exactly as today.
- Evolution panel, "Ansichts-Labor": a checkbox "Nachbearbeitung" (on by default, remembered per browser) switches the post effects off to compare.

## Approaches

- **Full post-processing with `@react-three/postprocessing` (chosen 2026-11-16):** an environment cube rendered from the sky, AgX tone mapping, N8AO ambient occlusion, bloom, and a vignette in one effect composer; relation lines get their own pass after the effects so they keep their exact colours. Closest to the concept renders, and part 4 gets its bloom from here. Costs a new dependency, a one-time change of the drawing order, and a lower quality tier for phones.
- Light only, without post-processing: environment light, AgX on the renderer, haze, soft contact shadows under roots. No new dependency and exact colours stay untouched, but no depth in furrows and no halo around the gold; part 4 would need post-processing anyway.
- Light only now, post-processing with part 4: smaller steps, but the drawing order changes later anyway and the light is calibrated twice.

## Design

### Pipeline

- Add `@react-three/postprocessing` (^3.2.2, peer `postprocessing` ^6.39.6) to `ui/`; it brings `n8ao`.
- In the 3D appearances `Scene.tsx` mounts an `<EffectComposer>` with a half-float frame buffer and these effects, in order: `N8AO` (half resolution), `Bloom` (mipmap blur, luminance threshold around 1 so only HDR highlights bloom), `ToneMapping` (AgX), `Vignette`.
- The TRON branch (`experimental` in `Scene.tsx`) mounts no composer and keeps today's renderer settings.
- `toneMappingExposure: 0.6` (`Scene.tsx:993`) goes; while the composer is active, the composer tone-maps and the renderer does not. Exposure is calibrated in the tone mapping effect and the light intensities.

### Environment light

- A second Preetham `<Sky>` with the same sun direction as `DaySky` is rendered into a small cube (64 to 128 px) by drei's `<Environment>` and set as `scene.environment` only; the visible background stays today's sky.
- The cube is rendered again only when the sun has moved more than about 0.5°, never every frame.
- `scene.environmentIntensity` follows `daylight()`: full by day, low at night, where the moon light and the hemisphere light carry the scene.

### Lights and haze

- The hemisphere light (`Scene.tsx:459`) is turned down by day, because the environment now fills from the sky; at night it stays for the moon's fill.
- Sun and moon keep their shadow-casting directional lights; intensities are calibrated again.
- The exponential haze (`Scene.tsx:458`) gets a higher density, so the far meadow fades into the haze colour; the colours `NIGHT`, `DUSK`, `NOON` are tuned with it.

### Exact colours

- Relation lines (`ON_TOP`) move into an overlay scene that is drawn after the composer into the same canvas (a portal into a second scene, drawn in a later `useFrame` with the depth buffer cleared). They already skip the depth test, so nothing changes about how they stack.
- Halos behind the selected and the own card, the light orbs, and the moon stay in the main scene: they are light, so they go through tone mapping and bloom; their intensities are tuned so they read in their colours as before (`--glow`, `--accent`).
- Card faces are normal lit materials already and stay so; names must stay as readable as today.

### Gold on the Stufenbaum

- With an environment, the workaround "only a little metal, so it shows without reflections" (`TwinedTree.tsx`, `metalness: 0.3`) goes: the gold map drives metalness at full strength, so gold is metal and bark is not.
- The faint emissive glow stays as it is; coupling it to the sun is part 4.
- `docs/design/blender/README.md`, "Known differences", loses its line about the missing environment map.

### Quality

- There are two tiers: **high** (AO, bloom, multisampling) and **medium** (bloom, no AO, no multisampling).
- Fine pointers start at high, coarse pointers at medium; drei's `<PerformanceMonitor>` steps from high down to medium when the frame rate drops, and back up when it recovers.
- The checkbox "Nachbearbeitung" off means no composer: environment light and AgX on the renderer, no AO, no bloom, no vignette.

### Things that must keep working

- "Momentaufnahme" downloads the view with effects and lines: the canvas keeps `preserveDrawingBuffer`, and the overlay is drawn into the same canvas.
- Camera flights, orbit, growth replay, the TRON rides, card clicks and drags.
- The landing page keeps its still (`home/landing.jpg`) until the clearing becomes the default; it is rendered again then.

## Changes while building (2026-11-16)

- ACES instead of AgX: AgX made bark and leaves grey and pale; the textures were tuned under ACES, and GRID uses it too, so the composer tone-maps with ACES and no renderer tone-mapping switch is needed.
- The exposure of 0.6 stays for all appearances: without it the visible sky was brighter than before, and the sky shader has no other brightness control; the composer's tone mapping reads it.
- Glowing things are drawn brighter while the post effects run (`useGlowGain`), since in the composer they pass through tone mapping like everything else: light orbs and card halos 8×, so they bloom, the moon 1.5×, so it stays as bright as before.
- Environment strength 0.18 of the sky cube; bloom threshold 3 with a tight radius, so a sun behind the crown gets a small halo instead of washing out the crown.
- The new file is `ui/app/PostProcessing.tsx` (not `PostEffects.tsx`), because macOS file names are case-insensitive and it would collide with `postEffects.ts`.
- Night sky stays brownish from the sky shader as before; making it dark blue moves to part 4 (night watch).

## Acceptance

- Screenshots before and after for the organic tree, the Stufenbaum and the example family at four moments: noon, sun 5° high, sun 4° below the horizon, night; the user approves the look.
- Relation lines in the overlay have exactly their token colour (checked by reading pixels in a screenshot).
- TRON screenshots are unchanged.
- "Momentaufnahme" contains effects and lines.
- At least 50 frames per second in the start view on an M1 laptop at tier high, measured in the browser.
- `pnpm --dir ui typecheck`, `pnpm --dir ui lint` and the existing `*.check.mjs` checks pass.
- `docs/project-overview.md` gets new lines in "Sky and time of day" and in the Evolution panel section; `docs/design/blender/README.md` as above.

## Non-goals

Light shafts (part 3), glow following the sun (part 4), new bark textures (part 2), the clearing and forest (part 3), leaves, bloom in TRON, a new landing still.

## Calls made (to confirm)

- Effects only in the 3D appearances; TRON keeps its pipeline.
- Only relation lines move to the overlay; halos, orbs and moon go through tone mapping and bloom with tuned intensities.
- The environment cube comes from a second sky, small, rendered again only when the sun moves.
- Quality tiers are automatic; the lab checkbox exists to compare, remembered per browser as `ftree.post`.
- The Stufenbaum's gold becomes full metal now, because it needs the environment and is a one-line change.

## Left to the builder

Exact intensities, AO radius and strength, bloom threshold and strength, vignette strength, haze density, tier switching thresholds, the cube resolution.
