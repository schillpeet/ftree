# Growth of the twined tiered tree – design

## Intent

"A tree that grows with you": when a member joins, the Stufenbaum should visibly grow instead of jumping to its new shape.
This step is a spike to learn how growth looks and to constrain the form work that follows (see `docs/superpowers/briefs/2026-11-14-twined-tree-form.md`); the form itself stays as it is.

## What the user sees

- A new partner: their strand grows from the ground up, winding around the partner's strand, bends out, and their card appears at its tip.
- A new child without partner: a twig sprouts out of the parents' braid; the card appears at its tip.
- A new generation: the whole tree rises by one tier while the new tier grows out at the bottom; existing strands lengthen with it.
- Cards of existing members glide with the tree; when cards shift around the trunk they glide there too.
- Evolution panel, "Ansichts-Labor": a button "Wachstum abspielen" replays the open family from its first member to all of them, one member at a time, so growth can be judged on any family without editing data.

## Rules

- Replay order: by generation, then birth date (unknown last), then id; so the eldest come first and the tree grows downward tier by tier.
- One growth step takes about 2.5 s: the rise and the shifting take the whole step, a new strand or twig grows during it and its card appears when the strand reaches it.
- Elements are matched across steps by person id; a removed member simply disappears (no shrinking in this spike).
- Growth only runs in the Stufenbaum appearance; with reduced motion preferred, the tree jumps as today.

## Approaches

- **Rebuild the tubes every frame while a step runs, clip each strand in its shader (chosen):** an in-between plan (angles and tier heights blended) is turned into geometry each frame; each strand and twig is its own mesh whose material discards everything beyond its grown length (the tube's `uv.x` runs from ground 0 to tip 1). Simple and close to today's code; cost only during the 2.5 s of a step.
- Animate everything in the vertex shader from two baked plans: smooth for huge families, but much more code and it would have to be rewritten after the form work.
- Morph targets between the two shapes: only works when both shapes have the same vertices, which a new strand breaks.

## Calls made (to confirm)

- Cards of existing members follow the tree every frame through the existing `layout` map; if that turns out too slow, they move at the end of the step instead.
- Replay hides nothing else: lines and panels behave as they do today.
- The replay button is only in the Evolution panel (`dev.tools`), not for end users yet.

## Non-goals

Shrinking on removal, sound, particles, leaves, the final golden material, changes to the form.
