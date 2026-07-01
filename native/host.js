#!/usr/bin/env node
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const DOWNLOAD_DIR = process.env.VIDEO_DOWNLOAD_DIR || join(homedir(), "Downloads");

function send(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

function runYtdlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
  });
}

async function handle(message) {
  if (message.type === "info") {
    const stdout = await runYtdlp(["--dump-single-json", "--no-playlist", message.url]);
    const info = JSON.parse(stdout);
    send({
      ok: true,
      title: info.title,
      webpageUrl: info.webpage_url || message.url,
      thumbnail: info.thumbnail,
      extractor: info.extractor,
      formats: (info.formats || []).map(format => ({
        id: format.format_id,
        ext: format.ext,
        resolution: format.resolution || (format.height ? `${format.height}p` : "audio"),
        fps: format.fps || null,
        acodec: format.acodec,
        vcodec: format.vcodec,
        filesize: format.filesize || format.filesize_approx || null
      }))
    });
    return;
  }

  if (message.type === "download") {
    const args = [
      "--no-playlist",
      "--paths",
      DOWNLOAD_DIR,
      "--restrict-filenames",
      "-o",
      "%(title).180B [%(id)s].%(ext)s",
      "-f",
      message.formatId || "bv*+ba/b",
      message.url
    ];
    await runYtdlp(args);
    send({ ok: true, directory: DOWNLOAD_DIR });
    return;
  }

  send({ ok: false, error: "Unknown message type" });
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", chunk => {
  buffer = Buffer.concat([buffer, chunk]);

  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < length + 4) return;
    const payload = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);

    handle(JSON.parse(payload.toString("utf8"))).catch(error => {
      send({ ok: false, error: error.message });
    });
  }
});
