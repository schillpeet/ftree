# Components

Every component uses only the tokens in [tokens.css](tokens.css); none of them knows the theme.
Reference: boards 4 (TRON) and 5 (3D) on the canvas linked in [README.md](README.md).

## Glass surface

- Background `--panel` (menus and popovers `--panel-strong`), `backdrop-filter: var(--blur-glass)`, 1px `--border`.
- Used by header controls, dock, person panel, person pills, menus, welcome and invitation cards.

## Header (all signed-in screens)

- Left: f-monogram in `--accent` and the wordmark "ftree" in `--font-display`.
- Centre: family switcher – people icon, family name in `--font-display`, divider, chevron; opens the families list.
- Left, after the wordmark: "Evolution" with DEV badge (only with "Entwicklertools"), then the admin badge.
- The admin badge is a status chip, not a button: check icon and "ADM" in the accent colour, title "Als Admin angemeldet"; it shows only in an admin session, with or without the Evolution button, and shrinks to the check mark on phones.
- Right, in this order: theme segment (3D | TRON), language segment (DE | EN), burger; the public pages have their sign-in chip first.
- The Evolution panel opens on the left, under the button.
- Controls are `--size-control` high with `--radius-control`; segments use `--radius-pill`, the active option `--segment-on`.

## Burger menu (top right)

- Profil, Familien, Momentaufnahme, GEDCOM importieren, Feedback, Admin-Tool (only with the permission), divider, Abmelden.
- Admin-Tool ends in an external-link icon instead of a chevron, since it leaves the page (and, in production, the host); entries that open a board keep the chevron.
- No appearance row: the 3D | TRON segment is always in the header, on phones too, where its segments get tighter.
- The divider is a thin `--border` line across the menu, not a bare `hr` (which a grid shrinks to a dot).
- No primary actions here; adding people lives in the dock.

## Evolution panel (developers only)

- Opens below its header button; sections "Ansichts-Labor" (a select over every appearance: 3D, Stufenbaum, TRON), "Ansicht" (zoom, Front / Oben / Orbit) and "Vorschau" (crown scale, relation spacing), plus toggles for connection lines and light orbs.
- Hidden entirely without the "Entwicklertools" permission; opening it closes the burger menu and vice versa.
- The button also shows on the public pages (`/home`, `/home/how`, `/home/example`) for signed-in holders, from the quiet `/me` probe; there the panel is the full one on the example, and only the "Ansichts-Labor" with a hint on the pages without a scene.

## Admin people (`/admin/people`)

- The admin area is called "Admin-Tool" (menu entry, page title, audit category).
- Developer tools are a visible on/off switch on the person's page under "Rechte" with a hint (for admins it is on and disabled, "Für Admins immer an"); the list only shows a badge.
- A chip "Mit Entwicklerwerkzeugen" in the filters lists everyone who holds them, admins included.
- The "⋯" menu holds only "Umbenennen".
- A failed change shows the BFF's problem, for example that no Cloudflare Access seat is left.

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
- The camera backs off far enough that the selected card and all its slots fit into about half of the free view, and shifts the card into the middle of the part the panel leaves free (`ui/app/cardFrame.ts`).
- Editing a person from the tree opens the form on the left instead, and the card moves to the right until the form closes; below 700px the panel stays a full-width sheet.

## Card slots

- Dashed "+ Mutter / + Vater" above, "+ Partner:in" right and "+ Kind" below the selected card; a round pencil left of it opens the edit form.

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
- The title runs over three lines, the tree's name alone in the middle: "Du wurdest in den Baum / <Name> / eingeladen."
- Primary "Einladung annehmen" leads into the tree focused on the user, with a task list (check your data, photo, your branch, a memory).
- Links "Später entscheiden" (the card gives way to a small reminder above the dock with "Antworten"; it is back on the next visit) and "Ablehnen" (asks once, then removes the tree from the user's list).
- Until the invitation is accepted, Person, Suche and Einladen in the dock stay disabled ("Nimm zuerst die Einladung an"); the server allows only viewing.

## Landing (signed out, `/`)

- Scene background, header with wordmark, glass navigation with the single entry "So funktioniert's" (the other destinations are the hero buttons and the legal line, so nothing appears twice), a glass status chip, theme and language segments.
- The status chip reads "Angemeldet als <Name>" when signed in (display name, else email) and "Anmelden" otherwise; both lead to `/start`. It comes from a quiet `/me` probe, without the permissions provider.
- Centre: chip "Privat · nur für eure Familie · Open Source", title "Eure Familie. Ein Baum, der mitwächst.", one sentence, "Baum anlegen" and "Beispielfamilie ansehen".
- 3D: the hero is smaller and sits at the bottom, so the crown and trunk of the still stay visible; TRON keeps the centred hero.
- The three steps are not on the landing page; "So funktioniert's" opens `/home/how`.

## How it works (`/home/how`)

- Landing look (dimmed still or TRON grid, same header), a "← Zurück" control next to the wordmark leading to `/home`, and the status chip.
- Title, one intro sentence, three glass step cards (number, title, short line, two sentences of explanation), then "Baum anlegen" and "Beispielfamilie ansehen".

## Example family (`/home/example`)

- Header with wordmark, "← Zurück" (to `/home`), the title card, the status chip, theme and language segments; "Eigenen Baum anlegen" at the bottom.

## Legal line

- Bottom centre, 12px, `--muted`: version · Nutzungsbedingungen · Datenschutz; on every screen, below the dock where there is one.
