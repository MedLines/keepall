const form = document.querySelector("#settings");
const input = document.querySelector("#origin");
const status = document.querySelector("#status");
const libraryLink = document.querySelector("#library-link");
const imageAccessEnable = document.querySelector("#image-access-enable");
const imageAccessManage = document.querySelector("#image-access-manage");
const imageAccessDefault = document.querySelector("#image-access-default");
const imageAccessBadge = document.querySelector("#image-access-badge");
const imageAccessStatus = document.querySelector("#image-access-status");
const PRODUCTION_ORIGIN = "https://www.keepall.app";
const libraryAccessRestore = document.querySelector("#library-access-restore");
const libraryAccessStatus = document.querySelector("#library-access-status");
const LIBRARY_HOSTS = { origins: ["https://www.keepall.app/*", "http://localhost/*"] };
const LIBRARY_RESTORE_HOSTS = { origins: ["*://www.keepall.app/*", "*://localhost/*"] };
const ALL_IMAGE_HOSTS = { origins: ["*://*/*"] };
const LEGACY_IMAGE_HOSTS = { origins: ["https://*/*", "http://*/*"] };
const shortcutValue = document.querySelector("#shortcut-value");
const shortcutState = document.querySelector("#shortcut-state");
const shortcutChange = document.querySelector("#shortcut-change");
const shortcutError = document.querySelector("#shortcut-error");
let shortcutRefresh = 0;

async function refreshShortcut() {
  const refresh = ++shortcutRefresh;
  try {
    const commands = await chrome.commands.getAll();
    if (refresh !== shortcutRefresh) return;
    const shortcut = commands.find((command) => command.name === "open-editor")?.shortcut?.trim() ?? "";
    shortcutValue.textContent = shortcut;
    shortcutValue.hidden = !shortcut;
    shortcutState.hidden = Boolean(shortcut);
    shortcutState.textContent = shortcut ? "" : "No shortcut set";
  } catch {
    if (refresh !== shortcutRefresh) return;
    shortcutValue.hidden = true;
    shortcutValue.textContent = "";
    shortcutState.hidden = false;
    shortcutState.textContent = "Could not check your shortcut";
  }
}

shortcutChange.addEventListener("click", async () => {
  shortcutError.hidden = true;
  shortcutChange.disabled = true;
  try {
    await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  } catch {
    shortcutError.textContent = "Open chrome://extensions/shortcuts in Chrome, then find Keepall Capture.";
    shortcutError.hidden = false;
  } finally {
    shortcutChange.disabled = false;
  }
});
void refreshShortcut();
window.addEventListener("focus", () => { void refreshShortcut(); });
chrome.tabs.onActivated.addListener(() => { void refreshShortcut(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshShortcut();
});

async function hasAllWebsiteAccess() {
  const [current, legacy] = await Promise.all([
    chrome.permissions.contains(ALL_IMAGE_HOSTS),
    chrome.permissions.contains(LEGACY_IMAGE_HOSTS),
  ]);
  return current || legacy;
}

async function resetCaptureBridge() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length) await chrome.offscreen.closeDocument();
}

async function refreshLibraryAccess() {
  const connected = await chrome.permissions.contains(LIBRARY_HOSTS);
  libraryAccessRestore.hidden = connected;
  libraryAccessStatus.hidden = connected;
  libraryAccessStatus.textContent = connected ? "" : "The extension has lost access to your library. Restore it before saving.";
  libraryAccessStatus.dataset.state = connected ? "success" : "error";
  libraryAccessRestore.disabled = false;
}

async function restoreLibraryAccess() {
  libraryAccessRestore.disabled = true;
  try {
    const granted = await chrome.permissions.request(LIBRARY_RESTORE_HOSTS);
    if (!granted) throw new Error("Allow library access to connect Keepall.");
    await resetCaptureBridge();
    await refreshLibraryAccess();
  } catch (error) {
    libraryAccessStatus.hidden = false;
    libraryAccessStatus.textContent = error instanceof Error ? error.message : "Could not restore library access.";
    libraryAccessStatus.dataset.state = "error";
  } finally {
    libraryAccessRestore.disabled = false;
  }
}

libraryAccessRestore.addEventListener("click", () => { void restoreLibraryAccess(); });
void refreshLibraryAccess().catch(() => {
  libraryAccessRestore.hidden = false;
  libraryAccessStatus.hidden = false;
  libraryAccessStatus.textContent = "Could not check library access. Try restoring it.";
  libraryAccessStatus.dataset.state = "error";
});

async function refreshImageAccess() {
  const granted = await hasAllWebsiteAccess();
  imageAccessEnable.disabled = granted;
  imageAccessEnable.textContent = granted ? "Access to all websites enabled" : "Allow access to all websites";
  imageAccessDefault.textContent = granted ? "Manage website access in Chrome below." : "Your current choice. No setup needed.";
  imageAccessBadge.textContent = granted ? "Enabled" : "Optional";
}

void refreshImageAccess().catch(() => {
  imageAccessDefault.textContent = "Could not check your current choice.";
  imageAccessStatus.textContent = "Could not read Chrome's permissions. Reload this page to try again.";
  imageAccessStatus.dataset.state = "error";
});

async function enableImageAccess() {
  imageAccessEnable.disabled = true;
  try {
    const granted = await chrome.permissions.request(ALL_IMAGE_HOSTS);
    imageAccessStatus.textContent = granted
      ? "You can now save images without repeated website permission requests."
      : "Access was not granted. You can still allow individual websites when saving images.";
    imageAccessStatus.dataset.state = granted ? "success" : "error";
  } catch (error) {
    imageAccessStatus.textContent = error instanceof Error ? error.message : "Could not enable image access. Try again.";
    imageAccessStatus.dataset.state = "error";
  } finally {
    await refreshAccessState();
  }
}

async function refreshAccessState() {
  await Promise.all([refreshImageAccess(), refreshLibraryAccess()]).catch(() => {
    imageAccessStatus.textContent = "Reload this page to check your current permissions.";
    imageAccessStatus.dataset.state = "error";
  });
}

imageAccessEnable.addEventListener("click", () => { void enableImageAccess(); });
imageAccessManage.addEventListener("click", () => {
  void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }).catch(() => {
    imageAccessStatus.textContent = "Open chrome://extensions, find Keepall Capture, and choose Details.";
    imageAccessStatus.dataset.state = "error";
  });
});
window.addEventListener("focus", () => { void refreshAccessState(); });
chrome.permissions.onAdded.addListener(() => { void refreshAccessState(); });
chrome.permissions.onRemoved.addListener(() => { void refreshAccessState(); });

chrome.storage.local.get("origin").then(({ origin }) => {
  input.value = origin === "https://keepall.app" ? PRODUCTION_ORIGIN : origin ?? PRODUCTION_ORIGIN;
  libraryLink.href = `${input.value}/`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let origin;
  try {
    const parsed = new URL(input.value);
    origin = parsed.origin === "https://keepall.app" ? PRODUCTION_ORIGIN : parsed.origin;
    if (parsed.href !== `${parsed.origin}/` ||
        (origin !== PRODUCTION_ORIGIN && !/^http:\/\/localhost:\d{2,5}$/.test(origin))) {
      throw new Error("Enter https://www.keepall.app or a local development address with a port.");
    }
    await chrome.storage.local.set({ origin });
    input.value = origin;
    status.textContent = "Address saved.";
    status.dataset.state = "success";
    libraryLink.href = `${origin}/`;
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = "error";
  }
});
