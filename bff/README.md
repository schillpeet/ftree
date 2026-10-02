# BFF

Kotlin/Spring Boot Backend for Frontend. It implements `GET /members`, `POST /members`, and `DELETE /members/{id}` from the generated `MembersApi` interface and persists member records in PostgreSQL through Spring Data JPA.

Run `./gradlew openApiGenerate` from this directory to generate Java sources under `build/generated/openapi/`. `./gradlew build` runs generation automatically before compilation. Kotlin code can implement `com.github.bff.generated.api.MembersApi` and use the generated models in `com.github.bff.generated.model`.

For local development, start PostgreSQL from the repository root with `docker compose up -d --wait db`, then run `./gradlew bootRun` from this directory. The default connection is `jdbc:postgresql://localhost:5433/appdb`; `DB_URL`, `DB_USER`, and `DB_PASSWORD` can override it. Hibernate creates or updates the local `members` table automatically; production migrations are not configured yet.
