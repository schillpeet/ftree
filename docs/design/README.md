# Design

This folder describes how ftree looks and feels, and it is where design changes are worked out together.
It describes `main` as it is; if code on `main` and this folder disagree, the folder is out of date and gets fixed.
Start with the click dummy: open [dummy/index.html](dummy/index.html) in a browser (no build, no server).

## Current direction: "Horizont" (v2, 2026-11-01)

- The click dummy ([dummy/](dummy/)) shows the journeys of visitors, new, invited, and returning users in both themes.
- The first prototypes lived on a private design canvas; their sources in [prototypes/](prototypes/) are kept for history only.

## Principles

- One set of components, two themes: `3d` (default) and `tron`. Components never branch on the theme; only tokens change.
- The horizon is the brand motif: a wide view, a single tree in the middle, calm ground below for UI.
- The real Three.js scene is the background everywhere (landing included, as a pre-rendered still or short loop); no separate illustration style.
- Glass surfaces over the scene: neutral dark glass with blur, never tinted purple.
- Warm amber (`3d`) or cyan (`tron`) is the only accent; it marks the signed-in person, highlighted lineage lines, and the DEV badge.
- Exception today: TRON draws the selected person's blood relatives in amber besides the cyan lineage (see "Known deviations from the tokens" in components.md).
- Fast over guided: no multi-step stepper; one welcome card, then the tree with a skippable three-step intro.
- The main action ("Person") is always visible in the bottom dock; adding relatives starts from a person via dashed "+" slots.

## Files

- [tokens.json](tokens.json) – design tokens per theme (source).
- [tokens.css](tokens.css) – the same tokens as CSS custom properties, the shape `ui/` should adopt.
- [components.md](components.md) – the building blocks and their rules.
- [journeys.md](journeys.md) – new, invited, and returning users.
- [plan.md](plan.md) – what has to change in `ui/`, split into pull requests, and what is planned but not built.
- [dummy/](dummy/) – the click dummy: plain HTML on top of `tokens.css`, one page per journey.
- [prototypes/](prototypes/) – sources of the old canvas boards, historical.

## Decisions

- An invitation waits for the invited person on the server: until they accept it they may only look at the tree, and they can put it aside ("Später entscheiden") or decline it (2026-11-01).
- A selected card is framed with all its slots and moved beside the person panel; editing from the tree's pencil slot opens the form on the left, with the card on the right (2026-11-01).
- The themes are called "3D" and "TRON" in the UI (not "Abend").
- The landing page lives at `/home` and is public (Cloudflare Access bypass for `/home` and its static assets); `/` redirects to `/home`, and the ftree logo in the header links there; signed-in users go on to their last tree from the landing through `/start` (2026-11-01).
- The landing page has no navigation: the hero offers "Baum anlegen" / "Zu deinem Baum" and "So funktioniert's"; the three steps and the example family live on `/home/how` (2026-11-02).
- The public headers show only what switches, plus "Anmelden" for signed-out visitors; "Angemeldet als <Name>" sits as a small line under the main button, and signed out that line says access needs an invitation (2026-11-02).
- `/home/how` and `/home/example` have a "← Zurück" control to `/home` (2026-11-01).
- Signed in, the steps on `/home/how` are links into the own tree and tick off what is done (2026-11-02).
- The GitHub link sits in the legal line at the bottom, not in the hero (2026-11-02).
- The TRON landing gets a horizon: night sky, glowing horizon line, mountain ridge, a perspective floor grid like the TRON tree view, and a light tree (a beam branching like a circuit into glowing nodes) in the middle (2026-11-02).
- `/home/how` is for reading: in TRON it has no light tree, and its horizon sits below the buttons (2026-11-02).
- In TRON, "Zu deinem Baum" and "Beispielfamilie ansehen" ride into the tree: the page derezzes into scanlines, a light trail shoots to the horizon and the floor rushes past, then the scene's camera drives in low over the grid and rises into the start view; the click dummy leaves the ride out, as it has no scene (2026-11-02).
- In TRON, the wordmark in a tree or the example family rides back to the landing: the camera sinks onto the grid and pulls back along a light trail until the tree is a point on the horizon, a flash fades to black, and the landing builds itself up in scanlines while its trail retracts into the horizon (2026-11-02).
- The TRON animations are a feature the person switches on: an "Animation" toggle left of the 3D | TRON segment, off by default; switched on while the system reduces motion, a hint names that setting instead of overriding it (2026-11-02).
- The landing hero is the same in 3D and TRON: the headline's bottom at 61.8 % of the viewport height, the "Privat · nur für eure Familie" chip below the headline (2026-11-01).
- The 3D start view is lower and closer (tree ~60 % of the height, horizon ~57 % on desktop), and the horizon haze is warmer (2026-11-01).
- Only invited (allowed) users can sign in; the welcome card is for signed-in users who are not assigned to any tree yet.
- The burger menu stays, top right, for secondary actions; language (DE/EN) stays visible in the header.
- "Evolution" is a header button with a DEV badge, shown only with the "Entwicklertools" permission.
- Terms and privacy sit in one small line at the bottom centre (version · Nutzungsbedingungen · Datenschutz · GitHub), below the dock.
- Connection lines use the accent colour (amber in 3D) – thin, dim by default, glowing for the selected lineage.
- In 3D, people stay papyrus scrolls; only TRON uses glass pills (2026-11-01).
- "3D" is today's organic tree, "TRON" today's experimental grid view; the tiered tree moves into the evolution panel (2026-11-01).
- The burger menu has no appearance row, since the header always shows the 3D | TRON segment; developers pick the appearance (including the tiered tree) in the Evolution panel's "Ansichts-Labor" (2026-11-01).
- The administration is called "Admin-Tool" in the UI; developer tools are granted with a visible switch on the person's page, and the people list has a filter for who holds them (2026-11-01).
- The Evolution button sits left, right after the wordmark, followed by an "ADM" status chip for admin sessions; the Evolution panel opens on the left (2026-11-01).
- The Evolution button shows everywhere for holders of the developer tools, the public pages included, and Admin-Tool in the burger menu has an external-link icon (2026-11-01).
- The invitation card shows on the first visit of a shared tree; sharing keeps granting access right away, there is no pending state (2026-11-01).
- The signed-in person is a member linked to the user in the BFF, not guessed from the name (2026-11-01).
- This folder describes `main`; design work happens in the click dummy in the repository instead of the private canvas, so others can join (2026-11-02).

## Open questions

- Pre-rendered landing still vs. short video loop of the scene; the landing uses `ui/app/home/landing.jpg` (the prototype's scene still) for now.

## Working with the design system

1. Branch from `main` as AGENTS.md describes, then try the idea in the dummy (`dummy/*.html`, `dummy/dummy.css`) or in `tokens.css`; the dummy reads `tokens.css` directly, so a token change shows on every dummy page.
2. Push the branch; the other person checks it out and opens `dummy/index.html` to review, and both talk it through on the branch or its PR.
3. Record the outcome as a dated line under "Decisions" and keep `tokens.json` equal to `tokens.css`.
4. Build it in `ui/`: copy `tokens.css` to `ui/app/tokens.css` (`node ui/app/tokens.check.mjs` checks they match), change the components, and update their section in `components.md`.
5. Once the change is on `main`, the dummy shows the new state; it always mirrors `main` plus the ideas on open branches.
- Larger changes get an entry in [plan.md](plan.md) first, split into pull requests.
