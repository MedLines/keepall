import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  // Native serializable handles exercise real writes; the OS picker and prompts are controlled.
  await page.addInitScript(() => {
    const controls = window as unknown as {
      pickerCalls: number; permissionRequests: number; failBackupWrite: boolean;
      permissionOverride?: PermissionState; denyReconnect?: boolean;
      showDirectoryPicker: (options: { mode: string }) => Promise<FileSystemDirectoryHandle>;
    };
    controls.pickerCalls = 0;
    controls.permissionRequests = 0;
    const prototype = FileSystemDirectoryHandle.prototype as FileSystemDirectoryHandle & {
      queryPermission: () => Promise<PermissionState>;
      requestPermission: () => Promise<PermissionState>;
    };
    const originalQuery = prototype.queryPermission;
    prototype.queryPermission = async function () {
      return controls.permissionOverride ?? originalQuery.call(this);
    };
    prototype.requestPermission = async function () {
      controls.permissionRequests += 1;
      controls.permissionOverride = controls.denyReconnect ? "denied" : "granted";
      return controls.permissionOverride;
    };
    controls.showDirectoryPicker = async (options) => {
      if (options.mode !== "readwrite" || !navigator.userActivation.isActive) throw new Error("Picker must run directly from a click");
      controls.pickerCalls += 1;
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("Keepall Backups", { create: true });
      const stream = await (await directory.getFileHandle("family.txt", { create: true })).createWritable();
      await stream.write("Unrelated personal file");
      await stream.close();
      return directory;
    };
    const originalWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (options) {
      if (controls.failBackupWrite && this.name.endsWith(".keepall.zip")) {
        return Promise.reject(new DOMException("Disk full", "QuotaExceededError"));
      }
      return originalWritable.call(this, options);
    };
  });
});

test("choose, save, reload, retain three backups, and turn off without deleting files", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await expect(backup.getByRole("button", { name: "Choose backup folder" })).toBeEnabled();
  await expect(backup).toContainText("Every 30 minutes");
  expect(await page.evaluate(() => (window as unknown as { pickerCalls: number }).pickerCalls)).toBe(0);
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  await expect(backup.locator("time")).toBeVisible();
  await expect(backup).toContainText("Keepall Backups");
  await expect(backup).toContainText("Up to date");
  await page.reload();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  await expect(backup.locator("time")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests)).toBe(0);
  for (let count = 0; count < 3; count += 1) {
    await backup.getByRole("button", { name: "Back up now" }).click();
    await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  }
  const files = await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle("Keepall Backups") as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> };
    const names: string[] = [];
    for await (const name of directory.keys()) names.push(name);
    return { names, personal: await (await (await directory.getFileHandle("family.txt")).getFile()).text() };
  });
  expect(files.names.filter((name) => name.endsWith(".keepall.zip"))).toHaveLength(3);
  expect(files.names.filter((name) => name.endsWith(".complete.json"))).toHaveLength(3);
  expect(files.personal).toBe("Unrelated personal file");
  await backup.screenshot({ path: testInfo.outputPath("folder-connected-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await backup.screenshot({ path: testInfo.outputPath("folder-connected-mobile.png") });
  expect(await backup.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await backup.getByRole("button", { name: "Turn off folder backups" }).click();
  await expect(backup.getByRole("button", { name: "Enable folder backups" })).toBeEnabled();
  await expect(backup).toContainText("Saved files stay in your folder");
  await expect(backup.locator("time")).toBeVisible();
  expect(errors).toEqual([]);
});

test("revoked permission is checked on reload and requested only by reconnecting", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  await page.getByRole("link", { name: "Back to library" }).click();
  await addNote(page, "Pending before permission was revoked");
  await page.goto("/settings#storage");
  await expect(backup).toContainText("Changes waiting for backup");
  await page.addInitScript(() => {
    (window as unknown as { permissionOverride: string; denyReconnect: boolean }).permissionOverride = "prompt";
    (window as unknown as { denyReconnect: boolean }).denyReconnect = true;
  });
  await page.reload();
  await expect(backup.getByRole("button", { name: "Reconnect folder" })).toBeEnabled();
  await expect(backup.locator("time")).toBeVisible();
  await page.clock.fastForward(31 * 60_000);
  await expect.poll(async () => (await backupRecord(page))?.lastError).toMatch(/Reconnect/);
  expect((await backupRecord(page))?.completed).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests)).toBe(0);
  await backup.getByRole("button", { name: "Reconnect folder" }).click();
  await expect(backup.getByRole("alert")).toContainText("wasn't granted");
  await expect(backup.getByRole("button", { name: "Export backup", exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { denyReconnect: boolean }).denyReconnect = false; });
  await backup.getByRole("button", { name: "Reconnect folder" }).click();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests)).toBe(2);
  await expect(backup).toContainText("Up to date");
});

