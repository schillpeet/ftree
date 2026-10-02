# Family Tree

[![CI](https://github.com/schillpeet/ftree/actions/workflows/ci.yml/badge.svg)](https://github.com/schillpeet/ftree/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/tag/schillpeet/ftree?sort=semver&label=version)](https://github.com/schillpeet/ftree/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

ftree is intended to become a shared family-tree web service where family members can build and maintain their family tree. The UI currently renders a procedural tree and meadow with an initial members interface. The BFF can list, create, and delete members in the local PostgreSQL database; authentication and family relationships are not implemented yet.

See [the project overview](docs/project-overview.md) for the current structure, architectural direction, and open decisions.

The shared member API contract is in `api/openapi.yaml`. Generate the typed UI client with:

```bash
pnpm --dir ui api:generate
```

Set `NEXT_PUBLIC_BFF_URL` when generating the client for a non-local BFF. The default URL is `http://localhost:8080`.

The repository keeps the Next.js UI in `ui/` and the Kotlin/Spring Boot Backend for Frontend in `bff/`. The BFF implements `GET /members`, `POST /members`, and `DELETE /members/{id}` against PostgreSQL. GitHub Actions (`.github/workflows/ci.yml`) lints, type-checks, and builds the UI, checks that the generated API client matches the spec, and builds and tests the BFF against PostgreSQL on every pull request.

## Getting Started

Install dependencies:

```bash
pnpm --dir ui install
```

Start the database, BFF, and UI together:

```bash
./dev.sh
```

Open [http://localhost:3000](http://localhost:3000) to view the app; the BFF listens on [http://localhost:8080](http://localhost:8080). Ctrl+C stops the BFF and UI. The database keeps running; stop it with `docker compose down`.

To start the services individually (see [bff/README.md](bff/README.md) for the BFF):

```bash
docker compose up -d --wait db
cd bff && ./gradlew bootRun
pnpm --dir ui dev
```

## Checks

Run the available project checks:

```bash
pnpm --dir ui lint
pnpm --dir ui typecheck
pnpm --dir ui build
```

## Versioning

The repository is versioned as a whole with [Semantic Versioning](https://semver.org) tags (`vX.Y.Z`) on `main`. No file holds the version: the BFF build derives it with `git describe --tags`, so a build on a tag is `0.1.0` and a build three commits later is `0.1.0-3-g<sha>`. Builds without Git history fall back to `0.0.0-dev`.

Releases are automated with [release-please](https://github.com/googleapis/release-please). After each merge to `main`, it opens or updates a release PR that collects the changes since the last release and proposes the next version from the commit types: `fix` bumps the patch version, `feat` the minor version, and breaking changes (`!`) also bump the minor version while in `0.x`. Other types do not trigger a release. Merging the release PR updates `CHANGELOG.md` and creates the tag and the GitHub release.

The `info.version` in `api/openapi.yaml` is the API contract version and only changes when the contract changes.

## Commit Messages

Commit conventions are defined in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
