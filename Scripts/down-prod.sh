#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "[prod] Bringing down prod stack..."
compose_prod down
echo "[prod] Done."
