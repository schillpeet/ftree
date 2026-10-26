# Project Overview

## Purpose

ftree is intended to become a web service where family members can create and maintain a shared family tree.
The repository is currently an early visual prototype, not a working family-tree service.

## Current State

### Scene and camera

The home route displays a full-screen Three.js scene with one procedurally generated tree in a meadow under a sky that follows the current time of day, plus a family card listing the members and a form for creating and editing members.
Selecting a member in the list moves the camera to their card (for the scrolls in the tree and the wooden boards close up from the side the card faces, below the crown) and opens their profile; clicking a scroll (or pressing Enter on it) opens that member's profile, while a drag that starts on a scroll still orbits the camera.
The zoom slider in the Evolution panel, with its − and + steps, zooms in and out alongside mouse wheel and trackpad pinch.
Below the zoom slider, "Front" flies the camera back to the start view in front of the tree and "Above" shows the tree from a bird's-eye view.
"Orbit" circles the camera slowly around the tree until it is switched off, another view is chosen, or the user moves the camera.
The UI is available in English (default) and German; the language button next to "Time" switches between them, and the choice is remembered per browser in `localStorage`.
The burger menu's "Appearance" board switches between the organic tree (default) and an experimental view, remembered per browser in `localStorage`.
The burger menu's entries are "Familien", "Mitglied hinzufügen", "Darstellung", and "Momentaufnahme", with a people, an add-person, a palette, and a camera icon.
The burger menu's "Momentaufnahme" ("Snapshot") entry downloads the current view as `ftree-<family>-<yyyy-mm-dd>.png`, showing only the scene and the family name, without any controls.
The experimental view is a dark floor with a glowing grid and no cards yet; it is the starting point for a simpler family tree, and organic-only controls (time, pins, light orbs, card style, crown, bundling) are greyed out there.
In the experimental view, the selected family appears as a flat family tree facing the start camera: one row per generation, partners side by side, and children hanging from a bar below their parents; a click on a floating name opens the profile.
Positions in the experimental view follow from the stored relations alone (`ui/app/simpleLayout.ts`, models in `ui/app/experimental/model.ts`), so the same family always looks the same and nothing can be dragged there.
The experimental view centres every couple over its first and last child, packs families as tightly as their shapes allow, and keeps their lines from crossing.
In-law families (a partner's parents at the top of the tree) are placed right next to the family their child married into, centred over their own children; a sibling group has two edges for them, left and right.
A third in-law family in the same sibling group becomes a stub instead of a crossing line.
The experimental view draws its lines like a circuit diagram (`ui/app/experimental/routing.ts`): only right angles, and every horizontal line on a track of its own in the channel between two rows, so lines never overlap.
Spacing in the experimental view follows the measured size of a name label: siblings and partners stand close together, and families get a clearly wider gap.
Sibling bars in the experimental view stay a short distance above the children's names, so every child hangs on a visible line, and the outer corners of the lines are subtly rounded.
Experimental-view names scale with the window height like the rest of the scene, so the spacing between them is the same in any window size.
Parallel tracks keep at least 0.3 apart; the channel's tracks are compressed evenly when they do not fit at the usual 0.6.
Every point where three lines meet gets a dot, and no point joins four lines except the one described below.
No line crosses another one, except where a union's vertical line must cross a partnership line: the partnership line then hops over it on a small bridge.
A link that cannot be drawn without crossing, or only with a crossing other than such a bridge, becomes a stub instead.
A stub is a small label "▲ Eltern von <Vorname>" above the child that opens the first parent's profile.
Partners are joined by a line on its own track with a symbol on it: ⚭ for married and widowed, ⚯ for together, ⚮ for divorced, none for separated.
The line of separated and divorced partners is dashed, the others are solid, including widowed ones.
A child hangs from the union of its biological parents; a union node sits in the middle of the line between adjacent partners and straight below the outer partner (the one with fewer partners) when someone stands between them.
The children of separated or divorced partners always hang straight below the former partner, even when the two stand side by side.
A child of only one parent hangs with the children of that parent's current couple (nearest by birth date), so it stands among its siblings; without such a couple it hangs below that parent, and if that would read like a child of the parent's partnership, it becomes a stub.
A child directly below its union node with siblings on both sides hangs from the same bar, and the stem, bar, and the line to that child meet in a single dot; this is the only point where four lines meet.
A child without biological parents in the tree hangs from the union of all its parents, drawn dotted.
A non-biological parent who is a partner of one of the drawn parents gets no extra line, since the partnership line shows the step relation; any other non-biological parent becomes a stub.
Parents of a shared child stand side by side in the experimental view even without a stored partnership.
A person with several partners and no parents in the tree stands in the middle of their partner group.
A partner with shared children stands outermost, at most one per side: the first by the order below goes right, the second left; a former partner with a child of their own counts as one with children.
Childless partners stand inside between the person and the right outer partner, the current partner nearest.
Further partners with children stand beyond the right outer one; routing bridges the lines their links cross.
The order of partners: current before former, then no shared child before the youngest latest child, then fewer children.
The child who married into another family stands at the edge of their sibling group facing that family.
The other siblings stand in blocks by age: the oldest next to that married-in child (or toward a sibling who hangs under their partner's family), the youngest outermost; without such a sibling the oldest stands left.
Siblings without a birth date stand after those with one, ordered by first name.
In a sibling's block the sibling stands inside and their partners outside, so a sibling is always nearer to their siblings than their own partner.
A sibling with several partners has all of them on the outer side, in the profile order (current first, then the latest ended), co-parents without a stored partnership last; the lines to the children of all but the outermost partner cross the outer partnership lines on bridges.
A deceased person's name is preceded by †.
`ui/app/experimental/verify.ts` checks drawings in the tests, not at runtime: right angles, no overlaps, no crossings but on recorded bridges, no four-way points, and a read-back of the parents and partners from the drawing itself.
CI runs this check on a fixture shaped like a real five-generation family (synthetic people) and on 500 random families (`ui/app/experimental/families.check.mjs`).
The appearance board also offers an experimental organic tree: a tiered tree (`ui/app/TieredTree.tsx`) that grows one tier of level branches per generation, parents a tier above their children, so no branch hangs in front of a card.
Each card hangs under its own twig with leaves only on top and at the tip, and each tier reaches further out than the one above.
Every family gets its own wedge around the trunk (`ui/app/tieredLayout.ts`): a person and their partners hang in the middle of it, and their children's branch leaves the trunk right below them, so parents always hang directly above their children.
The family is centred on the front of the tree; when the wedges do not fit around the trunk, all tiers reach further out.
The tiered tree is rebuilt when the family's generations change; cards cannot be dragged there, stored pins are ignored but kept, and pins, crown size and bundling are greyed out.
The f-monogram logo and the released version (for example `v0.18.0`, from `ui/package.json` via `APP_VERSION` in `ui/next.config.ts`) are shown centred at the bottom of the screen (`.app-version` in `ui/app/layout.tsx`).

### Sky and time of day

The sun stands where it currently is at the browser's location: the browser is asked once for its position (kept in the browser, never sent anywhere); without permission the time zone's standard meridian at 51° latitude is used.
South lies straight ahead from the start view.
Sun and sky light, haze, and sky colors follow the sun's altitude, with the afterglow stretched through civil twilight; at night a full moon (a camera-facing disc with a painted texture of maria, craters, and ray craters, plus a soft halo) stands opposite the sun (its arc flattened to about 20° so it stays in view) and lights the scene bluish, and stars come out one by one as the sun sinks to 14° below the horizon.
The time updates every minute.
The "Time" button next to "Evolution" opens a panel in which "Uhrzeit vorschauen" shows a 24-hour dial (midnight at the top) appears whose hand can be dragged or moved with the arrow keys in 15-minute steps to preview any time of today.
As evening falls, small warm-white light orbs rise above the hanging scrolls and boards, glowing brighter and larger as the sun sinks to civil twilight; a "Leuchtkugeln" checkbox in the debug panel (on by default) switches them off.

### Tree and roots

The aerial roots stay on their limbs and are rebuilt to reach the ground below wherever the scaled limb now is.
Growing the crown also fills two more rings around the tree: from crown scale 1 to 1.5 new aerial roots hang down from the middle band of the outer branches (halfway to the ground at 1.25), and from 1.5 to 2 from the outermost band.
At the same pace new roots creep outward half-buried in each ring, diving under the hill for a metre or three and surfacing again, sometimes forking.
Among them are four giant roots about fifteen times as thick that swell out of the trunk base and wind over the hill in long, half-sunk ridges.
Every new root starts at half its final thickness and thickens as it grows.
The original aerial and grounded roots always stay; nothing grows below scale 1.

### Debug panel

The "Evolution" button in the upper-right corner (the former debug panel, closed by default) opens a translucent panel that groups the tools into sections: "Ansicht" with the zoom slider, the "Front", "Above", and "Orbit" camera buttons, the "Anheftpunkte" pin checkbox, and the "Kartenstil" select (see below), and the development-only "Vorschau" section with the crown and relation spacing sliders (hidden in production builds).
The "Linien anzeigen" checkbox in the "Verbindungslinien" section hides or shows the parent and partner lines in all three appearances, so that only the cards remain.
The choice is remembered per browser and the lines are shown by default.
While a person panel is open, the lines from that person to everyone the panel lists (parents, partners, children, siblings, and half-siblings) are drawn in a highlight color in all three appearances.
The Evolution board has its own "Verbindungslinien" section, set slightly apart from the legend checkbox, with "Linien anzeigen", "Kernfamilie", and "Blutsverwandt".
The "Kernfamilie" checkbox switches this highlight on or off; it is remembered per browser, on by default, and unavailable while the lines are hidden.
In the experimental view, the highlight also follows everyone the person descends from up to the oldest generation in the tree: the lines from each parent, grandparent, and so on to their own parents, the partnership symbols between them, and any "▲ Eltern von …" stub where those parents are drawn elsewhere.
In the experimental view, only the pieces of line on the way between two highlighted people light up: a sibling bar stands out from the stem to the highlighted child only, not on to that child's siblings (`ui/app/experimental/highlight.ts`).
The "Blutsverwandt" checkbox highlights, in amber, the experimental view's lines between the selected person's blood relatives: their biological ancestors and every biological descendant of those, such as siblings, half-siblings, aunts, and cousins, with partners who married in and adoptive, step, and foster links left out (`bloodRelativesOf` in `ui/app/relatives.ts`).
It is remembered per browser, off by default, and unavailable while the lines are hidden or in the other appearances; where both highlights apply, the core family's color wins.
The "Legende der Beziehungen" checkbox at the end of the "Ansicht" section shows a legend in the bottom right corner of the experimental view; it is remembered per browser, on by default, and unavailable in the other appearances.
The legend explains the experimental view's solid, dashed, dotted, core-family, and blood-relative lines, branch points, bridges, the partnership symbols ⚭ ⚯ ⚮, the "▲ Eltern von …" stubs, and the † before a name (`ui/app/RelationLegend.tsx`).
The legend lists its entries in two columns, can be dragged by its header, pinned in place like the person panel, folded to its header with the button next to ×, and closed with ×; the pinned position and the folded state are remembered per browser.
The legend starts folded to its header until the user unfolds it.
A development-only slider scales the crown and its pins together while the card size itself stays fixed.
A second development-only slider in the debug panel previews relation spacing: with "Bündeln" checked, pinned members linked as parent/child or partners are moved between pins by a local search so their links approach a target length: at −10 the closest two cards fit side by side, at 0 twice that, and at +10 the widest distance between any two pins, interpolated logarithmically in between; members without such links keep their pins, and the result is put back into generation order.
The preview is not saved, and cards cannot be dragged while it is on.

### Families

A `default` family is selected first on a fresh install; custom people created from the members form belong to the selected family.
The "Zufallsfamilie generieren" button in the families board of the menu, shown to admins and developers below "GEDCOM importieren", unfolds the random family form below it.
The random family board creates a named family set with up to 250 generated members across 1–10 generations and 0–3 children per parent.
The family selector is the "Familien" entry of the burger menu in the upper-left corner, not in the Evolution panel, and its board opens beside the menu; Escape or a press outside closes it.
The top centre shows the selected family's name, or "Keine Familie" while the tree is hidden.
The family selector displays compact people and generation counts, switches the visible tree, and lets the user show or hide one family at a time with an eye control, and shows a family and opens its card with a pencil; any family, including `default`, can be deleted there after confirmation.
The UI offers no archiving; the BFF's `POST /families/{familyId}/archive` stays available.
The family card's edit mode renames the family via `PUT /families/{familyId}`; the name is unique (case-insensitively) and up to 100 characters, and the rename leaves the members, links, and placements untouched.
Every family has a slug (lowercase ASCII words joined by `-`, at most 60 characters) that is made from its name when it is created, gets `-2`, `-3`, … when taken, and stays when the family is renamed; it names the family in the access file, and admins see it on the family card.
Family sets and their settings are persisted in PostgreSQL; existing members are migrated into `default`, and members/relationships are scoped to the selected set.
The original `/members` endpoints remain available for the default family.
"GEDCOM importieren" in the family selector reads a GEDCOM 5.5.1 or 7 file and, after asking for a name (the file name by default), always creates it as a new family.
`POST /families/empty` creates a family without members or test settings under a unique name of up to 100 characters; like generating and importing, it needs `family.create`, and a developer who creates it is its developer.
The import takes names, exact birth and death dates and places, and notes from its people, and partners and children from its family records; imprecise dates such as `ABT 1950` stay empty and are kept verbatim in the note, and unknown names stay empty.
Imported members get no placement, so they are shown on the free pins like other unplaced members.
The family card's download button exports the family as a GEDCOM 5.5.1 file named after the family; photos and card placement are not exported.
"Anonymisierte Kopie" in the family card's edit mode asks for a name ("<name> (anonym)" by default) and creates a copy of the family with random names, for example to show the tree's structure in a snapshot without personal names.
Families in the selector's "Alle Familien" list can be reordered by drag and drop; the order is saved via `PUT /families/order` (which must list every family exactly once), new families are appended at the end, and a failed save restores the previous order.
Clicking the family name at the top centre opens the family card of the shown family, or the families board while no family is shown.
The family card lists the family's members by generation, the oldest first and each generation by birth date, with counts of members and generations; clicking a member opens their person card.
The family card behaves like the person card: it can be dragged, pinned to a position of its own (`ftree.familyPanelPin`), and closes on ×, Escape, or a click outside unless pinned.
The family card's header downloads the family as GEDCOM, and its pencil switches it to edit mode: a dashed photo field ("Foto ablegen" while empty), the name, "Familienfoto hinzufügen" or "Familienfoto ändern" and "Familienfoto entfernen", "Anonymisierte Kopie" in a row of its own, and below a line "Familie löschen" (after confirmation) apart from "Abbrechen" and "Speichern".
The family photo fills the family card's cover; in edit mode the photo field takes a new photo by choosing a file or dropping an image, which the browser scales to at most 800 px as JPEG and uploads on save, and "Familienfoto entfernen" deletes it on save.
"Neue Familie" at the top of the families board, shown to admins and developers, closes the menu and opens the family card in create mode: the same photo field, name, and photo display as in edit mode, with "Abbrechen" and "Anlegen" and without the copy and delete buttons.
"Anlegen" creates the empty family, uploads the picked photo to it, shows the new family, and switches its card to view mode.
In edit mode a switch under the photo field chooses "Füllend" (the photo fills the cover) or "Originalgröße" (the photo keeps its own size, centred, at most 240 px high and as wide as the card, never scaled up); it is saved per family via `PUT /families/{familyId}/photo-fit`.

### Members and relatives

Every member appears in the scene as a card whose look the "Kartenstil" select picks; the choice is remembered per browser in `localStorage`.
"Rolle im Baum" (the default) is a 3D papyrus scroll hanging from its pin on two ropes, facing away from the trunk, swinging gently, and written on both sides.
"Rolle, lesbar" is the same scroll turned toward the camera and glowing slightly for legibility.
"Holzschild" is a swinging wooden board with burnt-in name and dates and the photo in a medallion beside them.
These three are lit by the sun, cast shadows, are hidden by leaves in front of them, and cannot take keyboard focus (the family card is the keyboard path); a photo that cannot be loaded with CORS headers is left out.
"Papyrus (klassisch)" is the earlier camera-facing HTML scroll, drawn over the scene and focusable.
At night the scroll and board cards glow softly (their emissive faces brighten) so their names stay readable, lit by the little orbs above them.
Each card shows photo (from `photoUrl`), name, birth and death dates, and, except on the wooden board, the note.
Each member can be assigned any number of parents, children, and partners (current or former; always mutual) in the member form.
Siblings and half-siblings are not stored separately but derived from shared parents: the relatives section lists them against the selected parents (a half-sibling shares only some of them, chosen in an "über …" select) and saves them by giving each sibling the shared parents and removing them from unchecked ones; without parents both lists are disabled with the hint "Erst Eltern zuweisen" (half-siblings need at least two parents).
In edit mode each relation shows its people as chips with a × and an "… hinzufügen" button that opens a name search instead of a list of everybody; Enter or a click adds the first or chosen match.
Each selected partner gets a status, "zusammen", "verheiratet", "getrennt", "geschieden", or "verwitwet", with the dates that go with it: "seit" for together and separated, the wedding date for married, the wedding and divorce date for divorced, and the wedding date and date of death for widowed.
Both partners share these details, and the profile shows them next to the partner, for example "verheiratet seit 12.06.1985", "zusammen seit 01.02.1983", or "geschieden seit 30.09.1999 (⚭ 12.06.1985)".
The profile and the relatives form list partners in one order: current ones first (married before together, the newer first), then former ones (widowed, divorced, separated) by when the relationship ended, the latest first, so the oldest relationship comes last; undated ones follow the dated ones of their group.
In the profile the current partner stands on the person's row; every other partner gets a row of their own below, reached by a thin line that bends down from the person and carries the status, and a toggle folds the former partners away.
A search square of the same size sits right of the burger menu; a click widens it to a text field.
Typing shows up to eight matching members of the selected family as autocomplete suggestions (arrow keys and Enter or a click choose one; Escape or a press outside closes the field).
Choosing a suggestion flies the camera to that card (organic view) and opens the person's profile.
"Mitglied hinzufügen" in the burger menu opens the form for a new person in the shown family; the members themselves are listed in the family card, and relatives are shown in the profile.
A person panel in the middle of the screen (`ui/app/PersonPanel.tsx`) replaces the former profile dialog and member form: it sits below the top bar and has no dimmed backdrop, so the tree and camera stay usable around it.
The panel can be dragged by its header (a grab cursor shows the handle); each newly opened panel starts in the middle again.
The pin in the panel header fixes the panel at its current position: it can no longer be dragged, and every panel opens there, also after a reload (remembered per browser in `localStorage`) until it is unpinned.
The photo is shown large (112 px) beside the name.
The panel shows a member's photo (or their initials in its place), name, years and age, birth and death dates with places, the note as a quote, and relatives as chips with avatar, name, and years: parents, then the person next to their partners (with the partnership status), then children, with siblings and half-siblings in collapsed sections.
Members have an optional birth name (for example a maiden name that was given up), edited as "Geburtsname" and shown as "geb. …" in the profile when it differs from the surname.
GEDCOM export writes a differing birth name as a second NAME with TYPE birth; import also reads TYPE maiden, a NAME of TYPE married as the current name, and `_MARNM`.
First and last name may be left empty for a person whose name is unknown (the BFF trims names and stores unknown ones as empty strings); such a person is shown as "Unbekannt" (small and italic on their card) and with "?" as initials.
Clicking a relative in the panel shows that person and moves the camera to their scroll; a back arrow in the panel header walks back through the people visited this way.
The pencil in the panel header turns the same panel into the edit form in place.
The edit form keeps the avatar (click or drop an image to change the photo) beside the name fields on top and splits the rest into two tabs, so nothing needs scrolling: "Persönliche Daten" ("Geboren am/in" and "Verstorben am/in" in two columns, the note) and "Beziehungen", saved together with the person, so relatives can also be assigned while creating someone.
The name fields on top carry labels ("Vorname", "Nachname") like the other fields and sit centred beside a larger portrait-format photo; on narrow screens the fields wrap below the photo.
The optional birth name sits with the name fields on top, behind a "+ Geburtsname hinzufügen" link below the surname.
Removing a relative with × asks for confirmation first.
Each parent has a kind: "leiblich" (the default), "adoptiert", "Stief", or "Pflege".
The relatives form shows a select for the kind next to each parent, and removing a parent resets its kind.
The profile names the kind next to every parent that is not biological.
As soon as a name is typed into a relation's search, the list ends with a highlighted "+ Neue Person „…“ hinzufügen" entry (Enter picks it when nothing matches); it opens a second, draggable "add member" panel prefilled with the typed name (last word as surname), without a relations tab.
Saving that panel creates the person right away and adds them to the chosen relation of the form it was opened from, which still has to be saved itself.
That panel is titled after the relation, for example "Partner von Dennis Behrendt hinzufügen", and opens beside the form on the side with more room, moving an unpinned form over just far enough for both to fit (and back once it closes).
While it is open, the relation it was requested for is highlighted and a flowing accent line (`ui/app/RelationLink.tsx`) leads from its "… hinzufügen" button to the new panel, following both while they are dragged.
The relatives section lists parents, partners, children, siblings, and half-siblings; each partner chip has its status and dates next to it.
"Verwerfen" and "Person speichern" stay at the bottom of the panel and appear only for a new person or once something changed; saving shows the person again.
The profile panel shows no title: pin and edit, then close after a thin divider, sit in its top-right corner level with the photo; edit is the brightest of them.
"Person löschen" is a trash can in the header of the edit form only, red on hover, and deletes the person after confirmation.
The photo URL is no longer editable in the form; an existing one is kept and still shown.
A photo can also be uploaded in the member form, by choosing a file or dropping an image on the photo field: the browser scales it down to at most 800 px on the longer edge and saves it as JPEG after the member is saved, "Foto entfernen" deletes it again, and an uploaded photo is shown instead of `photoUrl` on the scroll and as the avatar in the profile and family card.
The person panel closes on Escape (also while the tree has focus) or ×, the edit form first asks before discarding unsaved changes, and the create form keeps its draft.
The profile panel also closes on a click outside every panel (a drag that orbits the tree does not count) unless it is pinned; the edit and create forms stay open.

### Pins and card placement

Scrolls are no longer placed automatically.
Red pins on the tree's outer branches are anchor points: they are derived from the procedural branch geometry, ordered top-down, and kept at least a card width (horizontally) or card height (vertically) plus a 16 px gap apart, so cards on neighbouring pins never overlap in space (from oblique camera angles they can still cover each other).
A pin's id is its index in that list.
A card either hangs directly below a pin (at most one card per pin) or sits at free 3D coordinates relative to the tree base; both are stored per member.
When the "Anheftpunkte" checkbox shows the pins, a card can be dragged on a plane facing the camera: released while it touches free pins it docks to the nearest one, released only over occupied pins it springs back, otherwise it stays where it was dropped.
With the pins hidden, cards cannot be dragged and a drag orbits the camera as before.
A database migration pinned existing members per family (oldest birth date first); members created afterwards, including generated test families, and members whose pin does not exist are shown on the free pins top-down in birth order (oldest first, unknown birth dates last), computed in the UI and not saved until their card is dragged.
Only members left over when the free pins run out wait in rows on an arc in front of the tree.
Pinned cards are kept in generation order for display: generation by generation (partners count as the same generation), a card hanging less than a card height plus gap below one of its pinned parents moves to the nearest free pin that low, or else to the nearest free pin at least below the parent.
A card with pinned descendants only stays where enough pins hang below it for them (a card height plus gap per generation, or at least lower when the crown is too small), so ancestors hanging too low move up; a child still hanging above a parent after that swaps pins with them.
Parents therefore always hang above their children, also while bundling or after scaling the crown, though on a very small crown less than a card height apart.
Cards that already fit or are unrelated keep their pins.
This is not saved, and free or waiting cards are not moved.
A drop less than a card height plus gap below a placed parent or above a placed child springs back, both onto a pin and at a free spot.

### Relation lines

Light lines drawn over the foliage connect families between the cards' current positions: each parent drops to a bar joining the parents, a stem from its middle leads to a bar from which the children hang, and where two families' bars would overlap in a row they get different heights.
Partners without shared children are joined by a gold line.

### BFF and API

The UI calls a generated client.
The BFF implements family-scoped member listing, creation, editing, deletion, parent/child and partner links (with siblings set through shared parents), card placement (pin or free position, rejecting a pin that is already taken), plus atomic generation, archiving (moving all members into a new named family), and deletion of whole sets against PostgreSQL; it rejects links that would make someone their own ancestor.
Member photos (JPEG, PNG, or WebP up to 2 MB) are stored in PostgreSQL in their own `member_photos` table, so member listings never load the bytes; members carry `photoUpdatedAt`, which the UI appends to the photo URL so the year-long private cache never shows an outdated photo, and deleting a member or family removes their photos.
Families can have one photo (JPEG, PNG, or WebP up to 2 MB) via `GET`, `PUT`, and `DELETE /families/{familyId}/photo`, stored in its own `family_photos` table; family summaries carry `photoUpdatedAt` for the same year-long private cache, and deleting a family removes its photo.
Family summaries carry `photoFit` (`cover` fills the family card's title area, `original` shows the photo at its natural size, limited by the client), stored in `families.photo_fit` (migration V16), set via `PUT /families/{familyId}/photo-fit`, and `cover` for every new family.
Partnership status and dates live in `member_partners` on both rows of a pair; members return them as `partnerships`, and the relatives endpoint replaces them only when its request includes `partnerships`.
The status is `together`, `married`, `separated`, `divorced`, or `widowed`, set per partner in the relatives form.
Each status keeps only its own dates: `since` for together, `marriedOn` for married, `endedOn` for separated, and `marriedOn` with `endedOn` for divorced and widowed (the date of death); the BFF drops the others.
Divorced partners count as former partners like separated ones, so the trees treat both alike.
Widowed partners stay married in the trees: solid lines and the ⚭ symbol (in the organic trees, the ring sits right under the name of the partner who died: the one with a date of death, else the one with fewer partners); choosing "verwitwet" fills in the partner's date of death, and the profile falls back to it, for example "verwitwet seit 03.04.2010 (⚭ 12.06.1985)".
Partnership dates cannot lie in the future, and a divorce cannot come before the wedding: the relatives form marks such dates in red and refuses to save with a message, and the BFF rejects them with 400 (allowing one day for clients in a later time zone).
The kind of each parent/child link (`biological`, `adoptive`, `step`, or `foster`) lives in the `kind` column of `member_parents` (migration V14), which defaults to biological.
Members return the kinds as read-only `parentLinks` (`parentId` and `kind`).
The relatives endpoint changes kinds only when its request includes `parentLinks`; then every parent left out of it becomes biological, and without `parentLinks` the kinds stay as they are.
GEDCOM import reads `PEDI` under `FAMC` (`birth`, `adopted`, and `foster`, case-insensitively; unknown values count as biological).
GEDCOM export writes `2 PEDI adopted` or `2 PEDI foster` after `1 FAMC`, while step parents get no `PEDI` and come back as biological on re-import.
A couple is exported as two single-parent families when the `PEDI` written for the child's two links differs, for example when one parent is adopted or fostered and the other is not.
The GEDCOM import and export do not carry partnership status yet.
`POST /families/{familyId}/anonymize` copies a family in one transaction into a new named family with the same members, dates, places, notes, links, partnership details, and placement but without photos, leaving the original untouched.
The copy replaces first names at random and maps each distinct last name (birth names included) consistently to a random last name from fixed lists in `AnonymousNames.kt`, never reusing a name from the original; empty names stay empty.
Anonymous copies keep the kinds of the parent links.
The BFF imports a GEDCOM file as a new family (rejecting unreadable files, links that would make someone their own ancestor, more than 2000 people, and taken names) and exports a family as GEDCOM, using its own parser and writer for a subset of the format.
Roles apply per family: `visitor` (`tree.view`), `editor` (adds `member.edit`, `family.edit`, and `family.export`), `developer` (adds `member.delete` and `family.delete`), and `admin` (the same as developer); admins are admins in every family and also have `family.create`, `family.manage`, and `dev.tools`.
Developers have `family.create` and `dev.tools`, so they create and import families, and they are developers in the families they created; every family stores the normalized email of who created it in `created_by` (null for families from before V18).
Everyone has `tree.appearance`, which offers every appearance and the Evolution panel with its view, line, and legend settings.
`app.access.file` (env `APP_ACCESS_FILE`) points to the access file, a YAML list `people` in which every entry has an `email` and `admin: true`, `developer: true` (optionally with `trees`), or `trees` with exactly one family slug mapped to `editor` or `visitor`, because only admins and developers can switch between families; the BFF reads it once at startup, refuses to start when it is malformed or set together with `app.roles`, and gives people it does not list no family.
Without an access file, `app.roles.admins` and `app.roles.editors` (env `APP_ROLES_ADMINS`, `APP_ROLES_EDITORS`) list emails, matched trimmed and case-insensitively; admins win, editors are editors and everyone else is a visitor in the first real family only, the first without test settings in the saved order.
`GET /me` returns the signed-in user's `email`, `admin`, `developer`, the `permissions` outside any family, and `verified`, or 401 without a user; every family in `GET /families` and in the answers of family writes carries the caller's `role` and `permissions` in it.
`app.auth.mode` (env `APP_AUTH_MODE`) is `cloudflare` by default; `dev` signs every request in as `app.auth.dev-email` (default `dev@localhost`) with `verified` false and logs a warning at startup, and `start.sh` runs the BFF in dev mode with `dev@localhost` as admin.
Spring Security runs stateless and enforces the permissions per method and path: every request needs a signed-in user (401 otherwise), `GET /me` needs nothing more, and any other request needs its permission (403 otherwise), taken from the role in the family of the path for `/families/{familyId}/...`, with unknown endpoints always denied.
`tree.view` covers the reads (families, members, photos), `family.export` the GEDCOM export, `member.edit` creating and changing members, relatives, placement, and member photos, `member.delete` deleting members, `family.edit` renaming families, family photos, and the photo fit, `family.delete` deleting a family, `family.create` creating, generating, and importing families, and `family.manage` archiving, anonymizing, and reordering families.
The legacy `/members` endpoints without a family are admin-only (`family.manage`), because they act on the family named `default`, which non-admins may not see, and the UI no longer uses them.
Non-admins see only the families they have a role in: `GET /families` lists only those, and every `/families/{familyId}/...` request for another family answers 404, so test families are admin-only.
Because Cloudflare Access turns its cookie into the JWT header, the BFF rejects writes from other sites with 403: POST, PUT, PATCH, and DELETE with `Sec-Fetch-Site` `same-site` or `cross-site`, or without it but with an `Origin` outside `app.cors.allowed-origins`; the UI sends no CSRF token.
In cloudflare mode the BFF verifies the Cloudflare Access JWT from the `Cf-Access-Jwt-Assertion` header against the keys at `https://<team-domain>/cdn-cgi/access/certs`, checking its signature, expiry, issuer (`https://<team-domain>`), and audience, and takes the user from its `email` claim with `verified` true.
`app.auth.team-domain` and `app.auth.audience` (env `APP_AUTH_TEAM_DOMAIN`, `APP_AUTH_AUDIENCE`, the Access application's AUD tag) are required in cloudflare mode; without them the BFF refuses to start.
A missing, invalid, or foreign token leaves the request anonymous, so `GET /me` answers 401; an `Authorization: Bearer` header is ignored.
The UI loads `GET /me` once at start and shows only what the permissions allow, those from `/me` together with those of the open family; it checks permissions, never role names, and the BFF still enforces them.
The burger menu starts with "Profil" for everyone, a board with the email, the role (Administrator or Developer, otherwise the role in the open family), whether Cloudflare Access verified the email ("nicht verifiziert (Dev)" in dev mode), and a logout link to `/cdn-cgi/access/logout`.
"Familien" needs `family.create` (admins and developers) and lists the families the user may see, with GEDCOM import for `family.create` and drag-and-drop reordering for `family.manage`; "Mitglied hinzufügen" needs `member.edit` in the open family, and "Momentaufnahme" and "Darstellung" are for everyone.
Without `tree.appearance` only the experimental appearance can be chosen; the others are disabled and marked "Demnächst", and a stored other choice falls back to experimental.
The Evolution button needs `tree.appearance`, so everyone sees it; its random-family generator needs `dev.tools`.
Editing a person, their photo, relatives, and dragging cards to pins need `member.edit`; deleting a person needs `member.delete`.
Editing the family card (name, photo, photo fit) needs `family.edit`, the GEDCOM download `family.export`, deleting a family `family.delete`, creating and importing families `family.create`, and the anonymized copy and reordering families `family.manage`.
A 403 from the API shows a friendly notice that the role does not allow it, and a 401 suggests reloading or signing in again.
A broader family-tree model (relationship types such as uncertain links) is not implemented.
The BFF serves Actuator on its own management port, `management.server.port` (env `MANAGEMENT_PORT`, default 8081), so the UI's `/api` rewrite and the tunnel, which forward to port 8080, never reach it.
The management port exposes only `/actuator/health` (without details or components), `/actuator/health/liveness`, `/actuator/health/readiness`, and `/actuator/prometheus`, without a user; other Actuator endpoints answer 403 or 404, and `/actuator/**` on port 8080 stays denied like any unknown endpoint (`managementSecurityFilterChain` in `SecurityConfiguration.kt`).
The chart does not use the Actuator probes or expose the management port yet.
`http.server.requests` metrics are labelled with the matched URI template, for example `/families/{familyId}/members`, or `UNKNOWN`, never with ids, emails, or names from the path.
The BFF logs JSON in the Elastic Common Schema (`logging.structured.format.console=ecs`), also locally under `start.sh`; log statements must not contain names, emails, or ids of people.
The PostgreSQL driver runs with `logServerErrorDetail=false`, so database errors such as constraint violations do not quote row values in exceptions and logs.

The repository separates the Next.js UI from a Kotlin Backend for Frontend (BFF).
The UI uses TypeScript, React, React Three Fiber, Drei, and Three.js.
The Kotlin/Spring Boot BFF uses JPA and PostgreSQL for member records.
pnpm configuration, dependencies, lockfile, and scripts live in `ui/`; the BFF uses its own Gradle build.

## Code Map

- `ui/app/page.tsx` renders the home scene.
- `ui/app/FamilyTree.tsx` holds the loaded members, the camera focus, and the profile request (a clicked scroll) shared by the scene and the members overlay.
- `ui/app/FamilyTree.tsx` also renders the dashboard and the families board.
- `ui/app/Dashboard.tsx` renders the burger menu and the family name that opens the family card (`ui/app/FamilyCard.tsx`, rendered by `MembersControls`); `ui/app/icons.tsx` holds the shared stroke icons; the glass styles are at the end of `ui/app/globals.css`.
- `ui/app/Scene.tsx` configures the canvas, the time-of-day sky (sun, moon, stars, and lights from `ui/app/sky.ts`) with its clock, meadow, tree, camera controls, the "Time" and "Evolution" buttons with their panels (the latter with "Ansicht" with the zoom slider, pin toggle, and card style select, and the development-only "Vorschau" section with the crown scale and relation spacing sliders), the pins, member scrolls with their drag and drop and relation lines, and the camera flight to a selected scroll.
- `ui/app/SimpleTree.tsx` renders the experimental view's names, lines, dots, bridges, symbols, and stubs from `ui/app/experimental/routing.ts` and highlights the lines to the focused person's core family and blood relatives (`ui/app/experimental/highlight.ts`, `highlight.check.mjs`); `ui/app/simpleLayout.ts` places the names, with `ui/app/simpleLayout.check.mjs` as its self-check.
- `ui/app/RelationLegend.tsx` renders the experimental view's legend of lines, symbols, and stubs.
- `ui/app/experimental/model.ts` derives unions, partnerships, and generations for the experimental view (`model.check.mjs`); `routing.ts` routes the circuit-diagram lines (`route.check.mjs`); `verify.ts` and `families.check.mjs` prove them on fixtures and random families (`node app/experimental/families.check.mjs` in `ui/`).
- `ui/app/familyLayout.ts` computes the relation lines between placed scrolls; `ui/app/familyLayout.check.mjs` is its self-check (`node app/familyLayout.check.mjs` in `ui/`).
- `ui/app/arrange.ts` moves linked members between pins for the relation spacing preview; `ui/app/arrange.check.mjs` is its self-check (`node app/arrange.check.mjs` in `ui/`).
- `ui/app/generations.ts` derives generations, groups members into generation rows for the family card, moves cards between free pins (lifting ancestors when needed) so children hang below their parents, and bounds where a dragged card may drop; `ui/app/generations.check.mjs` is its self-check (`node app/generations.check.mjs` in `ui/`).
- `ui/app/pins.ts` holds the card footprint, the pin spacing rule and selection, and the drop rule (dock, spring back, or place freely); `ui/app/pins.check.mjs` is its self-check (`node app/pins.check.mjs` in `ui/`).
- `ui/app/sky.ts` computes the sun's position from date and location, the fallback location, and the daylight and starlight fades; `ui/app/sky.check.mjs` is its self-check (`node app/sky.check.mjs` in `ui/`).
- `ui/app/moon.ts` paints the moon's face and halo on canvases.
- `ui/app/Scroll.tsx` renders the classic papyrus scroll as camera-facing, clickable HTML in the scene; its look is defined in `globals.css`.
- `ui/app/HangingCard.tsx` renders the 3D card styles (scroll and wooden board on ropes), which must fit the card footprint in `pins.ts`; `ui/app/cardTextures.ts` draws their surfaces and text on canvases, with `ui/app/cardTextures.check.mjs` as its self-check (`node app/cardTextures.check.mjs` in `ui/`).
- `ui/app/MembersControls.tsx` contains the members list, the delete actions, and the state and saving of the person panel's edit form (create and edit); `ui/app/RelativesFields.tsx` is the form section that assigns parents, children, partners, and (half-)siblings with chips and a name search.
- `ui/app/MemberFields.tsx` holds the person form's shared fields (photo and names on top, birth, death, and note) and the panel that creates a new person from the relatives search.
- `ui/app/MemberSearch.tsx` renders the search square next to the burger menu; it widens to an input with autocomplete over the loaded members, and choosing a result flies the camera to the card and opens the profile.
- `ui/app/nameSearch.ts` matches members by name and birth name (case- and accent-insensitive, every query word must match, names starting with a word first); `ui/app/nameSearch.check.mjs` is its self-check (`node app/nameSearch.check.mjs` in `ui/`).
- `ui/app/PersonPanel.tsx` holds the person panel's shell (header with back, edit, pin, "⋯", and close, draggable by the header), its read-only view with the relatives, and the shared relative chip.
- `ui/app/panelPosition.ts` keeps a dragged person panel within the viewport, reads a stored pin, and places a panel beside another; `ui/app/panelPosition.check.mjs` is its self-check.
- `ui/app/Permissions.tsx` loads `GET /me` into a React context and provides `useMe`, `<OpenFamily>`, `useCan(permission)` (outside any family or in the open one), `<Can permission>`, and the 401/403 notice; `ui/app/access.ts` holds the pure permission, appearance-fallback, and error-status rules, with `ui/app/access.check.mjs` as its self-check.
- `ui/app/i18n.ts` holds every UI text in English and German (TypeScript enforces both have the same keys) and the `useT`/`useLanguage` hooks; components read their texts from `useT()`.
- `ui/app/relatives.ts` lists a member's parents, children, and partners and derives siblings and half-siblings from shared parents; `ui/app/relatives.check.mjs` is its self-check (`node app/relatives.check.mjs` in `ui/`).
- `ui/app/RandomFamilyPanel.tsx` creates named random family sets from its form in the families board ("Zufallsfamilie generieren"); `ui/app/FamiliesPanel.tsx` selects, summarizes, and deletes them; `ui/app/testFamilyPlan.ts` plans exact generation sizes and parent-child links, with `ui/app/testFamilyPlan.check.mjs` as its self-check.
- `ui/app/Tree.tsx` builds the tree geometry and foliage procedurally, collects the branch points that pins are picked from, and rebuilds the aerial roots and outer-ring roots for the crown scale.
- `ui/app/growth.ts` says how far each ring around the tree has grown at a crown scale; `ui/app/growth.check.mjs` is its self-check (`node app/growth.check.mjs` in `ui/`).
- `ui/app/Meadow.tsx` builds the terrain and instanced grass; it exports terrain height used by the tree and scene.
- `ui/app/random.ts` contains seeded random and smooth-noise helpers used by the procedural scene.
- `ui/app/layout.tsx` defines the root document, metadata, and global stylesheet import.
- `ui/app/globals.css` contains the global page styles.
- `ui/` contains the Next.js app, package manifest, pnpm lockfile/workspace settings, TypeScript, ESLint, and Next.js configuration.
- `bff/` contains the Kotlin/Spring Boot BFF scaffold, datasource configuration, and Gradle build.
- `bff/src/main/kotlin/com/github/bff/member/` contains the family and member JPA entities, repositories, services, and controllers implementing the generated API.
- `bff/src/main/kotlin/com/github/bff/member/FamilyVisibility.kt` gives each user their role per family and hides the others; `bff/src/test/kotlin/com/github/bff/auth/PermissionMatrixTest.kt` checks every endpoint per role.
- `bff/src/main/kotlin/com/github/bff/auth/` contains roles, permissions, the access file parser and policy, the legacy role resolver, the Spring Security configuration, the dev-mode filter, and `GET /me`; tests are in `bff/src/test/kotlin/com/github/bff/auth/`.
- `bff/src/test/kotlin/com/github/bff/ManagementPortTest.kt` checks the management port, that the app port does not serve Actuator, metric labels, and JSON logs.
- `bff/src/main/kotlin/com/github/bff/member/Gedcom.kt` parses and writes the GEDCOM subset used for family import and export; `GedcomTest` and `GedcomKindsTest` cover it.
- `bff/src/test/kotlin/com/github/bff/member/ParentLinkTest.kt` covers storing, reading, and resetting parent link kinds.
- `bff/build.gradle.kts` configures OpenAPI Generator's Java Spring generator; generated interfaces and models go under `bff/build/generated/openapi/`.
- `docker-compose.yml` defines the local PostgreSQL database used by the BFF and a Swagger UI container that serves `api/openapi.yaml` at `http://localhost:4010`.
- `bff/Dockerfile` builds the BFF into a container image from the repository root (`docker build -f bff/Dockerfile .`); the image runs as a non-root user and reads `DB_URL`, `DB_USER`, and `DB_PASSWORD` at runtime.
- The root `.dockerignore` only lets `api/openapi.yaml` and `bff/` (without its build output) into that build context.
- The BFF image has no Git history, so its version is `0.0.0-dev`.
- `ui/Dockerfile` builds the UI into a container image from `ui/` (`docker build -t ftree-ui ui`) that runs the standalone Next.js server on port 3000 as a non-root user.
- The UI image's `BFF_URL` build argument (default `http://ftree-bff:8080`) sets the BFF address its `/api` rewrite proxies to; it cannot be changed when the container starts.
- `start.sh` and `stop.sh` start and stop PostgreSQL, the Swagger UI container, the BFF, and the UI for local development; `restart.sh` runs both with a UI dependency install in between, so pulled changes (including BFF code, which `bootRun` recompiles) take effect; the custom Node mock server that previously served the spec was removed.
- `api/openapi.yaml` defines family-set listing, generation, deletion, and family-scoped member operations as the shared API contract.
- `ui/orval.config.ts` generates the typed UI client into `ui/lib/api/generated/members.ts` with the relative base URL `/api`.
- `ui/next.config.ts` rewrites `/api/*` to the BFF at `BFF_URL` (default `http://localhost:8080`), so the browser only talks to the UI's origin; `BFF_URL` is read when the UI is built.
- `ui/next.config.ts` builds the UI as a standalone server (`.next/standalone/server.js`) for container images.
- `.github/workflows/ci.yml` runs on every pull request and push to `main`. Its `ui` job lints, type-checks, and builds the UI and checks that the generated API client matches the spec; its `bff` job builds and tests the BFF against PostgreSQL. Each job runs only when its app directory, `api/openapi.yaml`, or `ci.yml` changes, ignoring Markdown. The `ci-ok` job waits for both and fails if either failed or was cancelled; configure `ci-ok` (together with the PR-title `validate` check) as a required status check so pull requests cannot be merged before the relevant checks finish.
- `.github/workflows/pinact.yml` runs `actionlint` on all GitHub Actions workflows and uses Pinact to fail when an action is not pinned to a commit SHA or its version comment does not match. It runs on pull requests that change workflow files. Pin a new action locally with `pinact run`; Dependabot updates the SHAs afterwards.
- `.github/workflows/release-images.yml` builds the UI and BFF images for arm64 on every published release and pushes them to `ghcr.io/schillpeet/ftree-ui` and `ghcr.io/schillpeet/ftree-bff`, tagged with the release version (for example `0.14.0`) and `sha-<commit>`; it can also be run manually, which only adds the `sha-` tag, and never pushes `latest`.
- `.github/workflows/release-images.yml` also packages the Helm chart in `deploy/ftree/` on every published release, with the release version as chart and app version, and pushes it to `oci://ghcr.io/schillpeet/charts/ftree`; manual runs skip the chart.
- The chart's `bff.auth.*` and `bff.roles.*` values become the BFF's `APP_AUTH_*` and `APP_ROLES_*` variables, and `bff.access` becomes the mounted access file in `APP_ACCESS_FILE`; in cloudflare mode the chart refuses to render without `bff.auth.teamDomain` and `bff.auth.audience` (see `deploy/README.md`).

The procedural scene is presentation code.
It is not a family-tree domain model or a persistence layer.

## Initial Architecture Direction

Keep the UI and Kotlin BFF as separate applications in this repository.
The BFF exposes the UI-facing API and owns access to PostgreSQL; no separate backend service is currently planned.
`api/openapi.yaml` is the shared contract; Orval generates the UI client, and OpenAPI Generator creates Java API interfaces and DTOs implemented by Kotlin.
Flyway manages the schema with versioned SQL migrations in `bff/src/main/resources/db/migration/`, and Hibernate only validates the entities against it (`ddl-auto=validate`).
Databases created earlier by Hibernate are baselined at V1 (`baseline-on-migrate`), so V1 is not run on them; the family-set migration associates those existing members with `default`.
Authentication and authorization must be designed before family data is shared.

Family relationships and identifying information are sensitive.
Any shared-data implementation must define who can view and change a tree, how membership and invitations work, and how users can recover or remove access.
Do not assume that a tree is public by default.

## Open Decisions

These decisions have not been implemented:

- The broader person and family-tree domain model, including how uncertain or conflicting information is represented.
- Relationship types beyond parent/child and partners (for example uncertain links) and schema beyond the `families`, `members` (including card placement), `member_parents`, `member_partners`, and `member_photos` tables, plus backups and data deletion behavior.
- Data export beyond the per-family GEDCOM export, which leaves out photos and card placement.
- Remaining BFF API operations, error format, and deployment shape.
- Authentication, family membership, invitations, authorization, and account recovery.
- How concurrent edits are handled and whether an audit/history model is needed.
- Which parts of the current 3D prototype remain in the product and how family data is navigated or edited.

Resolve these based on product needs before committing to a backend or collaboration design.

## Repository Structure

The repository separates `ui/` and `bff/` while keeping them under one Git root.
pnpm manages only the UI, so its lockfile and workspace settings live in `ui/`; the Kotlin BFF uses its own Gradle build.
Keep this structure rather than nesting a second Git repository.
GitHub Actions runs CI for both applications, and release-please creates version tags and GitHub releases for the repository as a whole; container images are published to GHCR for each release, but deployment is not configured yet.
Revisit further package or repository splits only when separate ownership, access control, or release lifecycles make them useful.
Logo variants live in `docs/assets/`; the f-monogram (`d-f-monogramm-*.svg`) is the current logo, `ui/app/icon.svg` is its icon used as the favicon, and `social-preview.png` (rendered from `social-preview.svg` with `rsvg-convert`) is the GitHub social preview.

## Versioning and Releases

The repository is versioned as a whole with Semantic Versioning tags (`vX.Y.Z`) on `main`.
`bff/build.gradle.kts` derives the BFF version with `git describe --tags` (for example `0.1.0` on a tag, `0.1.0-3-g<sha>` after it, `0.0.0-dev` without Git history).
The UI version is the `version` field in `ui/package.json`, which release-please bumps in the release PR (`extra-files` in `release-please-config.json`), because the UI image is built without Git history.
CI checks out the full history for the BFF so tags are available.

release-please (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) opens or updates a release PR after each merge to `main`.
Commit types decide the next version: `fix` bumps the patch version, `feat` the minor version, and breaking changes also bump the minor version while in `0.x`; other types except `deps` do not trigger a release.
Dependabot titles its pull requests `deps(ui)`, `deps(bff)`, or `deps(repo)` (`.github/dependabot.yml`), and `release-please-config.json` lists the `deps` type as a visible "Dependencies" changelog section, so Dependabot merges alone bump the patch version.
After release-please has updated the release PR, `release-please.yml` runs `.github/scripts/collapse-dependency-notes.mjs` on the release branch's `CHANGELOG.md` and on the PR body, which collapses all Dependabot entries of the upcoming release into the single line "update dependencies with dependabot" with links to their PRs.
The GitHub release notes are taken from the release PR body, so they show the same single line.
Merging the release PR updates `CHANGELOG.md` and creates the tag and GitHub release.
Each published release triggers `.github/workflows/readme-preview.yml`, which starts the stack with the fictional demo family from `docs/preview/demo.ged` and attaches a `preview.png` screenshot to the release; the README embeds the latest release's preview, and the workflow can be run manually for an existing tag.
Release PRs are titled `chore(repo): release X.Y.Z` (`pull-request-title-pattern`) so they pass the PR-title check, and are created with the fine-grained personal access token in the `RELEASE_PLEASE_TOKEN` secret (this repository only; Contents and Pull requests read/write), because PRs opened with `GITHUB_TOKEN` do not trigger workflows and their required checks would never run.

Pull requests are squash-merged, so the PR title becomes the only commit message release-please sees for that PR; individual commits on the PR branch do not become separate changelog entries.
Every independently releasable feature or fix must therefore have its own PR, with an accurate, lowercase Conventional Commit title such as `feat(ui): add family visibility toggle` or `fix(repo): manage local services`.
Do not bundle independent features into one PR or expect their branch commits to preserve separate release notes.
The PR-title workflow rejects titles that do not follow the lowercase `<type>(<scope>): <message>` convention.
Configure its status check as required in GitHub branch protection so invalid titles cannot be merged.
A malformed or capitalized title can be ignored by release-please even when the commits inside the PR contain valid conventional commit messages, resulting in a missing version bump or changelog entry.
Merge commits would list each change twice, because release-please also parses the PR title in the merge commit body.

`info.version` in `api/openapi.yaml` is the API contract version and changes only when the contract changes.

## Keeping This Overview Useful

Keep current behavior and future intent clearly separated.
Update this document when the app structure, product direction, or an architectural decision changes.
Write one sentence per line and put new behavior as new lines in the matching `###` section of "Current State" (or a new section), rather than extending an existing sentence or paragraph, so branches that document different features do not conflict.
Avoid duplicating detailed setup instructions here; the root `README.md` is the setup entry point, and `AGENTS.md` contains repository-specific agent guidance.
