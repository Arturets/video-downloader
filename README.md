# Video Downloader

Local video downloader MVP for Firefox on macOS.

## What is included

- `app/`: local web UI at `http://127.0.0.1:8787`
- `native/`: Firefox native messaging host backed by `yt-dlp`
- `extension/`: Firefox WebExtension that injects a small download button on YouTube, Substack, X/Twitter and adds toolbar/context-menu entry points

## Requirements

- Node.js 22+
- `yt-dlp`
- `ffmpeg`
- Firefox

## Run the web app

```sh
npm run dev
```

Open `http://127.0.0.1:8787`, paste a URL, choose a format, and download.

Downloads are saved to `~/Downloads` by default. Override with:

```sh
VIDEO_DOWNLOAD_DIR=/path/to/folder npm run dev
```

## Install the Firefox native messaging host

```sh
./scripts/install-firefox-native-host.sh
```

Then load the extension temporarily in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extension/manifest.json`

The extension currently opens the local web app for format selection. The native messaging host is scaffolded and ready for a richer extension popup/options flow.

## Limits

- DRM-protected media is not supported.
- Site support depends on `yt-dlp` and can break when platforms change.
- The injected UI is intentionally simple in this MVP; deeper site-native placement can be added per site.
