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

## Install as a local macOS app

```sh
./scripts/install-macos.sh
```

This creates:

```text
dist/Video Downloader.app
```

After that, open the app directly. It starts the local server with `node`, opens the browser UI, and logs to:

```text
~/Library/Logs/Video Downloader/server.log
```

This app wrapper does not require `npm` to launch, but it does still require Node.js, `yt-dlp`, and `ffmpeg` to be installed on the machine.

## Install the Firefox native messaging host

```sh
./scripts/install-firefox-native-host.sh
```

Then load the extension temporarily in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extension/manifest.json`

The extension currently opens the local web app for format selection. The native messaging host is scaffolded and ready for a richer extension popup/options flow.

## Package the Firefox extension for AMO

```sh
npm run package:firefox
```

Upload this ZIP in Mozilla Add-on Developer Hub:

```text
dist/video-downloader-firefox-0.1.0.zip
```

The ZIP is built with `manifest.json` at the archive root, which is what AMO expects. The `.xpi` beside it is the same package with Firefox's install extension.

Suggested AMO reviewer note:

```text
This extension opens a local companion downloader at http://127.0.0.1:8787 and declares nativeMessaging for a local helper named video_downloader_host. The companion app/native host is installed separately by the user and wraps yt-dlp/ffmpeg. The extension package itself does not include yt-dlp, ffmpeg, or the native host binary.
```

## Limits

- DRM-protected media is not supported.
- Site support depends on `yt-dlp` and can break when platforms change.
- The injected UI is intentionally simple in this MVP; deeper site-native placement can be added per site.
