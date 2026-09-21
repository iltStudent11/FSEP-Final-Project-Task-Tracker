#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "[dev] Bringing down dev stack..."
compose_dev down
echo "[dev] Done."
