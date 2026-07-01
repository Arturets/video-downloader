const HOST_NAME = "video_downloader_host";
const WEB_APP_URL = "http://127.0.0.1:8787/";

function openDownloader(url) {
  browser.tabs.create({
    url: `${WEB_APP_URL}?url=${encodeURIComponent(url)}`
  });
}

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "download-video-page",
    title: "Download video from this page",
    contexts: ["page", "video", "link"]
  });
});

browser.browserAction.onClicked.addListener(tab => {
  if (tab?.url) openDownloader(tab.url);
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  openDownloader(info.linkUrl || info.srcUrl || tab?.url || "");
});

browser.runtime.onMessage.addListener(message => {
  if (message.type === "open-downloader" && message.url) {
    openDownloader(message.url);
    return Promise.resolve({ ok: true });
  }

  if (message.type === "native-info" || message.type === "native-download") {
    const nativeMessage =
      message.type === "native-info"
        ? { type: "info", url: message.url }
        : { type: "download", url: message.url, formatId: message.formatId };
    return browser.runtime.sendNativeMessage(HOST_NAME, nativeMessage);
  }

  return Promise.resolve({ ok: false, error: "Unknown message" });
});
