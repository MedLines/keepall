const DEFAULT_ORIGIN = "https://www.keepall.app";
const PENDING_LIFETIME_MS = 10 * 60 * 1000;
let creatingOffscreen;
const badgeTimers = new Map();

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void chrome.alarms.create("pending-cleanup", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pending-cleanup") {
    void pendingCapture("", "", "").catch(() => {});
    void pruneEditorSessions().catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-to-keepall",
      title: "Save to Keepall",
      contexts: ["image", "link", "selection"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
      targetUrlPatterns: ["http://*/*", "https://*/*"],
    });
    // Separate from the item above so blob: (streamed) videos still show it and get a clear explanation.
    chrome.contextMenus.create({
      id: "save-video-to-keepall",
      title: "Save video to Keepall",
      contexts: ["video"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
    chrome.contextMenus.create({
      id: "save-page-with-screenshot",
      title: "Save page with screenshot",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
    chrome.contextMenus.create({ id: "open-keepall-library", title: "Open Keepall library", contexts: ["action"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-keepall-library") {
    void openKeepallLibrary().catch(() => {
      if (tab?.id !== undefined) void showFeedback(tab.id, "Could not open your Keepall library. Try again.", false, "badge");
    });
    return;
  }
  void saveContext(info, tab);
});

function saveContext(info, tab) {
  if (info.menuItemId === "save-video-to-keepall") return saveVideo(tab, info.srcUrl, info);
  if (info.menuItemId === "save-page-with-screenshot") return saveTab(tab, { screenshot: true });
  if (info.menuItemId !== "save-to-keepall") return;
  if (info.mediaType === "image") {
    if (info.srcUrl) return saveImage(tab, info.srcUrl, info);
    return;
  }
  if (typeof info.selectionText === "string" && info.selectionText.trim()) return saveSelection(tab, info);
  if (info.linkUrl) return saveLink(tab, info.linkUrl);
}

async function keepallOrigin() {
  const { origin } = await chrome.storage.local.get("origin");
  return typeof origin === "string" && /^http:\/\/localhost:\d{2,5}$/.test(origin)
    ? origin
    : DEFAULT_ORIGIN;
}

async function openKeepallLibrary() {
  const origin = await keepallOrigin();
  const tabs = await chrome.tabs.query({});
  const library = tabs.find((tab) => {
    if (tab.id === undefined || !tab.url) return false;
    try {
      const url = new URL(tab.url);
      return url.origin === origin && url.pathname === "/";
    } catch { return false; }
  });
  if (library) {
    await chrome.tabs.update(library.id, { active: true });
    await chrome.windows.update(library.windowId, { focused: true });
  } else await chrome.tabs.create({ url: `${origin}/` });
}

async function requireLibraryAccess(origin) {
  const url = new URL(origin);
  if (!await chrome.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] })) {
    throw new Error("Keepall Capture lost access to your library. Open settings and choose Restore library access.");
  }
}

async function ensureOffscreen(origin) {
  await requireLibraryAccess(origin);
  if (creatingOffscreen) return creatingOffscreen;
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url],
  });
  if (creatingOffscreen) return creatingOffscreen;
  if (contexts.length > 0) return;
  creatingOffscreen ??= chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["IFRAME_SCRIPTING"],
    justification: "Save an explicitly selected page to the local Keepall library without opening a tab",
  }).finally(() => { creatingOffscreen = undefined; });
  await creatingOffscreen;
}

async function checkLibraryConnection() {
  const origin = await keepallOrigin();
  try {
    await requireLibraryAccess(origin);
  } catch {
    return { success: false, origin, reason: "access" };
  }
  try {
    await ensureOffscreen(origin);
    const result = await chrome.runtime.sendMessage({ target: "offscreen", type: "organizations", origin, url: origin });
    if (result?.error || !Array.isArray(result?.collections) || !Array.isArray(result?.tags)) throw new Error("Unavailable library");
    await requireLibraryAccess(origin);
    return { success: true, origin };
  } catch {
    return { success: false, origin, reason: "unavailable" };
  }
}

async function captureTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  return ["light", "dark"].includes(theme) ? theme : "system";
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.theme) return;
  void (async () => {
    const theme = await captureTheme();
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.filter((tab) => tab.id).map((tab) => chrome.tabs.sendMessage(tab.id, { type: "theme", theme })));
  })().catch(() => {});
});

async function showSaving(tabId, title) {
  clearTimeout(badgeTimers.get(tabId));
  await chrome.action.setBadgeText({ tabId, text: "…" }).catch(() => {});
  await chrome.action.setTitle({ tabId, title }).catch(() => {});
}

/** Which Options tab helps with this failure, or null when settings cannot. */
function settingsSectionFor(message) {
  if (typeof message !== "string") return null;
  if (message.includes("to save this image") || message.includes("to save this video")) return "images";
  if (message.includes("Could not reach Keepall") || message.includes("lost access to your library")) return "general";
  return null;
}

