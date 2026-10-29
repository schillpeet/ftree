#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# bootRun recompiles the BFF on start; install picks up pulled UI dependency changes.
"$ROOT/stop.sh"
(cd "$ROOT/ui" && pnpm install)
"$ROOT/start.sh"
