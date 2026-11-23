// save_file runs here first: read the files the agent names, from disk or the web, and send their bytes to the
// browser. The browser checks them again and saves them the way Add files does.
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { agentFileProblem, AGENT_FILE_TYPES, extensionForMime, MAX_CALL_BYTES, MAX_FILES_PER_CALL, SUPPORTED_FILES } from "../../../src/domain/agent-file-limits.ts";

/** Checks a file before reading or sending it. The browser checks it again with the app's rules. */
function check(name: string, size: number): string {
  const problem = agentFileProblem(name, size);
  if (problem) throw new Error(problem);
  return AGENT_FILE_TYPES[name.split(".").at(-1)!.toLowerCase()].mime;
}
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

type Prepared = { name: string; type: string; data: string; size: number };

function list(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value;
  throw new Error("path and url take a string or a list of strings.");
}

/** ~ and relative paths resolve the way a shell would from where the agent runs. */
export function resolvePath(value: string, cwd = process.cwd()): string {
  const trimmed = value.trim().replace(/^file:\/\//, "");
  if (trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return path.join(homedir(), trimmed.slice(1));
  return path.resolve(cwd, trimmed);
}

async function fromPath(value: string): Promise<Prepared> {
  const file = resolvePath(value);
  const info = await stat(file).catch(() => {
    throw new Error(`There's no file at ${file}. Check the path; relative paths start from ${process.cwd()}.`);
  });
  if (!info.isFile()) throw new Error(`${file} is a folder. Give the files inside it, one path each.`);
  const name = path.basename(file);
  // Check the type and size before reading, so a huge or unsupported file fails at once.
  const type = check(name, info.size);
  const bytes = await readFile(file);
  return { name, type, data: bytes.toString("base64"), size: bytes.byteLength };
}

function nameFor(url: URL, response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const quoted = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  let name = quoted ? decodeURIComponent(quoted[1] ?? quoted[2]) : decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  name = name.replace(/[\\/]/g, "_").trim() || url.hostname;
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const extension = extensionForMime(type);
  if (!/\.[a-z0-9]{2,5}$/i.test(name) && extension) name += `.${extension}`;
  return name;
}

async function fromUrl(value: string): Promise<Prepared> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${value} isn't a web address. Use path for files on this computer.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("url must start with http or https.");
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) }).catch(() => {
    throw new Error(`Couldn't download ${url.href}. Check the address and your connection.`);
  });
  if (!response.ok) throw new Error(`Downloading ${url.href} failed with HTTP ${response.status}.`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type === "text/html" || type === "application/xhtml+xml") throw new Error(`${url.href} is a web page, not a file. Save it with save_link.`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error(`${url.href} is too large. Keepall saves ${SUPPORTED_FILES}.`);
  const name = nameFor(url, response);
  check(name, declared || 1);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { name, type: check(name, bytes.byteLength), data: bytes.toString("base64"), size: bytes.byteLength };
}

/**
 * Turns save_file's paths and URLs into the files the browser receives. Other tools pass through unchanged.
 * Errors name the file and what to do, since the agent relays them.
 */
export async function prepareToolArgs(tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (tool !== "save_file") return args;
  const { path: paths, paths: morePaths, url: urls, urls: moreUrls, ...rest } = args;
  const sources: Array<{ kind: "path" | "url"; value: string }> = [
    ...[...list(paths), ...list(morePaths)].map((value) => ({ kind: "path" as const, value })),
    ...[...list(urls), ...list(moreUrls)].map((value) => ({ kind: "url" as const, value })),
  ];
  if (!sources.length) throw new Error("Give path (a file on this computer) or url (a file on the web). For a web page, use save_link.");
  if (sources.length > MAX_FILES_PER_CALL) throw new Error(`Save up to ${MAX_FILES_PER_CALL} files per call.`);
  const files: Prepared[] = [];
  let total = 0;
  for (const source of sources) {
    const file = source.kind === "path" ? await fromPath(source.value) : await fromUrl(source.value);
    total += file.size;
    if (total > MAX_CALL_BYTES) throw new Error("These files are too large together. Save them in separate calls.");
    files.push(file);
  }
  return { ...rest, files: files.map(({ name, type, data }) => ({ name, type, data })) };
}
