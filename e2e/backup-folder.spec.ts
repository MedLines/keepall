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
  await page.goto("/settings");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await expect(backup.getByRole("button", { name: "Choose backup folder" })).toBeEnabled();
  await expect(backup).toContainText("Scheduled backups are not active yet");
  expect(await page.evaluate(() => (window as unknown as { pickerCalls: number }).pickerCalls)).toBe(0);
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  await expect(backup.locator("time")).toBeVisible();
  await expect(backup).toContainText("Keepall Backups");
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
  await page.goto("/settings");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  await backup.getByRole("button", { name: "Choose backup folder" }).click();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  await page.addInitScript(() => {
    (window as unknown as { permissionOverride: string; denyReconnect: boolean }).permissionOverride = "prompt";
    (window as unknown as { denyReconnect: boolean }).denyReconnect = true;
  });
  await page.reload();
  await expect(backup.getByRole("button", { name: "Reconnect folder" })).toBeEnabled();
  await expect(backup.locator("time")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests)).toBe(0);
  await backup.getByRole("button", { name: "Reconnect folder" }).click();
  await expect(backup.getByRole("alert")).toContainText("wasn't granted");
  await expect(backup.getByRole("button", { name: "Export backup", exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { denyReconnect: boolean }).denyReconnect = false; });
  await backup.getByRole("button", { name: "Reconnect folder" }).click();
  await expect(backup.getByRole("button", { name: "Back up now" })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: number }).permissionRequests)).toBe(2);
});

test("failed first writes stay pending and can be retried", async ({ page }) => {
  await page.goto("/settings");
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