async function showFeedback(tabId, message, success, source = "toolbar", editorId, actions) {
  if (!success && !actions) {
    const section = settingsSectionFor(message);
    if (section) actions = { settings: section };
  }
  try {
    // Chrome's badge API rejects OKLCH strings and requires legacy RGBA here.
    await chrome.action.setBadgeBackgroundColor({ tabId, color: success ? [22, 128, 60, 255] : [180, 35, 24, 255] });
    await chrome.action.setBadgeText({ tabId, text: success ? "✓" : "!" });
    await chrome.action.setTitle({ tabId, title: message });
  } catch {
    return;
  }
  clearTimeout(badgeTimers.get(tabId));
  badgeTimers.set(tabId, setTimeout(() => {
    badgeTimers.delete(tabId);
    void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    void chrome.action.setTitle({ tabId, title: "Save page to Keepall" }).catch(() => {});
  }, success ? 5000 : 15000));
  if (source === "badge") return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["toast-collections.js", "page-ui.js"] });
    await chrome.tabs.sendMessage(tabId, {
      type: source === "editor" ? "editor-feedback" : "toast-feedback",
      message, success, editorId, actions, theme: await captureTheme(),
    });
  } catch {
    // The badge remains visible on restricted browser pages.
  }
}

/** `pageUrl` is set only when the saved link is the page in this tab, so it can be captured. */
async function captureFeedbackActions(tabId, origin, result, pageUrl) {
  const id = crypto.randomUUID();
  const undoExpiresAt = Number.isFinite(result.undoExpiresAt) ? result.undoExpiresAt : Date.now() + 60_000;
  const canUndo = result.outcome === "created" && typeof result.undoToken === "string" && undoExpiresAt > Date.now();
  const canScreenshot = typeof pageUrl === "string" && Array.isArray(result.capabilities) && result.capabilities.includes("link-screenshot-v1");
  // Keep actions until the next save or tab close. In-page navigation can report
  // "loading" while the notification and its organizer are still open.
  await chrome.storage.session.set({ [`save-feedback:${tabId}`]: {
    id, origin, itemId: result.itemId,
    ...(canUndo ? { undoToken: result.undoToken } : {}),
    ...(canScreenshot ? { pageUrl } : {}),
  } });
  return { id, canUndo, canScreenshot, ...(canUndo ? { undoExpiresAt } : {}) };
}

const SCREENSHOT_MAX_WIDTH = 2000;

function samePage(first, second) {
  try {
    const a = new URL(first);
    const b = new URL(second);
    a.hash = "";
    b.hash = "";
    return a.href === b.href;
  } catch {
    return false;
  }
}

/** Downscales a visible-tab PNG and encodes it as WebP (PNG where WebP encoding is unavailable). */
async function encodeScreenshot(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || "image/png", width, height };
}

/** Chrome allows about two captures per second; wait out the quota instead of failing. */
async function captureWithinQuota(windowId, attempt = 0) {
  try {
    return await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  } catch (error) {
    if (attempt >= 2 || !String(error?.message).includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return captureWithinQuota(windowId, attempt + 1);
  }
}

/** Hides Keepall's own page UI for the capture so it never appears in the screenshot. */
async function captureVisiblePage(tab) {
  const hidden = await chrome.tabs.sendMessage(tab.id, { type: "screenshot-hide" }).then((reply) => reply?.hidden === true, () => false);
  try {
    return await captureWithinQuota(tab.windowId);
  } finally {
    if (hidden) await chrome.tabs.sendMessage(tab.id, { type: "screenshot-show" }).catch(() => {});
  }
}

async function saveScreenshot(tabId, record) {
  if (!record?.pageUrl) throw new Error("Screenshots can be added to saved pages only.");
  const tab = await chrome.tabs.get(tabId);
  if (!samePage(tab.url ?? "", record.pageUrl)) throw new Error("This page changed. Save it again to add screenshots.");
  if (!tab.active) throw new Error("Switch back to this tab to capture it.");
  let dataUrl;
  try {
    dataUrl = await captureVisiblePage(tab);
  } catch {
    throw new Error("Can't capture this page.");
  }
  const image = await encodeScreenshot(dataUrl);
  await ensureOffscreen(record.origin);
  const captureId = crypto.randomUUID();
  const result = await chrome.runtime.sendMessage({
    target: "offscreen", type: "capture-screenshot", origin: record.origin,
    payload: { captureId, itemId: record.itemId, url: record.pageUrl, mimeType: image.mimeType, width: image.width, height: image.height, data: base64Image(image.bytes) },
  });
  if (result?.error) throw new Error(result.error);
  if (result?.captureId !== captureId || result.itemId !== record.itemId || !Number.isInteger(result.count)) {
    throw new Error("Keepall did not confirm the screenshot. Try again.");
  }
  await requireLibraryAccess(record.origin);
  await notifyOpenKeepallTabs(record.origin).catch(() => {});
  return { success: true, count: result.count, limit: result.limit };
}

async function handleFeedbackAction(message, tabId) {
  const key = `save-feedback:${tabId}`;
  const record = (await chrome.storage.session.get(key))[key];
  if (!record || record.id !== message.actionId) throw new Error("This notification has expired. Open Keepall to find your item.");
  if (message.action === "open") {
    const url = `${record.origin}/items/${encodeURIComponent(record.itemId)}?from=%2F`;
    const tabs = await chrome.tabs.query({ url: `${record.origin}/*` });
    const library = tabs.find((tab) => tab.id && new URL(tab.url).pathname === "/")
      ?? tabs.find((tab) => tab.id && new URL(tab.url).pathname.startsWith("/items/"));
    if (library) {
      await chrome.tabs.update(library.id, { url, active: true });
      await chrome.windows.update(library.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url });
    }
    return { success: true };
  }
  if (message.action === "collections" || message.action === "move" || message.action === "tag") {
    return organizeCapture(message, record);
  }
  if (message.action === "screenshot") return saveScreenshot(tabId, record);
  if (message.action !== "undo" || !record.undoToken) throw new Error("This save cannot be undone from this notification.");
  await ensureOffscreen(record.origin);
  const captureId = crypto.randomUUID();
  const result = await chrome.runtime.sendMessage({
    target: "offscreen", type: "undo-capture", origin: record.origin,
    payload: { captureId, undoToken: record.undoToken },
  });
  if (result?.error) throw new Error(result.error);
  if (result?.captureId !== captureId || result.itemId !== record.itemId || result.undone !== true) {
    throw new Error("Keepall did not confirm Undo. Try again.");
  }
  await requireLibraryAccess(record.origin);
  await notifyOpenKeepallTabs(record.origin).catch(() => {});
  return { success: true };
}

