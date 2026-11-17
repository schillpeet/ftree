# Clearing around the tiered tree – design

## Intent

Part 3 of the direction in [2026-11-16-scene-light-and-post-design.md](2026-11-16-scene-light-and-post-design.md), "The whole direction", and in [../../design/visions/README.md](../../design/visions/README.md), image A "Lichtung".
The Stufenbaum stands on a low hill in a forest clearing instead of on a dome in an endless meadow.
A ring of conifers closes the horizon and fades into haze, grass moves in the wind, a few rocks give scale, and a low sun sends light shafts through the air.
The tree should read as an ancient giant in a real place, not as a model on a table: scale, depth, layering and muted colours (visions README, "What the forest reference has and the tree does not yet").

## Way of working (the user, 2026-11-17)

- Forms and colours are the user's decision: hill form, grass colour and height, densities, rocks, ring distance and silhouette, haze, light shafts.
- Every stage starts with a look decision: 2 to 3 variants side by side in the lab on `http://localhost:3000`, switched by a select or slider, with screenshots to compare.
- The user picks; only then is the stage built out and committed.
- The variants below are proposals to start the lab with, not decisions; the values that ship are the ones the user picks.
- After the user said "go with your recommendations" (2026-11-17), the builder makes the remaining technical calls and asks only for look decisions and important design questions.

## Decided by the user

- Ring inside (2026-11-17): the forest ring stands at about 60 m from the trunk and the camera never leaves the clearing.
- Real sun (2026-11-17): the sun keeps following time and location; the camera looks south from the north, so the forenoon gives the back light from behind left of image A, noon from behind, the evening from the right.
- Lab first: everything only under the `organicExperimental` appearance (Stufenbaum); the organic tree ("3D"), GRID and the landing stay as they are.
- Family phase, no go-live: the default appearance is not switched in this part.
- The forest ring is the last stage, first with placeholders; real billboards are baked on another machine (no Blender here).
- Picked from the lab (2026-11-17): hill "Zielbild" (flat dome 2.5 m, foot at 35 m); ring "Zielbild" (tall slim conifers); ring distance follows the tree; ring trees 70 % of the tree's top; haze "leicht" (a tree 50 m away 95 % clear).
- Camera room (2026-11-17): zoomed fully out, the whole tree must always be in view; the ring moves out as far as that needs.

## Goals

- A hill and a clearing floor that are the Stufenbaum's own ground.
- Grass as instanced blades that move in the wind, in muted colours.
- A few rocks for scale, half sunk into the ground.
- Haze tuned for the clearing, and light shafts when the sun is in view.
- A ring of trees as camera-facing billboards, first placeholders, later the baked atlas specified below.
- The camera stays inside the ring.

## Non-goals

Night watch (part 4: glow following the sun, light at the trunk, moon rim light, fireflies, dark blue night), leaves, moss on the roots, walking and climbing, a new landing still, shadows cast by the ring trees, wind in the ring trees, any change to the organic tree, GRID, or the landing.

## Anti-goals

- The tree must stay the hero: nothing in the clearing may compete with it in size, contrast or colour.
- No "game from around 2000": no visible tiling, no hard horizon line, no artificial-turf green, no billboard that visibly turns with the camera.
- No surprise: nothing visible gets a value the user has not seen in the lab.

## Constraints

- At least 50 frames per second in the start view at post tier high on an M1 laptop, and no stutter during "Wachstum abspielen".
- Coarse pointers (post tier medium) get fewer grass blades, the same look otherwise.
- The tree's foot stays at today's absolute height (`TREE_BASE` in `Scene.tsx`), so every position derived from it (camera start, waiting cards, rides, pins) keeps working.
- `docs/project-overview.md`: one sentence per line, new lines in the tiered tree's section of "Current State".

## Approaches

