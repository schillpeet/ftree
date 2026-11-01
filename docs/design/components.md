# Components

Every component uses only the tokens in [tokens.css](tokens.css); none of them knows the theme.
Reference: boards 4 (TRON) and 5 (3D) on the canvas linked in [README.md](README.md).

## Glass surface

- Background `--panel` (menus and popovers `--panel-strong`), `backdrop-filter: var(--blur-glass)`, 1px `--border`.
- Used by header controls, dock, person panel, person pills, menus, welcome and invitation cards.

## Header (all signed-in screens)

- Left: f-monogram in `--accent` and the wordmark "ftree" in `--font-display`.
- Centre: family switcher – people icon, family name in `--font-display`, divider, chevron; opens the families list.
- Right, in this order: theme segment (3D | TRON), language segment (DE | EN), "Evolution" with DEV badge (only with "Entwicklertools"), burger.
- Controls are `--size-control` high with `--radius-control`; segments use `--radius-pill`, the active option `--segment-on`.

## Burger menu (top right)

- Familien, Darstellung (3D · TRON), Momentaufnahme, GEDCOM importieren, Feedback, divider, Abmelden.
- No primary actions here; adding people lives in the dock.

## Evolution panel (developers only)

- Opens below its header button; sections "Ansicht" (zoom, Front / Oben / Orbit) and "Vorschau" (crown scale, relation spacing), plus toggles for connection lines and light orbs.
- Hidden entirely without the "Entwicklertools" permission; opening it closes the burger menu and vice versa.

## Bottom dock

- Centred, `--radius-dock`, 44px above the bottom edge.
- Primary "Person" (`--primary`, `--size-dock-primary`, `--radius-dock-primary`), then Suchen, Einladen, Ansicht as icon-over-label buttons.
- "Person" highlights the "+" slots and explains "Tippe auf ein + am Baum".

## Person card

- The card shape follows the theme; size, position, and behaviour do not.
- `3d`: papyrus scroll as today (`.scroll` in `ui/app/globals.css`: rod, torn sheet, curl), about 104px wide in the overview, with initials or photo, name, and years.
  - Signed-in person: small "DU" badge in `--accent` on the rod; selected scroll gets a soft `--glow` halo.
- `tron`: glass pill, `--size-person-pill` high, `--radius-pill`, `--node` background, avatar on `--avatar`, name, one line of years or role.
  - Signed-in person: border `--line-on` plus a ring and glow in `--glow`.
- Both: dimmed (`opacity .62`, desaturated scroll or `--avatar-dim`) when a lineage is highlighted and the person is not part of it.

## Relative slots ("+")

- Dashed 1.5px `--slot-border`, `--radius-pill`, `--size-slot` high, label "+ Mutter", "+ Vater", "+ Partner:in", "+ Kind".
- Shown around the selected person only for relations that are still missing.
- Click opens the quick-add popover at the slot: Vorname (focused), Nachname (prefilled from the person for father and child), Jahr; Enter saves, Esc closes.
- After saving a mother the popover moves on to the father; a toast confirms "<Name> wächst jetzt in deinem Baum".

## Connection lines

- Thin (about 1.3px) lines in `--line-dim`; the selected person's ancestors, descendants, and partner switch to `--line-on` with a soft glow underneath.
- Partners: one horizontal line between the two cards at card height. Children: a line from the middle of that partner line straight down, across, and down to the top of the child's card (in `3d` to the scroll's rod).
- `3d` rounds the two bends with an 8px radius; `tron` keeps sharp right angles.
- Lines never run through a card and never start or end in empty space.
- Replaces today's thick light tubes in the 3D scene, which overlap the crown and each other.

## Person panel (right)

- Eyebrow "AUSGEWÄHLT" in `--font-mono` and `--accent`, name in `--font-display`, years, then rows Eltern / Partner:in / Kinder.

## Intro tour

- Three glass tooltips, skippable: "Das bist du." (camera, drag, zoom) → "Tippe auf ein +" → "Alles Wichtige unten" (dock, header).
- Shown once per user after the first tree is created or an invitation is accepted.

## Welcome card (signed in, no tree)

- Glass card left over the blurred scene: eyebrow "Willkommen bei ftree", title "Lass uns deinen Baum pflanzen.", "Er beginnt mit dir – stimmt das so?".
- Live preview of the user's own card; first and last name prefilled from the account, birth year optional.
- Primary "Baum pflanzen"; links "Stammbaum-Datei importieren (GEDCOM)" and "Erst die Beispielfamilie ansehen".
- On submit the scene sharpens and the tree moves to the centre; the user's card appears in the crown.

## Invitation card

- Centred glass card: inviter avatars, "<Name> hat dich in den Baum der Familie <Name> eingeladen.", chips (people, generations, last activity).
- Row "Du hängst schon im Baum als <Name> · <Jahr> · <Beziehung>" with a "Nicht ich" link instead of a separate "Is this you?" step.
- Primary "Einladung annehmen" leads into the tree focused on the user, with a task list (check your data, photo, your branch, a memory).

## Landing (signed out, `/`)

- Scene background, header with wordmark, glass navigation (So funktioniert's, Privatsphäre, Beispielfamilie, Anmelden), theme and language segments, burger.
- Centre: chip "Privat · nur für eure Familie · Open Source", title "Eure Familie. Ein Baum, der mitwächst.", one sentence, "Baum anlegen" and "Beispielfamilie ansehen".
- Three glass step cards above the legal line.

## Legal line

- Bottom centre, 12px, `--muted`: version · Nutzungsbedingungen · Datenschutz; on every screen, below the dock where there is one.
