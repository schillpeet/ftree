# Components

Every component should use only the tokens in [tokens.css](tokens.css) and must not know the theme; the exceptions that exist today are listed under "Known deviations from the tokens".
This file describes `main` as it is; UI copy is quoted from `ui/app/i18n.ts` (German).
The click dummy in [dummy/](dummy/) shows the same components in their journeys.

## Glass surface

- Background `--panel` (menus and popovers `--panel-strong`), `backdrop-filter: var(--blur-glass)`, 1px `--border`.
- Used by header controls, dock, person panel, person pills, menus, boards, welcome and invitation cards, toasts.

## Header (all signed-in screens)

- Left: f-monogram in `--accent` and the wordmark "ftree" in `--font-display`, a link to `/home`.
- Left, after the wordmark: "Evolution" with DEV badge (only with "Entwicklertools"), then the admin badge.
- The admin badge is a status chip, not a button: check icon and "ADM" in the accent colour, title "Als Admin angemeldet"; it shows only in an admin session, with or without the Evolution button, and shrinks to the check mark on phones.
- Centre: the prompt button `<user>:<family>` (`HeaderPrompt` in `ui/app/Header.tsx`, shared with the landing page) – the user in `--muted`, the family name in `--font-display`; in the tree a click opens the family card, on the landing page the families board. In GRID all in `--font-mono`, the user in `--accent` with glow.
- No tree switcher in the header: trees are switched on the Familien board (sheet) in the burger menu.
- Below the family button: the presence bar (see "Live presence").
- Right, in this order: the card density segment (S | M, titles "Schlank: Name und Jahre" and "Mehr: voller Name, Geburtsname und Daten"), in TRON the "Animation" toggle, theme segment (3D | GRID), language segment (DE | EN), burger; the public pages have no sign-in chip.
- The wordmark's tooltip reads "Zur Startseite"; the burger menu's first entry, "Startseite" with a house icon, leads there too, in TRON as the ride back.
- Without `tree.appearance` only TRON is offered and 3D is disabled with the title "Demnächst"; every signed-in user holds the permission today, so this only affects signed-out visitors.
- Phones: the Evolution button shrinks to its icon and the density segment hides below 480px; the family button moves to a second row below 700px.
- Controls are `--size-control` high with `--radius-control`; segments use `--radius-pill`, the active option `--segment-on`.

## Burger menu (top right)

- Profil, Familien (with `family.create`), Momentaufnahme, Feedback (only if an operator email is configured; a `mailto:` link), Admin-Tool (with `users.view`), divider, Abmelden.
- Momentaufnahme downloads `ftree-<Name>-<yyyy-mm-dd>.png` and changes nothing on screen.
- Abmelden goes to the Cloudflare Access logout.
- Opening Profil or Familien closes the menu; the board is a sheet (see "Sheet" and "Menu boards").
- On the landing page (`ui/app/home/HomeMenu.tsx`) the menu comes after the theme and language segments: signed in "Profil", "Familien" (with `family.create`), divider, "Abmelden"; signed out only "Anmelden" (to `/login`). "Startseite", "Momentaufnahme", "Feedback" and "Admin-Tool" are not offered there.
- While the quiet `/me` probe runs the burger is disabled.
- Admin-Tool ends in an external-link icon instead of a chevron, since it leaves the page (and, in production, the host); entries that open a board keep the chevron.
- No appearance row: the 3D | GRID segment is always in the header, on phones too, where its segments get tighter.
- The divider is a thin `--border` line across the menu, not a bare `hr` (which a grid shrinks to a dot).
- No primary actions here; adding people lives in the dock.
- GEDCOM import lives only in the Familien board; it has no menu entry of its own.

## Menu boards (Profil, Familien)

