# BFF

Kotlin/Spring Boot scaffold for the Backend for Frontend. It currently has JPA and PostgreSQL connection configuration, but no family-tree model or HTTP endpoints yet. The BFF is intended to own PostgreSQL access and provide the UI-facing API.

Start the local database from the repository root with `docker compose up -d db`, then run `./gradlew build` from this directory. The default local connection is `jdbc:postgresql://localhost:5433/appdb`; `DB_URL`, `DB_USER`, and `DB_PASSWORD` can override it.
