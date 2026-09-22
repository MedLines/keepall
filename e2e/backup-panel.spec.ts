import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });

test("settings owns backup and import recovery", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to library" })).toHaveAttribute(
    "href",
    "/",
  );

  const backup = page.getByRole("region", { name: "Backup" });
  const importSection = page.getByRole("region", { name: "Import" });
  const backupInput = backup.locator('input[accept*="application/json"]');
  await expect(backup.getByRole("button", { name: "Export backup" })).toBeVisible();
  await expect(importSection.getByRole("button", { name: "Import bookmarks" })).toBeVisible();
  const storage = page.getByRole("region", { name: "Storage" });
  await expect(storage).toContainText("Planned");
  await expect(storage.getByText("Site storage used")).toBeVisible();
  await expect(storage.getByRole("button", { name: "Refresh storage status" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("settings-desktop.png"), fullPage: true });

  for (const theme of ["light", "dark"] as const) {
    if (await page.locator("html").getAttribute("data-theme") !== theme) {
      await page.getByRole("button", { name: "Theme", exact: true }).click();
    }
    await backupInput.setInputFiles({
      name: "library.keepall.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    const dialog = page.getByRole("dialog", { name: "Import backup" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/ui-popover/);
    const backdrop = await dialog.evaluate((element) => {
      const style = getComputedStyle(element, "::backdrop");
      return {
        backgroundImage: style.backgroundImage,
        backdropFilter: style.backdropFilter,
      };
    });
    expect(backdrop.backgroundImage).toContain("linear-gradient");
    expect(backdrop.backdropFilter).toContain("blur(8px)");
    await page.screenshot({ path: testInfo.outputPath(`backup-${theme}.png`) });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  await importSection.locator('input[accept*="text/html"]').setInputFiles({
    name: "bookmarks.html",
    mimeType: "text/html",
    buffer: Buffer.from("<DL><p></DL>"),
  });
  const bookmarksDialog = page.getByRole("dialog", { name: "Import browser bookmarks" });
  await expect(bookmarksDialog).toBeVisible();
  await expect(bookmarksDialog.getByRole("radio")).toHaveCount(3);
  await bookmarksDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  const imageFolder = testInfo.outputPath("image-folder");
  await mkdir(imageFolder, { recursive: true });
  await writeFile(`${imageFolder}/reference.png`, Buffer.from([137, 80, 78, 71]));
  await importSection.locator('input[webkitdirectory]').setInputFiles(imageFolder);
  const imageDialog = page.getByRole("dialog", { name: "Import image folder" });
  await expect(imageDialog).toBeVisible();
  await expect(imageDialog.getByLabel("Collection (optional)")).toBeVisible();
  await imageDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Help" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-mobile.png"), fullPage: true });
  await storage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("storage-mobile.png") });
});
