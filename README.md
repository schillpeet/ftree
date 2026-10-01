# Family Tree

ftree is intended to become a shared family-tree web service where family members can build and maintain their family tree. The UI currently renders a procedural tree and meadow with an initial members interface; member data is not yet persisted and the BFF routes are not implemented.

See [the project overview](docs/project-overview.md) for the current structure, architectural direction, and open decisions.

The shared member API contract is in `api/openapi.yaml`. Generate the typed UI client with:

```bash
pnpm --dir ui api:generate
```

Set `NEXT_PUBLIC_BFF_URL` when generating the client for a non-local BFF. The default URL is `http://localhost:8080`.

The repository keeps the Next.js UI in `ui/` and the Kotlin/Spring Boot Backend for Frontend in `bff/`. The BFF is intended to provide the UI-facing API and access PostgreSQL; its member operations are specified but not implemented, and there is no family-tree model yet. CI/CD is not configured here yet.

## Getting Started

Install dependencies:

```bash
pnpm --dir ui install
```

Start the development server:

```bash
pnpm --dir ui dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

To build the BFF, start the local database and run Gradle (see [bff/README.md](bff/README.md)):

```bash
docker compose up -d db
cd bff && ./gradlew build
```

## Checks

Run the available project checks:

```bash
pnpm --dir ui lint
pnpm --dir ui typecheck
pnpm --dir ui build
```

## Commit Messages

Commits follow `<type>(<scope>): <message>`, all lowercase, in English and in the imperative mood, for example `feat(ui): add person detail panel`.

- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`
- Scopes: `ui`, `bff`, `db`, `repo`

## License

[MIT](LICENSE)
