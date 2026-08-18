import { expect, test } from "@playwright/test";

test("saving a note survives a reload", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Title", { exact: true }).fill("Studio lighting");
  await page.getByLabel("Note", { exact: true }).fill("Soft side light, hard rim.");
  await page.getByRole("button", { name: "Save note" }).click();

  await expect(
    page.getByRole("heading", { name: "Studio lighting" }),
  ).toBeVisible();
  await expect(page.getByText("Soft side light, hard rim.")).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Studio lighting" }),
  ).toBeVisible();
  await expect(page.getByText("Soft side light, hard rim.")).toBeVisible();
});
