import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const PORT = Number(process.env.PORT || 8787);
const ROOT = resolve(import.meta.dirname, "public");
const DOWNLOAD_DIR = process.env.VIDEO_DOWNLOAD_DIR || join(homedir(), "Downloads");
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
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
  const { stdout } = await runYtdlp(["--dump-single-json", "--no-playlist", url]);
  const info = JSON.parse(stdout);
  return {
    id: info.id,
    title: info.title || "Untitled video",
    webpageUrl: info.webpage_url || url,
    thumbnail: info.thumbnail || "",
    duration: info.duration || null,
    extractor: info.extractor || "",
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

async function downloadVideo({ url, formatId, videoFormatId, audioFormatId }) {
  const args = [
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

createServer((req, res) => {
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
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Video Downloader running at http://127.0.0.1:${PORT}`);
  console.log(`Downloads will be saved to ${DOWNLOAD_DIR}`);
});
