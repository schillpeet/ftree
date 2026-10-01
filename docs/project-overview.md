# Project Overview

## Purpose

ftree is intended to become a web service where family members can create and maintain a shared family tree. The repository is currently an early visual prototype, not a working family-tree service.

## Current State

The home route displays a full-screen Three.js scene with one procedurally generated tree in a meadow. There is no family-member data model, persistence, account system, sharing, or editing workflow.

The repository separates the Next.js UI from a Kotlin Backend for Frontend (BFF). The UI uses TypeScript, React, React Three Fiber, Drei, and Three.js. The BFF is a Kotlin/Spring Boot scaffold with JPA and PostgreSQL connection configuration, but it has no family-tree model or HTTP endpoints yet. pnpm configuration, dependencies, lockfile, and scripts live in `ui/`; the BFF uses its own Gradle build.

## Code Map

- `ui/app/page.tsx` renders the home scene.
- `ui/app/Scene.tsx` configures the canvas, sunset lighting, meadow, tree, and orbit controls.
- `ui/app/Tree.tsx` builds the tree geometry and foliage procedurally.
- `ui/app/Meadow.tsx` builds the terrain and instanced grass; it exports terrain height used by the tree and scene.
- `ui/app/random.ts` contains seeded random and smooth-noise helpers used by the procedural scene.
- `ui/app/layout.tsx` defines the root document, metadata, and global stylesheet import.
- `ui/app/globals.css` contains the global page styles.
- `ui/` contains the Next.js app, package manifest, pnpm lockfile/workspace settings, TypeScript, ESLint, and Next.js configuration.
- `bff/` contains the Kotlin/Spring Boot BFF scaffold, datasource configuration, and Gradle build.
- `docker-compose.yml` defines the local PostgreSQL database used by the BFF.

The procedural scene is presentation code. It is not a family-tree domain model or a persistence layer.

## Initial Architecture Direction

Keep the UI and Kotlin BFF as separate applications in this repository. The BFF is planned to expose the UI-facing API and own access to PostgreSQL; no separate backend service is currently planned. The Spring Boot scaffold exists, but the API contract, schema, and deployment shape are still open. Introduce clear boundaries between family-tree concepts, persistence, access control, and presentation as those features are designed.

Family relationships and identifying information are sensitive. Any shared-data implementation must define who can view and change a tree, how membership and invitations work, and how users can recover or remove access. Do not assume that a tree is public by default.

## Open Decisions

These decisions have not been implemented:

- The person, relationship, and family-tree data model, including how uncertain or conflicting information is represented.
- PostgreSQL schema, migrations, backups, and data export/deletion behavior.
- The BFF API contract and deployment shape.
- Authentication, family membership, invitations, authorization, and account recovery.
- How concurrent edits are handled and whether an audit/history model is needed.
- Which parts of the current 3D prototype remain in the product and how family data is navigated or edited.

Resolve these based on product needs before committing to a backend or collaboration design.

## Repository Structure

The repository separates `ui/` and `bff/` while keeping them under one Git root. pnpm manages only the UI, so its lockfile and workspace settings live in `ui/`; the Kotlin BFF uses its own Gradle build. Keep this structure rather than nesting a second Git repository. CI/CD workflows have not been configured yet. Revisit further package or repository splits only when separate ownership, access control, or release lifecycles make them useful.

## Keeping This Overview Useful

Keep current behavior and future intent clearly separated. Update this document when the app structure, product direction, or an architectural decision changes. Avoid duplicating detailed setup instructions here; the root `README.md` is the setup entry point, and `AGENTS.md` contains repository-specific agent guidance.
