#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$ROOT/.local/dev"
LOCK_DIR="$STATE_DIR/lock"

mkdir -p "$STATE_DIR"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another local-service start/stop operation is in progress." >&2
  exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

for command in docker lsof nohup ps pnpm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

is_tracked_process_running() {
  local name="$1"
  local pid_file="$STATE_DIR/$name.pid"
  local pid started_at current_start

  [[ -f "$pid_file" ]] || return 1
  read -r pid started_at < "$pid_file"
  [[ "$pid" =~ ^[0-9]+$ && -n "$started_at" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  current_start="$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^[[:space:]]*//')"
  [[ "$current_start" == "$started_at" ]]
}

for service in bff ui; do
  if is_tracked_process_running "$service"; then
    echo "The managed $service is already running. Run ./stop.sh before starting again." >&2
    exit 1
  fi
  rm -f "$STATE_DIR/$service.pid"
done

port_in_use=0
for port in 3000 8080 4010; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; refusing to start services:" >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    port_in_use=1
  fi
done
if [[ "$port_in_use" == 1 ]]; then
  echo "Run ./stop.sh to stop ftree services started by this repository." >&2
  exit 1
fi

docker compose -f "$ROOT/docker-compose.yml" up -d --wait

start_service() {
  local name="$1"
  local log_file="$STATE_DIR/$name.log"
  local pid started_at

  if [[ "$name" == bff ]]; then
    nohup bash -c 'cd "$1" || exit; exec ./gradlew --no-daemon bootRun' _ "$ROOT/bff" \
      >"$log_file" 2>&1 </dev/null &
  else
    nohup bash -c 'cd "$1" || exit; exec pnpm --dir ui dev' _ "$ROOT" \
      >"$log_file" 2>&1 </dev/null &
  fi

  pid=$!
  started_at="$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^[[:space:]]*//')"
  if [[ -z "$started_at" ]]; then
    echo "Could not record the $name process. Check $log_file." >&2
    return 1
  fi
  printf '%s %s\n' "$pid" "$started_at" > "$STATE_DIR/$name.pid"
  echo "Started $name (PID $pid); log: ${log_file#"$ROOT"/}"
}

start_service bff
start_service ui

echo "Local services started: UI http://localhost:3000, BFF http://localhost:8080"
echo "API docs (Swagger UI): http://localhost:4010"
echo "Run ./stop.sh to stop the UI, BFF, Swagger UI, and PostgreSQL."