test("failed first writes stay pending and can be retried", async ({ page }) => {
  await page.goto("/settings#storage");
  await page.evaluate(() => { (window as unknown as { failBackupWrite: boolean }).failBackupWrite = true; });
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.getByRole("alert")).toContainText("Could not save the backup");
  await expect(backup).toContainText("No completed backup yet");
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { failBackupWrite: boolean }).failBackupWrite = false; });
  await backup.getByRole("button", { name: "Back up now" }).click();
  await expect(backup.locator("time")).toBeVisible();
  await expect(backup.getByRole("alert")).toHaveCount(0);
});

async function backupRecord(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<{ completed: unknown[]; lastBackupRevision?: string; lastError: string | null } | undefined>((resolve, reject) => {
      const tx = db.transaction("backupSettings");
      const read = tx.objectStore("backupSettings").get("folder");
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    db.close();
    return result;
  });
}

test("switching settings tabs preserves an in-progress folder backup", async ({ page }) => {
  await page.goto("/settings#storage");
  await page.evaluate(() => {
    const createWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (options) {
      const stream = await createWritable.call(this, options);
      if (this.name.endsWith(".keepall.zip")) {
        const write = stream.write.bind(stream);
        stream.write = async (data) => {
          await new Promise<void>((resolve) => {
            (window as unknown as { finishBackupWrite: () => void }).finishBackupWrite = resolve;
          });
          await write(data);
        };
      }
      return stream;
    };
  });
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { finishBackupWrite?: () => void }).finishBackupWrite)).toBe("function");
  await page.getByRole("tab", { name: "General", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "General", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Storage & backups", exact: true }).click();
  await expect(backup.getByRole("progressbar", { name: "Saving folder backup", exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { finishBackupWrite: () => void }).finishBackupWrite());
  await expect(backup.locator("time")).toBeVisible();
  await expect(backup.getByRole("alert")).toHaveCount(0);
  expect((await backupRecord(page))?.completed).toHaveLength(1);
});

async function addNote(page: import("@playwright/test").Page, content: string) {
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await capture.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill(content);
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
}

test("automatic backups run from the library, survive reload, and skip unchanged intervals", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.locator("time")).toBeVisible();
  const initial = await backupRecord(page);
  await page.getByRole("link", { name: "Back to library" }).click();
  await addNote(page, "Automatically protected note");
  await page.reload();
  await expect(page.getByRole("button", { name: "Save item", exact: true })).toBeVisible();
  await page.clock.fastForward(29 * 60_000);
  expect((await backupRecord(page))?.completed).toHaveLength(1);
  await page.clock.fastForward(2 * 60_000);
  await expect.poll(async () => (await backupRecord(page))?.completed.length).toBe(2);
  const saved = await backupRecord(page);
  expect(saved?.lastBackupRevision).not.toBe(initial?.lastBackupRevision);
  await page.clock.fastForward(31 * 60_000);
  expect((await backupRecord(page))?.completed).toHaveLength(2);
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests)).toBe(0);
  await page.goto("/settings#storage");
  await expect(backup).toContainText("Every 30 minutes");
  await backup.getByRole("button", { name: "Turn off folder backups" }).click();
  await page.getByRole("link", { name: "Back to library" }).click();
  await addNote(page, "Not backed up while disabled");
  await page.clock.fastForward(31 * 60_000);
  expect((await backupRecord(page))?.completed).toHaveLength(2);
});

test("two tabs share one scheduled backup for a changed revision", async ({ page, context }) => {
  const time = new Date("2030-01-01T12:00:00Z");
  await page.clock.install({ time });
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.locator("time")).toBeVisible();
  const other = await context.newPage();
  await other.clock.install({ time });
  await other.goto("/");
  await addNote(other, "Changed in a second tab");
  await Promise.all([page.clock.fastForward(31 * 60_000), other.clock.fastForward(31 * 60_000)]);
  await expect.poll(async () => (await backupRecord(page))?.completed.length).toBe(2);
  await Promise.all([page.clock.fastForward(60_000), other.clock.fastForward(60_000)]);
  expect((await backupRecord(page))?.completed).toHaveLength(2);
  await other.close();
});

