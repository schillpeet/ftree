# Member-to-User Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The BFF knows which member of a tree is the signed-in person, so the UI can mark "DU", fly the camera to that card, start a new tree with the user, and show "Du hängst schon im Baum als …" with "Nicht ich".

**Architecture:** The link lives on the membership: a nullable `family_memberships.member_id`, unique per family, with a composite foreign key to `members (id, family_id)` that keeps the member inside the membership's family and is cleared when the member is deleted.
A person without a membership (an admin who only reaches a tree as admin) has no row to hold a link, so they have no self member.
`FamilySummary.selfMemberId` reports the caller's own link; `PUT`/`DELETE /families/{familyId}/self` set and clear it; `PUT /families/{familyId}/access` takes an optional `memberId` for the invitee; `TreeAccessEntry.memberId` shows owners whom each person is.

**Tech Stack:** OpenAPI 3 (`api/openapi.yaml`), Kotlin/Spring Boot + Flyway + JDBC (`bff/`), orval-generated client (`ui/`).

## Global Constraints

- One user ↔ at most one member per family; one member ↔ at most one user.
- Linking yourself needs `member.edit` in the tree and a membership there; unlinking yourself needs only `tree.view` and always succeeds (204, idempotent).
- A tree the caller cannot see stays 404; a member outside the tree answers 404; a member linked to someone else answers 409 `MEMBER_TAKEN` without naming that person.
- Sharing without `memberId` leaves an existing link alone; with `memberId` it sets the invitee's link (no pending/accept state).
- Moving members into another family (archive) clears the links of the source family first.
- Never edit generated files; run `pnpm --dir ui api:generate`, the BFF generates on build.
- Do not commit; leave the work uncommitted in the worktree.

---

### Task 1: API contract

**Files:**
- Modify: `api/openapi.yaml`
- Regenerate: `ui/lib/api/generated/members.ts`

**Interfaces:**
- `FamilySummary.selfMemberId: uuid | null` (required, readOnly).
- `PUT /families/{familyId}/self` (`setSelfMember`, tag Families) with `SetSelfMemberRequest { memberId: uuid }` → 200 `FamilySummary`; 400 `INVALID_REQUEST` without a membership, 403, 404, 409 `MEMBER_TAKEN`.
- `DELETE /families/{familyId}/self` (`clearSelfMember`) → 204.
- `ShareTreeRequest.memberId: uuid | null` (optional); `TreeAccessEntry.memberId: uuid | null` (required).
- `ProblemCode.MEMBER_TAKEN` (409).

- [ ] Add the paths, schemas, and problem code; run `pnpm --dir api lint`, `pnpm --dir ui api:generate`.

### Task 2: Storage

**Files:**
- Create: `bff/src/main/resources/db/migration/V29__link_members_to_users.sql`

**Interfaces:**
- `members` gets `UNIQUE (id, family_id)`; `family_memberships.member_id uuid` with `UNIQUE (family_id, member_id)` and `FOREIGN KEY (member_id, family_id) REFERENCES members (id, family_id) ON DELETE SET NULL (member_id)`.

- [ ] Write the migration.

### Task 3: Service, controller, security

**Files:**
- Create: `bff/src/main/kotlin/com/github/bff/auth/SelfMembers.kt`
- Modify: `member/FamilyVisibility.kt` (fill `selfMemberId`), `member/FamiliesController.kt`, `member/FamilyService.kt` (archive), `access/TreeAccessService.kt`, `access/AccessController.kt`, `auth/SecurityConfiguration.kt`, `problem/ApiProblem.kt`

**Interfaces:**
- `SelfMembers.of(email): Map<UUID, UUID>` (family → member), `link(familyId, email, memberId, actor)`, `unlink(familyId, email, actor)`; audit actions `membership.member.linked` / `membership.member.unlinked`.
- Security: `PUT /families/{familyId}/self` → `inFamily(MEMBER_EDIT)`, `DELETE /families/{familyId}/self` → `inFamily(TREE_VIEW)`.

- [ ] Implement; link locks the family row like `MembershipService`, so two people cannot claim one member at once.

### Task 4: Tests

**Files:**
- Create: `bff/src/test/kotlin/com/github/bff/auth/SelfMemberTest.kt` (MockMvc with Cloudflare test tokens, like `PermissionMatrixTest`)
- Modify: `auth/PermissionMatrixTest.kt` (two new endpoints), `access/TreeAccessServiceTest.kt` (share with `memberId`)

- [ ] Cases: link and read back via `GET /families`; visitor 403; foreign tree 404; member of another tree 404; unlink always 204 (visitor, without link); member taken 409; one member per user (relinking replaces); member deletion clears the link; archive clears the links; admin without membership has `selfMemberId` null and cannot link; sharing with `memberId` links the invitee and keeps it on a later share without it.

### Task 5: Docs and verification

- [ ] `docs/project-overview.md` "Current State" lines (Sharing); fix the "not implemented yet" wording there and in `AGENTS.md`.
- [ ] `cd bff && ./gradlew build`; `pnpm --dir ui typecheck`.
