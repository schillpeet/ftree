# Night watch over the tiered tree – design

## Intent

Part 4 of the direction in [2026-11-16-scene-light-and-post-design.md](2026-11-16-scene-light-and-post-design.md), "The whole direction", and in [../../design/visions/README.md](../../design/visions/README.md), image D "Nachtwache".
At night the clearing of part 3 looks like image D: a dark blue sky instead of today's brownish one, the bare tree glowing from its gold scars just enough to show its form, a faint warm light at its foot lying on the ground, the moon setting a cool edge on the tree from behind, and fireflies in the grass.
By day nothing changes except that the gold stops glowing and is only metal.
The night must read as night, not as a grey, dim day (visions README, image D, "Risk").

## Way of working (the user, 2026-11-17)

- Forms and colours are the user's decision: sky colours, how strongly and how the gold glows, the light at the trunk, the moon's path and edge, the fireflies.
- Every stage starts with a look decision: 2 to 3 variants side by side in the lab on `http://localhost:3000` (or the worktree's UI on `http://localhost:3001`), switched by a select or slider, with screenshots to compare.
- The user picks; only then is the stage built out and committed; the losing variants are deleted.
- The variants below are proposals to start the lab with, not decisions; the values that ship are the ones the user picks.
- As in part 3, the builder makes the remaining technical calls and asks only for look decisions and important design questions.
- Nothing visible is left to the builder: whatever the user will see gets a value the user has seen in the lab.

## Decided by the user

- Moon by the clock, behind the tree (2026-11-17): the moon keeps moving with the time of day (it rises when the sun sets and sets when it rises, highest around midnight), but its path is pulled into the half of the sky behind the tree in the start view, so it is in view all night and its light comes from behind.
  Today it stands opposite the sun and is behind the tree only from about 22:30 to 01:30 in November; in the evening it stands 60° to 110° to the left, mostly behind the forest ring.
  Accepted in exchange: the moon covers about 80° of sky in a night instead of about 230°, it never stands in the sky behind the camera, and the light over the night varies less (always from behind, never from the side).
- The sun stays the real sun of part 3.
- Lab first: everything only under the `organicExperimental` appearance (Stufenbaum); the organic tree ("3D"), GRID and the landing stay as they are, at night too.
- Accepted from the builder's proposals (2026-11-17):
  - Stage order: night sky, gold glow, light at the trunk, moon, fireflies.
  - The names on the cards stay as readable at night as today; the sky may get darker, the cards may not.
  - Fireflies all year round, not only in summer; the tree is bare all year, and seasons come with the leaves (part 5).
  - The light orbs above the cards stay as they are.
  - Without "Nachbearbeitung" the gold glows the same, only without a halo.
  - The moon stays always full; no phases.
  - At least 50 frames per second as before, measured in every stage.

## Goals

- A dark blue night sky over the clearing that the gold also reflects.
- The gold's glow follows the sun's altitude and breathes slowly at night.
- A faint warm light at the trunk's foot that lights the ground, the roots, the rocks and the lowest cards.
- The moon on a path behind the tree, lighting it from behind with a cool edge.
- Fireflies over the grass at night.

## Non-goals

Moon phases or a real moon ephemeris, clouds, seasons, leaves, shadows cast by the trunk light, a night look for the organic tree, GRID or the landing, a new landing still, switching the default appearance.

## Anti-goals

- Grey instead of nocturnal: if the variants only make the day darker, the stage has failed.
- The tree must stay the hero: the moon, the sky and the fireflies may not outshine the gold.
- No "Christmas lights": fireflies are few, small and slow; the breathing is slow, never a flicker or strobe.
- The moon's light must not flatten the tree from the front; it comes from behind.
- No surprise: nothing visible gets a value the user has not seen in the lab.

## Constraints

- At least 50 frames per second in the start view at post tier high on an M1 laptop, and no stutter during "Wachstum abspielen".
  Part 3 left little room (45 to 52 frames per second in the in-app browser), so every stage reports the frame rate of its variants against the frame rate before it, in the same browser.
- Coarse pointers (post tier medium) get half the fireflies, the same look otherwise.
- No light is mounted or unmounted with the time of day: three.js compiles the number of lights into every lit material, so a light that appears at dusk recompiles every material (the 240 000 grass blades included) and the scene stutters. New lights stay mounted under `organicExperimental` and fade their intensity to 0.
- Everything new reaches `DaySky` and the tree as props or uniforms set only when `tiered` (as `haze` and `tint` are today), so the organic tree at night stays identical by construction.
- `docs/project-overview.md`: one sentence per line, new lines in the tiered tree's section and in "Sky and time of day" of "Current State".

## Approaches

The builder's calls, accepted by the user (2026-11-17):

- **Night sky: a night dome over today's sky (chosen).** A sphere with its own small shader (a vertical gradient from zenith to horizon, a lighter band near the horizon) is drawn over drei's Preetham `<Sky>` and under the stars, and fades in as the twilight ends; the same dome is drawn into the environment cube, so the gold reflects the night sky. The day sky is untouched and only the Stufenbaum gets the dome.
  Not chosen: patching the Preetham shader's colours (shared with the organic tree, hard to keep to the Stufenbaum); a whole new sky for day and night (much work, and the day is already approved).
- **Light at the trunk: a real point light without shadows (chosen).** It lights the roots, rocks, grass and the lowest cards, not just the ground.
  Fallback if it costs more than the frame budget: a light pool painted into the ground's and the grass's shaders only (cheaper, but roots and rocks stay dark); the user sees the fallback in the lab before it replaces the light.
- **Moon edge: the existing moon light from the disc's direction (chosen),** with a lab variant that adds an edge term to the bark shader in case the light alone is too soft.
- **Gold glow:** one sensible way, the bark shader's emission driven by a uniform from the sun's altitude.
- **Fireflies:** one sensible way, one instanced mesh of camera-facing glow quads with the light orbs' glow texture, moved in the vertex shader.

## Design

### The night's clock

All night effects hang on two numbers from the sun's altitude, pure functions in `ui/app/sky.ts` (checked by `sky.check.mjs`):

- `nightGlow(altitude) = 1 − smoothstep(−6°, 0°, altitude)`: 0 while the sun is up, rising through civil twilight, 1 from 6° below the horizon (the visions' `smoothstep(0, −6, sun)`). The gold's glow, the trunk light and the fireflies follow it.
- `nightSky(altitude)`: how much of the night dome shows; 0 during the afterglow, 1 at full night. Its two ends are part of the stage 1 variants (proposal: from 3° to 12° below the horizon, so the afterglow of civil twilight stays and the dome takes over in nautical twilight).
- Breathing: `1 + amplitude · sin(2π · t / period)` on the glow, with `t` the scene's clock in seconds; amplitude and period are part of the stage 2 variants.
- The stars keep their fade (they come out by 14° below the horizon); the light orbs above the cards keep `evening()`.

### Stage 1: night sky

- The night dome: a sphere around the camera, drawn after the `<Sky>` and before the stars, no fog, no depth write; its colour is a gradient from the zenith colour to the horizon colour with a lighter band in the last few degrees above the horizon, so the ring's tops stand as dark silhouettes against it as in image D.
- Its opacity is `nightSky(altitude)`; where the moon stands, the dome is lightened in a wide soft patch (image D's sky around the moon is about `#394a68` against `#1c2a3f`).
- The night haze (`NIGHT.haze` in `Scene.tsx`) under `organicExperimental` takes the dome's horizon colour, so the ring melts into the sky instead of standing in front of a different blue; the hemisphere light's night colours are retuned with it, so the ring trees read dark blue, not black.
- The environment cube gets the same dome, so the gold reflects the night sky; the cube is still only rendered again when the sun has moved half a degree, or when the appearance or the dome's variant changes (both are part of its key).
- Colours are stated as they should appear on screen in the start view (after tone mapping and exposure); the builder calibrates the dome's own values to reach them.

Lab variants (stage 1), stated by what the screen shows:

| Variant | Zenith | Horizon | Character |
|---|---|---|---|
| V1 "Zielbild" | `#162238` | `#1d2c43` | image D: deep navy, a little lighter at the horizon |
| V2 "Tiefe Nacht" | `#080c18` | `#141c2e` | almost black-blue, the stars and the gold stand out most |
| V3 "Mondhell" | `#1f2f50` | `#3a4c6e` | bright moonlit night, the most readable, the least dramatic |

Plus sliders for the start and end of `nightSky` (sun altitude) while stage 1 is decided.

### Stage 2: gold glow

- The bark shader's constant `gold · 0.3` emission goes; the emission is `goldTexture · gold · nightGlow · breathing · strength`, set as a uniform once per frame.
- It covers all gold, scars and veins alike; the bloom (threshold 3, from part 1) picks up whatever passes its threshold, so whether the gold gets a halo depends on the strength.
- With "Nachbearbeitung" off the emission is the same, without a halo; by day the gold has no emission with or without "Nachbearbeitung".
- The growing seed keeps its own small glow.

Lab variants (stage 2), plus a select for the breathing ("im Gleichtakt", or "Welle": the phase shifts up along the trunk, so a slow wave of light climbs the tree):

| Variant | Strength | Breathing | Halo |
|---|---|---|---|
| V1 "Zielbild" | 4 (the visions' value) | ±12 %, 7 s | a little, at the brightest scars |
| V2 "Glimmen" | 2 | ±8 %, 9 s | none: the gold glows without bloom |
| V3 "Laterne" | 8 | ±15 %, 6 s | clear halo; the tree is the clearing's lantern |

### Stage 3: light at the trunk

- A warm point light at the trunk's foot, about 1.5 m above the hilltop, without shadows, with a range after which it falls to 0; its intensity is `nightGlow · breathing · strength`, so it breathes with the gold, and it stays mounted by day at intensity 0.
- It lights everything around the foot: roots, hill, grass, rocks and the lowest cards.
- Its colour is the gold's light (image D's lit ground near the trunk is about `#7c5729`).

Lab variants (stage 3):

- V1 "Zielbild": amber `#ffa850`, range about 12 m, a clear warm pool around the roots as in image D.
- V2 "Weit und schwach": the same colour, range about 25 m, a faint warmth over the whole hilltop.
- V3 "Nah und stark": `#ff9440`, range about 6 m, a bright pool right at the foot, the rest dark.

### Stage 4: moon

- Path, azimuth: the start view looks south (`SOUTH = VIEW_FRONT + π` in `Scene.tsx`), and azimuths are measured from south, so today's moon azimuth (the sun's plus 180°) already is its angle from the start view's line: 0 at the deepest point of the night, behind the tree, negative (left) in the evening, positive (right) in the morning.
  The new azimuth is today's times a span factor; in November today's moon swings about 115° to each side, with a factor of 0.35 it swings about 40°; in summer the night is short and today's moon swings less, so the scaled moon stays closer behind the tree.
- Path, altitude: `highest · sin(−sun) / sin(−lowest)`, where `lowest` is the sun's lowest altitude that night (`|latitude + declination| − 90°`); so the moon rises when the sun sets, sets when it rises, and every night peaks at the same `highest` point, in short summer nights too (today's flattened arc peaks at about 17° in November but only about 5°, behind the ring, in June).
- The disc and its halo follow the new path; as today they show once the sun stands lower than about 6° above the horizon.
- Light: the moon's directional light comes from the disc's direction (today it comes in much steeper than the disc stands), at least 8° high as today, and keeps its shadow; with the moon behind the tree its light edges the trunk and limbs, and the tree's front lies in the hemisphere light and the gold's glow.
  Its strength is a lab slider (today 1.5) shared by all edge variants; the edge term only adds to it.
- Edge term (V2, V3 of the edge select): the bark shader adds a cool light where the surface turns away from the camera and toward the moon (a rim from the angle between the view direction and the normal, weighted by how much the surface faces the moon), on the bark only.

Lab, two selects and a slider for the moon light's strength (1 to 4):

- Path: V1 "Zielbild" (span factor 0.35, highest point 25°, the moon above the ring's tops as in image D); V2 "Flach" (0.35, highest 17°, today's height in November); V3 "Weit" (0.5, highest 30°).
- Edge: V1 "Nur Mondlicht" (the light alone); V2 "Kante" (light and a soft edge term); V3 "Kante stark" (a clear cool line along the silhouette).

Screenshots for stage 4 at two night moments: early night (sun about 18° below the horizon, the moon low on the left) and the deepest point of the night (the moon behind the tree).

### Stage 5: fireflies

- One instanced mesh of small camera-facing glow quads with the light orbs' glow texture (`HangingCard.tsx`), additive, no depth write, no fog.
- They hover 0.2 to 2 m above the ground on slow wandering paths moved in the vertex shader, never on the trunk, more of them near the hill's foot and the forest's edge; they fade in with `nightGlow`.
- Placement and paths are seeded and fixed (not per family).
- Medium tier: half as many.

- They drift at about 0.3 m/s, each on its own seeded path.

Lab variants (stage 5), plus a select for the light ("Glimmen": a soft pulse between half and full brightness over 3 to 5 s per firefly; "Blinken": flashes of about 0.4 s every 2 to 6 s with dark pauses, as real fireflies do):

- V1 "Zielbild": about 200, warm white `#fff2cc` like the orbs, spread over the clearing.
- V2 "Wenige": about 80, the same colour, only around the hill's foot.
- V3 "Grünlich": about 200, yellow-green `#d8f07a` like real fireflies.

### Lab

- In the Evolution panel's "Ansichts-Labor", while the Stufenbaum is shown, a group "Nachtwache" holds one select per open stage and its sliders; values are remembered per browser under `ftree.night`.
- After the user picks, the chosen values become constants and the stage's controls are removed; only the stage being decided has controls.
- Screenshots for each look decision, set with the lab clock by the sun's altitude (the clock time computed with `sunPosition` for the location in use, not guessed): the start view at 3° below the horizon (dusk, the glow half way), at 9° below (nautical twilight, the dome half way) and at 18° or more below (night), and a close view of the trunk's foot (about 25 m) at night.
  The lab clock previews today's date; on dates whose sun never sinks 18° below the horizon, the night shots are taken at the deepest point of the night.
- Every set of screenshots includes one card close up at night, to check that names stay readable.

### Stages shown on localhost

1. Night sky (dome, haze, hemisphere, environment).
2. Gold glow and breathing.
3. Light at the trunk.
4. Moon path and edge.
5. Fireflies.

Each stage gets one commit on `feat/ui-let-the-tiered-tree-keep-night-watch` once the user has picked and approved the staged diff; no pull request unless the user asks for one.

## Acceptance

- For each stage, screenshots of the variants and of the built-out choice; the user approves the look.
- The organic tree, GRID and the landing look as before at noon and at night (screenshots before and after).
- At least 50 frames per second in the start view at tier high on an M1 laptop; no stutter at dusk while the lab clock sweeps through twilight, and none during "Wachstum abspielen".
- Names on the cards are as readable at night as before part 4.
- `sky.check.mjs` covers: `nightGlow` is 0 for every altitude above the horizon and 1 from 6° below; `nightSky` is 0 during the afterglow and 1 at night; the moon's path stays within the span around the start view's line, is continuous through midnight, rises in the evening on the left and sets in the morning on the right.
- `pnpm --dir ui typecheck`, `pnpm --dir ui lint` and the other `*.check.mjs` pass.
- `docs/project-overview.md` gets new lines; the visions README's "4. Night watch" line is marked done.

## Calls made (the builder's, to confirm while reading)

- Screenshots by sun altitude (3°, 9°, 18° below the horizon), not by clock time, so they hit the same moment on every date and location.
- The gold's glow covers scars and veins alike.
- The trunk light breathes with the gold.
- The night haze takes the dome's horizon colour under the Stufenbaum.
- The edge term, if chosen, lies on the bark only, not on rocks, cards or the ring.
- Fireflies avoid the trunk and are seeded, not per family.
- The moon's altitude is rescaled so every night peaks at the same highest point, instead of today's arc capped; otherwise summer moons would stay behind the ring.
- The moon light's strength is one slider for all edge variants, so the edge variants differ only in the edge.
- The firefly timings (drift 0.3 m/s, pulse 3 to 5 s, flashes 0.4 s every 2 to 6 s) are proposals the lab shows.

## Changes while building

- Night sky picked (2026-11-17): V1 "Zielbild" (`#162238` at the top of the start view, `#1d2c43` above the forest), fading in between 3° and 12° of sun below the horizon; `NIGHT_SKY` in `sky.ts`.
- The dome's colours are not tuned by hand: `domeColor` in `NightDome.tsx` undoes the ACES tone mapping exactly (output matrix, curve, input matrix), so the stated screen colours land within a few steps per channel (measured `#152135` and `#1c2b41`).
- The hemisphere light's night colours stay as they were: with the haze in the dome's horizon colour the ring already reads dark blue (`#0c1421` on screen), not black.
- Gold glow picked (2026-11-17): V1 "Zielbild", strength 4.
- Breathing: ±12 % (the visions' value) and ±35 % could not be seen, because the bright gold sits in the tone mapping's shoulder, where swings are compressed; the user picked ±60 % every 7 s as a wave that climbs the trunk, 20 m per breath; it breathes only at night.
- Gold by day, a deviation from "only metal": without any glow the metal gold vanished against the light at noon (it reflects only the faint sky), taking back the gold the user asked for in part 2; the lab offered "only metal" and "faint glow as before", and the builder's proposal "as before" (0.3, today's value) was taken; at night the glow rises from it to 4.
- Trunk light picked (2026-11-17): V2 "Weit und schwach" (`#ffa850`, 25 m); it breathes with the gold, as the spec's call says (the user did not ask to change it).
- The first strengths were about a third of image D's lit ground (`#291b10` on screen where image D shows `#7c5729`), so all three variants were raised before the pick; the chosen light is 1200 cd.
- The light sits inside the trunk, so the bark itself gets none of it; only ground, roots, grass, rocks and low cards do.
- Moon path: taken literally, "behind the tree" put the moon behind the crown at the deepest point of the night, and at 25° behind the header; a fourth lab variant, "links neben der Krone" (centred 15° left of the start view's line, swinging ±20°, up to 14°), was picked (2026-11-17): at 21:00 it stands over the forest on the left, at midnight beside the crown as in image D, toward morning behind the trunk. `moonPosition` takes the path's centre.
- Moon edge and light: the builder's proposal "Kante" (edge 0.4) and today's strength 1.5 were taken; close up the warm trunk light outshines the edge at the trunk's foot, higher up it shows as a faint cool line on the left contours.
- Moon look (the user, 2026-11-17, a step beyond the spec, which kept the painted moon): a new painted texture (white highlands, smooth seas) looked less real than today's at every size and brightness and was dropped; the user then chose NASA's rendering of the real full moon (Scientific Visualization Studio, "Moon Phase and Libration, 2026", frame 7157 = 26 October 2026 04:00 UT, 730 × 730 JPEG, public domain, downloaded with the user's consent) as the disc's texture, at the painted moon's size (6 × real) and brightness. Its face is turned as the real moon stood that night (celestial north up).
- The photo's disc is cut 5 px inside its edge (the frame's black bled into the outermost pixels as a dark fringe) and feathered over its outer 3 %; a tight glow around the disc (`aureoleTexture`) bridges the step from the bright disc to the faint wide halo, so the moon sits in the sky instead of on it.
- The frame rate could not be measured in stages 1 to 4: the in-app browser pane was hidden and drew about one frame per second; the dome is one extra draw call (and one more in the environment cube when it is rendered again).

## Left to the builder

How the dome, the edge term and the fireflies' paths are written in GLSL, how the lab state is stored, file names, the dome's own colour values that reach the stated screen colours, and the order of work inside a stage.
