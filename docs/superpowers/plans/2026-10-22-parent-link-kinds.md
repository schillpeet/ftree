# Parent Link Kinds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every parent/child link carries a kind (biological, adoptive, step, foster) that is stored, edited in the relatives form, shown in the profile, and carried through anonymous copies and GEDCOM.

**Architecture:** Mirror how partnership details were added (`8517871`, `f121f80`): a `kind` column on `member_parents` with a default, written by JDBC after the JPA links are flushed, read per family by one JDBC query, exposed as a read-only `Member.parentLinks` list and accepted as an optional `Relatives.parentLinks` list.

**Tech Stack:** OpenAPI 3 (`api/openapi.yaml`), Kotlin/Spring Boot + Flyway + JPA/JDBC (`bff/`), Next.js/React with orval-generated client (`ui/`).

**Spec:** `docs/superpowers/specs/2026-10-22-experimental-view-routing-design.md` (section "Parent link kinds"; on branch `docs/repo-add-experimental-view-routing-design`, PR #150).

## Global Constraints

- Kinds, exactly: `biological` (default), `adoptive`, `step`, `foster`.
- `Member.parentLinks` is read-only and lists `{ parentId, kind }` for every id in `parentIds`.
- `Relatives.parentLinks` is optional: when absent, stored kinds stay unchanged; when sent, parents left out are `biological`.
- GEDCOM `PEDI` mapping: `birth` ↔ `biological`, `adopted` ↔ `adoptive`, `foster` ↔ `foster`; `step` is exported without `PEDI`; unknown `PEDI` values import as `biological`.
- UI labels: German „leiblich“, „adoptiert“, „Stief“, „Pflege“; English "biological", "adoptive", "step", "foster".
- Do not edit generated files by hand: run `pnpm --dir ui api:generate` after changing the spec; the BFF generates on build.
- Branch `feat/bff-add-parent-link-kinds`, PR title `feat(bff): add parent link kinds`.
- Do not commit per task: stage only. One commit at the end, after showing the user the staged diff and the message and getting explicit approval (AGENTS.md).
- `docs/project-overview.md`: one sentence per line, new behaviour as new lines in the matching "Current State" section; remove adoption from "Open Decisions".

## Review Focus

- Replacing a member's parents (adding a second parent) must keep the stored kind of the parent who stays; Hibernate replacing the whole collection would silently reset it to biological. Owner: Task 2.
- Editing a member as a child from the parent's side (adding them under "children") must not reset the kind of that member's other parents. Owner: Task 2.
- A couple whose child has different kinds per parent (mother biological, father adoptive) must survive a GEDCOM export and re-import. Owner: Task 4.
- An anonymous copy must keep the kinds; copying only the JPA links would reset them. Owner: Task 3.
- An old browser tab sending relatives without `parentLinks` must not wipe stored kinds. Owner: Task 2.

---

### Task 1: API contract

**Files:**
- Modify: `api/openapi.yaml` (schemas `Member`, `Relatives`; new `ParentLink`)
- Regenerate: `ui/lib/api/generated/members.ts` via `pnpm --dir ui api:generate`

**Interfaces:**
- Produces: schema `ParentLink { parentId: uuid (required), kind: enum [biological, adoptive, step, foster] (required) }`; `Member.parentLinks: ParentLink[]` (required, readOnly, description "Kind per parent in parentIds."); `Relatives.parentLinks: ParentLink[] | null` (description: kinds of parents in parentIds; parents left out are biological; when absent, existing kinds stay unchanged). Generated Kotlin `com.github.bff.generated.model.ParentLink` with `ParentLink.KindEnum`; generated TS type `ParentLink`.

- [ ] **Step 1:** Add the schemas next to `Partnership`, mirroring its style; mention parent kinds in the `PUT /members/{id}/relatives` description.
- [ ] **Step 2:** Run `pnpm --dir ui api:generate` and `cd bff && ./gradlew compileKotlin`. Expected: both succeed; `members.ts` exports `ParentLink`.
- [ ] **Step 3:** Run `pnpm --dir ui typecheck`. Expected: fails only where `Member` objects are built without `parentLinks` (fixed in Task 5), or passes.
- [ ] **Step 4:** Stage.

### Task 2: Store and update kinds in the BFF

**Files:**
- Create: `bff/src/main/resources/db/migration/V14__add_parent_link_kinds.sql`
- Modify: `bff/src/main/kotlin/com/github/bff/member/MemberService.kt` (`updateRelatives`, new `parentLinks(familyId)`, `toResponse`)
- Test: `bff/src/test/kotlin/com/github/bff/member/ParentLinkTest.kt` (style of `PartnershipTest.kt`)

**Interfaces:**
- Consumes: `ParentLink`, `Relatives.parentLinks` from Task 1.
- Produces: column `member_parents.kind varchar(16) NOT NULL DEFAULT 'biological' CHECK (kind IN ('biological','adoptive','step','foster'))`; `private fun parentLinks(familyId: UUID): Map<UUID, List<ParentLink>>` keyed by child id; every `Member` response has `parentLinks` covering all `parentIds`.

- [ ] **Step 1: Write the failing tests** in `ParentLinkTest` (family with `mother`, `father`, `stepfather`, `child`):
  - `stores the kind of each parent`: relatives of `child` with parents `[mother, stepfather]`, parentLinks `[mother: BIOLOGICAL, stepfather: STEP]` → `findAll` gives `child.parentLinks` with exactly those pairs.
  - `parents left out of parentLinks are biological`: parentLinks `[stepfather: STEP]` only → mother is `BIOLOGICAL`.
  - `keeps kinds when parentLinks is absent`: store `stepfather: STEP`, then update relatives again with `parentLinks = null` → still `STEP`.
  - `keeps the kind of a kept parent when another parent is added`: store `[stepfather: STEP]`, then update with parents `[stepfather, father]` and `parentLinks = null` → stepfather `STEP`, father `BIOLOGICAL`.
  - `keeps kinds when the child is added from the parent's side`: store `child` with `stepfather: STEP`; update relatives of `mother` with `childIds = [child]` → stepfather still `STEP`.
  - `rejects a kind for someone who is not a parent`: parentLinks naming `father` while parents are `[mother]` → `RelativesResult.INVALID`.
  - `rejects a parent listed twice`: parentLinks `[mother: STEP, mother: BIOLOGICAL]` → `INVALID`.
- [ ] **Step 2:** Run `cd bff && ./gradlew test --tests '*ParentLinkTest'`. Expected: FAIL (no `parentLinks` on `Member`, or kinds not stored).
- [ ] **Step 3:** Add the migration and implement:
  - Validate `parentLinks` like `partnerships` (unique ids, all in `parentIds`).
  - Replace `member.parents = …` by an in-place `removeIf`/`addAll`, as `member.partners` already is, so kept rows and their kinds stay.
  - When `parentLinks != null`: `memberRepository.flush()`, then `UPDATE member_parents SET kind = ? WHERE child_id = ? AND parent_id = ?` for every parent in `parentIds`, `biological` for those left out.
  - Read kinds with one query over `member_parents JOIN members ON m.id = child_id WHERE m.family_id = ?`, and set `parentLinks` in `toResponse` (also for the single-member update response at line ~89).
- [ ] **Step 4:** Run `cd bff && ./gradlew test`. Expected: PASS, including `SiblingsTest` and `PartnershipTest`.
- [ ] **Step 5:** Stage.

### Task 3: Keep kinds in anonymous copies

**Files:**
- Modify: `bff/src/main/kotlin/com/github/bff/member/FamilyService.kt` (anonymize, after the partnership details copy at ~line 176)
- Test: `bff/src/test/kotlin/com/github/bff/member/AnonymizeFamilyTest.kt`

**Interfaces:**
- Consumes: column `member_parents.kind` (Task 2).

- [ ] **Step 1:** Write the failing test `copies parent link kinds`: source child with `stepfather: STEP` → the copy's child has the copied stepfather with `STEP`.
- [ ] **Step 2:** Run `./gradlew test --tests '*AnonymizeFamilyTest'`. Expected: FAIL (`BIOLOGICAL`).
- [ ] **Step 3:** After the flush, select `child_id, parent_id, kind` of the source family and `batchUpdate` the copies' rows, as is done for `member_partners`.
- [ ] **Step 4:** Run `./gradlew test`. Expected: PASS.
- [ ] **Step 5:** Stage.

### Task 4: GEDCOM PEDI

**Files:**
- Modify: `bff/src/main/kotlin/com/github/bff/member/Gedcom.kt` (`GedcomPerson`, `parseGedcom`, `writeGedcom`)
- Modify: `bff/src/main/kotlin/com/github/bff/member/FamilyService.kt` (import at ~line 130, export at ~line 215)
- Test: `bff/src/test/kotlin/com/github/bff/member/GedcomTest.kt`

**Interfaces:**
- Consumes: `ParentLink.KindEnum` (Task 1), `member_parents.kind` (Task 2).
- Produces: `GedcomPerson.parentKinds: Map<String, ParentLink.KindEnum> = emptyMap()`; a parent missing from the map is biological.

- [ ] **Step 1:** Write the failing tests:
  - `reads pedigree kinds from FAMC PEDI`: an INDI with `1 FAMC @F1@` / `2 PEDI adopted` for a FAM with HUSB and WIFE → both parents `ADOPTIVE`; `2 PEDI foster` → `FOSTER`; `2 PEDI BIRTH` (GEDCOM 7 casing) → `BIOLOGICAL`; `2 PEDI sealed` → `BIOLOGICAL`.
  - `writes pedigree kinds`: a child of a couple, both `ADOPTIVE` → one FAM, and the child's `1 FAMC` is followed by `2 PEDI adopted`; `STEP` → `FAMC` without `PEDI`.
  - `splits a couple whose kinds differ`: mother `BIOLOGICAL`, father `ADOPTIVE` (partners) → two single-parent FAMs; reading the output back gives the same `parentKinds`.
  - Extend `writes what it reads back` with one adoptive child.
- [ ] **Step 2:** Run `./gradlew test --tests '*GedcomTest'`. Expected: FAIL.
- [ ] **Step 3:** Implement: the parser reads `PEDI` under each `FAMC` and applies it to that FAM's spouses (the `CHIL` record alone carries no kind); the writer groups a child's parents into one FAM only when they are a couple *and* share a kind, and writes `2 PEDI` lowercase (5.5.1) under `FAMC` for `adopted`/`foster`. In `FamilyService`, export passes `parentKinds` from the Task 2 query; import writes kinds after its `flush()` as Task 3 does.
- [ ] **Step 4:** Run `./gradlew build`. Expected: PASS with no warnings (warnings fail the build).
- [ ] **Step 5:** Stage.

### Task 5: Relatives form and profile

**Files:**
- Modify: `ui/app/RelativesFields.tsx` (parent group gets `extra`; state; `onChange` payload; change detection)
- Modify: `ui/app/PersonPanel.tsx` (parent chips show a non-biological kind)
- Modify: `ui/app/i18n.ts` (de and en)
- Modify: `ui/app/globals.css` only if the select needs the existing partner-status class
- Modify: any test fixture or factory that builds a `Member` (find with `pnpm --dir ui typecheck`)

**Interfaces:**
- Consumes: `Member.parentLinks`, `Relatives.parentLinks`, `ParentLink` (Task 1).
- Produces: i18n keys `t.relatives.parentKinds: Record<ParentLink['kind'], string>` and `t.relatives.parentKind(name: string): string` (aria-label of the select, e.g. „Art der Elternschaft von Karin Behrendt“).

- [ ] **Step 1:** Add a `kinds: Record<string, ParentLink['kind']>` state initialised from `member.parentLinks`, a select per selected parent (reuse the partner status select's markup and class), include `parentLinks: parentIds.map((parentId) => ({ parentId, kind: kinds[parentId] ?? 'biological' }))` in `onChange`, and add the kinds to the key that decides whether the form changed.
- [ ] **Step 2:** In `PersonPanel.tsx`, add the kind label after a parent chip when it is not `biological`, the way the partner status follows a partner chip.
- [ ] **Step 3:** Run `pnpm --dir ui lint && pnpm --dir ui typecheck && pnpm --dir ui build`. Expected: PASS.
- [ ] **Step 4:** Run `./start.sh`, open http://localhost:3000, family `fam-schiller`, Kirsten Wagner → edit → Beziehungen: set Horst Manfred Behrendt to „Stief“, save; the profile shows „Stief“ next to Horst; reload and it is still there; Wolfgang Krenzlin and Karin stay „leiblich“ without a label.
- [ ] **Step 5:** Stage.

### Task 6: Overview, verification, commit

**Files:**
- Modify: `docs/project-overview.md` ("Members and relatives", "BFF and API", "Families" for GEDCOM, "Open Decisions")
- Add: this plan file

- [ ] **Step 1:** Add new lines: each parent has a kind (leiblich, adoptiert, Stief, Pflege) chosen next to the parent in the relatives form; the profile names non-biological kinds; GEDCOM import and export map `PEDI`, and step parents are exported without it; anonymous copies keep the kinds. In "Open Decisions", drop adoption from the relationship types list.
- [ ] **Step 2:** Run `git fetch origin && git rebase origin/main`, then `cd bff && ./gradlew build` and `pnpm --dir ui lint && pnpm --dir ui typecheck && pnpm --dir ui build` and the `node app/*.check.mjs` scripts listed in `.github/workflows/ci.yml`. Expected: all pass.
- [ ] **Step 3:** Open the diff pane, give the review URLs (UI http://localhost:3000, BFF http://localhost:8080, Swagger UI http://localhost:4010), show the staged diff and the message `feat(bff): add parent link kinds`, and wait for approval.
- [ ] **Step 4:** After approval: commit, push, open the PR titled `feat(bff): add parent link kinds`, and check that the PR-title check passes.
