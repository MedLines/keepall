import { expect, test } from "@playwright/test";

test("home page shows Keepall", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Keepall home" })).toBeVisible();
});
