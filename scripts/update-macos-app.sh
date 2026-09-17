#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${VIDEO_DOWNLOADER_SOURCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TARGET_APP="${VIDEO_DOWNLOADER_APP_BUNDLE:-$SOURCE_ROOT/dist/Video Downloader.app}"
SOURCE_PACKAGE="$SOURCE_ROOT/package.json"

if [ ! -f "$SOURCE_PACKAGE" ]; then
  echo "Update skipped: source package.json was not found at $SOURCE_ROOT" >&2
  exit 1
fi

SOURCE_VERSION="$(node -p "require('$SOURCE_PACKAGE').version")"
INSTALLED_VERSION="$(defaults read "$TARGET_APP/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo 0.0.0)"

if ! node -e 'const [a, b] = process.argv.slice(1).map(v => v.split(".").map(Number)); for (let i = 0; i < 3; i += 1) { if ((a[i] || 0) !== (b[i] || 0)) process.exit((a[i] || 0) > (b[i] || 0) ? 0 : 1); } process.exit(1);' "$SOURCE_VERSION" "$INSTALLED_VERSION"; then
  echo "Update skipped: installed version $INSTALLED_VERSION is current or newer."
  exit 0
fi

# Let the current launcher stop its local server before its bundle is refreshed.
sleep 1

STAGING_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/video-downloader-update.XXXXXX")"
STAGING_APP="$STAGING_ROOT/Video Downloader.app"
cleanup() { rm -rf "$STAGING_ROOT"; }
trap cleanup EXIT

VIDEO_DOWNLOADER_APP_DIR="$STAGING_APP" "$SOURCE_ROOT/scripts/create-macos-app.sh"
ditto "$STAGING_APP" "$TARGET_APP"
echo "Updated Video Downloader from $INSTALLED_VERSION to $SOURCE_VERSION at $TARGET_APP"
open -n "$TARGET_APP"
