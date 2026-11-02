# User journeys

## New user without a tree

1. Signs in (invited/allowed address) and is not assigned to any tree; `/start` finds no tree and stays.
2. Sees the welcome card over the veiled scene, first and last name prefilled.
3. "Baum pflanzen" creates the tree "Familie <Nachname>" with the user as the first person.
4. Camera settles on the user's card; the intro tour starts (skippable).
5. Dashed slots invite the first relatives; mother, then father in one flow.
- Goal: first own card in under 30 seconds, first relative within the first minute.
- Alternative on the card: GEDCOM import (opens the Familien board).

## Invited user

1. Opens the invitation text's link and signs in; the invited tree is one of their trees, and `/start` opens it like any other.
2. The invitation card shows the tree's name, its people and generations; the inviter is not named.
3. If the user is linked to a member, the card shows "Du hängst schon im Baum als …" with "Nicht ich"; otherwise a note says the account is not assigned yet.
4. "Einladung annehmen" opens the tree focused on their own card; until then they can only look, and the dock is locked.
   - "Später entscheiden" leaves the invitation open, for example to plant their own tree first; a reminder above the dock with "Antworten" brings the card back, and it returns on the next visit.
   - "Ablehnen" asks once, removes the tree from their list, and goes to `/start` (another tree, or the welcome card).
5. The intro tour runs once; then a task card offers "Deine Daten prüfen", "Foto hinzufügen", "Deinen Zweig ergänzen".
- Goal: they contribute something (photo, date fix, own branch) in the first session.

## Returning user

1. `/start` (from "Zu deinem Baum" or "Anmelden") opens their last tree, else the tree "default", else the first; the camera flies to their own card.
2. Dock for the main actions, header for family, theme, language, menu.
3. Selecting a person highlights their lineage and shows the person panel; "+" slots show what is missing.
4. Other trees are one click away in the family switcher; an unknown or forbidden address shows "Baum nicht gefunden".
- Goal: no hunting through menus; any relative is two clicks and a name away.

## Signed-out visitor

1. `/` redirects to the landing page `/home`.
2. The hero offers "Baum anlegen" (sign-in) and "So funktioniert's"; below it a note says that access needs an invitation, and "Anmelden" sits top right.
3. `/home/how` explains the three steps and leads on to "Beispielfamilie ansehen", a read-only example tree, or to signing in.
4. Signed in, the steps link into the own tree and tick off what is done (own card, tree shared, three people); step 2 opens the share dialog.
5. "← Zurück" on the steps and example pages leads back to the landing page.
6. In TRON the way into a tree ("Zu deinem Baum", "Beispielfamilie ansehen") is a ride: the page derezzes and the camera drives in over the grid, so the landing and the tree feel like one world.
