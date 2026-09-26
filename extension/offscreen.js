let frame;
let frameOrigin;
let frameReady;
let resolveReady;
let readyTimer;
const waiting = new Map();
const organizationWaiting = new Map();

function ensureFrame(origin) {
  if (frame && frameOrigin === origin) return frameReady;
  frame?.remove();
  clearTimeout(readyTimer);
  frameOrigin = origin;
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
    resolveReady?.();
    resolveReady = undefined;
    return;
  }
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return;
  const operation = message.type === "capture" || message.type === "undo-capture"
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
