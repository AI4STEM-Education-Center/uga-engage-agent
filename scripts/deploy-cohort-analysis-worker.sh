#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT_DIR/workers/cohort-analysis-worker"
BUILD_DIR="$WORKER_DIR/.build"
ZIP_PATH="$BUILD_DIR/cohort-analysis-worker.zip"

mkdir -p "$BUILD_DIR"
rm -f "$ZIP_PATH"

pushd "$WORKER_DIR" >/dev/null
npm install --omit=dev
zip -rq "$ZIP_PATH" index.mjs package.json package-lock.json node_modules
popd >/dev/null

echo "$ZIP_PATH"
