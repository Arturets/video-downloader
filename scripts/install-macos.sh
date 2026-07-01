#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT/scripts/install-firefox-native-host.sh"
"$ROOT/scripts/create-macos-app.sh"

echo
echo "Install complete."
echo "Launch the app from:"
echo "$ROOT/dist/Video Downloader.app"
