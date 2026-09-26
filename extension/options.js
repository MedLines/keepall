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
const destination = document.querySelector("#library-destination");
const connectionStatus = document.querySelector("#connection-status");
const connectionCheck = document.querySelector("#connection-check");
let savedOrigin = PRODUCTION_ORIGIN;
let connectionRevision = 0;
let restoringLibraryAccess = false;

function normalizeOrigin(origin) {
  return typeof origin === "string" && /^http:\/\/localhost:\d{2,5}$/.test(origin) ? origin : PRODUCTION_ORIGIN;
}

function setDestination(origin) {
  savedOrigin = normalizeOrigin(origin);
  destination.textContent = savedOrigin === PRODUCTION_ORIGIN ? "keepall.app" : `Local library · ${savedOrigin}`;
  libraryLink.href = `${savedOrigin}/`;
  connectionRevision++;
  connectionStatus.textContent = "Not checked yet";
  connectionStatus.dataset.state = "idle";
  connectionCheck.disabled = false;
  connectionCheck.textContent = "Check connection";
}

async function checkConnection() {
  const revision = ++connectionRevision;
  connectionCheck.disabled = true;
  connectionStatus.textContent = "Checking your library…";
  connectionStatus.dataset.state = "checking";
  try {
    const result = await chrome.runtime.sendMessage({ type: "check-connection" });
    if (revision !== connectionRevision) return;
    if (result?.origin && result.origin !== savedOrigin) return;
    connectionStatus.dataset.state = result?.success ? "success" : "error";
    connectionStatus.textContent = result?.success ? "Connected to your library." : result?.reason === "access"
      ? "Library access is missing. Choose Restore library access below."
      : savedOrigin === PRODUCTION_ORIGIN ? "Could not reach Keepall. Open your library, then try again."
        : "Could not reach your local library. Check that it is running, then try again.";
    connectionCheck.textContent = result?.success ? "Check again" : "Try again";
    await refreshLibraryAccess();
  } catch {
    if (revision !== connectionRevision) return;
    connectionStatus.textContent = "Could not check the connection. Try again.";
    connectionStatus.dataset.state = "error";
    connectionCheck.textContent = "Try again";
  } finally {
    if (revision === connectionRevision) connectionCheck.disabled = false;
  }
}
connectionCheck.addEventListener("click", () => { void checkConnection(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.origin) {
    setDestination(changes.origin.newValue);
    void refreshLibraryAccess();
  }
});
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
  const origin = savedOrigin;
  const connected = await chrome.permissions.contains({ origins: [`${new URL(origin).protocol}//${new URL(origin).hostname}/*`] });
  if (origin !== savedOrigin || restoringLibraryAccess) return;
  libraryAccessRestore.hidden = connected;
  libraryAccessStatus.hidden = connected;
  libraryAccessStatus.textContent = connected ? "" : "The extension has lost access to your library. Restore it before saving.";
  libraryAccessStatus.dataset.state = connected ? "success" : "error";
  libraryAccessRestore.disabled = false;
  if (!connected) {
    connectionRevision++;
    connectionStatus.textContent = "Library access is missing. Choose Restore library access below.";
    connectionStatus.dataset.state = "access";
    connectionCheck.disabled = false;
    connectionCheck.textContent = "Check connection";
  } else if (connectionStatus.dataset.state === "access") {
    setDestination(savedOrigin);
  }
}

async function restoreLibraryAccess() {
  restoringLibraryAccess = true;
  libraryAccessRestore.disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: [`*://${new URL(savedOrigin).hostname}/*`] });
    if (!granted) throw new Error("Allow library access to connect Keepall.");
    await resetCaptureBridge();
    await refreshLibraryAccess();
    await checkConnection();
  } catch (error) {
    libraryAccessStatus.hidden = false;
    libraryAccessStatus.textContent = error instanceof Error ? error.message : "Could not restore library access.";
    libraryAccessStatus.dataset.state = "error";
  } finally {
    restoringLibraryAccess = false;
    await refreshLibraryAccess();
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
  setDestination(input.value);
  void refreshLibraryAccess();
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
    setDestination(origin);
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = "error";
  }
});


const themeInputs = [...document.querySelectorAll('input[name="theme"]')];
const themeStatus = document.querySelector("#theme-status");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let themePreference = "system";
let themeRevision = 0;
function applyTheme(preference) {
  themePreference = ["light", "dark"].includes(preference) ? preference : "system";
  document.documentElement.dataset.theme = themePreference === "system" ? (systemTheme.matches ? "dark" : "light") : themePreference;
  for (const input of themeInputs) input.checked = input.value === themePreference;
}
systemTheme.addEventListener("change", () => applyTheme(themePreference));
chrome.storage.local.get("theme").then(({ theme }) => {
  if (!themeRevision) applyTheme(theme);
}).catch(() => {
  themeStatus.textContent = "Could not load your appearance preference. Choose it again below.";
  themeStatus.dataset.state = "error";
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.theme) applyTheme(changes.theme.newValue);
});
for (const input of themeInputs) input.addEventListener("change", async () => {
  if (!input.checked) return;
  const previous = themePreference;
  const revision = ++themeRevision;
  applyTheme(input.value);
  themeStatus.textContent = "";
  try {
    await chrome.storage.local.set({ theme: input.value });
    if (revision !== themeRevision) return;
    themeStatus.textContent = "Appearance saved.";
    themeStatus.dataset.state = "success";
  } catch {
    if (revision !== themeRevision) return;
    applyTheme(previous);
    themeStatus.textContent = "Could not save your appearance. Try again.";
    themeStatus.dataset.state = "error";
  }
});