test("large originals can be backed up and verified without losing library data", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/settings#storage");
  await expect(page.getByRole("button", { name: "Choose backup folder" })).toBeEnabled();
  await page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const bytes = new Uint8Array(8 * 1024 * 1024);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "videoAssets"], "readwrite");
      for (let index = 0; index < 8; index += 1) {
        const id = crypto.randomUUID();
        const assetId = crypto.randomUUID();
        tx.objectStore("videoAssets").put({ id: assetId, mimeType: "video/mp4", byteLength: bytes.byteLength, blob: new Blob([bytes], { type: "video/mp4" }), createdAt: 1 });
        tx.objectStore("items").put({ id, type: "video", title: `Benchmark video ${index}`, sourceFileName: `video-${index}.mp4`, assetId, noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const metrics = await page.evaluate(() => {
    const performanceWithMemory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    const data = { started: performance.now(), baselineHeap: performanceWithMemory.memory?.usedJSHeapSize ?? null, peakHeap: 0, longestTaskMs: 0 };
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) data.longestTaskMs = Math.max(data.longestTaskMs, entry.duration);
    });
    observer.observe({ type: "longtask", buffered: false });
    const sample = window.setInterval(() => { data.peakHeap = Math.max(data.peakHeap, performanceWithMemory.memory?.usedJSHeapSize ?? 0); }, 50);
    (window as unknown as { stopBackupMetrics: () => typeof data & { durationMs: number } }).stopBackupMetrics = () => {
      clearInterval(sample);
      observer.disconnect();
      return { ...data, durationMs: performance.now() - data.started };
    };
    return { bytes: 64 * 1024 * 1024, userAgent: navigator.userAgent };
  });
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.locator("time")).toBeVisible({ timeout: 90_000 });
  const result = await page.evaluate(() => (window as unknown as { stopBackupMetrics: () => object }).stopBackupMetrics());
  const metricsPath = testInfo.outputPath("backup-performance.json");
  await writeFile(metricsPath, JSON.stringify({ ...metrics, ...result }, null, 2));
  await testInfo.attach("backup-performance.json", { path: metricsPath, contentType: "application/json" });
  expect((await backupRecord(page))?.completed).toHaveLength(1);
  await expect(backup.getByRole("alert")).toHaveCount(0);
});

test("empty replacement pauses backups and restoring a recovery copy resumes them", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.goto("/");
  await addNote(page, "Recoverable original note");
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.locator("time")).toBeVisible();
  const recoveryBytes = await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle("Keepall Backups") as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };
    for await (const handle of directory.values()) {
      if (handle.kind === "file" && handle.name.endsWith(".keepall.zip")) {
        return Array.from(new Uint8Array(await (await (handle as FileSystemFileHandle).getFile()).arrayBuffer()));
      }
    }
    throw new Error("Recovery ZIP missing");
  });
  const input = backup.locator('input[accept*="application/json"]');
  await input.setInputFiles({ name: "empty.keepall.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
    format: "keepall", version: 7, exportedAt: 1, items: [], tags: [], collections: [], assets: [], preferences: { pinnedCollectionIds: [] },
  })) });
  await page.getByRole("dialog", { name: "Import backup" }).getByRole("button", { name: "Replace library", exact: true }).click();
  await page.getByRole("dialog", { name: "Replace library?" }).getByRole("button", { name: "Confirm replacement", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.clock.fastForward(31 * 60_000);
  await expect(backup.getByRole("alert")).toContainText("library is empty");
  expect((await backupRecord(page))?.completed).toHaveLength(1);
  await input.setInputFiles({ name: "recovery.keepall.zip", mimeType: "application/zip", buffer: Buffer.from(recoveryBytes) });
  await page.getByRole("dialog", { name: "Import backup" }).getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await backup.getByRole("button", { name: "Back up now" }).click();
  await expect(backup.getByRole("alert")).toHaveCount(0);
  expect((await backupRecord(page))?.completed).toHaveLength(2);
});
