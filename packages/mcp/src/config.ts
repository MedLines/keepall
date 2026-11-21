import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fromBase64Url, isChannelId, parseSetupCode, setupCodePairKey, toBase64Url, type Bytes } from "../../../src/domain/agent-protocol.ts";

export type Pairing = { relayUrl: string; appOrigin: string; channelId: string; pairKey: Bytes };

// Spike defaults point at local development. Production values come with the deployed relay.
export const relayUrl = () => process.env.KEEPALL_RELAY_URL ?? "http://localhost:8787";
export const appOrigin = () => process.env.KEEPALL_APP_ORIGIN ?? "http://localhost:3000";

export function configPath() {
  if (process.env.KEEPALL_AGENT_CONFIG) return process.env.KEEPALL_AGENT_CONFIG;
  const base = process.platform === "win32"
    ? process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming")
    : process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config");
  return path.join(base, "keepall", "agent.json");
}

/** A setup code from `--code <code>` or KEEPALL_CODE. Made in Keepall under Settings, Agents. */
export function setupCodeText(argv: readonly string[] = process.argv): string | undefined {
  const index = argv.indexOf("--code");
  return (index >= 0 ? argv[index + 1] : undefined) ?? process.env.KEEPALL_CODE;
}

/** Command-line arguments with the setup code taken out, so commands still parse. */
export function commandArgs(argv: readonly string[] = process.argv): string[] {
  const args = argv.slice(2);
  const index = args.indexOf("--code");
  if (index >= 0) args.splice(index, 2);
  return args;
}

export async function loadPairing(): Promise<Pairing | null> {
  const codeText = setupCodeText();
  if (codeText) {
    const code = parseSetupCode(codeText);
    if (!code) throw new Error("That Keepall setup code isn't valid. Copy it again from Keepall: Settings, Agents.");
    return { relayUrl: code.relayUrl, appOrigin: code.appOrigin, channelId: code.channelId, pairKey: await setupCodePairKey(code) };
  }
  let text: string;
  try {
    text = await readFile(configPath(), "utf8");
  } catch {
    return null;
  }
  const value = JSON.parse(text) as Record<string, unknown>;
  if (value.version !== 1 || typeof value.relayUrl !== "string" || typeof value.appOrigin !== "string" ||
      !isChannelId(value.channelId) || typeof value.pairKey !== "string") {
    throw new Error(`Keepall pairing file is damaged: ${configPath()}. Delete it and pair again.`);
  }
  return { relayUrl: value.relayUrl, appOrigin: value.appOrigin, channelId: value.channelId, pairKey: fromBase64Url(value.pairKey, 32) };
}

/** The pair key is the only secret on disk. Only the user can read the file. */
export async function savePairing(pairing: Pairing) {
  const file = configPath();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const body = { version: 1, relayUrl: pairing.relayUrl, appOrigin: pairing.appOrigin, channelId: pairing.channelId, pairKey: toBase64Url(pairing.pairKey) };
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
}

export async function deletePairing() {
  await rm(configPath(), { force: true });
}
