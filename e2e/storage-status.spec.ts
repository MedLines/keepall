import { expect, test } from "@playwright/test";

test("dismisses the storage status across reloads", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.removeItem("keepall.storage-status-dismissed");
  });
  await page.reload();

  const status = page.getByTestId("persistent-storage-status");
  await expect(status).toBeVisible();
  await status.getByRole("button").click();
  await expect(status).toHaveCount(0);

  await page.reload();
  await expect(status).toHaveCount(0);
});
