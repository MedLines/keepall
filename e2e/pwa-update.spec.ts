import { execSync, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PORT = 3198;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(process.cwd());

let server: ChildProcess | undefined;

function runBuild(marker: string) {
  execSync("pnpm build", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_BUILD_MARKER: marker,
      NEXT_PUBLIC_KEEPALL_ORIGIN: BASE,
    },
  });
}

async function waitForServer(url: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Server at ${url} did not become ready`);
}

function startServer() {
  stopServer();
  server = spawn("pnpm", ["exec", "next", "start", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
    env: process.env,
  });
  server.unref();
}

function stopServer() {
  if (!server?.pid) {
    return;
  }

  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    try {
      process.kill(server.pid, "SIGTERM");
    } catch {
      // Process already exited.
    }
  }

  server = undefined;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  runBuild("build-a");
  startServer();
  await waitForServer(BASE);
});

test.afterAll(() => {
  stopServer();
});

test("shows update banner after a second deploy and reload applies it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Keepall home" })).toBeVisible();
  await expect(page.getByTestId("build-marker")).toHaveText("build-a");

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!("serviceWorker" in navigator)) {
            return false;
          }
          await navigator.serviceWorker.ready;
          return Boolean(navigator.serviceWorker.controller);
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  await page.keyboard.press("Alt+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Link, note, or image").fill("Update flow note.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByLabel("Library").getByText("Update flow note."),
  ).toBeVisible();

  stopServer();
  runBuild("build-b");
  startServer();
  await waitForServer(BASE);

  await page.goto("/");
  await expect(page.getByTestId("pwa-update-banner")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Reload" }).click();

  await expect(page.getByTestId("build-marker")).toHaveText("build-b", {
    timeout: 30_000,
  });
  await expect(
    page.getByLabel("Library").getByText("Update flow note."),
  ).toBeVisible();
});
