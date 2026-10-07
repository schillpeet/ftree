#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# bootRun recompiles the BFF on start; install picks up pulled UI dependency changes.
"$ROOT/stop.sh"
pnpm --dir "$ROOT/ui" install
"$ROOT/start.sh"
