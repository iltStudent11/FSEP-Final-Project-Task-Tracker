#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

PROD_MONGO_PORT_WHEN_BOTH_UP="${PROD_MONGO_PORT_WHEN_BOTH_UP:-37017}"

echo "[all] Starting dev and prod stacks..."
"$SCRIPT_DIR/up-dev.sh"
ensure_prod_certs
echo "[all] Starting prod stack with mongo mapped to host port ${PROD_MONGO_PORT_WHEN_BOTH_UP}..."
compose_prod_with_mongo_port "$PROD_MONGO_PORT_WHEN_BOTH_UP" up -d --build
echo "[all] Done."
