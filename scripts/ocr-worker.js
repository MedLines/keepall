/* A parent worker makes initialization and recognition cancellable together. */
/* global importScripts, Tesseract */
importScripts("tesseract.min.js");
self.onmessage = async ({ data: bytes }) => {
  let engine;
  try {
    const base = new URL(".", self.location.href).href.replace(/\/$/, "");
    engine = await Tesseract.createWorker("eng", 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: base,
      langPath: base,
      workerBlobURL: false,
      cachePath: "keepall-ocr-7.0.0",
      logger: message => self.postMessage({ type: "progress", status: message.status, progress: message.progress }),
      errorHandler: error => self.postMessage({ type: "error", message: String(error) }),
    });
    const { data } = await engine.recognize(bytes);
    self.postMessage({ type: "result", text: data.text, confidence: data.confidence });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  } finally {
    await engine?.terminate();
  }
};
