const form = document.querySelector("#lookup-form");
const urlInput = document.querySelector("#url");
const statusEl = document.querySelector("#status");
const result = document.querySelector("#result");
const thumbnail = document.querySelector("#thumbnail");
const title = document.querySelector("#title");
const source = document.querySelector("#source");
const meta = document.querySelector("#meta");
const videoFormatSelect = document.querySelector("#video-format");
const audioFormatSelect = document.querySelector("#audio-format");
const downloadButton = document.querySelector("#download");
const commandInput = document.querySelector("#command");
const resetCommandButton = document.querySelector("#reset-command");
const themeToggle = document.querySelector("#theme-toggle");
const updateButton = document.querySelector("#update");
const updateStatusEl = document.querySelector("#update-status");

let currentUrl = "";
let downloadDirectory = "~/Downloads";
let commandEdited = false;
let cookieBrowser = "";

function quoteArgument(argument) {
  return /[\s"'\\]/.test(argument) ? JSON.stringify(argument) : argument;
}

function buildCommand() {
  const format = videoFormatSelect.value && audioFormatSelect.value
    ? `${videoFormatSelect.value}+${audioFormatSelect.value}`
    : videoFormatSelect.value
      ? `${videoFormatSelect.value}+ba/b`
      : audioFormatSelect.value || "bv*+ba/b";
  const url = urlInput.value.trim() || currentUrl;
  return [
    "yt-dlp",
    ...(cookieBrowser ? ["--cookies-from-browser", cookieBrowser] : []),
    "--no-playlist",
    "--paths", downloadDirectory,
    "--restrict-filenames",
    "--newline",
    "-o", "%(title).180B [%(id)s].%(ext)s",
    "-f", format,
    url
  ].filter(Boolean).map(quoteArgument).join(" ");
}

function refreshCommand({ force = false } = {}) {
  if (!commandEdited || force) commandInput.value = buildCommand();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  localStorage.setItem("theme", theme);
}

const params = new URLSearchParams(location.search);
if (params.get("url")) {
  urlInput.value = params.get("url");
}

function setBusy(busy, message) {
  form.querySelector("button").disabled = busy;
  downloadButton.disabled = busy;
  statusEl.textContent = message || "";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function optionLabel(format) {
  const parts = [
    format.resolution,
    format.ext,
    format.fps ? `${format.fps} fps` : "",
    format.acodec === "none" ? "video only" : "",
    format.vcodec === "none" ? "audio only" : "",
    formatBytes(format.filesize)
  ].filter(Boolean);
  return `${format.id} - ${parts.join(" · ")}`;
}

function appendFormatOptions(select, formats) {
  for (const format of formats) {
    select.append(new Option(optionLabel(format), format.id));
  }
}

function splitFormats(formats) {
  if (!Array.isArray(formats)) {
    return {
      video: formats?.video || [],
      audio: formats?.audio || []
    };
  }

  return {
    video: formats.filter(format => format.vcodec !== "none"),
    audio: formats.filter(format => format.acodec !== "none")
  };
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function checkForUpdate() {
  try {
    const response = await fetch("/api/update-status", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to check for updates");
    updateStatusEl.hidden = false;
    updateStatusEl.textContent = data.message;
    updateButton.hidden = !data.canUpdate;
  } catch {
    // The downloader remains usable if the update helper is unavailable.
  }
}

function renderInfo(info) {
  currentUrl = info.webpageUrl;
  downloadDirectory = info.downloadDirectory || "~/Downloads";
  cookieBrowser = info.cookieBrowser || "";
  title.textContent = info.title;
  source.textContent = info.extractor || "Video";
  meta.textContent = [formatDuration(info.duration), info.webpageUrl].filter(Boolean).join(" · ");
  thumbnail.src = info.thumbnail || "";
  thumbnail.hidden = !info.thumbnail;

  const formats = splitFormats(info.formats);

  videoFormatSelect.replaceChildren();
  audioFormatSelect.replaceChildren();
  videoFormatSelect.append(new Option("Best available video", ""));
  audioFormatSelect.append(new Option("Best available audio", ""));
  appendFormatOptions(videoFormatSelect, formats.video);
  appendFormatOptions(audioFormatSelect, formats.audio);

  result.hidden = false;
  commandEdited = false;
  refreshCommand({ force: true });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  setBusy(true, "Checking available formats...");
  try {
    const info = await postJson("/api/info", { url: urlInput.value.trim() });
    renderInfo(info);
    setBusy(false, "Choose a format and download.");
  } catch (error) {
    setBusy(false, error.message);
  }
});

urlInput.addEventListener("input", () => {
  currentUrl = "";
  if (!commandEdited) refreshCommand({ force: true });
});

async function loadConfig() {
  try {
    const data = await postJson("/api/config", {});
    cookieBrowser = data.cookieBrowser || "";
    downloadDirectory = data.downloadDirectory || downloadDirectory;
    refreshCommand();
  } catch {
    // A command preview is still useful if the optional configuration call fails.
  }
}

downloadButton.addEventListener("click", async () => {
  setBusy(true, "Downloading...");
  try {
    const data = await postJson("/api/download", {
      url: currentUrl || urlInput.value.trim(),
      videoFormatId: videoFormatSelect.value,
      audioFormatId: audioFormatSelect.value,
      command: commandInput.value.trim()
    });
    setBusy(false, `Saved to ${data.directory}`);
  } catch (error) {
    setBusy(false, error.message);
  }
});

[videoFormatSelect, audioFormatSelect].forEach(select => {
  select.addEventListener("change", () => refreshCommand());
});

commandInput.addEventListener("input", () => {
  commandEdited = true;
});

resetCommandButton.addEventListener("click", () => {
  commandEdited = false;
  refreshCommand({ force: true });
});

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

updateButton.addEventListener("click", async () => {
  updateButton.disabled = true;
  updateStatusEl.hidden = false;
  updateStatusEl.textContent = "Installing update and restarting the app...";
  try {
    const data = await postJson("/api/update", {});
    if (!data.updating) {
      updateStatusEl.textContent = data.message;
      updateButton.hidden = true;
      updateButton.disabled = false;
    }
  } catch (error) {
    updateStatusEl.textContent = error.message;
    updateButton.disabled = false;
  }
});

setTheme(localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
refreshCommand({ force: true });
checkForUpdate();
loadConfig();
