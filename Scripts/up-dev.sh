#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "[dev] Building and starting dev stack..."
compose_dev up -d --build
echo "[dev] Done."
