import { resolve } from "node:path";

const root = resolve(process.argv[2] || ".");
const manifest = {
  name: "video_downloader_host",
  description: "Video Downloader native messaging host",
  path: `${root}/native/host.js`,
  type: "stdio",
  allowed_extensions: ["video-downloader@local"]
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
