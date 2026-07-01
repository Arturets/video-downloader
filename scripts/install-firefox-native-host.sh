#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
TARGET="$TARGET_DIR/video_downloader_host.json"

mkdir -p "$TARGET_DIR"
chmod +x "$ROOT/native/host.js"
node "$ROOT/scripts/render-native-manifest.js" "$ROOT" > "$TARGET"

echo "Installed native host manifest:"
echo "$TARGET"
