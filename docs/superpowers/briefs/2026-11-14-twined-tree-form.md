# Brief: give the twined tiered tree its form

Paste this as the prompt for the form session.

---

You are shaping the "Stufenbaum" (tiered tree) of ftree, a shared family-tree web app (Next.js + React Three Fiber, `ui/`).
Read `AGENTS.md`, `docs/project-overview.md`, `docs/superpowers/specs/2026-11-14-twined-tiered-tree-design.md`, `ui/app/twinedLayout.ts` and `ui/app/TwinedTree.tsx` first.
To view it: `./start.sh`, open `http://localhost:3000`, pick a family, Evolution panel → "Ansichts-Labor" → Darstellung "Stufenbaum". The local families "Stufen 1 Person" … "Stufen 7 Grosse Familie" cover the cases below.

## The goal

An iconic, epic, clean and emotional tree: a single noble silhouette you would recognise from far away, in the spirit of the golden tree in *The Fountain*.
Minimal, not busy: few, strong forms; the eye reads the family at a glance.
Today it is a functional sketch of plain tubes; the logic is right, the form is not.

## Rules that must stay (they carry the meaning)

- One tier per generation; the eldest at the top, the youngest at the bottom.
- Everyone with a partner or children has a strand of their own from the ground up to their tier; a couple's strands visibly wind around each other (three strands for a second partner).
- A childless person without a partner whose parents are in the tree is a twig of the parents' braid, one tier below them.
- The trunk is thickest at the ground (all couples) and thins upwards as younger couples branch off; the eldest couple reaches the top.
- Two families joined by marriage may fork the trunk; that is welcome.
- Every card hangs free, parents above their children, and the front stays free so the trunk shows (see `FRONT_GAP` in `twinedLayout.ts`).
- The tree is generated from the family data and must work from 1 to ~100 people; nothing may be hand-placed per family.

## What is yours to change

- Proportions: trunk girth against card size, tier height, how far branches reach, card size and orientation (cards seen edge-on at the sides are a known problem; turning them towards the camera is fine).
- How strands merge: fusing into one sculpted trunk with readable strand ridges, root flare and roots into the hill, how a braid leaves the trunk (sweeping curves instead of kinks), a crown above the eldest couple.
- Tube profiles, tapering, twist rate, subtle noise; geometry may move to a custom mesh or shader as long as it stays generated.
- You may change the plan module, but keep its checks green (`node app/twinedLayout.check.mjs`) and add checks for new rules.

## Constraints

- Growth is being built in parallel: strands grow from the ground to their card, new tiers push the tree up. Keep every strand and twig a separate, identifiable piece with a length parameter from ground (0) to card (1), so it can still be drawn partially; check `ui/app/twinedGrowth.ts` if it exists by then.
- No leaves, lianas or final materials yet; the golden look is developed in Blender separately (`/Users/petschi/code/blender-playground`, experiment 04 has a gold material and a glTF export). Use a neutral material that shows form under the existing light.
- Performance: a family of 100 must stay smooth on a laptop.
- Follow the repo rules in `AGENTS.md` (branch first, English code and commits, show the diff before committing).

## How to work

Start with 2–3 quick silhouette variants for the large family, show screenshots, let the user pick, then refine. Check every change in the browser on at least "Stufen 2 Paar", "Stufen 4 Drei Generationen" and "Stufen 7 Grosse Familie".
