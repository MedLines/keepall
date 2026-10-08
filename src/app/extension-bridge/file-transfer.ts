import { captureRecord, isUuid, MAX_TRANSFER_BYTES, MAX_TRANSFER_CHUNK_BYTES, TRANSFER_TTL_MS, validateFileManifest, type ExtensionFileManifest, type ExtensionFileResult, type ExtensionTransferStatus } from "@/domain/extension-file-capture";
import type { ExtensionCaptureOptions } from "@/persistence/extension-file-capture";

type Session = {
  owner: string; manifest: ExtensionFileManifest; status: ExtensionTransferStatus;
  bytes: Uint8Array[]; offsets: number[]; controller: AbortController; touched: number;
};
type Save = (manifest: ExtensionFileManifest, bytes: Uint8Array[], options: Pick<ExtensionCaptureOptions, "signal" | "onResult" | "onStage">) => Promise<ExtensionFileResult[]>;

/** Created after mount. All uploaded bytes stay in this trusted frame. */
export function createFileTransfer(save: Save) {
  const sessions = new Map<string, Session>();
  function prune() {
    for (const [id, session] of sessions) {
      if (Date.now() - session.touched <= TRANSFER_TTL_MS) continue;
      session.controller.abort(); session.bytes = []; sessions.delete(id);
    }
  }
  const timer = setInterval(prune, 30_000);
  function get(owner: string, id: unknown) {
    prune();
    const session = isUuid(id) ? sessions.get(id) : undefined;
    if (!session || session.owner !== owner) throw new Error("Unknown or expired file session. Retransmit the same manifest and item IDs.");
    session.touched = Date.now();
    return session;
  }
  function snapshot(session: Session): ExtensionTransferStatus {
    return { ...session.status, results: session.status.results.map(result => ({ ...result })) };
  }
  function status(owner: string, id: unknown) { return snapshot(get(owner, id)); }
  function begin(owner: string, input: unknown) {
    prune();
    const manifest = validateFileManifest(input);
    for (const session of sessions.values()) {
      if (session.owner !== owner || session.manifest.manifestId !== manifest.manifestId) continue;
      if (JSON.stringify(session.manifest) !== JSON.stringify(manifest)) throw new Error("This frozen manifest changed. Start a new transfer with new IDs.");
      session.touched = Date.now(); return snapshot(session);
    }
    const active = [...sessions.values()].filter(session => session.status.stage === "receiving" || session.status.stage === "saving");
    if (active.length >= 4) throw new Error("Too many active file sessions. Finish or cancel another transfer.");
    const completed = [...sessions.values()].filter(session => session.status.stage === "complete" || session.status.stage === "cancelled").sort((a, b) => a.touched - b.touched);
    for (const session of completed.slice(0, Math.max(0, completed.length - 31))) sessions.delete(session.status.sessionId);
    const totalBytes = manifest.files.reduce((sum, file) => sum + file.size, 0);
    const reserved = [...sessions.values()].reduce((sum, session) => sum + (session.bytes.length ? session.status.totalBytes : 0), 0);
    if (reserved + totalBytes > MAX_TRANSFER_BYTES) throw new Error("Active transfers exceed 200 MiB. Finish or cancel another transfer.");
    const sessionId = crypto.randomUUID();
    const session: Session = { owner, manifest, controller: new AbortController(), touched: Date.now(),
      bytes: manifest.files.map(file => new Uint8Array(file.size)), offsets: manifest.files.map(() => 0),
      status: { sessionId, stage: "receiving", receivedBytes: 0, totalBytes, results: [] } };
    sessions.set(sessionId, session); return snapshot(session);
  }
  function chunk(owner: string, value: unknown) {
    const input = captureRecord(value);
    const session = get(owner, input.sessionId);
    if (session.status.stage !== "receiving") throw new Error("This session is no longer receiving files.");
    const index = input.fileIndex as number; const offset = input.offset as number;
    if (!Number.isSafeInteger(index) || index < 0 || index >= session.bytes.length || !Number.isSafeInteger(offset) || offset < 0 || !(input.bytes instanceof ArrayBuffer) || input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_TRANSFER_CHUNK_BYTES) throw new Error("Invalid file chunk.");
    const bytes = new Uint8Array(input.bytes); const target = session.bytes[index];
    if (offset + bytes.length > target.length || offset > session.offsets[index]) throw new Error("File chunk exceeds the size or skips an offset.");
    if (offset < session.offsets[index]) {
      if (offset + bytes.length > session.offsets[index] || bytes.some((byte, position) => target[offset + position] !== byte)) throw new Error("File chunk has conflicting replay bytes.");
      return snapshot(session);
    }
    if (session.offsets.some((received, position) => position < index && received !== session.manifest.files[position].size)) throw new Error("Upload files in manifest order.");
    target.set(bytes, offset); session.offsets[index] += bytes.length; session.status.receivedBytes += bytes.length;
    return snapshot(session);
  }
  function commit(owner: string, id: unknown) {
    const session = get(owner, id);
    if (session.status.stage !== "receiving") return snapshot(session);
    if (session.status.receivedBytes !== session.status.totalBytes) throw new Error("File transfer is incomplete.");
    session.status.stage = "saving";
    void Promise.resolve().then(() => save(session.manifest, session.bytes, {
      signal: session.controller.signal,
      onResult: result => { session.status.results.push(result); session.touched = Date.now(); },
      onStage: (processing, fileIndex) => { session.status.processing = processing; session.status.fileIndex = fileIndex; session.touched = Date.now(); },
    })).then(results => { session.status.results = results; }).catch(error => {
      session.status.results = session.manifest.files.map((file, fileIndex) => session.status.results.find(result => result.fileIndex === fileIndex) ?? {
        fileIndex, fileName: file.name, ...(session.controller.signal.aborted ? { status: "cancelled" as const } : { status: "failed" as const, error: error instanceof Error ? error.message : "Could not save this file." }),
      });
    }).finally(() => {
      session.bytes = [];
      session.status.stage = session.controller.signal.aborted ? "cancelled" : "complete";
      delete session.status.processing; delete session.status.fileIndex;
      session.touched = Date.now();
    });
    return snapshot(session);
  }
  function cancel(owner: string, id: unknown) {
    const session = get(owner, id);
    if (session.status.stage === "complete" || session.status.stage === "cancelled") return snapshot(session);
    session.controller.abort();
    // A write already committed may still be reporting its result. Let it finish.
    if (session.status.stage === "receiving") {
      session.bytes = []; session.status.stage = "cancelled";
      session.status.results = session.manifest.files.map((file, fileIndex) => ({ fileIndex, fileName: file.name, status: "cancelled" }));
    }
    return snapshot(session);
  }
  return { begin, chunk, commit, status, cancel,
    dispose() { clearInterval(timer); for (const session of sessions.values()) { session.controller.abort(); session.bytes = []; } sessions.clear(); },
    handle(owner: string, operation: unknown, payload: unknown) {
      if (operation === "begin") return begin(owner, payload);
      if (operation === "chunk") return chunk(owner, payload);
      const { sessionId } = captureRecord(payload);
      if (operation === "commit") return commit(owner, sessionId);
      if (operation === "status") return status(owner, sessionId);
      if (operation === "cancel") return cancel(owner, sessionId);
      throw new Error("Unsupported file action.");
    },
  };
}
