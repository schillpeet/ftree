# 🌳 ftree

[![CI](https://github.com/schillpeet/ftree/actions/workflows/ci.yml/badge.svg)](https://github.com/schillpeet/ftree/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/tag/schillpeet/ftree?sort=semver&label=version)](https://github.com/schillpeet/ftree/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A shared family tree that families build and maintain together.**

> **Early prototype.** Today, ftree shows a procedurally generated 3D tree in a meadow and lets you create, edit, list, and delete family members. Accounts, sharing, and family relationships are still to come.

## Quick Start

You need [Node.js 22](https://nodejs.org) with [pnpm](https://pnpm.io) (`corepack enable` installs the pinned version), [Java 21](https://adoptium.net), and [Docker](https://www.docker.com).

```bash
git clone https://github.com/schillpeet/ftree.git
cd ftree
pnpm --dir ui install
./start.sh
```

`start.sh` starts PostgreSQL, Swagger UI, the backend, and the UI in the background. Then open:

- **App:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **API docs:** [http://localhost:4010](http://localhost:4010) (Swagger UI)

Run `./stop.sh` to stop all services. PostgreSQL data is retained. Logs and process state are stored under `.local/dev/`.
After pulling changes, run `./restart.sh`: it stops all services, installs UI dependencies, and starts again. The backend is recompiled on start.
If a required port is already occupied, `start.sh` reports the process and exits without stopping it.

## What's Inside

| Path                                       | What it is                                                  |
| ------------------------------------------ | ----------------------------------------------------------- |
| [`ui/`](ui)                                | Next.js web app with a React Three Fiber scene              |
| [`bff/`](bff)                              | Kotlin/Spring Boot backend for the UI, backed by PostgreSQL |
| [`api/openapi.yaml`](api/openapi.yaml)     | API contract that both sides generate their code from       |
| [`docker-compose.yml`](docker-compose.yml) | Local PostgreSQL and Swagger UI used during development     |
| [`docs/`](docs/project-overview.md)        | Architecture, current state, and open decisions             |

## Development

Start the parts individually:

```bash
docker compose up -d --wait         # PostgreSQL and Swagger UI
(cd bff && ./gradlew bootRun)       # backend
pnpm --dir ui dev                   # UI
```

For the managed start/stop lifecycle, use `./start.sh`, `./stop.sh`, and `./restart.sh`.

After changing `api/openapi.yaml`, regenerate the UI client (the backend regenerates on build):

```bash
pnpm --dir ui api:generate
```

Run the same checks as CI before opening a pull request:

```bash
pnpm --dir ui lint && pnpm --dir ui typecheck && pnpm --dir ui build
(cd bff && ./gradlew build)         # needs the database running
```

## Contributing

Branches, commit messages, and project conventions are described in [AGENTS.md](AGENTS.md). Commits follow [Conventional Commits](https://www.conventionalcommits.org), which drive automated releases.

## License

[MIT](LICENSE)
