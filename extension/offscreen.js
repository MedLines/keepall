let frame;
let frameOrigin;
let frameReady;
let resolveReady;
let readyTimer;
const waiting = new Map();
const organizationWaiting = new Map();
const fileWaiting = new Map();
let fileTransferSupported = false;

function ensureFrame(origin) {
  if (frame && frameOrigin === origin) return frameReady;
  frame?.remove();
  clearTimeout(readyTimer);
  frameOrigin = origin;
  fileTransferSupported = false;
  frameReady = new Promise((resolve, reject) => {
    resolveReady = resolve;
    readyTimer = setTimeout(() => {
      if (!resolveReady) return;
      resolveReady = undefined;
      frame?.remove();
      frame = undefined;
      frameOrigin = undefined;
      reject(new Error("Keepall did not load"));
    }, 15000);
  });
  frame = document.createElement("iframe");
  frame.src = `${origin}/extension-bridge`;
  frame.hidden = true;
  document.body.append(frame);
  return frameReady;
}

window.addEventListener("message", (event) => {
  if (event.source !== frame?.contentWindow || event.origin !== frameOrigin) return;
  if (event.data?.channel !== "keepall-extension") return;
  if (event.data.type === "ready") {
    clearTimeout(readyTimer);
    fileTransferSupported = event.data.capabilities?.includes("file-transfer-v1") === true;
    resolveReady?.();
    resolveReady = undefined;
    return;
  }
  if (event.data.type === "file-result" && typeof event.data.requestId === "string") fileWaiting.get(event.data.requestId)?.(event.data);
  if (event.data.type === "result" && typeof event.data.captureId === "string") {
    waiting.get(event.data.captureId)?.resolve(event.data);
  }
  if (event.data.type === "organizations" && typeof event.data.requestId === "string") {
    organizationWaiting.get(event.data.requestId)?.resolve(event.data);
  }
});

async function capture(origin, payload, type = "capture") {
  await ensureFrame(origin);
  if (waiting.has(payload.captureId)) return waiting.get(payload.captureId).promise;
  let finish;
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(payload.captureId);
      reject(new Error("Keepall did not confirm the save"));
    }, type === "capture-image" ? 45000 : 15000);
    finish = (result) => {
      clearTimeout(timer);
      waiting.delete(payload.captureId);
      resolve(result);
    };
  });
  waiting.set(payload.captureId, { promise, resolve: finish });
  frame.contentWindow.postMessage({ channel: "keepall-extension", type, payload }, origin);
  return promise;
}

async function organizations(origin, url) {
  await ensureFrame(origin);
  const requestId = crypto.randomUUID();
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      organizationWaiting.delete(requestId);
      reject(new Error("Keepall did not load collections and tags"));
    }, 15000);
    organizationWaiting.set(requestId, {
      resolve(result) {
        clearTimeout(timer);
        organizationWaiting.delete(requestId);
        resolve(result);
      },
    });
  });
  frame.contentWindow.postMessage({ channel: "keepall-extension", type: "organizations", requestId, url }, origin);
  return promise;
}

function imageCapture(origin, payload) {
  const binary = atob(payload.data);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return capture(origin, {
    captureId: payload.captureId,
    sourcePageUrl: payload.sourcePageUrl,
    mimeType: payload.mimeType,
    bytes,
  }, "capture-image");
}

async function fileAction(message) {
  await ensureFrame(message.origin);
  if (!fileTransferSupported) throw new Error("This Keepall app does not support local file capture yet. Deploy the matching app version, then reload the extension.");
  if (fileWaiting.size >= 8) throw new Error("Wait for the previous file action before continuing.");
  let payload = message.payload;
  const transfer = [];
  if (message.operation === "chunk") {
    const data = payload?.data;
    if (typeof data !== "string" || data.length === 0 || data.length > Math.ceil(256 * 1024 / 3) * 4 || data.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw new Error("Invalid file chunk encoding.");
    const binary = atob(data);
    if (binary.length > 256 * 1024) throw new Error("File chunk exceeds 256 KiB.");
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0)).buffer;
    payload = { sessionId: payload.sessionId, fileIndex: payload.fileIndex, offset: payload.offset, bytes };
    transfer.push(bytes);
  }
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      fileWaiting.delete(requestId);
      reject(new Error("Keepall did not confirm this file action. Check status, then retransmit the same IDs if the session expired."));
    }, 15000);
    fileWaiting.set(requestId, result => { clearTimeout(timer); fileWaiting.delete(requestId); resolve(result); });
    try {
      frame.contentWindow.postMessage({ channel: "keepall-extension", type: "file-action", requestId, editorId: message.editorId, tabId: message.tabId, operation: message.operation, payload }, message.origin, transfer);
    } catch (error) { clearTimeout(timer); fileWaiting.delete(requestId); reject(error); }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return;
  if (message.type === "file-action") {
    if (_sender.tab || _sender.id !== chrome.runtime.id) { sendResponse({ success: false, error: "Untrusted file action sender." }); return; }
    void fileAction(message).then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  const operation = ["capture", "capture-selection", "undo-capture", "capture-collections", "move-capture", "tag-capture"].includes(message.type)
    ? capture(message.origin, message.payload, message.type)
    : message.type === "organizations"
      ? organizations(message.origin, message.url)
      : message.type === "capture-image"
        ? imageCapture(message.origin, message.payload)
        : null;
  if (!operation) return;
  operation
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ error: error.message, retryable: true }));
  return true;
});