- Both are a `Sheet` (see "Sheet"): by default `place="card"`, a centred glass card over a veil, on the landing page and in the tree; they no longer sit beside the burger menu. Below 700px they are bottom sheets.
- On the landing page they open in place: `KnownMe` in `ui/app/Permissions.tsx` hands the landing's quiet `/me` probe to them, so no permissions provider is needed.
- Profil (`ProfilePanel.tsx`): a header with an initials avatar, the name in `--font-display` with inline edit (pencil, input "Dein Name", save/cancel; blank falls back to the email; saving refreshes `/me` everywhere), the email, a chip "verifiziert" (or "nicht verifiziert (Dev)") and an admin chip for admins.
- Profil sections: "Konto" ("Anmeldung: Code per E-Mail (Cloudflare Access)") and "Entwickler-Tools" ("Entwickler-Tools aktiv" is an accent badge with a soft pulsing glow, static under `prefers-reduced-motion`; without the permission a muted "nicht aktiv" line).
- A link row "Familien – <n> Familien · <m> Einladungen offen" opens the families board (only with `family.create`); the person's accepted legal documents stay listed.
- At the bottom, "Konto löschen": a disabled "Account löschen" button with a "Demnächst" badge and the hint "Das kommt in einer späteren Version. Bis dahin löschen wir dein Konto und deine Daten auf Anfrage.", plus a "Schreib uns" `mailto:` link when an operator email is set. Deleting accounts is planned, not built.
- The role row, "Meine Familien" and "Ausstehende Einladungen" left the profile.
- Familien (`FamiliesPanel.tsx`): groups "Eigene Familien" (with "<n> von 5") and "Mit mir geteilt"; each row has a drag grip (admins reorder, "Zum Umsortieren ziehen"), the name, a marker "aktuell" and an accent edge for the current family, "<n> Personen · <m> Generationen", a chip with the role or "Einladung offen" (class `acct-chip-ok`) when the person has not accepted the invitation into that family; in the tree the row also has the eye toggle and the family-card pencil.
- Below the lists, "Von dir eingeladen": the invitations the person sent (`GET /me/invitations`), each "<email> · <Familie>", "als <Rolle> · eingeladen am <Datum>" and a status chip.
- The footer is fixed at the bottom of the sheet: "Neue Familie" and "GEDCOM importieren", both disabled at five own trees ("Du besitzt bereits 5 Familien; lösche eine, bevor du eine neue anlegst."), a round ⓘ button (`aria-expanded`) that toggles a short text on what GEDCOM is and what the importer does (new family, counts toward the limit, .ged up to about 5 MB read as UTF-8, up to 100 people, no photos or card positions), and the limit note.
- On the landing page, choosing a family only makes it the current one (stored as `ftree.lastTree`, `ui/app/lastTree.ts`) and the prompt changes; "Weiter zum Baum" opens it. "Neue Familie" there leads to `/start?create=1`, which opens the new-family form in the tree.

## Sheet

- `ui/app/Sheet.tsx` and `sheet.css`: the one surface for Profil, Familien and the relation legend; it renders in `document.body` through a portal, so the header's stacking context and the dock never cover it.
- `place="card"`: a centred glass card (at most 580px wide) over a veil, between the header (76px from the top) and the dock zone (128px from the bottom).
- `place="corner"`: a narrow panel bottom right (340px), above the dock zone between 701 and 1100px.
- Below 700px every sheet is a bottom sheet with a grip and three heights: peek 30dvh, half 52dvh, full `100dvh - 48px` (`ui/app/sheetSnap.ts`, checked by `sheetSnap.check.mjs`). A tap on the grip steps through them, a drag rests at the nearest, and one pulled far down closes the sheet. While a sheet is open `<html data-sheet-open>` hides the dock on phones.
- Escape, the × and the veil close it.
- Z scale (tokens, `--z-*`): `--z-hud` 4, `--z-chrome` 6, `--z-panel` 7, `--z-sheet` 30; components take their layer from these instead of literals (`tokens.check.mjs` checks the copy in `ui/`).

## Family card

