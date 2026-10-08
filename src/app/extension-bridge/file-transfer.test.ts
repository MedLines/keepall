import { expect, test, vi } from "vitest";
import { createFileTransfer } from "./file-transfer";
import { TRANSFER_TTL_MS, type ExtensionFileManifest } from "@/domain/extension-file-capture";
const manifest = (): ExtensionFileManifest => ({ manifestId: crypto.randomUUID(), itemIds: [crypto.randomUUID()], files: [{ name: "a.txt", type: "text/plain", size: 3 }], imageMode: "separate", organization: {} });
const owner = "tab:1:editor";
function setup() { const save = vi.fn(async (input: ExtensionFileManifest) => [{ fileIndex: 0, fileName: "a.txt", status: "saved" as const, itemId: input.itemIds[0] }]); return { save, transfer: createFileTransfer(save) }; }
test("acknowledges identical replay and rejects gaps, conflicting bytes and cross-editor access", () => {
  const { transfer } = setup(); const { sessionId } = transfer.begin(owner, manifest());
  const bytes = new Uint8Array([1, 2]).buffer;
  expect(transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes }).receivedBytes).toBe(2);
  expect(transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes }).receivedBytes).toBe(2);
  expect(() => transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes: new Uint8Array([3]).buffer })).toThrow("conflicting");
  expect(() => transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 3, bytes })).toThrow();
  expect(() => transfer.status("another", sessionId)).toThrow("Unknown");
  expect(() => transfer.commit(owner, sessionId)).toThrow("incomplete");
  transfer.dispose();
});
test("commit returns immediately and status recovers a lost reply without saving twice", async () => {
  const { transfer, save } = setup(); const input = manifest();
  const { sessionId } = transfer.begin(owner, input);
  expect(transfer.begin(owner, input).sessionId).toBe(sessionId);
  transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes: new Uint8Array([1, 2, 3]).buffer });
  expect(transfer.commit(owner, sessionId).stage).toBe("saving");
  transfer.commit(owner, sessionId);
  await vi.waitFor(() => expect(transfer.status(owner, sessionId).stage).toBe("complete"));
  expect(save).toHaveBeenCalledTimes(1);
  expect(transfer.status(owner, sessionId).results[0]).toMatchObject({ status: "saved", itemId: input.itemIds[0] });
  transfer.dispose();
});
test("cancel drops pending bytes and expired sessions allow retransmitting frozen IDs", () => {
  vi.useFakeTimers();
  const { transfer } = setup(); const input = manifest(); const { sessionId } = transfer.begin(owner, input);
  expect(transfer.cancel(owner, sessionId).stage).toBe("cancelled");
  expect(transfer.status(owner, sessionId).results[0].status).toBe("cancelled");
  vi.advanceTimersByTime(TRANSFER_TTL_MS + 60_000);
  expect(() => transfer.status(owner, sessionId)).toThrow("expired");
  expect(transfer.begin(owner, input).sessionId).not.toBe(sessionId);
  transfer.dispose(); vi.useRealTimers();
});
test("bounds concurrent reserved memory before allocating and rejects changed frozen manifests", () => {
  const { transfer } = setup(); const input = manifest(); transfer.begin(owner, input);
  expect(() => transfer.begin(owner, { ...input, metadata: { title: "Changed" } })).toThrow("manifest");
  for (let index = 1; index < 4; index++) transfer.begin(owner, manifest());
  expect(() => transfer.begin(owner, manifest())).toThrow("Too many");
  transfer.dispose();
});

test("cancellation waits for an in-flight write outcome and keeps saved results", async () => {
  const input = manifest();
  let finish!: (results: import("@/domain/extension-file-capture").ExtensionFileResult[]) => void;
  const transfer = createFileTransfer(async (_manifest, _bytes, options) => {
    expect(options.signal?.aborted).toBe(false);
    return new Promise(resolve => { finish = resolve; });
  });
  const { sessionId } = transfer.begin(owner, input);
  transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes: new Uint8Array([1, 2, 3]).buffer });
  transfer.commit(owner, sessionId);
  await Promise.resolve();
  expect(transfer.cancel(owner, sessionId).stage).toBe("saving");
  finish([{ fileIndex: 0, fileName: "a.txt", status: "saved", itemId: input.itemIds[0] }]);
  await vi.waitFor(() => expect(transfer.status(owner, sessionId).stage).toBe("cancelled"));
  expect(transfer.status(owner, sessionId).results[0].status).toBe("saved");
  transfer.dispose();
});

test("enforces exact file order, sizes and chunk bounds", () => {
  const { transfer } = setup(); const input = manifest();
  input.files.push({ name: "b.txt", type: "", size: 1 }); input.itemIds.push(crypto.randomUUID());
  const { sessionId } = transfer.begin(owner, input);
  expect(() => transfer.chunk(owner, { sessionId, fileIndex: 1, offset: 0, bytes: new Uint8Array([1]).buffer })).toThrow("order");
  expect(() => transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes: new Uint8Array(256 * 1024 + 1).buffer })).toThrow("Invalid");
  expect(() => transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes: new Uint8Array(4).buffer })).toThrow("exceeds");
  transfer.dispose();
});

test("completed and cancelled sessions never exhaust the active session limit", async () => {
  const { transfer } = setup();
  let firstId = "";
  for (let index = 0; index < 40; index++) {
    const { sessionId } = transfer.begin(owner, manifest());
    if (index === 0) firstId = sessionId;
    if (index % 2 === 0) transfer.cancel(owner, sessionId);
    else {
      transfer.chunk(owner, { sessionId, fileIndex: 0, offset: 0, bytes: new Uint8Array([1, 2, 3]).buffer });
      transfer.commit(owner, sessionId);
      await vi.waitFor(() => expect(transfer.status(owner, sessionId).stage).toBe("complete"));
    }
  }
  expect(() => transfer.status(owner, firstId)).toThrow("expired");
  expect(transfer.begin(owner, manifest()).stage).toBe("receiving");
  transfer.dispose();
});
