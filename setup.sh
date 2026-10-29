#!/usr/bin/env bash
# Checks the tools ftree needs and prints how to install what is missing. Installs no tool itself.
# Required versions are read from the project files that use them, so they cannot drift from this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

PNPM_VERSION="$(sed -nE 's/.*"packageManager": *"pnpm@([^"]+)".*/\1/p' "$ROOT/ui/package.json")"
NODE_MAJOR="$(sed -nE 's/^FROM node:([0-9]+).*/\1/p' "$ROOT/ui/Dockerfile" | head -1)"
JAVA_MAJOR="$(sed -nE 's/.*JavaLanguageVersion\.of\(([0-9]+)\).*/\1/p' "$ROOT/bff/build.gradle.kts" | head -1)"

missing=0

ok() { printf '  ok       %s\n' "$1"; }
warn() { printf '  note     %s\n' "$1"; }
fail() {
  printf '  MISSING  %s\n' "$1"
  shift
  for line in "$@"; do printf '           %s\n' "$line"; done
  missing=1
}

echo "Checking requirements for ftree"

if command -v git >/dev/null 2>&1; then
  ok "git $(git --version | awk '{print $3}')"
else
  fail "git" "Install: https://git-scm.com/downloads (on macOS: xcode-select --install)"
fi

if [[ -z "$NODE_MAJOR" ]]; then
  warn "could not read the Node version from ui/Dockerfile; skipping the version check"
fi
if command -v node >/dev/null 2>&1; then
  current_node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ -z "$NODE_MAJOR" ]] || (( current_node_major >= NODE_MAJOR )); then
    ok "node $(node --version)"
  else
    fail "node $(node --version) is too old, the UI image uses Node $NODE_MAJOR" \
      "Install: https://nodejs.org/en/download"
  fi
else
  fail "node" "Install Node.js ${NODE_MAJOR:-(see ui/Dockerfile)}: https://nodejs.org/en/download"
fi

# pnpm picks the version pinned in ui/package.json (packageManager) by itself, but only when it runs inside ui/.
# That is why the project commands use `cd ui` and not `pnpm --dir ui`, which would use the installed version.
if command -v pnpm >/dev/null 2>&1; then
  active_pnpm="$(cd "$ROOT/ui" && pnpm --version 2>/dev/null | tail -1)"
  if [[ "$active_pnpm" == "$PNPM_VERSION" ]]; then
    ok "pnpm $active_pnpm (pinned in ui/package.json)"
  else
    fail "pnpm $active_pnpm is active in ui/, the project pins $PNPM_VERSION" \
      "pnpm 9.7 or newer switches to the pinned version by itself; update it: https://pnpm.io/installation" \
      "Make sure 'manage-package-manager-versions' is not set to false in your pnpm config."
  fi
else
  fail "pnpm" \
    "Install any current pnpm: https://pnpm.io/installation (for example 'npm install -g pnpm')" \
    "Inside ui/ it then switches to the pinned $PNPM_VERSION by itself the first time it runs."
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    ok "docker $(docker --version | awk '{print $3}' | tr -d ',') (daemon running)"
  else
    fail "docker daemon is not running" "Start Docker Desktop (or your Docker engine) and run this script again."
  fi
else
  fail "docker" \
    "Install Docker Desktop: https://docs.docker.com/desktop/setup/install/mac-install/" \
    "Linux: https://docs.docker.com/engine/install/"
fi

# macOS ships only a stub at /usr/bin/java, so check that it really runs.
java_major=""
if command -v java >/dev/null 2>&1 && java_version="$(java -version 2>&1)"; then
  java_major="$(printf '%s\n' "$java_version" | sed -nE '1s/.*version "([0-9]+).*/\1/p')"
fi
if [[ -n "$java_major" && -n "$JAVA_MAJOR" ]] && (( java_major >= JAVA_MAJOR )); then
  ok "java $java_major"
else
  warn "no Java ${JAVA_MAJOR:-(see bff/build.gradle.kts)}+ found; that is fine"
  warn "Gradle downloads a matching JDK (about 200 MB) on the first backend build."
  warn "To install one yourself: https://adoptium.net/temurin/releases/?version=${JAVA_MAJOR:-21}"
fi

echo
if (( missing )); then
  echo "Not ready: install or fix the items marked MISSING above, then run ./setup.sh again."
  exit 1
fi

if install_output="$(cd "$ROOT/ui" && pnpm install --frozen-lockfile 2>&1)"; then
  ok "UI dependencies installed"
else
  printf '%s\n' "$install_output" >&2
  echo "Installing the UI dependencies failed; see the output above." >&2
  exit 1
fi

cat <<'EOF'

Ready: all requirements are in place.
  ./start.sh   start PostgreSQL, Swagger UI, backend, and UI
  ./stop.sh    stop them again

Then open http://localhost:3000. See CONTRIBUTING.md before opening a pull request.
EOF