- Opens from the family name in the header or from the Familien board.
- View: "Familie", optional family photo, "<n> Mitglieder", "<n> Generationen", "Teilen" (owners only), then one list per generation with a chip per person that opens them; empty: "Noch keine Mitglieder."
- Edit and create ("Neue Familie"): "Familienname", family photo (add, change, remove), "Bilddarstellung" Füllend / Originalgröße, "Abbrechen" and "Speichern" ("Anlegen"), and "Familie löschen" for owners (native confirm).

## Evolution panel (developers only)

- Opens below its header button, on the left; sections "Ansichts-Labor" (a select over every appearance: 3D, Stufenbaum, TRON), "Ansicht" (zoom, camera), "Vorschau" (crown scale, relation spacing), "Uhrzeit", "Anheftpunkte", "Kartenstil" (Rolle im Baum, Rolle lesbar, Holzschild, Papyrus), toggles for connection lines, lineage, blood relatives, the relation legend, bundling, and light orbs.
- Options a view cannot use are disabled with "In dieser Ansicht nicht verfügbar".
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
- "Person" shows only with the right to add people and "Einladen" only with the right to share (owners); guests see Suchen and Ansicht.
- Sizing: the dock stays compact; items are at least 56px wide with 8px/10px padding, the primary button has 14px side padding, bar padding 5px and gap 2px; buttons reach about 44px through padding, icon and label.
- "Person" without a selection opens the add form; with a selection a toast "Tippe auf ein + am Baum" shows above the dock for 4 seconds.
- "Suchen" toggles the member search above the dock; "Einladen" opens the share dialog; "Ansicht" opens the popover "Kameraansicht" with Front, Oben, Orbit.
- Without a tree, Person and Einladen are disabled ("Öffne zuerst einen Baum"); while an invitation is open, Person, Suchen and Einladen are disabled ("Nimm zuerst die Einladung an").

## Member search

- A glass field above the dock with a search icon and "Mitglied suchen …"; arrows and Enter pick, Esc closes.
- Results read "Vorname Nachname (Jahr)"; none: "Keine Treffer"; a pick selects the person and flies there.
- Words match the start of name parts; one letter only given names ("M" → Marie, Karl Michael), two or more also surnames, ranked after given names.

## Person card

- The card shape follows the theme; size, position, and behaviour do not.
- `3d`: papyrus scroll (`.scroll` in `ui/app/globals.css`: rod, torn sheet, curl), about 104px wide in the overview, with initials or photo, name, and years.
  - Signed-in person: small "DU" badge in `--accent` on the rod; selected scroll gets a soft `--glow` halo.
- `tron`: round pill in the chip look (`.simple-name` in `ui/app/globals.css`, markup in `ui/app/SimpleTree.tsx`), `--size-person-pill` high and at most 132px wide, `--radius-pill`, `--node` background, 1px `--accent` edge, glass blur, `--font-ui` (mono in GRID) 500 12px with 0.04em tracking.
  - Content: a 30px ring in `--avatar` with the initials on `--hover`, the first name in capitals, and the years at 10px (no role line).
  - Lineage: a 14px glow; selected: 12 % larger, a `--line-core` (white) edge, a face mixed with 20 % `--accent`, filled initials, and a 26px glow; dimmed: edge and ring in `--avatar-dim`, grey at 30 % opacity.
  - Signed-in person: a 1.5px `--line-on` ring, a 14px glow and the "DU" badge.
- Density M: 3D cards add "geb. …" and the dates of birth and death instead of the years; GRID pills keep their size with three tight lines (full name, "geb. …", date of birth or years). No card shows the note.
- Placeholder (a nameless person): never "Unbekannt"; the role ("Elternteil", "Partner:in", "Kind", "Person") in italics, "?" in a dashed ring, and in GRID a dashed `--avatar-dim` edge with `--muted` text; the profile adds "noch nicht eingetragen" and, for editors, "Eintragen".
- Both: a spotlight on the selection: the person and everyone their panel lists stay lit, every other card is dimmed (grey, `opacity .35` on scrolls, `.3` on pills); without a selection a highlighted lineage dims the rest the same way; a presence dot shows when someone else views or edits the person.

