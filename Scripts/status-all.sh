#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================ DEV ================"
"$SCRIPT_DIR/status-dev.sh"
echo
echo "=============== PROD ================"
"$SCRIPT_DIR/status-prod.sh"