async function organizeCapture(message, record) {
  const moving = message.action === "move";
  const tagging = message.action === "tag";
  if (moving && ((message.collectionId !== null && (typeof message.collectionId !== "string" || message.collectionId.length > 100)) ||
      (message.collectionName !== undefined && (message.collectionId !== null || typeof message.collectionName !== "string" || !message.collectionName.trim() || message.collectionName.length > 120)) ||
      !Array.isArray(message.expectedCollectionIds) || message.expectedCollectionIds.length > 1 ||
      !message.expectedCollectionIds.every((id) => typeof id === "string" && id.length <= 100))) {
    throw new Error("Choose a collection and try again.");
  }
  if (tagging) {
    const hasId = typeof message.tagId === "string" && message.tagId.length > 0 && message.tagId.length <= 100;
    const hasName = typeof message.tagName === "string" && message.tagName.trim().length > 0 && message.tagName.length <= 120;
    if (hasId === hasName || (hasName && message.assigned !== true) || typeof message.assigned !== "boolean" ||
        !Array.isArray(message.expectedTagIds) || message.expectedTagIds.length > 1000 ||
        !message.expectedTagIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 100)) {
      throw new Error("Choose a tag and try again.");
    }
  }
  await ensureOffscreen(record.origin);
  const captureId = crypto.randomUUID();
  const result = await chrome.runtime.sendMessage({
    target: "offscreen", type: tagging ? "tag-capture" : moving ? "move-capture" : "capture-collections", origin: record.origin,
    payload: { captureId, itemId: record.itemId, ...(moving ? {
      collectionId: message.collectionId, collectionName: message.collectionName, expectedCollectionIds: message.expectedCollectionIds,
    } : tagging ? {
      tagId: message.tagId, tagName: message.tagName, assigned: message.assigned, expectedTagIds: message.expectedTagIds,
    } : {}) },
  });
  if (result?.error) throw new Error(result.error);
  if (result?.captureId !== captureId || result.itemId !== record.itemId ||
      (moving ? typeof result.collectionName !== "string" || typeof result.changed !== "boolean" : tagging ?
        typeof result.tag?.id !== "string" || typeof result.tag?.name !== "string" || !Array.isArray(result.tagIds) || typeof result.changed !== "boolean" || typeof result.assigned !== "boolean" :
        !Array.isArray(result.collections) || !Array.isArray(result.collectionIds) || !Array.isArray(result.tags) || !Array.isArray(result.tagIds))) {
    throw new Error("Keepall did not confirm this action. Try again.");
  }
  await requireLibraryAccess(record.origin);
  if ((moving || tagging) && result.changed) await notifyOpenKeepallTabs(record.origin).catch(() => {});
  return { ...result, success: true };
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
  const feedback = (message, success, actions) => showFeedback(tab.id, message, success, options.source, options.editorId, actions);
  if (!tab?.id) return;
  if (!/^https?:\/\//i.test(tab.url ?? "")) {
    await feedback("This page cannot be saved to Keepall.", false);
    return;
  }

  try {
    if (options.source !== "editor") await showSaving(tab.id, "Saving to Keepall…");
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
    if (result.outcome === "created" || result.created) {
      message = options.source === "editor" ? "Saved to Keepall" : "Link saved to Keepall";
    }
    if (result.outcome === "updated") message = result.movedTo ? `Moved to ${result.movedTo}` : "Your changes were saved";
    if (result.outcome === "unchanged") message = "This link was already saved";
    // Only a page saved from this tab can be captured; right-clicked links and drawer saves cannot.
    const pageUrl = !options.source && !options.linkTarget ? payload.url : undefined;
    const actions = await captureFeedbackActions(tab.id, origin, result, pageUrl).catch(() => undefined);
    let success = true;
    if (options.screenshot) ({ message, success } = await screenshotAfterSave(tab.id, message, actions));
    await feedback(message, success, actions);
  } catch (error) {
    await feedback(error instanceof Error ? error.message : "Could not save to Keepall", false);
  }
}