## Relative slots ("+")

- Filled in `--accent` with `--accent-ink` text and a 1.5px `--accent` edge (cyan in GRID, amber in 3D), so actions never look like the outlined people; hover and open add a `--line-core` edge and a `--glow`; `--radius-pill`, `--size-slot` high, labels "+ Mutter", "+ Vater", "+ Elternteil" (parent of unknown gender), "+ Geschwister", "+ Partner:in", "+ Kind".
- Placed around the selected card: mother and father above, partner right, child below, and left of the card the sibling and, nearest to it, a round pencil that opens the edit form.
- In GRID the pills stand too close side by side for that, so mother and father sit above and pencil, sibling, partner, and child share one row below the pill, all between the rows.
- Shown only to editors and only for relations that are still missing.
- A click opens the quick-add popover at the slot, titled "Mutter von <Name>" and so on: Vorname (focused) and Nachname (prefilled from the person for father and child); "Hinzufügen ↵"; hint "Esc schließt · Details später im Profil", for a mother "Danach geht es direkt mit dem Vater weiter."
- After saving a mother the popover moves on to the father.
- While typing, up to five fitting people already in the tree are listed under the first name ("Schon im Baum"): ring with initials, name, years, and "verknüpfen" on the highlighted one; a pick links them, the button then reads "Neu anlegen ↵", and the toast says "<Name> ist jetzt verknüpft" without undo.
- After a partner the popover turns into "Auch Elternteil?": "Ist <Partner> auch Elternteil von <Kind>?" with "Ja ↵" and "Nein", one child with a single parent at a time.
- "Noch nicht bekannt", a dashed-underlined link below the fields, adds a placeholder; for a sibling of someone without parents the hint says a placeholder parent comes along.
- Each save shows a toast "<Name> wächst jetzt in deinem Baum" with "Rückgängig" for 6 seconds; undo deletes the person again.

## Connection lines

- `3d`: thin (about 1.3px) lines in `--line-dim`; the selected person's ancestors, descendants, and partners switch to `--line-on` with a soft glow underneath.
- `tron`: light trails (2026-11-03): every line 2px in `--line-dim` (a whiter cyan than the floor grid) on a 7px `--line-shadow`; the lineage 2.4px in `--line-on` over an 8px `--glow` with a 1.2px `--line-core` and, while animations play, a light pulse running from the ancestors down; junctions are solder pads, a dark dot in a ring of the line's colour.
- Partners: one horizontal line between the two cards at card height. Children: a line from the middle of that partner line straight down, across, and down to the top of the child's card (in `3d` to the scroll's rod).
- `3d` rounds the two bends with an 8px radius (`ui/app/scrollLines.ts`); `tron` keeps sharp right angles, routed like a circuit diagram (`ui/app/experimental/routing.ts`).
- Lines never run through a card and never start or end in empty space.
- `tron` additionally has:
  - three line styles: solid (parents and children, partners), dashed (separated or divorced), dotted (only non-biological parents);
  - junction dots at branches, and small hops where a partner line crosses another line without joining it;
  - a glyph above each partner line: ⚭ married (also widowed), ⚯ together, ⚮ divorced;
  - blood relatives of the selected person in a second, amber colour;
  - "▲ Eltern von <Name>" stubs where the parents are drawn elsewhere; a click opens them.

## Relation legend (`tron` only)

