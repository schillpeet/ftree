# Bark v2 of the tiered tree – design

## Intent

Close up, the tiered tree ("Stufenbaum") should look like an old, real tree instead of a game from around 2000: bark whose plates are the same size everywhere, furrows with depth, and gold that lies like bared heartwood below the bark in a few large scars, with a raised rim of callus around them.
This is part 2 of the direction "Lichtung + Nachtwache" (see `2026-11-16-scene-light-and-post-design.md`, "The whole direction"); part 1 (light and image) is on `main` with PR #362.
The target image is the close-up "rinde.jpg" on the vision page "Baumvisionen" (claude.ai artifact `KC8oxrR14J9J2KPWV5jnDi`).

## Goals

- Thick strands are round at their silhouette: more sides for thick wood, fewer for thin.
- Bark is tiled in metres: plates are the same size on a thick trunk strand and on a limb, never stretched.
- Furrows get darker and deeper: an ambient occlusion map and a height map, baked with the bark.
- Gold sits only in a few large scars (3 to 5 per tree), sunk below the bark, with a raised callus rim that catches light.
- Faint gold veins in the deepest furrows: running out from each scar and thinning, and here and there elsewhere on the tree (decided 2026-11-16), never as an even net.
- The bark and the gold are baked again in Blender (`docs/design/blender/tree.py`), so the look stays editable there.

## Non-goals

- Strands that melt into each other at crossings, radius noise and bulges along the wood, levels of detail.
- Scars that mean something (a person or an event); they are decoration now (decided 2026-11-16) and can get a meaning later by deriving their place from a member instead of from chance.
- The gold's glow following the sun (part 4), the clearing (part 3), leaves.
- Any change to the organic tree ("3D"), TRON, or the landing still.

## Anti-goals

- Gold as a net over the whole tree, or a pattern that visibly repeats.
- Gold that reads as yellow paint lying on top of the bark.
- A tree that drops below 50 frames per second at tier high on an M1 laptop, or stutters while it grows.

## Constraints

- Lab first (decided 2026-11-16): `TwinedTree` is only drawn for the appearance `organicExperimental`, so all of this stays in the lab until the user switches the default after parts 2 to 4.
- The tree is rebuilt every frame while it grows (`sweepAll` writes straight into buffers, `pieceCache`/`rootCache` keep unchanged pieces); new attributes must fit into that without per-frame allocations.
- The scene tone-maps with ACES at exposure 0.6, has an environment of strength 0.18, N8AO and bloom (part 1, "Changes while building"); the bark is tuned under those.
- Scene units are about metres: the trunk strands are up to 0.42 thick at the ground, the tree is 15 to 30 high.
- The textures are JPEGs next to `TwinedTree.tsx` in `ui/app/bark/`; only `TwinedTree.tsx` loads them.
- Every intermediate stage is shown to the user on `http://localhost:3000` before it is committed.

## Approaches

- **Mask per vertex, scar in the shader (chosen 2026-11-16):** `twinedForm.ts` places the scars and writes a soft `scar` attribute per vertex; the shader turns it, together with noise, into a sharp irregular edge, draws gold heartwood inside, sunk by parallax, and a callus rim outside. One mesh, one material, grows with the tree, no extra draw calls; the scar's outline is limited by the vertex density, which the noise hides.
- Scars as decal meshes projected onto the trunk: sharp, free outlines, but they must be fitted again every growth frame, flicker against the bark, and can hardly be sunk, so the gold would lie on top again.
- One texture per scar in an atlas: sharpest, but far too much work for 3 to 5 scars.

For the gold's place, gold inside the tiling bark (rarer and deeper than today) was weighed against the few large scars and rejected: it stays an even, repeating pattern, against the vision's "sparsam, nie als Netz" (decided 2026-11-16).

## Design

### Sides by thickness

- Every tube gets its number of sides from its thickest radius: about `round(maxRadius × 64)`, at least the kind's minimum today (strands 9, twigs 6, free branches 5, roots 4), at most 32.
- A thick trunk strand (0.42) gets about 28 sides, a twig stays at 6, the fans at the tips stay at 3, the collar goes from 16 to the same rule.
- The number is constant along a tube, so its tip is denser than needed; levels of detail are a non-goal.
- The side count is part of each piece's hash already (`hashOf(..., radial * 7919 + ...)`), so caching keeps working.

### Tiling in metres

- One bark tile covers `TILE_AROUND` metres around and `TILE_ALONG` metres along the wood, with plates of about 7 × 60 cm (vision page).
- `uv.x = shift + length / TILE_ALONG` replaces the radius-dependent `scale` in `sweepAll`.
- `uv.y = shift + (j / radial) × n`, with `n = max(1, round(2π × r / TILE_AROUND))` and `r` the tube's mean radius: a whole number of tiles around, so there is no seam.
- Where a tube tapers, its plates get narrower towards the tip, as real bark does.

### The new bake

- `bark_graph` in `tree.py` becomes pure bark: plates stretched along the wood, deep furrows, cross cracks, grey weathering and lichen as today, no gold.
- The torus mapping that makes the bake tile is sized in metres (`TILE_AROUND`, `TILE_ALONG`), so the baked tile is not stretched; the Blender look-dev tree uses the same metres.
- A new `gold_graph` draws the heartwood: gold with wood grain along the wood, darker towards the rim of the bed.
- `bake()` writes, into `ui/app/bark/`:
  - `bark-color.jpg` (sRGB), `bark-normal.jpg` (tangent space, +Y up),
  - `bark-data.jpg`: R ambient occlusion, G roughness, B height,
  - `gold-color.jpg` (sRGB), `gold-data.jpg`: R ambient occlusion, G roughness, B height.
