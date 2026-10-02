# Project Overview

## Purpose

ftree is intended to become a web service where family members can create and maintain a shared family tree. The repository is currently an early visual prototype, not a working family-tree service.

## Current State

The home route displays a full-screen Three.js scene with one procedurally generated tree in a meadow, plus a members list with delete action and a create form. Every member appears in the scene as a papyrus scroll showing photo (from `photoUrl`), name, birth and death dates, and note. Each member can be assigned any number of parents and children from the members list. Scrolls are placed automatically in rows on an arc in front of the tree: one row per generation, every member below all of their parents, and members without known parents directly above their children. Selecting a member in the list moves the camera to their scroll. The UI calls a generated client. The BFF implements member listing, creation, deletion, and parent/child links against PostgreSQL; it rejects links that would make someone their own ancestor. Authentication, partnerships, and a broader family-tree model are not implemented.

The repository separates the Next.js UI from a Kotlin Backend for Frontend (BFF). The UI uses TypeScript, React, React Three Fiber, Drei, and Three.js. The Kotlin/Spring Boot BFF uses JPA and PostgreSQL for member records. pnpm configuration, dependencies, lockfile, and scripts live in `ui/`; the BFF uses its own Gradle build.

## Code Map

- `ui/app/page.tsx` renders the home scene.
- `ui/app/FamilyTree.tsx` holds the loaded members and the camera focus shared by the scene and the members overlay.
- `ui/app/Scene.tsx` configures the canvas, sunset lighting, meadow, tree, camera controls, member scrolls, and the camera flight to a selected scroll.
- `ui/app/familyLayout.ts` computes generations and scroll positions; `ui/app/familyLayout.check.mjs` is its self-check (`node app/familyLayout.check.mjs` in `ui/`).
- `ui/app/Scroll.tsx` renders a member's papyrus scroll as camera-facing HTML in the scene; its look is defined in `globals.css`.
- `ui/app/MembersControls.tsx` contains the members list, delete action, and create form; `ui/app/RelativesDialog.tsx` assigns parents and children.
- `ui/app/Tree.tsx` builds the tree geometry and foliage procedurally.
- `ui/app/Meadow.tsx` builds the terrain and instanced grass; it exports terrain height used by the tree and scene.
- `ui/app/random.ts` contains seeded random and smooth-noise helpers used by the procedural scene.
- `ui/app/layout.tsx` defines the root document, metadata, and global stylesheet import.
- `ui/app/globals.css` contains the global page styles.
- `ui/` contains the Next.js app, package manifest, pnpm lockfile/workspace settings, TypeScript, ESLint, and Next.js configuration.
- `bff/` contains the Kotlin/Spring Boot BFF scaffold, datasource configuration, and Gradle build.
- `bff/src/main/kotlin/com/github/bff/member/` contains the member JPA entity, repository, service, and controller implementing the generated API.
- `bff/build.gradle.kts` configures OpenAPI Generator's Java Spring generator; generated interfaces and models go under `bff/build/generated/openapi/`.
- `docker-compose.yml` defines the local PostgreSQL database used by the BFF.
- `dev.sh` starts the database, BFF, and UI for local development.
- `api/openapi.yaml` defines `GET /members`, `POST /members`, `DELETE /members/{id}`, and `PUT /members/{id}/relatives` as the shared API contract.
- `ui/orval.config.ts` generates the typed UI client into `ui/lib/api/generated/members.ts`.

The procedural scene is presentation code. It is not a family-tree domain model or a persistence layer.

## Initial Architecture Direction

Keep the UI and Kotlin BFF as separate applications in this repository. The BFF exposes the UI-facing API and owns access to PostgreSQL; no separate backend service is currently planned. `api/openapi.yaml` is the shared contract; Orval generates the UI client, and OpenAPI Generator creates Java API interfaces and DTOs implemented by Kotlin. Hibernate currently manages the local schema with `ddl-auto=update`; add versioned migrations before production. Authentication and authorization must be designed before family data is shared.

Family relationships and identifying information are sensitive. Any shared-data implementation must define who can view and change a tree, how membership and invitations work, and how users can recover or remove access. Do not assume that a tree is public by default.

## Open Decisions

These decisions have not been implemented:

- The person, relationship, and family-tree data model, including how uncertain or conflicting information is represented.
- Relationship types beyond parent/child (partners, adoption, uncertain links) and schema beyond the members and `member_parents` tables, plus migrations, backups, and data export/deletion behavior.
- Remaining BFF API operations, error format, and deployment shape.
- Authentication, family membership, invitations, authorization, and account recovery.
- How concurrent edits are handled and whether an audit/history model is needed.
- Which parts of the current 3D prototype remain in the product and how family data is navigated or edited.

Resolve these based on product needs before committing to a backend or collaboration design.

## Repository Structure

The repository separates `ui/` and `bff/` while keeping them under one Git root. pnpm manages only the UI, so its lockfile and workspace settings live in `ui/`; the Kotlin BFF uses its own Gradle build. Keep this structure rather than nesting a second Git repository. GitHub Actions runs CI for both applications, and release-please creates version tags and GitHub releases for the repository as a whole; deployment is not configured yet. Revisit further package or repository splits only when separate ownership, access control, or release lifecycles make them useful.

## Keeping This Overview Useful

Keep current behavior and future intent clearly separated. Update this document when the app structure, product direction, or an architectural decision changes. Avoid duplicating detailed setup instructions here; the root `README.md` is the setup entry point, and `AGENTS.md` contains repository-specific agent guidance.
