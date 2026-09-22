const DEFAULT_ORIGIN = "https://keepall.app";
const LOCAL_ORIGIN = "http://localhost:3100";
let creatingOffscreen;

async function keepallOrigin() {
  const { origin } = await chrome.storage.local.get("origin");
  return origin === LOCAL_ORIGIN ? LOCAL_ORIGIN : DEFAULT_ORIGIN;
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url],
  });
  if (contexts.length > 0) return;
  creatingOffscreen ??= chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["IFRAME_SCRIPTING"],
    justification: "Save an explicitly selected page to the local Keepall library without opening a tab",
  }).finally(() => { creatingOffscreen = undefined; });
  await creatingOffscreen;
}

async function showFeedback(tabId, message, success) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: success ? "#16803c" : "#b42318" });
  await chrome.action.setBadgeText({ tabId, text: success ? "✓" : "!" });
  await chrome.action.setTitle({ tabId, title: message });
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["page-ui.js"] });
    await chrome.tabs.sendMessage(tabId, { type: "feedback", message, success });
  } catch {
    // The badge remains visible on restricted browser pages.
  }
}

async function saveTab(tab, options = {}) {
  if (!tab?.id) return;
  if (!/^https?:\/\//i.test(tab.url ?? "")) {
    await showFeedback(tab.id, "This page cannot be saved to Keepall.", false);
    return;
  }

  const payload = {
    captureId: crypto.randomUUID(),
    url: tab.url,
    title: options.title ?? tab.title ?? "",
    ...(options.noteContent ? { noteContent: options.noteContent } : {}),
  };
  const key = `pending:${payload.captureId}`;
  await chrome.storage.local.set({ [key]: { payload, createdAt: Date.now() } });
  try {
    await ensureOffscreen();
    const result = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "capture",
      origin: await keepallOrigin(),
      payload,
    });
    if (result?.error) throw new Error(result.error);
    if (result?.captureId !== payload.captureId || typeof result.itemId !== "string") {
      throw new Error("Keepall did not confirm the save");
    }
    await chrome.storage.local.remove(key);
    await showFeedback(tab.id, result.created ? "Saved to Keepall" : "Already in Keepall", true);
  } catch (error) {
    await showFeedback(tab.id, error instanceof Error ? error.message : "Could not save to Keepall", false);
  }
}

chrome.action.onClicked.addListener((tab) => { void saveTab(tab); });

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-editor" || !tab?.id) return;
  if (!/^https?:\/\//i.test(tab.url ?? "")) {
    void showFeedback(tab.id, "This page cannot be saved to Keepall.", false);
    return;
  }
  void (async () => {
    const origin = await keepallOrigin();
    if (new URL(tab.url).origin === origin) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => window.dispatchEvent(new Event("keepall:open-capture")),
      });
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["page-ui.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "editor", title: tab.title ?? "", url: tab.url });
  })().catch(() => { void showFeedback(tab.id, "Could not open Keepall capture on this page.", false); });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "save-from-editor" || !sender.tab) return;
  void saveTab(sender.tab, {
    title: typeof message.title === "string" ? message.title : sender.tab.title,
    noteContent: typeof message.noteContent === "string" ? message.noteContent : "",
  });
});
