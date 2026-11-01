# Design

This folder is the single source of truth for how ftree looks and feels.
If code and this folder disagree, this folder wins until it is updated.

## Current direction: "Horizont" (v2, 2026-11-01)

- Prototypes (interactive canvas, page "Version 2 · Horizont"): https://claude.ai/artifact/NFx5oNnHNpLBUWvxiXJ6Az
- The canvas is private to the owner; share it from its Share menu before linking it to others.
- Reference boards on that page: 1 Landing, 2 Welcome (signed in, no tree), 3 Invitation, 4 TRON view, 5 3D view.
- Boards 4 and 5 are built from the same markup and differ only in tokens; they are the reference for "same elements, different theme".

## Principles

- One set of components, two themes: `3d` (default) and `tron`. Components never branch on the theme; only tokens change.
- The horizon is the brand motif: a wide view, a single tree in the middle, calm ground below for UI.
- The real Three.js scene is the background everywhere (landing included, as a pre-rendered still or short loop); no separate illustration style.
- Glass surfaces over the scene: neutral dark glass with blur, never tinted purple.
- Warm amber (`3d`) or cyan (`tron`) is the only accent; it marks the signed-in person, highlighted lineage lines, and the DEV badge.
- Fast over guided: no multi-step stepper; one welcome card, then the tree with a skippable three-step intro.
- The main action ("Person") is always visible in the bottom dock; adding relatives starts from a person via dashed "+" slots.

## Files

- [tokens.json](tokens.json) – design tokens per theme (source).
- [tokens.css](tokens.css) – the same tokens as CSS custom properties, the shape `ui/` should adopt.
- [components.md](components.md) – the building blocks and their rules.
- [journeys.md](journeys.md) – new, invited, and returning users.
- [plan.md](plan.md) – what has to change in `ui/`, split into pull requests.
- [prototypes/](prototypes/) – sources of the canvas boards, for reference.

## Decisions

- The themes are called "3D" and "TRON" in the UI (not "Abend").
- `/` shows the landing page to signed-out visitors; signed-in users go straight to their tree.
- Only invited (allowed) users can sign in; the welcome card is for signed-in users who are not assigned to any tree yet.
- The burger menu stays, top right, for secondary actions; language (DE/EN) stays visible in the header.
- "Evolution" is a header button with a DEV badge, shown only with the "Entwicklertools" permission.
- Terms and privacy sit in one small line at the bottom centre (version · Nutzungsbedingungen · Datenschutz), below the dock.
- Connection lines use the accent colour (amber in 3D) – thin, dim by default, glowing for the selected lineage.
- In 3D, people stay papyrus scrolls; only TRON uses glass pills (2026-11-01).

## Open questions

- Landing behind Cloudflare Access: `/` must be reachable without sign-in (Access bypass for `/` and static assets, or the landing served outside the protected app).
- Pre-rendered landing still vs. short video loop of the scene.
- 3D scene tuning: lower, closer camera (tree ~50–60 % of the height, horizon ~55 %), warmer horizon light.

## Changing the design

1. Try it on the canvas (or a new page on it) first.
2. Update `tokens.json`/`tokens.css` and the affected section in `components.md`.
3. Add a line to "Decisions" with the date if it changes a rule above.
