# Blender look-dev of the tiered tree

The tiered tree (`ui/app/TwinedTree.tsx`) gets its form, bark and light designed in Blender first.
This folder holds that setup, so the look can be changed where it is quick to judge and then carried over.

![The tree in Blender](tiers-front.jpg)
![Bark with gold underneath](tiers-detail.jpg)

## What is here

| File | What it is |
| --- | --- |
| `tree.py` | Builds the tree in Blender from `family.json`: trunk, limbs, twigs, free branches, bark material, light, a growth animation, and the bake of the bark textures. |
| `family.json` | The example family (17 people, 4 generations) as a tree of couples and children, with a family id that seeds the free branches. |
| `tiers-front.jpg`, `tiers-detail.jpg` | Reference renders of the current look. |
| `*.blend` | Not committed. The scene is rebuilt from `tree.py` in a few seconds. |

## What the app takes from it

| In Blender | In the app |
| --- | --- |
| The form rule (`build("E")`) | `ui/app/twinedForm.ts`, written again in TypeScript. This file is what the app runs; `tree.py` is where a change is tried first. The base trunk of eight roots, the higher tiers, the fans at the tips, the root collar, the roots and the warm bark tint exist only in the app so far, so Blender renders look darker than the app. |
| The bark (`bark_graph`), baked by `bake()` | `ui/app/bark/bark-color.jpg`, `bark-normal.jpg`, `bark-gold.jpg`, loaded by `ui/app/TwinedTree.tsx`. |
| Light, sky, hill | Nothing. The app has its own scene (`ui/app/Scene.tsx`); the Blender light only imitates it. |

The textures tile: one repeat covers `TAU * RU` texture units along the wood and once around it.
`bark-gold.jpg` carries the gold in red and blue and the roughness in green, so it serves as `metalnessMap` and `roughnessMap`.

## How to use it

1. Open Blender (5.x), a new file, and save it into this folder.
2. In the Scripting tab run:
   ```python
   HERE = "/path/to/ftree/docs/design/blender"
   exec(open(HERE + "/tree.py").read())
   setup(); build("E"); grow("E"); show("E")
   ```
3. Change parameters in `tree.py` (`BASE`, `VARIANTS["E"]`, `bark_graph`), run again, look.
   `shot(path)` renders a still, `check("E")` reports kinks and wood that comes too close to a card.
4. When the bark changed, run `bake(HERE + "/../../../ui/app/bark")` and commit the three images.
5. When the form changed, carry the change over to `ui/app/twinedForm.ts` and run `node app/twinedForm.check.mjs` in `ui/`.

## Known differences between Blender and the app

- Card angles: Blender lays the family out itself (`layout()` in `tree.py`), the app uses `ui/app/twinedLayout.ts`. Both keep families together with air between them, but the app centres the family on the front.
- Free branches: Blender draws all chance from one sequence seeded with the family id. The app seeds every free branch with its own name, so it keeps its shape while the family grows, and it has no filler limbs yet.
- Gold: Blender shows real reflections. The app has no environment map, so the gold is half metal and glows a little instead.
