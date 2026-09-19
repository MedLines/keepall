import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });

test("backup and import dialogs use the current modal system", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Backup & restore" }).click();

  const backup = page.getByRole("region", { name: "Backup" });
  const backupInput = backup.locator('input[accept*="application/json"]');

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

  await backup.locator('input[accept*="text/html"]').setInputFiles({
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
  await backup.locator('input[webkitdirectory]').setInputFiles(imageFolder);
  const imageDialog = page.getByRole("dialog", { name: "Import image folder" });
  await expect(imageDialog).toBeVisible();
  await expect(imageDialog.getByLabel("Collection (optional)")).toBeVisible();
  await imageDialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
