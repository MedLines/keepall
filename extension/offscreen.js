let frame;
let frameOrigin;
let frameReady;
let resolveReady;
const waiting = new Map();

function ensureFrame(origin) {
  if (frame && frameOrigin === origin) return frameReady;
  frame?.remove();
  frameOrigin = origin;
  frameReady = new Promise((resolve, reject) => {
    resolveReady = resolve;
    setTimeout(() => reject(new Error("Keepall did not load")), 15000);
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
    resolveReady?.();
    resolveReady = undefined;
    return;
  }
  if (event.data.type === "result" && typeof event.data.captureId === "string") {
    waiting.get(event.data.captureId)?.(event.data);
  }
});

async function capture(origin, payload) {
  await ensureFrame(origin);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(payload.captureId);
      reject(new Error("Keepall did not confirm the save"));
    }, 15000);
    waiting.set(payload.captureId, (result) => {
      clearTimeout(timer);
      waiting.delete(payload.captureId);
      resolve(result);
    });
    frame.contentWindow.postMessage({ channel: "keepall-extension", type: "capture", payload }, origin);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.type !== "capture") return;
  capture(message.origin, message.payload)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ error: error.message }));
  return true;
});
