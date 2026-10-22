# Experimental view: circuit-diagram line routing

Status: design, not implemented.

## Goal

The experimental view should show at a glance how people are related: parents and children, married, together, separated, divorced, widowed, and step or adoptive links.
Its lines should read like an electronic schematic: only right angles, every connection a visible junction, no line lying on or running right next to another, and no crossing.
This must hold by construction and be checked automatically, not fixed case by case.

## Why the current approach fails

`simpleLayout.ts` orders people and `relationLines` in `familyLayout.ts` draws the lines, through about 30 special rules (forks, dashed lines at the family bar's height, partners outermost, …).
There is no track system: two horizontal lines can end up a few units apart or on top of each other.
In `fam-schiller` this shows at Kirsten Wagner (her bar to Helmut, Robert's line, and the dashed line to her former partner run into each other) and at Horst Behrendt (a second child bar for Kirsten's three parents runs parallel to the family bar, plus a small fork box).
`generations()` also puts a co-parent without a stored partnership (Wolfgang Krenzlin) at the top row instead of next to the other parent.

## Visual grammar

- Names float on one row per generation, as now.
- Every partnership is a horizontal line between the two partners, with a symbol on it: ⚭ married, ⚯ together, ⚮ divorced; separated has no symbol.
  Separated and divorced lines are dashed; a widowed line is solid with ⚭, and † stands at the deceased person's name.
- Children hang from a sibling bar, which hangs from a stem below the union node: the middle of the partnership line for adjacent partners, or straight below the outer partner when someone stands between the two.
- A parent link of kind step, adoptive, or foster is dotted; biological links are solid.
- Every junction is a T with a small dot; no point joins four lines, because that reads as a crossing.
- Step-siblings are not linked directly; they show through the partnership line between their parents.

## Model

A pure graph built from the members (`ui/app/experimental/model.ts`):

- Person nodes with their generation.
- Union nodes: one per stored partnership and one per set of parents sharing a child without a stored partnership (co-parents); a single parent forms a union of one.
- Each child links to exactly one union, the one formed by its parents; non-biological parent links carry their kind.

Co-parents share a row like partners, so a biological father without a partnership stands next to the mother.

## Ordering rules

Ordering decides which crossings are avoidable; routing then never needs to cross.

- Partner group: the person with several partners stands in the middle; partners with shared children stand outermost, at most one per side; childless partners stand inside, the current one nearest.
- A third partner with children cannot be placed without a crossing; that union falls back to a reference stub (below).
- Sibling group: a child who married into a displayed family stands at the edge facing that family, whose couple stands directly above the married-in partner.
  A sibling group has two edges, so at most two such links are drawn; further in-law families and loops (for example cousins marrying) fall back to a reference stub.
- Couples are centred over their children and families packed as tightly as their contours allow, as `simpleLayout.ts` does today.

## Routing

The space between two rows is a channel with discrete tracks (`ui/app/experimental/route.ts`):

- Upper part: partner tracks for the upper row's partnership lines.
- Lower part: sibling-bar tracks.
- Vertical segments only at a person's x or a union node's x.
- Each horizontal segment gets a track by left-edge interval assignment, so overlapping segments never share a track.
- Vertical constraints order the tracks: a line spanning another person's drop runs below that drop's end, and a union's stem never passes a deeper horizontal line it does not join.
- If the constraints form a cycle, the layout produced an unavoidable crossing; the offending link is replaced by a reference stub instead of being drawn.

## Reference stub

Where a link cannot be drawn without crossing, the person gets a small marker instead, for example "▲ Eltern von Ludmilla".
Clicking it opens the person panel for those relatives.
The tree itself stays crossing-free.

## Checker

`ui/app/experimental/route.check.mjs` runs the layout and routing over the fixtures, `fam-schiller`-like scenarios, and a few hundred random families from `random.ts`, and asserts:

1. Every segment is horizontal or vertical.
2. No two collinear segments overlap, and parallel horizontal segments are at least one track apart.
3. No segment passes through a name other than its own end.
4. No two segments cross, and no point joins four segments.
5. Reading the drawn segments back as a graph (people, junctions, symbols, line styles) gives exactly the input relations: each child's line leads to exactly its parents' union, with the right status and parent kinds, or to a stub.

## Parent link kinds (separate, earlier PR)

- API: `Member.parentLinks` (read-only) lists `{ parentId, kind }` with kind `biological` (default), `adoptive`, `step`, or `foster`; the relatives request accepts the kind per parent.
- BFF: a `kind` column on `member_parents`, defaulting to `biological`, with a migration.
- UI: a kind select next to each parent chip in the relatives form; the profile shows the kind next to non-biological parents.
- GEDCOM: import and export map `PEDI` (`birth`, `adopted`, `foster`); `step` is exported without `PEDI`.

## Delivery

1. `feat(bff): add parent link kinds`, covering API, BFF, migration, form, and GEDCOM.
2. `feat(ui): route experimental view lines like a circuit diagram`: the model, ordering, routing, stubs, checker, and the `SimpleTree.tsx` switch; the organic views keep `relationLines`.
   The experimental-view sentences in `docs/project-overview.md` are replaced by the rules above.

## Out of scope

- A focus or hourglass mode.
- Bridges (hop-overs) at crossings.
- Changes to the organic and tiered trees.
