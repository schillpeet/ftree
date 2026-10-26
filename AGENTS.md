## Project Guidance

- Read `docs/project-overview.md` before work that changes product behavior, data, or architecture.
- This project aims to become a shared family-tree web service. The Next.js UI is in `ui/`; `bff/` contains the Kotlin/Spring Boot Backend for Frontend.
- `api/openapi.yaml` defines the member contract; `ui/` and `bff/` generate clients/interfaces from it. Do not edit generated files; update the spec and regenerate instead.
- The BFF implements `GET /members`, `POST /members`, `PUT /members/{id}`, `DELETE /members/{id}`, and `PUT /members/{id}/relatives` (parent/child links with a kind and partner links with status and dates; siblings and half-siblings derived from shared parents) with PostgreSQL persistence, plus roles, `GET /me`, Cloudflare Access JWT verification (dev mode locally), and permission enforcement (non-admins see only the first real family), plus Actuator health probes and Prometheus metrics on management port 8081, and answers errors as RFC 9457 problem details with a machine-readable `code`. Invitations, member-to-user links, other relationship types, and production migrations are not implemented yet.
- For Next.js work, also follow `ui/AGENTS.md`, whose Next.js rules block `next dev` maintains, and resolve the installed Next.js documentation from `ui/` (for example, `ui/node_modules/next/dist/docs/`).
- Treat family relationships and identifying information as sensitive. Do not assume public access; define authorization and sharing rules before implementing shared data.
- Keep the UI and BFF in this repository. Avoid adding more services until there is a concrete need for them.
- Keep the overview accurate as behavior and decisions change, and distinguish implemented features from planned work.
- Write `docs/project-overview.md` with one sentence per line, and add new behavior as new lines in the matching section of "Current State" instead of extending existing sentences; parallel branches then rarely conflict there.
- Commit messages and pull request titles use `<type>(<scope>): <message>`, entirely lowercase, in English and in the imperative mood, for example `feat(ui): add person detail panel`. Never capitalize the type, scope, or message. Choose the type by semantic meaning, not merely because the change concerns Docker, scripts, or repository configuration:
  - `feat`: new user-facing or developer-facing functionality
  - `fix`: bug fixes
  - `docs`: documentation-only changes
  - `refactor`: code restructuring without behavior changes
  - `chore`: maintenance that does not add functionality
  - `test`: adding or changing tests
  - `build`: build system or external dependency changes
  - `ci`: CI configuration changes
  - `deps`: dependency updates by Dependabot only; they appear as one changelog line per release and trigger at least a patch release
    If a change introduces new functionality, always use `feat`. Scopes remain `ui`, `bff`, `db`, and `repo`.
- Start every new task by creating a branch from `main` before changing any files. Name it after the planned commit as `<type>/<scope>-<message-in-kebab-case>`, for example `feat(ui): add person detail panel` → `feat/ui-add-person-detail-panel`.
- Pull requests are squash-merged, so the PR title becomes the commit on `main` and is what release-please parses. Commits inside a PR do not produce separate release notes after squash-merge. Give every independently releasable feature or fix its own PR with a title that accurately describes it (`feat(...)` for a feature, `fix(...)` for a bug fix); do not bundle independent features into one PR or rely on their branch commits to appear in the changelog. Push the branch and open the PR, then verify its exact title follows the lowercase convention and that the PR-title check passes before merging. Configure the PR-title check as a required GitHub status check so invalid titles cannot be merged.
- Do not commit or push directly to `main`. Before merging, make sure every user-visible feature is represented by its own correctly titled PR so release-please can create the expected version bump and changelog entry.
- Do not set versions by hand or create release tags; release-please derives them from commit types (see the overview's versioning section). Mark breaking changes with `!`, for example `feat(bff)!: rename member fields`.
- Before committing, show the user the staged diff and the proposed commit message and wait for explicit approval. Never commit without it.
- Before pushing or opening a PR: run `git fetch origin && git rebase origin/main`, resolve any conflicts, and re-run typecheck/tests.

## Agent Execution & Tool Efficiency

- **Be Direct & Concise:** Execute actions immediately. Do not write text explaining what tools you are about to use (e.g., avoid "I will now read the file X"). Provide explanations only after completing the actions or when asking a required clarifying question.
- **Maximize Parallelism:** Whenever you need to read, inspect, or search multiple files (e.g., inspecting both `ui/` and `bff/` code or `api/`), invoke all relevant tools in a single parallel batch rather than sequentially.
- **Autonomous Read & Analysis:** You are fully trusted to read files, search the repository, run tests, inspect configuration, and inspect Git state/history/remotes without asking for permission.
- **Read-Only Operations:** Never ask for permission before executing read-only operations. This includes reading files, listing directories, searching code, inspecting configuration, running tests, and Git commands such as `git status`, `git diff`, `git log`, `git remote -v`, and `git branch`.
- **Approved Task Changes:** You may modify files autonomously when the changes are part of the approved task.
- **Destructive or External Operations:** Require explicit user confirmation for destructive operations and externally visible actions such as pushing, opening or merging pull requests, or deleting data.
- **Commits:** Before committing, always show the user the staged diff and proposed commit message and wait for explicit approval.
- **Diff review pane:** When a change is ready for review, open the session's diff pane on the right automatically (in the Claude desktop app via its show-pane tool) so the user can review every changed file there without asking; do this before asking for commit approval. Once the user replies with an approval such as "ok", commit and push.
- **Local Services and Review URLs:** You may run `./start.sh` and `./stop.sh` without asking. Before asking for commit approval of a user-visible change, run it locally and give the user the URLs to review it (UI `http://localhost:3000`, BFF `http://localhost:8080`, Swagger UI `http://localhost:4010`). To review several branches side by side, start the stack with `APP_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,…` and run one extra UI per worktree with `pnpm --dir ui dev -p 3001` (3002, …); `stop.sh` only stops the managed UI, so stop the extra ones yourself.
- **Follow Rules Without Prompting:** Keep all guidelines from this file and `docs/project-overview.md` active at all times. Do not ask the user whether you should follow these rules.
