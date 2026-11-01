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

- An invitation waits for the invited person on the server: until they accept it they may only look at the tree, and they can put it aside ("Später entscheiden") or decline it (2026-11-01).
- A selected card is framed with all its slots and moved beside the person panel; editing from the tree's pencil slot opens the form on the left, with the card on the right (2026-11-01).
- The themes are called "3D" and "TRON" in the UI (not "Abend").
- The landing page lives at `/home` and is public (Cloudflare Access bypass for `/home` and its static assets); `/` redirects to `/home`, and the ftree logo in the header links there; signed-in users go on to their last tree from the landing through `/start` (2026-11-01).
- The landing navigation holds only "So funktioniert's", with no entry the hero buttons or the footer repeat; the three steps moved to `/home/how` and are explained in more detail (2026-11-01).
- The landing header carries a glass sign-in chip ("Angemeldet als <Name>" / "Anmelden", to `/start`), also on `/home/how` and `/home/example`; `/home/how` and `/home/example` have a "← Zurück" control to `/home` (2026-11-01).
- The landing hero is the same in 3D and TRON: the headline's bottom at 61.8 % of the viewport height, the chip with the GitHub link below the headline (2026-11-01).
- The 3D start view is lower and closer (tree ~60 % of the height, horizon ~57 % on desktop), and the horizon haze is warmer (2026-11-01).
- Only invited (allowed) users can sign in; the welcome card is for signed-in users who are not assigned to any tree yet.
- The burger menu stays, top right, for secondary actions; language (DE/EN) stays visible in the header.
- "Evolution" is a header button with a DEV badge, shown only with the "Entwicklertools" permission.
- Terms and privacy sit in one small line at the bottom centre (version · Nutzungsbedingungen · Datenschutz), below the dock.
- Connection lines use the accent colour (amber in 3D) – thin, dim by default, glowing for the selected lineage.
- In 3D, people stay papyrus scrolls; only TRON uses glass pills (2026-11-01).
- "3D" is today's organic tree, "TRON" today's experimental grid view; the tiered tree moves into the evolution panel (2026-11-01).
- The burger menu has no appearance row, since the header always shows the 3D | TRON segment; developers pick the appearance (including the tiered tree) in the Evolution panel's "Ansichts-Labor" (2026-11-01).
- The administration is called "Admin-Tool" in the UI; developer tools are granted with a visible switch on the person's page, and the people list has a filter for who holds them (2026-11-01).
- The Evolution button sits left, right after the wordmark, followed by an "ADM" status chip for admin sessions; the Evolution panel opens on the left (2026-11-01).
- The Evolution button shows everywhere for holders of the developer tools, the public pages included, and Admin-Tool in the burger menu has an external-link icon (2026-11-01).
- The invitation card shows on the first visit of a shared tree; sharing keeps granting access right away, there is no pending state (2026-11-01).
- The signed-in person is a member linked to the user in the BFF, not guessed from the name (2026-11-01).

## Open questions

- Pre-rendered landing still vs. short video loop of the scene; the landing uses `ui/app/home/landing.jpg` (the prototype's scene still) for now.

## Changing the design

1. Try it on the canvas (or a new page on it) first.
2. Update `tokens.json`/`tokens.css` and the affected section in `components.md`.
3. Add a line to "Decisions" with the date if it changes a rule above.
