const EXTENSION_IDS = ["flmcadkppebdjebeiiellmeldfbckppo", "ehloefgfecmfjbncknaoleakbnjhkpea"];
const EXTENSION_REPLY_MS = 3_000;

type ChromeRuntime = { sendMessage(extensionId: string, message: unknown): Promise<unknown> };

/**
 * Asks Keepall Capture to load its hidden bridge, which answers agents without a tab open. Resolves true when an
 * installed extension that points at this address agreed. Chrome only exposes `runtime` here when one is installed.
 */
export async function wakeExtensionBridge(): Promise<boolean> {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage) return false;
  const replies = EXTENSION_IDS.map((id) => runtime.sendMessage(id, { type: "agent-host" })
    .then((reply) => (reply as { ok?: unknown } | undefined)?.ok === true, () => false));
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), EXTENSION_REPLY_MS));
  return Promise.race([Promise.all(replies).then((results) => results.includes(true)), timeout]);
}
