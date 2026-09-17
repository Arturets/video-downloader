#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
APP_DIR="${VIDEO_DOWNLOADER_APP_DIR:-$ROOT/dist/Video Downloader.app}"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
RESOURCE_APP_DIR="$RESOURCES_DIR/app"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
rm -rf "$RESOURCE_APP_DIR"
cp -R "$ROOT/app" "$RESOURCE_APP_DIR"
rm -rf "$RESOURCES_DIR/scripts"
cp -R "$ROOT/scripts" "$RESOURCES_DIR/scripts"

cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>video-downloader</string>
  <key>CFBundleIdentifier</key>
  <string>local.video-downloader</string>
  <key>CFBundleName</key>
  <string>Video Downloader</string>
  <key>CFBundleDisplayName</key>
  <string>Video Downloader</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>$VERSION</string>
  <key>VideoDownloaderSourceDirectory</key>
  <string>$ROOT</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/video-downloader" <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail

ROOT="$ROOT"
APP_ROOT="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/../Resources/app" && pwd)"
APP_BUNDLE_PATH="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="\$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\${PATH:-}"
PORT="\${PORT:-8787}"
URL="http://127.0.0.1:\${PORT}/"
LOG_DIR="\$HOME/Library/Logs/Video Downloader"
PID_FILE="\$LOG_DIR/server.pid"

mkdir -p "\$LOG_DIR"

NODE_BIN="\${NODE_BIN:-}"
if [ -z "\$NODE_BIN" ]; then
  for candidate in "\$HOME/.volta/bin/node" /opt/homebrew/bin/node /usr/local/bin/node node; do
    if command -v "\$candidate" >/dev/null 2>&1; then
      NODE_BIN="\$(command -v "\$candidate")"
      break
    fi
  done
fi

if [ -z "\$NODE_BIN" ]; then
  osascript -e 'display dialog "Node.js is required to run Video Downloader. Install Node.js 22 or newer, then reopen the app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

NODE_MAJOR="\$("\$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
if [ "\$NODE_MAJOR" -lt 22 ]; then
  osascript -e 'display dialog "Video Downloader found Node.js, but it is older than version 22. Install Node.js 22 or newer, then reopen the app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  osascript -e 'display dialog "yt-dlp is required to download videos. Install yt-dlp, then reopen the app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  osascript -e 'display dialog "ffmpeg is required to merge video and audio streams. Install ffmpeg, then reopen the app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

SERVER_PID=""

if ! curl -fsS "\$URL" >/dev/null 2>&1; then
  VIDEO_DOWNLOAD_DIR="\${VIDEO_DOWNLOAD_DIR:-\$HOME/Downloads}" PORT="\$PORT" APP_VERSION="$VERSION" VIDEO_DOWNLOADER_SOURCE_ROOT="\$ROOT" VIDEO_DOWNLOADER_APP_BUNDLE="\$APP_BUNDLE_PATH" nohup "\$NODE_BIN" "\$APP_ROOT/server.js" > "\$LOG_DIR/server.log" 2>&1 &
  SERVER_PID="\$!"
  echo "\$SERVER_PID" > "\$PID_FILE"
  for _ in {1..40}; do
    if curl -fsS "\$URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.15
  done
fi

open "\$URL"

if [ -n "\$SERVER_PID" ]; then
  wait "\$SERVER_PID"
fi
LAUNCHER

chmod +x "$MACOS_DIR/video-downloader"
echo "Created $APP_DIR"
