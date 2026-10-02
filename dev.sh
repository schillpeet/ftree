#!/usr/bin/env bash
# Starts PostgreSQL (detached), the BFF, and the UI dev server. Ctrl+C stops BFF and UI; stop the DB with `docker compose down`.
set -euo pipefail
cd "$(dirname "$0")"
docker compose up -d --wait db
trap 'kill 0' EXIT
(cd bff && ./gradlew bootRun) &
pnpm --dir ui dev &
wait
