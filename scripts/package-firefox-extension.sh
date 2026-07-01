#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("extension/manifest.json", "utf8")).version)')"
OUT_DIR="$ROOT/dist"
ZIP_PATH="$OUT_DIR/video-downloader-firefox-$VERSION.zip"
XPI_PATH="$OUT_DIR/video-downloader-firefox-$VERSION.xpi"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH" "$XPI_PATH"

(
  cd "$ROOT/extension"
  zip -r -FS "$ZIP_PATH" . \
    -x "*.DS_Store" \
    -x "__MACOSX/*"
)

cp "$ZIP_PATH" "$XPI_PATH"

echo "Created AMO upload package:"
echo "$ZIP_PATH"
echo
echo "Created equivalent XPI package:"
echo "$XPI_PATH"
