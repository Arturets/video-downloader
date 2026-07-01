#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/dist/Video Downloader.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

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
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/video-downloader" <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail

ROOT="$ROOT"
PORT="\${PORT:-8787}"
URL="http://127.0.0.1:\${PORT}/"
LOG_DIR="\$HOME/Library/Logs/Video Downloader"
PID_FILE="\$LOG_DIR/server.pid"

mkdir -p "\$LOG_DIR"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js is required to run Video Downloader. Install Node.js 22 or newer, then reopen the app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  osascript -e 'display dialog "yt-dlp is required to download videos. Install yt-dlp, then reopen the app." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

if ! curl -fsS "\$URL" >/dev/null 2>&1; then
  VIDEO_DOWNLOAD_DIR="\${VIDEO_DOWNLOAD_DIR:-\$HOME/Downloads}" PORT="\$PORT" nohup node "\$ROOT/app/server.js" > "\$LOG_DIR/server.log" 2>&1 &
  echo "\$!" > "\$PID_FILE"
  for _ in {1..40}; do
    if curl -fsS "\$URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.15
  done
fi

open "\$URL"
LAUNCHER

chmod +x "$MACOS_DIR/video-downloader"
echo "Created $APP_DIR"
