# Twined tiered tree (Stufenbaum) – design

## Intent

The current tiered tree (one central trunk, one level branch per family) looks bad and is a poor base for growth.
It is replaced by a new, deliberately simple tree in which couples are visible as trunks winding around each other.
Goal of this first step: open the appearance "Stufenbaum" on localhost and judge the shape; growth animation, gold look, textures, leaves and lianas come later.

## Rules (agreed from the sketches)

- Every generation has a fixed height: the oldest hang at the top, the youngest at the bottom.
- A person who has a partner gets their own strand; it grows from the ground up to the height of their generation.
- The strands of a couple wind around each other (a braid); a person with two partners on the same tier gives a three-strand braid.
- A person without partner and without children who has parents in the tree is a twig: it grows out of the parents' braid one tier below them.
- Where a braid ends, it bends out of the trunk; the cards of its people hang there.
- Because younger braids end lower, the trunk is thickest at the ground and thins towards the top, where only the oldest couple is left.
- A new generation adds a tier at the bottom and pushes the tree up, so it grows taller.

## Calls made without the user's explicit answer (to confirm)

- Strand or twig: a person is a twig only if they have parents in the tree, no partner and no children; everyone else gets a strand.
  So a single person is a single strand (a sapling), and a single parent is one unwound strand that carries their children's twigs.
- A couple whose partners both have parents in the tree hangs in the elder partner's family (as today); the forked trunk for two families (sketch 5) comes later.
- With a second partner it stays open which child belongs to which partner (sketch 6); not solved in this step.
- No leaves, no texture: plain tubes in one warm bark tone, each strand a little lighter or darker so the winding reads.

## Approaches

- **New pure layout + new geometry (chosen):** a pure `twinedPlan()` decides braids, twigs and card angles (testable with node), a separate builder turns it into tubes. Clean base for growth later; the old files are deleted.
- Reuse `tieredPlan()` and only swap the geometry: less work, but its units/branches model has no notion of strands per person, so the rules would be bolted on.
- Build the shape in Blender first and import glTF: good for look-dev, but the shape must change with every member, so it has to be generated in the app anyway.

## Non-goals

Growth animation, materials beyond a flat tone, leaves, lianas, the forked trunk for two families, dragging cards.

## Left to the builder

Exact radii, twist rate, tube thickness and colours, as long as the winding is clearly visible from the default camera.