async function screenshotAfterSave(tabId, savedMessage, actions) {
  try {
    if (!actions?.canScreenshot) throw new Error("Update Keepall to save screenshots.");
    const key = `save-feedback:${tabId}`;
    const { count } = await saveScreenshot(tabId, (await chrome.storage.session.get(key))[key]);
    return { message: count === 1 ? "Page and screenshot saved" : `Screenshot added (${count})`, success: true };
  } catch (error) {
    return { message: `${savedMessage}. Screenshot failed: ${error instanceof Error ? error.message : "Try again."}`, success: false };
  }
}

async function saveSelection(tab, info) {
  if (!tab?.id) return;
  try {
    const url = info.frameUrl || info.pageUrl || tab.url;
    if (!/^https?:\/\//i.test(url ?? "")) throw new Error("This page cannot be saved to Keepall.");
    const text = (await selectionWithLineBreaks(tab.id, info)).trim();
    if (text.length > 10000) throw new Error("This selection is too long. Select less text and try again.");
    await showSaving(tab.id, "Saving text to Keepall…");
    const origin = await keepallOrigin();
    await ensureOffscreen(origin);
    const captureId = crypto.randomUUID();
    const result = await chrome.runtime.sendMessage({
      target: "offscreen", type: "capture-selection", origin,
      payload: { captureId, url, title: info.frameUrl && info.frameUrl !== tab.url ? "" : (tab.title ?? "").slice(0, 500), text },
    });
    if (result?.error) throw new Error(result.error);
    if (result?.captureId !== captureId || typeof result.itemId !== "string") throw new Error("Keepall did not confirm the text save. Try again.");
    await requireLibraryAccess(origin);
    if (result.outcome !== "unchanged") await notifyOpenKeepallTabs(origin).catch(() => {});
    const actions = await captureFeedbackActions(tab.id, origin, result).catch(() => undefined);
    const message = result.outcome === "unchanged" ? "This text was already saved" : result.outcome === "updated" ? "Text added to your saved link" : "Text saved to Keepall";
    await showFeedback(tab.id, message, true, "toolbar", undefined, actions);
  } catch (error) {
    await showFeedback(tab.id, error.message || "Could not save this text to Keepall.", false);
  }
}

/**
 * Chrome flattens line breaks in selectionText. Read the same selection from
 * the clicked frame instead, and use it only when it holds exactly the same
 * words, so lists and paragraphs keep their lines without changing content.
 */
async function selectionWithLineBreaks(tabId, info) {
  const fallback = info.selectionText;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [info.frameId ?? 0] },
      func: () => String(globalThis.getSelection?.() ?? ""),
    });
    const text = typeof injection?.result === "string"
      ? injection.result.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
      : "";
    const words = (value) => value.replace(/\s+/g, " ").trim();
    return text && words(text) === words(fallback) ? text : fallback;
  } catch {
    return fallback;
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
  await saveTab({ ...tab, url: url.href }, { title: "", linkTarget: true });
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
  const bytes = await readLimited(response, MAX_IMAGE_BYTES, "Image must be 20 MiB or smaller.", "Image file is empty.");
  return { bytes, mimeType };
}

async function readLimited(response, maxBytes, tooLarge, empty) {
  if (Number(response.headers.get("content-length")) > maxBytes) throw new Error(tooLarge);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(tooLarge);
    }
    chunks.push(value);
  }
  if (!size) throw new Error(empty);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
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
  const feedback = (message, success, actions) => showFeedback(tab.id, message, success, "toolbar", undefined, actions);
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
    if (!await access) throw new Error(`Keepall needs permission for ${imageUrl.hostname} to save this image. Right-click it again and choose Allow, or allow all websites in settings.`);
    await showSaving(tab.id, "Saving image to Keepall…");
    const origin = await keepallOrigin();
    await ensureOffscreen(origin);
    const { bytes, mimeType } = await imageBytes(imageUrl.href);
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
    const actions = await captureFeedbackActions(tab.id, origin, result).catch(() => undefined);
    await feedback(result.outcome === "created" ? "Image saved to Keepall" : "This image was already saved", true, actions);
  } catch (error) {
    const message = error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name)
      ? "Could not download this image."
      : error instanceof Error ? error.message : "Could not save this image to Keepall.";
    await feedback(message, false);
  }
}

// Matches the web app's local video limit.
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Reads the container from the bytes, since video hosts often send a generic content type. */
function sniffVideo(bytes) {
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp") return { mimeType: "video/mp4", extension: "mp4" };
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { mimeType: "video/webm", extension: "webm" };
  return undefined;
}

