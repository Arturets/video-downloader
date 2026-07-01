#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/extension/manifest.json" | head -n 1)"
OUT_DIR="$ROOT/dist"
ZIP_PATH="$OUT_DIR/video-downloader-firefox-$VERSION.zip"
XPI_PATH="$OUT_DIR/video-downloader-firefox-$VERSION.xpi"
LATEST_ZIP_PATH="$OUT_DIR/video-downloader-firefox.zip"
LATEST_XPI_PATH="$OUT_DIR/video-downloader-firefox.xpi"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH" "$XPI_PATH" "$LATEST_ZIP_PATH" "$LATEST_XPI_PATH"

(
  cd "$ROOT/extension"
  zip -r -FS "$ZIP_PATH" . \
    -x "*.DS_Store" \
    -x "__MACOSX/*"
)

cp "$ZIP_PATH" "$XPI_PATH"
cp "$ZIP_PATH" "$LATEST_ZIP_PATH"
cp "$XPI_PATH" "$LATEST_XPI_PATH"

echo "Created AMO upload package:"
echo "$ZIP_PATH"
echo "$LATEST_ZIP_PATH"
echo
echo "Created equivalent XPI package:"
echo "$XPI_PATH"
echo "$LATEST_XPI_PATH"
