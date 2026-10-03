# Project Overview

## Purpose

ftree is intended to become a web service where family members can create and maintain a shared family tree. The repository is currently an early visual prototype, not a working family-tree service.

## Current State

The home route displays a full-screen Three.js scene with one procedurally generated tree in a meadow, plus a members list with edit and delete actions and a form for creating and editing members. A permanent, initially empty `default` family is selected on a fresh install; custom people created from the members form belong to the selected family. The upper-right test-user board creates a named family set with up to 250 generated members across 1–10 generations and 0–3 children per parent. The adjacent family selector displays compact people/children/generation counts, switches the visible tree, and deletes non-default family sets after confirmation. Family sets and their settings are persisted in PostgreSQL; existing members are migrated into `default`, and members/relationships are scoped to the selected set. The original `/members` endpoints remain available for the default family. Every member appears in the scene as a papyrus scroll showing photo (from `photoUrl`), name, birth and death dates, and note. Each member can be assigned any number of parents, children, and partners (current or former; always mutual) from the members list. Scrolls are placed automatically in rows on an arc in front of the tree: one row per generation, every member below all of their parents, partners in the same row side by side, siblings centred under their parents, and members without known parents directly above their children. Light lines drawn over the foliage connect families: each parent drops to a bar joining the parents, a stem from its middle leads to a bar from which the children hang, and where two families' bars would overlap in a row they get different heights. Partners without shared children are joined by a gold line. Selecting a member in the list moves the camera to their scroll; clicking a scroll (or pressing Enter on it) opens that member's edit form, while a drag that starts on a scroll still orbits the camera. Dialogs and the members list close on Escape or a click outside them; the edit form and the relatives dialog first ask before discarding unsaved changes, and the create form keeps its draft. A zoom scale in the bottom-right corner zooms in and out alongside mouse wheel and trackpad pinch. The UI calls a generated client. The BFF implements family-scoped member listing, creation, editing, deletion, parent/child and partner links, plus atomic generation/deletion of whole sets against PostgreSQL; it rejects links that would make someone their own ancestor. Authentication and a broader family-tree model (relationship types such as adoption, dates of partnerships, uncertain links) are not implemented.

The repository separates the Next.js UI from a Kotlin Backend for Frontend (BFF). The UI uses TypeScript, React, React Three Fiber, Drei, and Three.js. The Kotlin/Spring Boot BFF uses JPA and PostgreSQL for member records. pnpm configuration, dependencies, lockfile, and scripts live in `ui/`; the BFF uses its own Gradle build.

## Code Map

- `ui/app/page.tsx` renders the home scene.
- `ui/app/FamilyTree.tsx` holds the loaded members, the camera focus, and the profile request (a clicked scroll) shared by the scene and the members overlay.
- `ui/app/Scene.tsx` configures the canvas, sunset lighting, meadow, tree, camera controls with the zoom scale, member scrolls with relation lines, and the camera flight to a selected scroll.
- `ui/app/familyLayout.ts` computes generations and scroll positions; `ui/app/familyLayout.check.mjs` is its self-check (`node app/familyLayout.check.mjs` in `ui/`).
- `ui/app/Scroll.tsx` renders a member's papyrus scroll as camera-facing, clickable HTML in the scene; its look is defined in `globals.css`.
- `ui/app/MembersControls.tsx` contains the members list, edit and delete actions, and the form used to create and edit members; `ui/app/RelativesDialog.tsx` assigns parents, children, and partners.
- `ui/app/TestUsersPanel.tsx` creates named generated family sets from the upper-right board; `ui/app/FamiliesPanel.tsx` selects, summarizes, and deletes them; `ui/app/testFamilyPlan.ts` plans exact generation sizes and parent-child links, with `ui/app/testFamilyPlan.check.mjs` as its self-check.
- `ui/app/Tree.tsx` builds the tree geometry and foliage procedurally.
- `ui/app/Meadow.tsx` builds the terrain and instanced grass; it exports terrain height used by the tree and scene.
- `ui/app/random.ts` contains seeded random and smooth-noise helpers used by the procedural scene.
- `ui/app/layout.tsx` defines the root document, metadata, and global stylesheet import.
- `ui/app/globals.css` contains the global page styles.
- `ui/` contains the Next.js app, package manifest, pnpm lockfile/workspace settings, TypeScript, ESLint, and Next.js configuration.
- `bff/` contains the Kotlin/Spring Boot BFF scaffold, datasource configuration, and Gradle build.
- `bff/src/main/kotlin/com/github/bff/member/` contains the family and member JPA entities, repositories, services, and controllers implementing the generated API.
- `bff/build.gradle.kts` configures OpenAPI Generator's Java Spring generator; generated interfaces and models go under `bff/build/generated/openapi/`.
- `docker-compose.yml` defines the local PostgreSQL database used by the BFF.
- `dev.sh` starts the database, BFF, and UI for local development.
- `api/openapi.yaml` defines family-set listing, generation, deletion, and family-scoped member operations as the shared API contract.
- `ui/orval.config.ts` generates the typed UI client into `ui/lib/api/generated/members.ts`; `NEXT_PUBLIC_BFF_URL` sets the BFF base URL at generation time (default `http://localhost:8080`).
- `.github/workflows/ui.yml` lints, type-checks, and builds the UI and checks that the generated API client matches the spec; `.github/workflows/bff.yml` builds and tests the BFF against PostgreSQL. Each runs only when its app directory, `api/openapi.yaml`, or its own workflow file changes, ignoring Markdown.
- `.github/workflows/pinact.yml` runs `actionlint` on all GitHub Actions workflows and uses Pinact to open a pull request when workflow actions need SHA pins. It runs when workflow files change.

