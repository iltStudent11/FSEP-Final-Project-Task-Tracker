#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[all] Bringing down prod then dev stacks..."
"$SCRIPT_DIR/down-prod.sh"
"$SCRIPT_DIR/down-dev.sh"
echo "[all] Done."