function videoFileName(url, extension) {
  let base = "";
  try { base = decodeURIComponent(url.pathname.split("/").at(-1) ?? ""); } catch {}
  base = base.replace(/\.[^.]*$/, "").replace(/[\\/\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return `${base || "video"}.${extension}`;
}

/** Saves through the same chunked file transfer the drawer uses for local files, so no new bridge is needed. */
async function transferVideo(origin, tabId, manifest, bytes) {
  const editorId = crypto.randomUUID();
  const send = async (operation, payload) => {
    const result = await chrome.runtime.sendMessage({ target: "offscreen", type: "file-action", origin, editorId, tabId, operation, payload });
    if (!result?.success) throw new Error(result?.error || "Keepall did not confirm the video save.");
    return result;
  };
  const { sessionId } = await send("begin", manifest);
  for (let offset = 0; offset < bytes.length; offset += FILE_CHUNK_BYTES) {
    await send("chunk", { sessionId, fileIndex: 0, offset, data: base64Image(bytes.subarray(offset, offset + FILE_CHUNK_BYTES)) });
  }
  let status = await send("commit", { sessionId });
  const deadline = Date.now() + 120_000;
  while (status.stage === "saving") {
    if (Date.now() > deadline) throw new Error("Keepall is still saving this video. Check your library in a moment.");
    await new Promise((resolve) => setTimeout(resolve, 400));
    status = await send("status", { sessionId });
  }
  const saved = status.results?.[0];
  if (saved?.status !== "saved" || saved.itemId !== manifest.itemIds[0]) {
    throw new Error(saved?.status === "failed" && saved.error ? saved.error : "Could not save this video to Keepall.");
  }
  return saved.itemId;
}

const STREAMED_VIDEO = "This video streams in pieces, so Keepall can't save it as a file.";

/**
 * Runs in the page (MAIN world) to find file addresses behind a blob: video. Players that stream
 * through Media Source keep the real address in <source> tags, attributes, or React props.
 * Self-contained because Chrome serializes it. The page controls the answer, so every address is
 * still checked, permission-gated, and sniffed by the worker.
 */
function findVideoSources(blobUrl) {
  const video = [...document.querySelectorAll("video")].find((element) => element.currentSrc === blobUrl || element.src === blobUrl);
  if (!video) return [];
  const urls = new Set();
  const add = (value) => {
    if (urls.size < 20 && typeof value === "string" && value.length <= 2048 &&
        /^https?:\/\/[^\s"'<>]+\.(?:mp4|webm|m3u8)(?:[?#][^\s"'<>]*)?$/i.test(value)) urls.add(value);
  };
  for (const source of video.querySelectorAll("source")) add(source.src);
  for (const attribute of video.attributes) add(attribute.value);
  const key = Object.keys(video).find((name) => name.startsWith("__reactFiber$"));
  let fiber = key ? video[key] : undefined;
  // Players nest the address, such as Pinterest's src: [{ type, src }]. Look a few levels into
  // plain props, skipping DOM nodes and React elements, with a cap on how much is read.
  let budget = 2000;
  const scan = (value, level) => {
    if (--budget < 0) return;
    if (typeof value === "string") { add(value); return; }
    if (!value || typeof value !== "object" || level > 3 || value instanceof Node || value.$$typeof) return;
    let values = [];
    try { values = Array.isArray(value) ? value.slice(0, 20) : Object.values(value); } catch {}
    for (const nested of values) scan(nested, level + 1);
  };
  // Walk outward from the element, so the nearest player's props come first in a feed.
  for (let depth = 0; fiber && depth < 15; depth++, fiber = fiber.return) {
    if (fiber.memoizedProps && typeof fiber.memoizedProps === "object") scan(fiber.memoizedProps, 0);
  }
  return [...urls];
}

const isPlaylist = (url) => /\.m3u8$/i.test(url.pathname);

/**
 * Orders what to try for a video: direct files, then playlists. Pinterest publishes a 720p MP4
 * (with sound) beside many HLS streams, so that comes before its playlist.
 */
function videoDownloadCandidates(values) {
  const candidates = [];
  for (const value of values) {
    let url;
    try { url = new URL(value); } catch { continue; }
    // The page supplies these, so accept only video file addresses.
    if (!["http:", "https:"].includes(url.protocol) || !/\.(?:mp4|webm|m3u8)$/i.test(url.pathname)) continue;
    if (!isPlaylist(url)) { candidates.push(url.href); continue; }
    if (/(^|\.)pinimg\.com$/i.test(url.hostname) && url.pathname.includes("/hls/")) {
      const master = url.pathname.replace(/_(?:\d+w|audio)\.m3u8$/i, ".m3u8");
      candidates.push(`${url.origin}${master.replace("/hls/", "/720p/").replace(/\.m3u8$/i, ".mp4")}`, `${url.origin}${master}`);
    } else candidates.push(url.href);
  }
  return [...new Set(candidates)].sort((left, right) => Number(isPlaylist(new URL(left))) - Number(isPlaylist(new URL(right))));
}

async function streamedVideoCandidates(tab, blobUrl, frameId) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [frameId ?? 0] }, world: "MAIN", func: findVideoSources, args: [blobUrl],
    });
    const found = Array.isArray(injection?.result) ? injection.result.filter((value) => typeof value === "string") : [];
    return videoDownloadCandidates(found).map((value) => new URL(value));
  } catch {
    return [];
  }
}

