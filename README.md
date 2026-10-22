<h1 align="center">
  <img src="docs/assets/d-f-monogramm-logo.svg" alt="ftree" width="320">
</h1>

<p align="center"><strong>A shared family tree that families build and maintain together.</strong></p>

<p align="center">
  <a href="https://github.com/schillpeet/ftree/actions/workflows/ci.yml"><img src="https://github.com/schillpeet/ftree/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/schillpeet/ftree/tags"><img src="https://img.shields.io/github/v/tag/schillpeet/ftree?sort=semver&label=version" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

> **Early prototype.** Today, ftree shows a procedurally generated 3D tree in a meadow and lets you manage families, their members, and parent/child and partner links. Accounts and sharing are still to come.

![ftree preview with a demo family](https://github.com/schillpeet/ftree/releases/latest/download/preview.png)

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
| [`docs/assets/`](docs/assets)              | Logo variants and the GitHub social preview image           |

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

## Connect to PostgreSQL

The development database runs as the `db` service in [`docker-compose.yml`](docker-compose.yml) and is only reachable from your own machine (`127.0.0.1`), on port **5433** to avoid clashing with a local PostgreSQL on 5432.

| Setting  | Value       |
| -------- | ----------- |
| Host     | `localhost` |
| Port     | `5433`      |
| Database | `appdb`     |
| User     | `app`       |
| Password | `app`       |

JDBC URL: `jdbc:postgresql://localhost:5433/appdb`. The backend uses the same values by default and reads `DB_URL`, `DB_USER`, and `DB_PASSWORD` if you want to override them.

With a local `psql`:

```bash
psql "postgresql://app:app@localhost:5433/appdb"
```

Without a local client, use the one inside the container:

```bash
docker compose exec db psql -U app -d appdb
```

In a GUI client (DBeaver, DataGrip, TablePlus, ...) create a PostgreSQL connection with the values above. Useful tables are `families`, `members`, `member_parents`, `member_partners`, and `member_photos`.

The data lives in the Docker volume `ftree_postgres_data` and survives `./stop.sh`. To start with an empty database, stop the services and delete the volume (this removes all families and members):

```bash
./stop.sh && docker volume rm ftree_postgres_data
```

## Contributing

Branches, commit messages, and project conventions are described in [AGENTS.md](AGENTS.md). Commits follow [Conventional Commits](https://www.conventionalcommits.org), which drive automated releases.

## License

[MIT](LICENSE)
