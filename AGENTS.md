<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Guidance

- Read `docs/project-overview.md` before work that changes product behavior, data, or architecture.
- This project aims to become a shared family-tree web service. The Next.js UI is in `ui/`; `bff/` contains a Kotlin/Spring Boot scaffold for the Backend for Frontend.
- The UI is currently a procedural 3D scene; there is no family data model, persistent family data, API endpoint, accounts, or collaboration yet.
- For Next.js work, resolve the installed Next.js documentation from `ui/` (for example, `ui/node_modules/next/dist/docs/`).
- Treat family relationships and identifying information as sensitive. Do not assume public access; define authorization and sharing rules before implementing shared data.
- Keep the UI and BFF in this repository. Avoid adding more services until there is a concrete need for them.
- Keep the overview accurate as behavior and decisions change, and distinguish implemented features from planned work.
- Commit messages use `<type>(<scope>): <message>`, all lowercase, in English (types: feat, fix, chore, docs, refactor, test, build, ci; scopes: ui, bff, db, repo).
