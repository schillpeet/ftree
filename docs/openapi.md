# API Contract and Swagger UI

`api/openapi.yaml` is the single contract between the UI and the BFF.
Orval generates the UI client from it (`ui/lib/api/generated/`), and OpenAPI Generator generates the BFF's Java interfaces and models (`bff/build/generated/openapi/`).
Change the spec first and regenerate; never edit generated code.

## Where to see it

| Where | Status |
| --- | --- |
| Local Swagger UI at `http://localhost:4010` (`./start.sh`, container `swagger` in `docker-compose.yml`) | Available |
| Production | Not deployed; the BFF serves no Swagger UI or spec endpoint |
| Published documentation per release (for example on GitHub Pages) | Planned, not set up |

The local Swagger UI reads `api/openapi.yaml` directly, so it shows the spec of the checked-out branch.

## Standards

- **OpenAPI 3.0.3** (OAS, the OpenAPI Specification): the version matters because both generators must support it; 3.1 follows once Orval and OpenAPI Generator handle it cleanly.
- **RFC 9457 problem details**: every error is `application/problem+json` with the `Problem` schema and a machine-readable `code` that clients switch on.
- **Security scheme**: `cloudflareAccess`, the `Cf-Access-Jwt-Assertion` header set by Cloudflare Access, applies globally; every operation requires a sign-in.
- **Shared error responses**: every operation documents 401, 403, and 500 through `components.responses`.
- **Versioning**: `info.version` changes only when the contract changes; breaking changes are marked with `!` in the PR title (see the overview's versioning section).

## Checks

- `pnpm --dir api lint` runs Spectral with its OpenAPI rules and the OWASP API Security Top 10 ruleset (`api/.spectral.yaml`); errors fail, warnings are shown only.
- CI's `api` job runs that lint and oasdiff's breaking-change check against the base branch; a breaking change passes only with `!` in the PR title.
- CI's `ui` job fails when the generated UI client does not match the spec, and the `bff` job compiles against the generated interfaces.

## Next steps

- Add size bounds (`maxLength`, `maxItems`, `minimum`/`maximum`) field by field, together with the BFF validation they imply; the lint lists the missing ones as warnings.
- Publish the spec as static documentation per release.
- Move to OpenAPI 3.1 when the generators support it.
