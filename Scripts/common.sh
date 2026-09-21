#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEV_PROJECT="tasktracker-dev"
PROD_PROJECT="tasktracker-prod"

DEV_COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
PROD_COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
CERT_FILE="$ROOT_DIR/certs/server.crt"
KEY_FILE="$ROOT_DIR/certs/server.key"

compose_dev() {
  docker compose -p "$DEV_PROJECT" -f "$DEV_COMPOSE_FILE" "$@"
}

compose_prod() {
  docker compose -p "$PROD_PROJECT" -f "$PROD_COMPOSE_FILE" "$@"
}

compose_prod_with_mongo_port() {
  local host_port="$1"
  shift

  local override_file
  override_file="$(mktemp)"

  cat > "$override_file" <<EOF
services:
  mongo:
    ports:
      - "${host_port}:27017"
EOF

  docker compose -p "$PROD_PROJECT" -f "$PROD_COMPOSE_FILE" -f "$override_file" "$@"

  rm -f "$override_file"
}

ensure_prod_certs() {
  if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    return
  fi

  echo "[prod] TLS certs not found. Generating certs..."
  "$ROOT_DIR/generate-certs.sh"
}