- `bark-gold.jpg` goes.
- The channel layout lets three.js read R as `aoMap` and G as `roughnessMap` from the same texture; height is read by the shader.

### Scars

- `twinedForm.ts` picks 3 to 5 scars with chance seeded from the family id (`name`), on the base trunk strands and the root collar, between about 1 and 6 m above the hilltop, never facing straight away from the front.
- They only depend on the family id and the base trunk, so they stay where they are when people join, as the base trunk does.
- Each scar has a centre (a position along its strand and an angle around it), a height of about 0.5 to 1.4 m and a width of about 0.25 to 0.6 m.
- `sweepAll` writes a float attribute `scar` per vertex: 1 in the middle, falling smoothly to 0 at the scar's ellipse, measured in metres around and along; 0 on all other tubes.
- Without a base trunk (a tree too small for it) the scars sit on the collar only.

### Veins

- Gold runs into the deepest furrows of the bark (low bark height) where a vein mask allows it.
- Near a scar the mask comes from the scar attribute's falloff, so veins run out of the wound a short way and thin out.
- Elsewhere the mask is a large, low-frequency noise in world metres, so veins show only in a few places and the pattern does not repeat with the tile.
- Veins use the gold maps, are as deep as the furrow, and one strength turns them down to none.
- Because the vein needs a mask reaching beyond the scar, the `scar` attribute falls off over a wider band than the scar itself; the edge threshold sits inside that band.

### Shader

- `growingBark()` keeps its `onBeforeCompile` and its `along`/`uGrown` clipping, and gains:
  - the edge: `inside = smoothstep(e - w, e + w, scar + noise)`, with the noise from the bark height, so the edge is sharp and ragged although the mask is soft;
  - the rim: a band just outside the edge, raised in height and slightly fresher in colour (the callus);
  - the height field: bark height outside, raised at the rim, `-depth + gold height` inside;
  - parallax over that height field in tangent space (about 8 to 16 steps, fading out with distance from the camera), so the gold lies visibly below the bark and the rim throws it into shade;
  - inside the scar: the gold maps (colour, roughness, ambient occlusion), metalness 1, darker near the rim;
  - outside: the bark maps, metalness 0, ambient occlusion from `bark-data`.
- `sweepAll` writes a tangent per vertex (the tube's direction is known), so parallax does not depend on screen-space derivatives.
- The faint emissive glow comes from the scar mask instead of `metalnessMap.b`, at today's strength; coupling it to the sun is part 4.
- `BARK_TINT` and the normal scale are tuned again for the new bake.

### Blender

- `tree.py` builds the look-dev tree with the same side rule, metres tiling and scars (a vertex attribute and the same edge and rim in nodes), so a change can be judged in Blender first.
- `tiers-front.jpg` and `tiers-detail.jpg` are rendered again.
- `docs/design/blender/README.md` describes the new files and channels and the metres tiling.

### Stages shown on localhost:3000

1. Sides by thickness and tiling in metres, still with today's textures.
2. The new bake of the bark (no gold yet), with ambient occlusion and height.
3. Parallax and ambient occlusion in the shader.
4. Scars with gold and callus, and the veins.

Each stage gets one commit on this branch once the user has seen it; one pull request at the end.

## Changes while building (2026-11-16)

- A tile is 1.0 m around and 4.0 m along: with shorter tiles only two plates fit along, and the seamless 4D mapping smeared them.
- The bark is long ridges between furrows (a triangle wave around the wood, bent by noise, with bridges and a few breaks across) instead of stretched Voronoi plates, which ended in smears and read as scales; ridges are about 12 cm wide.

- More gold than "sparing" (the user, 2026-11-16, after seeing stage 4): veins fill whole furrows in patches over the trunk and limbs and glow a little in the gold's own colour, so they show from the normal views; person strands carry a scar of their own about every third time (seeded from the family and the person, so it stays with them); and one base strand is bared all around along the trunk.
- Scars are 0.8 to 2.2 m tall and sit 1.5 to 9 m up the base strands, so they show from the closest camera, about 25 m away; parallax fades between 30 and 80 m and the furrows lie 15 cm deep for the same reason.
- Scars and veins exist only in the app; the Blender look-dev tree shows pure bark.

## Acceptance

- Screenshots, close-up of the trunk and the whole tree, at noon and at night, before and after; the user approves the look.
- No visible seam around any tube; plates on a trunk strand and on a limb are the same size within a factor of about 1.5.
- The example family shows 3 to 5 scars; adding a member does not move them.
- Veins are visible near the scars and in a few other places, and never form an even net over the tree.
- At least 50 frames per second in the start view at tier high on an M1 laptop, and no stutter during "Wachstum abspielen".
- `node app/twinedForm.check.mjs` covers the side rule, the whole number of tiles around, and that scars only depend on the family id; `pnpm --dir ui typecheck`, `pnpm --dir ui lint` and the other `*.check.mjs` pass.
- `docs/project-overview.md` gets new lines in the tiered tree's section; the Blender README as above.

## Calls made (to confirm)

- Scars sit only on the base trunk and the collar, not at limb forks, because forks move when people join and the scars should stay put.
- Sides follow the thickest radius per tube (about 64 per metre of radius, at most 32), constant along the tube.
- Gold and bark are two texture sets in the same UVs; the height map drives parallax, not geometry.
- A tangent attribute is added to the tubes for parallax.
- Parallax fades out with distance, so far views cost nothing extra.

## Left to the builder

`TILE_AROUND`, `TILE_ALONG`, the sides factor, scar count, sizes and heights, vein strength, reach and noise scale, edge width, rim width and height, sink depth, parallax steps and fade distance, texture resolutions, ambient occlusion strength, the new `BARK_TINT`, whether the gold gets its own normal map or takes its relief from its height.
