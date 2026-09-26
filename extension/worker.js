const DEFAULT_ORIGIN = "https://www.keepall.app";
const PENDING_LIFETIME_MS = 10 * 60 * 1000;
let creatingOffscreen;

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void chrome.alarms.create("pending-cleanup", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pending-cleanup") void pendingCapture("", "", "").catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-to-keepall",
      title: "Save to Keepall",
      contexts: ["image", "link"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
      targetUrlPatterns: ["http://*/*", "https://*/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void saveContext(info, tab);
});

function saveContext(info, tab) {
  if (info.menuItemId !== "save-to-keepall") return;
  if (info.mediaType === "image") {
    if (info.srcUrl) return saveImage(tab, info.srcUrl, info);
    return;
  }
  if (info.linkUrl) return saveLink(tab, info.linkUrl);
}

async function keepallOrigin() {
  const { origin } = await chrome.storage.local.get("origin");
  return typeof origin === "string" && /^http:\/\/localhost:\d{2,5}$/.test(origin)
    ? origin
    : DEFAULT_ORIGIN;
}

async function requireLibraryAccess(origin) {
  const url = new URL(origin);
  if (!await chrome.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] })) {
    throw new Error("Library access is missing. Open Keepall extension Options and restore library access.");
  }
}

async function ensureOffscreen(origin) {
  await requireLibraryAccess(origin);
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

async function notifyOpenKeepallTabs(origin) {
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  await Promise.allSettled(tabs.filter((tab) => tab.id).map((tab) =>
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => window.dispatchEvent(new Event("keepall:items-changed")),
    }),
  ));
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
    const origin = await keepallOrigin();
    await ensureOffscreen(origin);
    const result = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "capture",
      origin,
      payload,
    });
    if (result?.error) {
      if (!result.retryable) await chrome.storage.local.remove(key);
      throw new Error(result.error);
    }
    if (result?.captureId !== payload.captureId || typeof result.itemId !== "string") {
      throw new Error("Keepall did not confirm the save");
    }
    await requireLibraryAccess(origin);
    await chrome.storage.local.remove(key);
    if (result.outcome === "created" || result.outcome === "updated" || result.created) {
      await notifyOpenKeepallTabs(origin).catch(() => {});
    }
    let message = "Keepall is up to date";
    if (result.outcome === "created" || result.created) message = "Saved to Keepall";
    if (result.outcome === "updated") message = result.movedTo ? `Moved to ${result.movedTo}` : "Your changes were saved";
    if (result.outcome === "unchanged") message = "This link was already saved";
    await feedback(message, true);
  } catch (error) {
    await feedback(error instanceof Error ? error.message : "Could not save to Keepall", false);
  }
}

async function saveLink(tab, linkUrl) {
  if (!tab?.id) return;
  let url;
  try {
    url = new URL(linkUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported link");
  } catch {
    await showFeedback(tab.id, "This link cannot be saved to Keepall.", false);
    return;
  }
  await saveTab({ ...tab, url: url.href }, { title: "" });
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

async function imageBytes(url) {
  const response = await fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.body) throw new Error("Could not download this image.");
  const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_MIMES.has(mimeType)) throw new Error("Use a PNG, JPEG, GIF, WebP, or AVIF image.");
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 20 MiB or smaller.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Image must be 20 MiB or smaller.");
    }
    chunks.push(value);
  }
  if (!size) throw new Error("Image file is empty.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, mimeType };
}

function base64Image(bytes) {
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += 24576) {
    parts.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24576))));
  }
  return parts.join("");
}

function imageSourceUrl(pageUrl, linkUrl) {
  const page = new URL(pageUrl);
  const isX = (url) => ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"].includes(url.hostname);
  if (!isX(page)) return page.href;
  for (const candidate of [linkUrl, page.href]) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate, page);
      if (!["http:", "https:"].includes(url.protocol) || !isX(url)) continue;
      if (!/^\/(?:[A-Za-z0-9_]+\/status|i\/web\/status|i\/status)\/\d+(?:\/(?:photo|video)\/\d+)?\/?$/.test(url.pathname)) continue;
      return `https://x.com${url.pathname.replace(/\/(?:photo|video)\/\d+\/?$/, "").replace(/\/$/, "")}`;
    } catch {
      // An unrelated or invalid image link leaves the page as the source.
    }
  }
  return page.href;
}

async function saveImage(tab, srcUrl, context = {}) {
  if (!tab?.id) return;
  const feedback = (message, success) => showFeedback(tab.id, message, success);
  let sourcePage;
  let imageUrl;
  try {
    sourcePage = new URL(context.pageUrl ?? tab.url ?? "");
    imageUrl = new URL(srcUrl);
    if (!["http:", "https:"].includes(sourcePage.protocol) ||
        !["http:", "https:"].includes(imageUrl.protocol)) {
      throw new Error("This image cannot be saved to Keepall.");
    }
  } catch {
    await feedback("This image cannot be saved to Keepall.", false);
    return;
  }

  // A context-menu click grants activeTab for the page origin. CDN hosts need
  // an explicit, optional grant requested while that click is still active.
  const access = imageUrl.origin === sourcePage.origin
    ? Promise.resolve(true)
    : chrome.permissions.request({ origins: [`${imageUrl.origin}/*`] });
  try {
    if (!await access) throw new Error("Allow access to this image host to save it.");
    const { bytes, mimeType } = await imageBytes(imageUrl.href);
    const origin = await keepallOrigin();
    await ensureOffscreen(origin);
    const captureId = crypto.randomUUID();
    const result = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "capture-image",
      origin,
      payload: {
        captureId,
        sourcePageUrl: imageSourceUrl(sourcePage.href, context.linkUrl),
        mimeType,
        data: base64Image(bytes),
      },
    });
    if (result?.error) throw new Error(result.error);
    if (result?.captureId !== captureId || typeof result.itemId !== "string") {
      throw new Error("Keepall did not confirm the image save.");
    }
    await requireLibraryAccess(origin);
    if (result.outcome === "created") await notifyOpenKeepallTabs(origin).catch(() => {});
    await feedback(result.outcome === "created" ? "Image saved to Keepall" : "This image was already saved", true);
  } catch (error) {
    const message = error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name)
      ? "Could not download this image."
      : error instanceof Error ? error.message : "Could not save this image to Keepall.";
    await feedback(message, false);
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
  await chrome.tabs.sendMessage(tab.id, { type: "editor", editorId, origin, title: tab.title ?? "", url: tab.url });
  try {
    await ensureOffscreen(origin);
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