- **Own ground for the Stufenbaum, in code (chosen, the builder's call):** a new `Clearing` component replaces `<Meadow />` under `organicExperimental`; hill, grass, rocks and ring placeholders are generated in code; the ring's final look comes from a baked atlas. The organic tree keeps its meadow untouched, the lab can switch variants instantly, and only the ring needs Blender.
- Change the shared meadow: less code, but the organic tree would change too, against "lab first".
- Everything baked in Blender (hill, rocks, ring as a glTF scene): best detail, but there is no Blender on this machine, and every look variant would need a round trip to the other machine.

## Design

### Ground and hill

- `ui/app/clearing.ts` (pure, checked by `clearing.check.mjs`) holds the hill shapes and the clearing's ground height: `hill(r)` is 0 at the trunk and falls to `-H` at the hill's foot; the clearing floor around it is flat with a gentle ripple and runs on to the horizon, so there is no edge.
- The ground in world coordinates is `TREE_BASE + hill(r) + ripple(x, z)`, with the ripple faded to 0 near the trunk; so the tree's foot does not move.
- `buildTwinedTree` takes the hill as a parameter (default: today's dome, so every existing check passes unchanged) instead of its own copy of the dome; `TwinedTree` passes the chosen hill and rebuilds when it changes, so the roots lie on the hill even while the lab switches variants.
- Only the ground under the roots changes; the roots' own shape (`ROOT`, `ROOT_REACH`) is retuned only if the user sees a problem in the lab.
- Waiting cards in front of the tree stand on the ground of the appearance they are shown in; stored card positions stay relative to `TREE_BASE` and do not move.
- Stage 1 gives `Meadow` a ground-height function (default today's `height`), so the organic tree stays identical by construction and today's grass grows on the new hill; the clearing's own component (`Clearing.tsx`) arrives in stage 2 with the new grass.
- The ground mesh keeps today's resolution scheme (dense at the tree, coarse far out); its vertex colours come from the chosen grass palette from stage 2 on.

Lab variants (stage 1):

| Variant | Form | Height | Falls off |
|---|---|---|---|
| V1 "Zielbild" | flat dome | 2.5 m | gently, to about 35 m |
| V2 "Heute, flacher" | round dome | 4 m | to about 25 m, then flat |
| V3 "Plateau" | almost flat top of 15 m radius around the trunk, then a visible edge | 3 m | to about 30 m |

### Grass

- Instanced blades (a bent quad strip of 3 to 4 segments, not today's cones) over the clearing, densest around the hill, thinning to the ring; the ring's foot is hidden by tall grass.
- Wind in the vertex shader: a slow travelling gust field over world position plus a small per-blade flutter; the tip moves most, the root not at all.
- Blade colour from a two-colour palette with per-blade variation; the ground's vertex colours use the darker half of the same palette, so gaps between blades do not show a different green.
- Medium tier: half the blades.

Lab variants (stage 2), plus sliders for wind strength and density:

| Variant | Colour | Height | Wind |
|---|---|---|---|
| V1 "Zielbild" | olive grey-green `#4a5a32`–`#6b7340` | 0.4–0.7 m | light |
| V2 "Trockene Wiese" | olive with straw `#6e6a3a`–`#a39a5c` | 0.6–1.0 m | clear |
| V3 "Heute, gedämpft" | `#2b4a2c`–`#4f6e3e` | 0.3–0.5 m, like a lawn | barely |

### Rocks

- Generated in code: an icosphere displaced by seeded noise, flattened, sunk a third into the ground; one shared geometry per rock shape, a few shapes, instanced.
- Material: rough stone colour with moss on the upward faces (by normal), strength set by a slider; rocks cast and receive shadows.
- Placement is seeded and fixed (it does not depend on the family), never on the tree's roots and never in front of the start view's line to the trunk.

Lab variants (stage 3), plus a slider for moss and a select for the stone colour (granite grey, dark blue-grey):

- V1 "Wenige große": 3 rocks of 1–1.5 m on the hill's flank, as in image A.
- V2 "Gruppe": one group of 5–7 stones of 0.3–1.2 m on one side, and 2 single ones.
- V3 "Verstreut": 10–12 stones of 0.2–0.8 m across the clearing, half in the grass.

### Air

- Haze stays the scene's exponential fog; under `organicExperimental` its density comes from the chosen variant, everywhere else it stays as today.
- Variants are stated by what the start camera sees, for the ring and camera distance settled in "Camera": V1 the tree 90 % clear and the far side of the ring 60 % clear; V2 95 % and 75 %; V3 today's density (fog `exp2`, so for a start view about 50 m from the trunk and the far ring about 110 m away V1 is a density of about 0.0065).
- Haze colour by select: today's warm grey, a cool blue-grey, a warm gold; it keeps following the time of day as today (`NIGHT`, `DUSK`, `NOON`), the select shifts its noon and dusk colours.
- Light shafts: the `GodRays` effect of `@react-three/postprocessing` from a sun disc placed along the sun's direction, only while the post effects run and the sun is above the horizon; strength by slider from off to strong. They show when the sun is in view or behind the crown or the ring.

### Forest ring

- Trees on a ring of radius `R` with seeded jitter in radius (±6 m) and spacing, in two to three rows so it reads as a forest edge, not a fence; `R` is a lab slider only while stage 5 is decided, then the chosen value is a constant.
- Each tree is a quad that turns only around its vertical axis to face the camera (cylindrical billboard), drawn instanced with alpha cut-out (`alphaTest`, writing depth); it takes fog, sun and hemisphere light through a normal map.
- Because the billboards write depth, they hide the sun from the light shafts: with a low sun, shafts come through the gaps between trunks below the crowns (V1) or between trees (V3), as in image A; with a sun above the ring's tops, from the open sky.
- Above and behind the ring is today's sky; the ring's tops stand as a silhouette against it, softened by the haze.
- Which atlas cell (tree variant) a ring tree uses, its height jitter (±15 %) and a mirror flip are seeded per tree.
- Placeholders: silhouettes drawn into a canvas texture in code (with a simple flat normal), in the shape of the selected variant, so the look decision sees the real outline; 3 placeholder silhouettes per variant.
- Height relative to the tree: select "lower than the Stufenbaum" (about 70 % of its top) or "as high".

Lab variants (stage 5):

- V1 "Zielbild": tall slim conifers, crown from half height up, trunks visible below.
- V2 "Fichtenwand": cones down to the ground, a closed wall.
- V3 "Gemischt": conifers and broadleaf trees, looser, with gaps the light shines through.

### Billboards to bake (on the other machine)

Because the camera stays inside the ring, every ring tree is always seen from the clearing, within about ±50° of its inward direction; one view per tree is enough.

- 4 tree variants of the chosen silhouette, each rendered from the front (camera at the clearing's centre height, orthographic, looking along the horizontal).
- 1024 × 2048 px per tree (a 30 m tree at 60 m covers about 1300 px on a 4K screen; mipmaps handle far views).
- One atlas of 4096 × 2048 px with the 4 trees side by side, foot at the bottom edge, the trunk's axis at each cell's horizontal centre.
- Two files in the same layout: `ring-color.png` (sRGB colour with straight alpha, no baked light, ambient occlusion multiplied in) and `ring-normal.png` (tangent-space normals, OpenGL convention +Y up, like the bark).
- Alpha with a 4 px dilated colour border so mipmaps do not darken the edges.
- A short `ring.json` next to them: per tree its height in metres and its trunk's foot position in the cell, so the app scales them without guessing.
- Files go to `ui/app/clearing/`, and `docs/design/blender/README.md` gets a section on how they were made.

### Camera

- The tree is taller than first said in the conversation: the top tier hangs at `15.5 + (depth − 1) · 6.32` m, so about 28 m for three generations and about 41 m (crown about 45 m) for five; the start view (about 51 m from the trunk, looking at 11 m height) already cuts off the top of a three-generation tree today.
- **Open, the user's decision, asked with the stage 1 drafts:** how ring distance and tree height go together (ring follows the tree's height, ring fixed farther out, or ring at about 60 m with the tree only partly in view from inside). The ring slider in stage 5 and the haze numbers follow from it.
- Whatever is chosen, under `organicExperimental` the orbit target is kept inside a box around the trunk (camera-controls `setBoundary`, pan included) and the camera's distance to it is capped, so neither panning nor zooming leaves the ring; the other appearances keep 150 m and free panning.
- "Von oben" under `organicExperimental` looks down from the highest point the cap allows, slightly tilted toward the front, instead of 90 m straight down, so the ring's billboards are never seen from straight above.
- The ride back to the landing (600 m) only runs in GRID, so it is not affected.

### Lab

- In the Evolution panel's "Ansichts-Labor", while the Stufenbaum is shown, a group "Lichtung" holds one select per open stage (variants) and its sliders; values are remembered per browser under `ftree.clearing`.
- After the user picks, the chosen values become the clearing's constants and the stage's select and sliders are removed; only the stage being decided has controls.
- Screenshots for each look decision: the start view and one close view, at noon and with the sun about 5° high in the forenoon (back light), using the lab clock.

### Stages shown on localhost:3000

1. Forest ring with placeholders and haze: silhouette, ring distance (follows the tree, fixed 80 m, fixed 60 m), ring height, haze density; the camera stays inside.
2. Hill and ground (variants V1–V3, drafts already in the lab), judged inside the clearing.
3. Grass in the wind and the ground colour.
4. Rocks.
5. Light: haze colour and light shafts.
6. The billboard bake specified above is handed to the other machine.

Each stage gets one commit on this branch once the user has picked; no pull request unless the user asks for one.

## Changes while building (2026-11-17)

- Order changed (the user, 2026-11-17): the forest ring with placeholders and the haze come first, so hill, grass and rocks are judged inside the clearing instead of in the endless meadow; the hill drafts stay in the lab until then.
- The ring distance is a lab choice: following the tree's height (about 60 m for three generations, about 72 m for five), fixed at 80 m, or fixed at 60 m; it answers the open camera question in "Camera".
- Every hill variant is lower than today's 7 m dome; the variant "flatter than today" is called "round dome 4 m".
- The ring's radius is `12 m + 3 m + room × fitDistance(top)`, where `fitDistance` is how far the camera stands to see the whole tree from its middle and `room` (1.3, 1.6 or 2 in the lab) is how much farther it may back off; the tree's top comes from its highest card plus 8 m.
- "Vorne" in the Stufenbaum looks at the tree's middle from about the same height, so zooming out moves back and up; looking up from the ground would carry the camera into the ground when zooming out.
- The lab also offers a deeper forest (8 rows instead of 3), because from far back one sees over a thin ring onto bare ground.
- Camera room 1.6× and the deep forest of 8 rows were picked (2026-11-17); committed as the first stage.
- The clearing's own ground is `ui/app/ClearingGround.tsx` (not `Clearing.tsx`, which would collide with `clearing.ts` on case-insensitive file systems); it reuses the meadow's ground mesh (`groundGeometry` in `Meadow.tsx`) and grows grass out to the ring.
- Grass blades: 160 000 at tier high, 80 000 at medium, times the lab's density, placed denser near the tree; in the in-app browser the start view ran at about 47, 44 and 38 frames per second at density 0.5, 1 and 1.5.
- Rocks picked (2026-11-17): the group layout at 2.5 times the first drafts' sizes (0.75 to 3 m), dark blue-grey, moss at half (the builder's recommendation, not asked), angular: each rock is cut along six seeded planes and shaded flat; 1 to 1.5 m rocks read as pebbles next to the tree's roots.
- Grass picked (2026-11-17): "Zielbild" olive, density 1.5 (240 000 blades at high, 120 000 at medium), wind 0.4 × the variant's (a tip bends 0.12 m per metre at a full gust); the start view then ran at 45 to 52 frames per second in the in-app browser.

- The creeping roots are cached per person while the tree grows; the cache now also remembers the hill, so a hill switch in the lab moves them too.
- A hill switch remounts the tree (its React key), which rebuilds it once.

## Acceptance

- For each stage, screenshots of the variants and of the built-out choice; the user approves the look.
- The organic tree, GRID and the landing look as before (screenshots before and after).
- At least 50 frames per second in the start view at tier high on an M1 laptop; no stutter during "Wachstum abspielen".
- The camera cannot leave the ring under `organicExperimental`.
- The tree's roots lie on the hill for every hill variant, for a one-person family and for the example family.
- `node app/clearing.check.mjs` covers: the hill is 0 at the trunk and monotonic down to its foot, the ground is finite everywhere, rock and ring placement are deterministic and keep clear of the trunk and the start view's line; `pnpm --dir ui typecheck`, `pnpm --dir ui lint` and the other `*.check.mjs` pass.
- `docs/project-overview.md` gets new lines in the tiered tree's section.

## Calls made (the builder's, to confirm while reading)

- The clearing is the Stufenbaum's own ground (`Clearing.tsx`, `clearing.ts`); `Meadow.tsx` stays for the organic tree.
- The tree's foot stays at today's absolute height; the clearing floor lies `H` below it.
- Rocks and ring placeholders are generated in code; only the final ring trees are baked.
- One view per ring tree, cylindrical billboards, because the camera stays inside the ring.
- Light shafts use the post-processing `GodRays` effect, so they are off when "Nachbearbeitung" is off.
- The ring trees cast no shadows; their foot is hidden in tall grass and haze.
- Losing variants are deleted after each choice instead of kept behind a switch.
- Grass blades have 4 segments (a soft curve, not a straight spike); rocks use 4 shapes; both are visible in the lab drafts and change if the user objects.
- Hill variants keep today's tree position; only the ground around it moves.

## Left to the builder

How the wind field and the billboards are written in GLSL, how the lab state is stored, file names other than the bake files, and the order of work inside a stage.