/** After an await the click's gesture may be gone, so fall back to an existing grant. */
async function videoHostAccess(videoUrl, pageOrigin, request) {
  if (videoUrl.origin === pageOrigin) return true;
  if (request) return request;
  if (await chrome.permissions.contains({ origins: [`${videoUrl.origin}/*`] }).catch(() => false)) return true;
  return chrome.permissions.request({ origins: [`${videoUrl.origin}/*`] }).catch(() => false);
}

async function fetchVideoResponse(url, access) {
  try {
    const response = await fetch(url.href, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(120_000) });
    if (!response.ok || !response.body) throw new Error("Could not download this video.");
    return response;
  } catch (error) {
    // Without a grant, only hosts that allow cross-origin reads work.
    if (!access && error instanceof TypeError) {
      throw new Error(`Allow Keepall to access ${url.hostname}: in Keepall Capture options, choose Allow access to all websites, then try again.`);
    }
    throw error;
  }
}

async function fetchPlaylist(url, access) {
  const bytes = await readLimited(await fetchVideoResponse(url, access), 1024 * 1024, "This video playlist is too large.", "This video playlist is empty.");
  return new TextDecoder().decode(bytes);
}

/**
 * HLS that stores each track as one fragmented MP4 read by byte ranges (CMAF, as on Pinterest)
 * already has a playable file behind it. Pick the largest variant up to 1080p and return that
 * file. Streams split into many segment files are refused. Separate audio is left out.
 */
