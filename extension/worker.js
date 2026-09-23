const DEFAULT_ORIGIN = "https://www.keepall.app";
const PENDING_LIFETIME_MS = 10 * 60 * 1000;
let creatingOffscreen;

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void chrome.alarms.create("pending-cleanup", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pending-cleanup") void pendingCapture("", "", "").catch(() => {});
});

async function keepallOrigin() {
  const { origin } = await chrome.storage.local.get("origin");
  return typeof origin === "string" && /^http:\/\/localhost:\d{2,5}$/.test(origin)
    ? origin
    : DEFAULT_ORIGIN;
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

async function showFeedback(tabId, message, success, source = "toolbar", editorId) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: success ? "#16803c" : "#b42318" });
    await chrome.action.setBadgeText({ tabId, text: success ? "✓" : "!" });
    await chrome.action.setTitle({ tabId, title: message });
  } catch {
    return;
  }
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    void chrome.action.setTitle({ tabId, title: "Save page to Keepall" }).catch(() => {});
  }, 5000);
  if (source === "badge") return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["page-ui.js"] });
    await chrome.tabs.sendMessage(tabId, {
      type: source === "editor" ? "editor-feedback" : "toast-feedback",
      message, success, editorId,
    });
  } catch {
    // The badge remains visible on restricted browser pages.
  }
}

async function pendingCapture(url, title, noteContent, noteFormat, existingLink, collectionId, tagIds, collectionName, tagNames) {
  const all = await chrome.storage.local.get(null);
  const expired = [];
  let matching;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith("pending:")) continue;
    if (!value || typeof value.createdAt !== "number" || Date.now() - value.createdAt > PENDING_LIFETIME_MS) {
      expired.push(key);
      continue;
    }
    if (value.payload?.url === url && value.payload.title === title &&
        (value.payload.noteContent ?? "") === noteContent &&
        value.payload.noteFormat === noteFormat &&
        JSON.stringify(value.payload.existingLink) === JSON.stringify(existingLink) &&
        value.payload.collectionId === collectionId &&
        JSON.stringify(value.payload.tagIds) === JSON.stringify(tagIds) &&
        value.payload.collectionName === collectionName &&
        JSON.stringify(value.payload.tagNames) === JSON.stringify(tagNames)) {
      matching = value.payload;
    }
  }
  if (expired.length) await chrome.storage.local.remove(expired);
  return matching;
}

async function saveTab(tab, options = {}) {
  const feedback = (message, success) => showFeedback(tab.id, message, success, options.source, options.editorId);
  if (!tab?.id) return;
  if (!/^https?:\/\//i.test(tab.url ?? "")) {
    await feedback("This page cannot be saved to Keepall.", false);
    return;
  }

  try {
    const title = options.title ?? tab.title ?? "";
    const payload = await pendingCapture(tab.url, title, options.noteContent ?? "", options.noteFormat, options.existingLink, options.collectionId, options.tagIds, options.collectionName, options.tagNames) ?? {
      captureId: crypto.randomUUID(),
      url: tab.url,
      title,
      ...(options.noteContent !== undefined ? { noteContent: options.noteContent } : {}),
      ...(options.noteFormat ? { noteFormat: options.noteFormat } : {}),
      ...(options.existingLink ? { existingLink: options.existingLink } : {}),
      ...(options.collectionId !== undefined ? { collectionId: options.collectionId } : {}),
      ...(options.tagIds !== undefined ? { tagIds: options.tagIds } : {}),
      ...(options.collectionName !== undefined ? { collectionName: options.collectionName } : {}),
      ...(options.tagNames !== undefined ? { tagNames: options.tagNames } : {}),
    };
    const key = `pending:${payload.captureId}`;
    await chrome.storage.local.set({ [key]: { payload, createdAt: Date.now() } });
    await ensureOffscreen();
    const result = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "capture",
      origin: await keepallOrigin(),
      payload,
    });
    if (result?.error) {
      if (!result.retryable) await chrome.storage.local.remove(key);
      throw new Error(result.error);
    }
    if (result?.captureId !== payload.captureId || typeof result.itemId !== "string") {
      throw new Error("Keepall did not confirm the save");
    }
    await chrome.storage.local.remove(key);
    let message = "Keepall is up to date";
    if (result.outcome === "created" || result.created) message = "Saved to Keepall";
    if (result.outcome === "updated") message = result.movedTo ? `Moved to ${result.movedTo}` : "Your changes were saved";
    if (result.outcome === "unchanged") message = "This link was already saved";
    await feedback(message, true);
  } catch (error) {
    await feedback(error instanceof Error ? error.message : "Could not save to Keepall", false);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    void chrome.action.setTitle({ tabId, title: "Save page to Keepall" }).catch(() => {});
  }
});

chrome.action.onClicked.addListener((tab) => { void saveTab(tab); });

async function openEditor(tab) {
  if (!tab?.id) return;
  if (!/^https?:\/\//i.test(tab.url ?? "")) {
    await showFeedback(tab.id, "This page cannot be saved to Keepall.", false, "badge");
    return;
  }
  const origin = await keepallOrigin();
  if (new URL(tab.url).origin === origin) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => window.dispatchEvent(new Event("keepall:open-capture")),
    });
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["org-picker.js", "page-ui.js"] });
  const editorId = crypto.randomUUID();
  await chrome.tabs.sendMessage(tab.id, { type: "editor", editorId, title: tab.title ?? "", url: tab.url });
  try {
    await ensureOffscreen();
    const result = await chrome.runtime.sendMessage({
      target: "offscreen", type: "organizations", origin, url: tab.url,
    });
    if (result?.error || !Array.isArray(result?.collections) || !Array.isArray(result?.tags)) {
      throw new Error(result?.error ?? "Could not load collections and tags.");
    }
    await chrome.tabs.sendMessage(tab.id, { type: "organizations", editorId, ...result });
  } catch {
    await chrome.tabs.sendMessage(tab.id, { type: "organization-error", editorId, message: "Could not load collections and tags. You can still save without changing organization." }).catch(() => {});
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-editor") return;
  void (async () => {
    const activeTab = tab ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    await openEditor(activeTab);
  })().catch(() => { void chrome.action.setBadgeText({ text: "!" }); });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "save-from-editor" || !sender.tab) return;
  void saveTab(sender.tab, {
    title: typeof message.title === "string" ? message.title : sender.tab.title,
    noteContent: typeof message.noteContent === "string" ? message.noteContent : "",
    noteFormat: message.noteFormat === "markdown" ? "markdown" : "plain",
    existingLink: message.existingLink,
    collectionId: message.collectionId === null || typeof message.collectionId === "string" ? message.collectionId : undefined,
    tagIds: Array.isArray(message.tagIds) && message.tagIds.every((id) => typeof id === "string") ? message.tagIds : undefined,
    collectionName: typeof message.collectionName === "string" ? message.collectionName : undefined,
    tagNames: Array.isArray(message.tagNames) && message.tagNames.every((name) => typeof name === "string") ? message.tagNames : undefined,
    source: "editor",
    editorId: typeof message.editorId === "string" ? message.editorId : undefined,
  });
});
