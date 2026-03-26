#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT_DIR/workers/cohort-analysis-worker"
BUILD_DIR="$WORKER_DIR/.build"
PACKAGE_DIR="$BUILD_DIR/package"
ZIP_PATH="$BUILD_DIR/cohort-analysis-worker.zip"

mkdir -p "$BUILD_DIR"
rm -rf "$PACKAGE_DIR"
rm -f "$ZIP_PATH"

pushd "$WORKER_DIR" >/dev/null
npm ci --omit=dev
popd >/dev/null

mkdir -p "$PACKAGE_DIR/data"
cp "$WORKER_DIR/index.mjs" "$PACKAGE_DIR/"
cp "$WORKER_DIR/package.json" "$PACKAGE_DIR/"
cp "$WORKER_DIR/package-lock.json" "$PACKAGE_DIR/"
cp -R "$WORKER_DIR/node_modules" "$PACKAGE_DIR/"
cp "$ROOT_DIR"/data/lesson*.json "$PACKAGE_DIR/data/"

pushd "$PACKAGE_DIR" >/dev/null
zip -rq "$ZIP_PATH" .
popd >/dev/null

echo "$ZIP_PATH"
