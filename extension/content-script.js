const BUTTON_CLASS = "vd-download-button";

function isSupportedPage() {
  return /youtube\.com|substack\.com|twitter\.com|x\.com/.test(location.hostname);
}

function buttonText() {
  if (location.hostname.includes("youtube.com")) return "Download";
  if (location.hostname.includes("substack.com")) return "Save video";
  return "Download video";
}

function createButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = buttonText();
  button.addEventListener("click", event => {
    event.stopPropagation();
    browser.runtime.sendMessage({
      type: "open-downloader",
      url: location.href
    });
  });
  return button;
}

function injectFallbackButton() {
  if (document.querySelector(`.${BUTTON_CLASS}`) || !document.body || !isSupportedPage()) return;
  document.body.append(createButton());
}

function scheduleInject() {
  window.clearTimeout(scheduleInject.timer);
  scheduleInject.timer = window.setTimeout(injectFallbackButton, 300);
}

scheduleInject();
new MutationObserver(scheduleInject).observe(document.documentElement, {
  childList: true,
  subtree: true
});