- Folded, a small glass chip "⚭ Beziehungen" bottom right, above the dock on phones and between 701 and 1100px.
- Unfolded, a corner `Sheet` (see "Sheet") with a one-column list, one row per line style and glyph, with the texts from `legend` in `ui/app/i18n.ts`; on phones a bottom sheet at half height while the dock steps aside.
- × and Escape fold it; an eye-off button hides it (the Evolution panel's "Legende der Beziehungen" brings it back). Pinning and dragging are gone.

## Person panel (right)

- Header: back arrow (after moving through relatives), pin ("Position fixieren"), pencil ("Bearbeiten", editors), and ×; the panel can be dragged.
- Body: photo or initials square, name in `--font-display`, "<Jahr> · <n> Jahre" (or the life span), facts (Geboren, Verstorben with date and place), an optional note, then groups Eltern, Partner (with the relationship, for example "zusammen" or "verheiratet seit …", and "frühere Partner anzeigen"), Kinder, and the folded groups Geschwister and Halbgeschwister; each relative is a chip that opens them.
- Without relatives: "Noch keine Verwandten zugewiesen."
- A presence hint names who else views or edits the person.
- The camera backs off far enough that the selected card and all its slots fit into about half of the free view, and shifts the card into the middle of the part the panel leaves free (`ui/app/cardFrame.ts`).
- Editing a person from the tree opens the form on the left instead, and the card moves to the right until the form closes; below 700px the panel stays a full-width sheet.

## Person form

- Titles "Mitglied hinzufügen" and "Person bearbeiten"; tabs "Persönliche Daten" and "Beziehungen".
- Data: Vorname, Nachname, Geburtsname (behind "Geburtsname hinzufügen"), Geboren am / in, Verstorben am / in, photo, Notiz.
- Relations: Eltern, Partner, Kinder, Geschwister, Halbgeschwister, each with a name search and "Neue Person „…“ hinzufügen"; partners carry a status (zusammen, verheiratet, getrennt, geschieden, verwitwet) with dates, parents a kind (leiblich, adoptiert, Stief, Pflege).
- The footer "Verwerfen" / "Person speichern" appears once something changed; deleting, removing a photo, and discarding use native confirms.

## Conflict dialog

- Modal when saving a person someone else changed meanwhile: "Jemand hat diese Person geändert", one explaining sentence, "Abbrechen", "Trotzdem überschreiben", "Neu laden" (focused).

## Share dialog ("<Familie> teilen")

- Glass dialog, draggable and pinnable; it does not close on an outside click.
- "Personen mit Zugriff": one row per person with a "du" badge, status (eingeladen, aktiv), role select (Eigentümer, Bearbeiter, Gast), "Besitz übertragen", and a trash icon; removing and transferring ask once inline.
- "Jemanden einladen": E-Mail, Rolle, "Einladen"; afterwards an invitation text with "Text kopieren" and the hint "Es wird keine E-Mail verschickt. Kopiere den Text und schick ihn selbst."

## Live presence (`ui/app/live`)

- Presence bar under the family name: one avatar with initials per person in the tree, faded when idle, a shield for admins, "+n" for overflow; the tooltip names the person and what they do.
- A click on someone else's avatar follows them: the camera and panel move with them, and a chip "Du folgst <Name>" with × ends it.
- Live toasts (up to three, 6 seconds): "<X> hat <Person> geändert", "… gelöscht", "<X> hat den Baum geändert".

## Intro tour

- Three glass tooltips, labelled "EINFÜHRUNG n/3" with "Überspringen" and "Weiter" ("Los geht's" on the last); Esc skips:
  1. "Das bist du." – camera, drag, zoom; under the own card.
  2. "Tippe auf ein +" – the dashed slots.
  3. "Alles Wichtige unten" – "Person hinzufügen, Suchen, Familie einladen, Ansicht. Einstellungen, Sprache und Darstellung findest du oben rechts."; above the dock.
- Shown once per browser after the first tree is planted or an invitation is accepted; not on an empty tree.

## Welcome card (signed in, no tree)

- Glass card left over a veil on the scene: eyebrow "Willkommen bei ftree", title "Lass uns deinen *Baum pflanzen.*", "Er beginnt mit dir – stimmt das so?".
- Live preview of the user's own card (scroll in `3d`, pill in `tron`), "Dein Name" until something is typed; Vorname (required) and Nachname prefilled from the account.
- Primary "Baum pflanzen" ("Wird gepflanzt …"); link "Stammbaum-Datei importieren (GEDCOM)" opens the Familien board.
- At five own trees a note explains the limit; if the tree was created but the user could not be added, a small card offers "Mich eintragen".
- On submit the scene sharpens and the tree moves to the centre; the user's card appears in the crown.

## Invitation card

- Centred glass card over a veil: eyebrow "Einladung", the title over three lines with the tree's name alone in the middle ("Du wurdest in den Baum / <Name> / eingeladen."), chips "<n> Personen" and "<n> Generationen"; the inviter is not named.
- Linked: avatar and "Du hängst schon im Baum" / "als <Name> · * <Jahr>" with a "Nicht ich" link; unlinked: "Dein Konto ist in diesem Baum noch keiner Person zugeordnet. Du kannst dich selbst eintragen oder die Besitzer:in fragen."
- Primary "Einladung annehmen" leads into the tree focused on the user; after the tour a task card "Dein Platz im Baum" offers "Deine Daten prüfen", "Foto hinzufügen", "Deinen Zweig ergänzen".
- "Später entscheiden": the card gives way to a reminder above the dock, "Einladung in <Name> offen" with "Antworten"; it is back on the next visit.
- "Ablehnen" asks inline "Wirklich ablehnen? Der Baum verschwindet aus deiner Liste." ("Ja, ablehnen" / "Abbrechen"), then removes the tree from the user's list and goes to `/start`.
- Footer: "Nur eingeladene Familienmitglieder sehen diesen Baum."
- Until the invitation is accepted the dock is locked (see "Bottom dock"); the server allows only viewing.

## Empty and error states

- Empty tree: "Dieser Baum ist noch leer" with "Erste Person hinzufügen" (editors), or a line that people appear once someone adds them.
- Unknown or forbidden tree: "Baum nicht gefunden", "Diesen Baum gibt es nicht, oder du hast keinen Zugriff darauf.", "Zurück zu deinem Baum".
- Auth notice: a closable glass banner with "Neu laden" when the role forbids something or the sign-in expired.

## Landing (signed out, `/home`)

- Scene background (`3d`: the still `ui/app/home/landing.jpg`; `tron`: a night sky turning deep blue toward a glowing horizon at 50 % of the height, a faint mountain ridge, a perspective floor grid that fades toward the viewer and slowly runs toward them, and a beam of light rising from the horizon that branches like a circuit into glowing nodes, drawn once on load and then pulsing; `ui/app/home/TronHorizon.tsx` and `ui/app/home/landing.css`, still without motion under `prefers-reduced-motion`), header with wordmark on the left and, on the right, the "Animation" toggle (TRON only), theme and language segments, then the burger menu (see "Burger menu"); signed in, the header also shows the centred `<user>:<family>` prompt (a click opens the families board), on phones (up to 560px) wordmark, controls and burger share one row with the prompt centred below.
- Signed out, a thin glass strip at the very top reads "Geschlossene Testphase · Zugang nur mit Einladung" in `--font-mono` and `--accent` (`/home` and `/home/how`).
- Who is signed in comes from a quiet `/me` probe, without the permissions provider; while it runs, neither the test-phase strip nor a name shows and the burger is disabled. Signed in, a small line under the main button reads "Angemeldet als <Name>" (display name, else email); signed out, it reads "Noch keine Einladung? Frag jemanden aus deiner Familie, der ftree schon nutzt."
- Centre: title "Deine Familie. Ein Baum, der mit euch wächst." on one line on desktop (it may reach over the tree up to the middle of the trunk; in `tron` with a `--glow` text shadow), below it the chip "Privat · nur für eure Familie" (in `tron` in `--font-mono`), then one sentence, "Anmelden" ("Weiter zum Baum" when signed in) and "So funktioniert's"; in TRON with animations on, the headline flickers once softly in scanlines every 8 s; the GitHub link sits in the legal line.
- 3D and TRON share one hero position: the headline's bottom sits at the golden ratio of the viewport height (61.8 %), everything else hangs below it.
- The landing page has no other navigation; the three steps and the example family are not on it; "So funktioniert's" opens `/home/how`.

## How it works (`/home/how`)

- Landing look (dimmed still, or in TRON the horizon without the light tree and lowered to 82 % of the height, so the cards stand in calm sky; same header), a "← Zurück" control next to the wordmark leading to `/home`.
- Title, one intro sentence, three glass step cards (number, title, short line, two sentences of explanation), then "Anmelden" ("Weiter zum Baum" when signed in) and "Beispielfamilie ansehen", and the signed-in or invitation line.
- Signed in, each card is a link into the own tree (step 2 opens the share dialog); a done step shows "✓" instead of its number, and the first open one is outlined in `--accent`. Signed out, only step 1 is a link, to sign-in.

## Example family (`/home/example`)

- Header with wordmark, "← Zurück" (to `/home`), the title card "Beispielfamilie / Nur ansehen · tippe auf eine Person, um ihre Linie zu sehen", theme and language segments; "Anmelden" ("Weiter zum Baum" when signed in) at the bottom.
- Twelve people over four generations in the real scene; a click highlights the lineage and shows a small card with name, birth name, and life span; there is no dock, panel, or slot.

## Legal line and pages

- Bottom centre, 12px, `--muted`: version · Nutzungsbedingungen · Datenschutz; on every screen, below the dock where there is one.
- `/terms` and `/privacy` are server-rendered and unthemed, with "← Zurück zu ftree" and a language toggle.

## Acceptance card

- `ui/app/LegalGate.tsx`, a modal `<dialog>` on the invitation card's surface (`.invitation-card`, `.consent-*` in `legal-gate.css`), over `/home`, trees and admin pages; the page behind it blurs and stays as it is.
- It has no way to close, only the main button and "Abmelden"; the button stays greyed out until the terms are ticked.
- States: first acceptance (with one sentence on cookies), new terms (version, date, what changed), only a new privacy notice ("Zur Kenntnis genommen", no tick).
- An announced version is a quiet glass line under the header (`.consent-announced`), under the presence bar in a tree and above the legal line on admin pages.

## Known deviations from the tokens

These literals predate the Horizont tokens or bypass them; they are debt for the next redesign round ([plan.md](plan.md)), not rules.

- TRON scene: background `#05070a`, grid cells `#0b4f5c` and sections `#00e5ff` (`ui/app/Scene.tsx`, `GridFloor`) instead of `--bg` and `--accent`.
- TRON blood-relative lines, glyphs and stubs: `#ffb347`, `#ffe9cc` (`ui/app/SimpleTree.tsx`, `ui/app/globals.css`), a second accent besides cyan.
- Relation legend glyph and stub samples: `#e6fdff`, `#00e5ff` (`.relation-legend-glyph`, `.relation-legend-stub` in `ui/app/globals.css`); the legend's container uses the sheet and glass tokens.
- Landing: `rgba(72,229,255,…)` and `rgba(11,15,16,…)` repeat token values as literals (`ui/app/home/landing.css`).
- Pre-Horizont palette in boards, person panel, forms and presence: `#fff`, `rgba(255,255,255,.04–.25)`, `rgba(127,214,255,…)`, `#18202b`, `#a6e3ff`, `#24384b` (`ui/app/globals.css`, `ui/app/share.css`, `ui/app/live/*.css`).
- Legal pages: their own gradient `#24364a → #0a0f16` (`ui/app/legal.css`).
- 3D scene, scrolls and Evolution panel: sky, meadow, bark and papyrus colours in `ui/app/Scene.tsx`, `Meadow.tsx`, `Tree.tsx`, `cardTextures.ts`, `HangingCard.tsx`; these belong to the scene, not to the UI.
- Token-pure today: `ui/app/dock.css`, `header.css`, `sheet.css`, `slots.css`, `tour.css`, `welcome.css`.