The procedural scene is presentation code. It is not a family-tree domain model or a persistence layer.

## Initial Architecture Direction

Keep the UI and Kotlin BFF as separate applications in this repository. The BFF exposes the UI-facing API and owns access to PostgreSQL; no separate backend service is currently planned. `api/openapi.yaml` is the shared contract; Orval generates the UI client, and OpenAPI Generator creates Java API interfaces and DTOs implemented by Kotlin. Flyway manages the schema with versioned SQL migrations in `bff/src/main/resources/db/migration/`, and Hibernate only validates the entities against it (`ddl-auto=validate`). Databases created earlier by Hibernate are baselined at V1 (`baseline-on-migrate`), so V1 is not run on them; the family-set migration associates those existing members with `default`. Authentication and authorization must be designed before family data is shared.

Family relationships and identifying information are sensitive. Any shared-data implementation must define who can view and change a tree, how membership and invitations work, and how users can recover or remove access. Do not assume that a tree is public by default.

## Open Decisions

These decisions have not been implemented:

- The broader person and family-tree domain model, including how uncertain or conflicting information is represented.
- Relationship types beyond parent/child and partners (adoption, partnership dates, uncertain links) and schema beyond the `families`, `members`, `member_parents`, and `member_partners` tables, plus backups and data export/deletion behavior.
- Remaining BFF API operations, error format, and deployment shape.
- Authentication, family membership, invitations, authorization, and account recovery.
- How concurrent edits are handled and whether an audit/history model is needed.
- Which parts of the current 3D prototype remain in the product and how family data is navigated or edited.

Resolve these based on product needs before committing to a backend or collaboration design.

## Repository Structure

The repository separates `ui/` and `bff/` while keeping them under one Git root. pnpm manages only the UI, so its lockfile and workspace settings live in `ui/`; the Kotlin BFF uses its own Gradle build. Keep this structure rather than nesting a second Git repository. GitHub Actions runs CI for both applications, and release-please creates version tags and GitHub releases for the repository as a whole; deployment is not configured yet. Revisit further package or repository splits only when separate ownership, access control, or release lifecycles make them useful.

## Versioning and Releases

The repository is versioned as a whole with Semantic Versioning tags (`vX.Y.Z`) on `main`. No file holds the version: `bff/build.gradle.kts` derives it with `git describe --tags` (for example `0.1.0` on a tag, `0.1.0-3-g<sha>` after it, `0.0.0-dev` without Git history), and `ui/package.json` has no version field. CI checks out the full history for the BFF so tags are available.

release-please (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) opens or updates a release PR after each merge to `main`. Commit types decide the next version: `fix` bumps the patch version, `feat` the minor version, and breaking changes also bump the minor version while in `0.x`; other types do not trigger a release. Merging the release PR updates `CHANGELOG.md` and creates the tag and GitHub release. Release PRs are created with `GITHUB_TOKEN`, so CI does not run on them. Pull requests are squash-merged with the PR title as the commit message, so each PR yields exactly one changelog entry and PR titles must follow the commit convention. Merge commits would list each change twice, because release-please also parses the PR title in the merge commit body.

`info.version` in `api/openapi.yaml` is the API contract version and changes only when the contract changes.

## Keeping This Overview Useful

Keep current behavior and future intent clearly separated. Update this document when the app structure, product direction, or an architectural decision changes. Avoid duplicating detailed setup instructions here; the root `README.md` is the setup entry point, and `AGENTS.md` contains repository-specific agent guidance.
