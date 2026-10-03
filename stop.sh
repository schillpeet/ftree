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

find_untracked_service() {
  local name="$1"
  local port cwd command_line pid

  if [[ "$name" == bff ]]; then
    port=8080
  else
    port=3000
  fi

  for pid in $(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$name" == bff && "$cwd" == "$ROOT/bff" && "$command_line" == *"$ROOT/bff/build/classes"* ]]; then
      printf '%s\n' "$pid"
      return 0
    fi
    if [[ "$name" == ui && "$cwd" == "$ROOT/ui" && "$command_line" == *next-server* ]]; then
      printf '%s\n' "$pid"
      return 0
    fi
  done
  return 1
}

stop_process_tree() {
  local name="$1"
  local pid="$2"
  local child
  local -a process_tree=()

  collect_process_tree() {
    local parent="$1"
    local child
    while IFS= read -r child; do
      [[ "$child" =~ ^[0-9]+$ ]] && collect_process_tree "$child"
    done < <(pgrep -P "$parent" 2>/dev/null || true)
    process_tree+=("$parent")
  }

  collect_process_tree "$pid"
  for pid in "${process_tree[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done

  for _ in {1..50}; do
    local running=false
    for pid in "${process_tree[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        running=true
        break
      fi
    done
    [[ "$running" == false ]] && break
    sleep 0.2
  done

  for pid in "${process_tree[@]}"; do
    kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null || true
  done
  echo "Stopped $name (PID $2)."
}

stop_service() {
  local name="$1"
  local pid_file="$STATE_DIR/$name.pid"
  local pid="" started_at="" current_start="" candidate=""

  if [[ -f "$pid_file" ]]; then
    read -r pid started_at < "$pid_file"
    if [[ ! "$pid" =~ ^[0-9]+$ || -z "$started_at" ]]; then
      echo "Ignoring invalid $name PID file: $pid_file" >&2
      pid=""
    else
      current_start="$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^[[:space:]]*//')"
      if [[ "$current_start" != "$started_at" ]]; then
        pid=""
      fi
    fi
    rm -f "$pid_file"
  fi

  if [[ -z "$pid" ]]; then
    if ! command -v lsof >/dev/null 2>&1; then
      echo "Cannot check for an untracked $name process because lsof is unavailable." >&2
      return 1
    fi
    candidate="$(find_untracked_service "$name" || true)"
    if [[ -n "$candidate" ]]; then
      pid="$candidate"
      echo "Found an untracked ftree $name process (PID $pid)."
    else
      echo "$name is not running."
      return 0
    fi
  fi

  stop_process_tree "$name" "$pid"
}

stop_status=0
stop_service ui || stop_status=1
stop_service bff || stop_status=1

if command -v docker >/dev/null 2>&1; then
  if docker compose -f "$ROOT/docker-compose.yml" stop db; then
    echo "Stopped PostgreSQL (database volume retained)."
  else
    echo "Could not stop PostgreSQL." >&2
    stop_status=1
  fi
else
  echo "Docker is unavailable; could not stop PostgreSQL." >&2
  stop_status=1
fi

exit "$stop_status"
