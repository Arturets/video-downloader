import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync, readdirSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const PORT = Number(process.env.PORT || 8787);
const ROOT = resolve(import.meta.dirname, "public");
const DOWNLOAD_DIR = process.env.VIDEO_DOWNLOAD_DIR || join(homedir(), "Downloads");
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const COOKIE_BROWSER = process.env.YTDLP_COOKIE_BROWSER || "firefox";
const SOURCE_ROOT = process.env.VIDEO_DOWNLOADER_SOURCE_ROOT || resolve(import.meta.dirname, "..");
const APP_BUNDLE = process.env.VIDEO_DOWNLOADER_APP_BUNDLE || join(SOURCE_ROOT, "dist", "Video Downloader.app");
const APP_VERSION = process.env.APP_VERSION || JSON.parse(await readFile(join(SOURCE_ROOT, "package.json"), "utf8")).version;
const UPDATE_SCRIPT = join(process.env.VIDEO_DOWNLOADER_APP_BUNDLE ? resolve(import.meta.dirname, "..", "scripts") : join(SOURCE_ROOT, "scripts"), "update-macos-app.sh");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function hasFirefoxCookies() {
  const profilesDirectory = join(homedir(), "Library", "Application Support", "Firefox", "Profiles");
  if (!existsSync(profilesDirectory)) return false;
  try {
    return readdirSync(profilesDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .some(entry => existsSync(join(profilesDirectory, entry.name, "cookies.sqlite")));
  } catch {
    return false;
  }
}

// Firefox is the default, but a missing profile must not prevent public-video downloads.
const ACTIVE_COOKIE_BROWSER = COOKIE_BROWSER === "firefox" && !hasFirefoxCookies() ? "" : COOKIE_BROWSER;

function cookieArgs() {
  return ACTIVE_COOKIE_BROWSER ? ["--cookies-from-browser", ACTIVE_COOKIE_BROWSER] : [];
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

async function updateStatus() {
  const sourcePackage = join(SOURCE_ROOT, "package.json");
  if (!existsSync(sourcePackage)) {
    return { installedVersion: APP_VERSION, canUpdate: false, message: "Source directory is unavailable." };
  }
  const sourceVersion = JSON.parse(await readFile(sourcePackage, "utf8")).version;
  const canUpdate = compareVersions(sourceVersion, APP_VERSION) > 0;
  return {
    installedVersion: APP_VERSION,
    sourceVersion,
    canUpdate,
    message: canUpdate ? `Version ${sourceVersion} is ready to install.` : "You have the latest build."
  };
}

async function startUpdate() {
  const status = await updateStatus();
  if (!status.canUpdate) return status;
  if (!existsSync(UPDATE_SCRIPT)) throw new Error("The app update helper is missing.");
  const updater = spawn("bash", [UPDATE_SCRIPT], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, VIDEO_DOWNLOADER_SOURCE_ROOT: SOURCE_ROOT, VIDEO_DOWNLOADER_APP_BUNDLE: APP_BUNDLE }
  });
  updater.unref();
  setTimeout(() => server.close(), 500);
  return { ...status, updating: true };
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function runYtdlp(args, { stream = false } = {}) {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(YTDLP, args, {
      stdio: ["ignore", stream ? "inherit" : "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    if (!stream) child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolveProcess({ stdout, stderr });
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
  });
}

function shellSplit(command) {
  const tokens = [];
  let token = "";
  let quote = null;
  let escaped = false;
  for (const character of command.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = "";
    } else {
      token += character;
    }
  }
  if (escaped || quote) throw new Error("The command has an unfinished quote or escape.");
  if (token) tokens.push(token);
  return tokens;
}

function commandArgs(command) {
  const tokens = shellSplit(command);
  if (!tokens.length) throw new Error("A yt-dlp command is required.");
  const executable = tokens.shift();
  if (executable !== "yt-dlp" && executable !== YTDLP) {
    throw new Error("The command must start with yt-dlp.");
  }
  return tokens;
}

function normalizeFormats(info) {
  const formats = Array.isArray(info.formats) ? info.formats : [];
  const normalized = formats
    .filter(format => format.format_id)
    .map(format => ({
      id: format.format_id,
      ext: format.ext || "",
      resolution: format.resolution || (format.height ? `${format.height}p` : "audio"),
      height: format.height || null,
      fps: format.fps || null,
      vcodec: format.vcodec || "none",
      acodec: format.acodec || "none",
      filesize: format.filesize || format.filesize_approx || null,
      tbr: format.tbr || null,
      note: format.format_note || "",
      label: format.format || format.format_id
    }));

  return {
    video: normalized.filter(format => format.vcodec !== "none"),
    audio: normalized.filter(format => format.acodec !== "none")
  };
}

async function getInfo(url) {
  const { stdout } = await runYtdlp([...cookieArgs(), "--dump-single-json", "--no-playlist", url]);
  const info = JSON.parse(stdout);
  return {
    id: info.id,
    title: info.title || "Untitled video",
    webpageUrl: info.webpage_url || url,
    thumbnail: info.thumbnail || "",
    duration: info.duration || null,
    extractor: info.extractor || "",
    downloadDirectory: DOWNLOAD_DIR,
    cookieBrowser: ACTIVE_COOKIE_BROWSER,
    formats: normalizeFormats(info)
  };
}

function composeFormat({ videoFormatId, audioFormatId, formatId }) {
  if (formatId) return formatId;
  if (videoFormatId && audioFormatId) return `${videoFormatId}+${audioFormatId}`;
  if (videoFormatId) return `${videoFormatId}+ba/b`;
  if (audioFormatId) return audioFormatId;
  return "bv*+ba/b";
}

async function downloadVideo({ url, formatId, videoFormatId, audioFormatId, command }) {
  if (command) {
    await runYtdlp(commandArgs(command), { stream: true });
    return { ok: true, directory: DOWNLOAD_DIR };
  }
  const args = [
    ...cookieArgs(),
    "--no-playlist",
    "--paths",
    DOWNLOAD_DIR,
    "--restrict-filenames",
    "--newline",
    "-o",
    "%(title).180B [%(id)s].%(ext)s"
  ];

  args.push("-f", composeFormat({ formatId, videoFormatId, audioFormatId }));

  args.push(url);
  await runYtdlp(args, { stream: true });
  return { ok: true, directory: DOWNLOAD_DIR };
}

async function handleApi(req, res) {
  try {
    const body = await readBody(req);
    if (req.url === "/api/update-status") {
      sendJson(res, 200, await updateStatus());
      return;
    }

    if (req.url === "/api/update") {
      sendJson(res, 200, await startUpdate());
      return;
    }

    if (req.url === "/api/config") {
      sendJson(res, 200, { cookieBrowser: ACTIVE_COOKIE_BROWSER, downloadDirectory: DOWNLOAD_DIR });
      return;
    }

    if (!body.url || typeof body.url !== "string") {
      sendJson(res, 400, { error: "A video URL is required." });
      return;
    }

    if (req.url === "/api/info") {
      sendJson(res, 200, await getInfo(body.url));
      return;
    }

    if (req.url === "/api/download") {
      sendJson(res, 200, await downloadVideo(body));
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = normalize(join(ROOT, decodeURIComponent(requestPath)));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    await readFile(filePath);
    res.writeHead(200, {
      "content-type": types[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Video Downloader running at http://127.0.0.1:${PORT}`);
  console.log(`Downloads will be saved to ${DOWNLOAD_DIR}`);
});
