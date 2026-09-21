#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_prod_certs

echo "[prod] Building and starting prod stack..."
compose_prod up -d --build
echo "[prod] Done."