async function hlsVideoFile(playlistUrl, access) {
  let mediaUrl = playlistUrl;
  let media = await fetchPlaylist(playlistUrl, access);
  let silent = false;
  if (media.includes("#EXT-X-STREAM-INF")) {
    silent = /^#EXT-X-MEDIA:(?=[^\n]*TYPE=AUDIO)(?=[^\n]*URI=)/m.test(media);
    const lines = media.split(/\r?\n/).map((line) => line.trim());
    const variants = [];
    lines.forEach((line, index) => {
      if (!line.startsWith("#EXT-X-STREAM-INF:")) return;
      const uri = lines.slice(index + 1).find((next) => next && !next.startsWith("#"));
      // The shorter side, so portrait clips compare like landscape ones.
      const [, width = 0, height = 0] = line.match(/RESOLUTION=(\d+)x(\d+)/) ?? [];
      const size = Math.min(Number(width), Number(height));
      const bandwidth = Number(line.match(/[:,]BANDWIDTH=(\d+)/)?.[1] ?? 0);
      if (uri) variants.push({ uri, size, bandwidth });
    });
    const fitting = variants.filter((variant) => variant.size <= 1080);
    const [best] = (fitting.length ? fitting : variants).sort((left, right) => right.size - left.size || right.bandwidth - left.bandwidth);
    if (!best) throw new Error(STREAMED_VIDEO);
    mediaUrl = new URL(best.uri, playlistUrl);
    media = await fetchPlaylist(mediaUrl, access);
  }
  const map = media.match(/^#EXT-X-MAP:[^\n]*URI="([^"]+)"/m)?.[1];
  const segments = media.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  if (!map || !segments.length || segments.some((segment) => segment !== map)) throw new Error(STREAMED_VIDEO);
  const file = new URL(map, mediaUrl);
  if (file.origin !== playlistUrl.origin) throw new Error(STREAMED_VIDEO);
  return { url: file, silent };
}

async function downloadVideo(candidate, access) {
  const { url, silent } = isPlaylist(candidate) ? await hlsVideoFile(candidate, access) : { url: candidate, silent: false };
  const bytes = await readLimited(await fetchVideoResponse(url, access), MAX_VIDEO_BYTES, "Video must be 100 MiB or smaller.", "Video file is empty.");
  const type = sniffVideo(bytes);
  if (!type) throw new Error("Keepall can save MP4 or WebM videos. This one uses another format.");
  return { bytes, type, url, silent };
}

async function saveVideo(tab, srcUrl, context = {}) {
  if (!tab?.id) return;
  const feedback = (message, success, actions) => showFeedback(tab.id, message, success, "toolbar", undefined, actions);
  let sourcePage;
  let videoUrl;
  try {
    sourcePage = new URL(context.pageUrl ?? tab.url ?? "");
    if (!["http:", "https:"].includes(sourcePage.protocol)) throw new Error("This video cannot be saved to Keepall.");
    videoUrl = new URL(srcUrl ?? "");
    if (!["http:", "https:", "blob:"].includes(videoUrl.protocol)) throw new Error("Unsupported video address.");
  } catch {
    await feedback("This video cannot be saved to Keepall.", false);
    return;
  }

  // Request a CDN grant while the context-menu click is still active, as for images.
  const streamed = videoUrl.protocol === "blob:";
  const request = streamed || videoUrl.origin === sourcePage.origin
    ? undefined
    : chrome.permissions.request({ origins: [`${videoUrl.origin}/*`] });
  try {
    await showSaving(tab.id, "Saving video to Keepall…");
    const candidates = streamed ? await streamedVideoCandidates(tab, videoUrl.href, context.frameId) : [videoUrl];
    if (!candidates.length) throw new Error(STREAMED_VIDEO);
    let video;
    let failure;
    const grants = new Map();
    for (const candidate of candidates) {
      if (!grants.has(candidate.origin)) grants.set(candidate.origin, await videoHostAccess(candidate, sourcePage.origin, request));
      const access = grants.get(candidate.origin);
      if (!access && !streamed) { failure ??= new Error(`Keepall needs permission for ${new URL(candidate.origin).hostname} to save this video. Right-click it again and choose Allow, or allow all websites in settings.`); continue; }
      try {
        video = await downloadVideo(candidate, access);
        break;
      } catch (error) {
        // Keep the most useful reason: a missing grant or a size limit beats a missing alternative.
        if (!failure || failure.message === STREAMED_VIDEO || failure.message === "Could not download this video.") failure = error;
      }
    }
    if (!video) throw failure ?? new Error(STREAMED_VIDEO);
    const { bytes, type, url, silent } = video;
    const origin = await keepallOrigin();
    await ensureOffscreen(origin);
    const itemId = crypto.randomUUID();
    const title = (tab.title ?? "").trim().slice(0, 500);
    await transferVideo(origin, tab.id, {
      manifestId: crypto.randomUUID(),
      itemIds: [itemId],
      files: [{ name: videoFileName(url, type.extension), type: type.mimeType, size: bytes.length }],
      imageMode: "separate",
      organization: {},
      metadata: { ...(title ? { title } : {}), sourceUrl: sourcePage.href },
    }, bytes);
    await requireLibraryAccess(origin);
    await notifyOpenKeepallTabs(origin).catch(() => {});
    const actions = await captureFeedbackActions(tab.id, origin, { itemId, outcome: "created" }).catch(() => undefined);
    await feedback(silent ? "Video saved to Keepall without sound" : "Video saved to Keepall", true, actions);
  } catch (error) {
    const message = error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name)
      ? "Could not download this video."
      : error instanceof Error ? error.message : "Could not save this video to Keepall.";
    await feedback(message, false);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    void chrome.action.setTitle({ tabId, title: "Save page to Keepall" }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove([`save-feedback:${tabId}`, `file-editor:${tabId}`]);
});

chrome.action.onClicked.addListener((tab) => { void saveTab(tab); });

const FILE_CHUNK_BYTES = 256 * 1024;
const EDITOR_LIFETIME_MS = 10 * 60 * 1000;
function fileUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function pruneEditorSessions() {
  const all = await chrome.storage.session.get(null);
  const records = Object.entries(all).filter(([key]) => key.startsWith("file-editor:"));
  const expired = records.filter(([, value]) => !value || Date.now() - value.createdAt > EDITOR_LIFETIME_MS).map(([key]) => key);
  const active = records.filter(([key]) => !expired.includes(key)).sort((a, b) => b[1].createdAt - a[1].createdAt);
  expired.push(...active.slice(63).map(([key]) => key));
  if (expired.length) await chrome.storage.session.remove(expired);
}
async function handleEditorFileAction(message, sender) {
  if (!sender.tab?.id || (sender.frameId !== undefined && sender.frameId !== 0) || !fileUuid(message.editorId)) throw new Error("This file editor is not registered. Reopen it and try again.");
  const key = `file-editor:${sender.tab.id}`;
  const record = (await chrome.storage.session.get(key))[key];
  if (!record || record.editorId !== message.editorId || record.tabId !== sender.tab.id || Date.now() - record.createdAt > EDITOR_LIFETIME_MS) throw new Error("This file editor has expired. Reopen it and try again.");
  const operation = message.operation;
  if (!["begin", "chunk", "commit", "status", "cancel", "open-bulk-import", "open-results"].includes(operation)) throw new Error("Unsupported file action.");
  await requireLibraryAccess(record.origin);
  if (operation === "open-results") {
    const ids = message.payload?.actionIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(fileUuid)) throw new Error("Invalid saved-file action.");
    const actions = record.actions ?? {};
    if (ids.some(id => !actions[id] || Date.now() - actions[id].createdAt > EDITOR_LIFETIME_MS)) throw new Error("This saved-file action has expired.");
    const itemIds = [...new Set(ids.flatMap(id => actions[id].itemIds))];
    const url = itemIds.length === 1 ? `${record.origin}/items/${itemIds[0]}?from=%2F` : `${record.origin}/`;
    const tabs = await chrome.tabs.query({ url: `${record.origin}/*` });
    const root = tabs.find(tab => tab.id && new URL(tab.url).pathname === "/");
    if (root) {
      await chrome.tabs.update(root.id, { url, active: true });
      await chrome.windows.update(root.windowId, { focused: true });
    } else await chrome.tabs.create({ url });
    return { success: true };
  }
  if (operation === "open-bulk-import") {
    const url = `${record.origin}/#keepall-bulk-import=${crypto.randomUUID()}`;
    const tabs = await chrome.tabs.query({ url: `${record.origin}/*` });
    const root = tabs.find(tab => tab.id && new URL(tab.url).pathname === "/");
    if (root) {
      const destination = new URL(root.url);
      destination.hash = new URL(url).hash;
      await chrome.tabs.update(root.id, { url: destination.href, active: true });
      await chrome.windows.update(root.windowId, { focused: true });
    } else await chrome.tabs.create({ url });
    return { success: true };
  }
  let payload = message.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid file action.");
  if (operation === "begin") {
    if (payload.metadata !== undefined && (!payload.metadata || typeof payload.metadata !== "object" || Array.isArray(payload.metadata))) throw new Error("Invalid file metadata.");
    if (payload.metadata?.sourceUrl !== undefined && payload.metadata.sourceUrl !== record.sourceUrl) throw new Error("The file source does not match this editor.");
    payload = { ...payload, metadata: { ...payload.metadata, sourceUrl: record.sourceUrl } };
  } else if (!fileUuid(payload.sessionId)) throw new Error("Invalid file session.");
  if (operation === "chunk" && (typeof payload.data !== "string" || payload.data.length > Math.ceil(FILE_CHUNK_BYTES / 3) * 4 || !Number.isSafeInteger(payload.offset) || payload.offset < 0 || !Number.isSafeInteger(payload.fileIndex) || payload.fileIndex < 0 || payload.fileIndex >= 50)) throw new Error("Invalid file chunk.");
  await chrome.storage.session.set({ [key]: { ...record, createdAt: Date.now() } });
  await ensureOffscreen(record.origin);
  const result = await chrome.runtime.sendMessage({ target: "offscreen", type: "file-action", origin: record.origin, editorId: record.editorId, tabId: record.tabId, operation, payload });
  if (!result || typeof result.success !== "boolean") throw new Error("Keepall did not confirm this file action. Check status before retrying.");
  if (result.success && result.results?.some(item => item.status === "saved")) {
    const itemIds = [...new Set(result.results.filter(item => item.status === "saved" && fileUuid(item.itemId)).map(item => item.itemId))];
    if (itemIds.length) {
      const current = (await chrome.storage.session.get(key))[key];
      if (current?.editorId === record.editorId) {
        const actions = current.actions ?? {};
        const actionId = Object.keys(actions).find(id => actions[id].sessionId === result.sessionId) ?? crypto.randomUUID();
        actions[actionId] = { sessionId: result.sessionId, itemIds, createdAt: Date.now() };
        for (const id of Object.keys(actions).slice(0, Math.max(0, Object.keys(actions).length - 50))) delete actions[id];
        await chrome.storage.session.set({ [key]: { ...current, actions, createdAt: Date.now() } });
        result.actionId = actionId;
      }
    }
    await notifyOpenKeepallTabs(record.origin).catch(() => {});
  }
  return result;
}

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
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["drawer-styles.js", "note-preview.js", "file-capture.js", "org-picker.js", "page-ui.js"] });
  const editorId = crypto.randomUUID();
  const response = await chrome.tabs.sendMessage(tab.id, { type: "editor", editorId, origin, title: tab.title ?? "", url: tab.url, theme: await captureTheme() });
  if (!response?.accepted) return;
  await pruneEditorSessions();
  const key = `file-editor:${tab.id}`;
  const previous = (await chrome.storage.session.get(key))[key];
  const actions = previous?.origin === origin && previous?.sourceUrl === tab.url
    ? Object.fromEntries(Object.entries(previous.actions ?? {}).filter(([, action]) => Date.now() - action.createdAt <= EDITOR_LIFETIME_MS)) : {};
  await chrome.storage.session.set({ [key]: { tabId: tab.id, editorId, origin, sourceUrl: tab.url, actions, createdAt: Date.now() } });
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
  let activeTab = tab;
  void (async () => {
    activeTab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    await openEditor(activeTab);
  })().catch(() => {
    if (activeTab?.id !== undefined) void showFeedback(activeTab.id, "Keepall can't open on this page. Chrome blocks extensions here.", false, "badge");
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "editor-file-action") {
    void handleEditorFileAction(message, sender).then(sendResponse).catch(error => sendResponse({ success: false, error: error.message || "Could not complete this file action." }));
    return true;
  }
  if (message?.type === "open-options" && sender.tab?.id && ["general", "saving", "images"].includes(message.section)) {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${message.section}`) })
      .then(() => sendResponse({ success: true }), (error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (message?.type === "check-connection" && sender.url?.split("#")[0] === chrome.runtime.getURL("options.html")) {
    void checkLibraryConnection().then(sendResponse).catch(() => sendResponse({ success: false, reason: "unavailable" }));
    return true;
  }
  if (message?.type === "capture-feedback-action" && sender.tab?.id &&
      typeof message.actionId === "string" && ["open", "undo", "collections", "move", "tag", "screenshot"].includes(message.action)) {
    void handleFeedbackAction(message, sender.tab.id)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message || "Could not complete this action. Try again." }));
    return true;
  }
  if (message?.type !== "save-from-editor" || !sender.tab) return;
  sendResponse({ accepted: true });
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
