// Starts the relay under `wrangler dev` on a free port for tests.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function startDevRelay() {
  const port = 8700 + Math.floor(Math.random() * 90);
  const url = `http://127.0.0.1:${port}`;
  const state = await mkdtemp(path.join(tmpdir(), "keepall-relay-"));
  const child = spawn("pnpm", ["exec", "wrangler", "dev", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", state, "--show-interactive-dev-session=false"], {
    cwd: path.resolve(import.meta.dirname, ".."), stdio: "ignore", detached: true,
  });
  async function stop() {
    if (child.pid) process.kill(-child.pid, "SIGTERM");
    await rm(state, { recursive: true, force: true });
  }
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return { url, port, stop };
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await stop();
  throw new Error("wrangler dev did not start");
}
