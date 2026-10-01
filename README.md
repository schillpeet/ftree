# Family Tree

ftree is intended to become a shared family-tree web service where family members can build and maintain their family tree. The current application is an early visual prototype: it renders a procedural tree and meadow, but does not yet store family data or support accounts and collaboration.

See [the project overview](docs/project-overview.md) for the current structure, architectural direction, and open decisions.

The repository keeps the Next.js UI in `ui/` and the Kotlin/Spring Boot Backend for Frontend in `bff/`. The BFF is intended to provide the UI-facing API and access PostgreSQL; it is currently a scaffold without endpoints or a family-tree model. CI/CD is not configured here yet.

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
