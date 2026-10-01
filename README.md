# Family Tree

ftree is intended to become a shared family-tree web service where family members can build and maintain their family tree. The UI currently renders a procedural tree and meadow with an initial members interface. The BFF can list and create members in the local PostgreSQL database; authentication and family relationships are not implemented yet.

See [the project overview](docs/project-overview.md) for the current structure, architectural direction, and open decisions.

The shared member API contract is in `api/openapi.yaml`. Generate the typed UI client with:

```bash
pnpm --dir ui api:generate
```

Set `NEXT_PUBLIC_BFF_URL` when generating the client for a non-local BFF. The default URL is `http://localhost:8080`.

The repository keeps the Next.js UI in `ui/` and the Kotlin/Spring Boot Backend for Frontend in `bff/`. The BFF implements `GET /members` and `POST /members` against PostgreSQL. CI/CD is not configured here yet.

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

To run the BFF, start the local database and start Spring Boot (see [bff/README.md](bff/README.md)):

```bash
docker compose up -d --wait db
cd bff && ./gradlew bootRun
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
