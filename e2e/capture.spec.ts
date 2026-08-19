import { expect, test } from "@playwright/test";

test("saving a note with Alt+K survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Alt+k");

  await page.getByLabel("Link or note").fill("Soft side light, hard rim.");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("dialog").getByText("Saved.")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByLabel("Library").getByText("Soft side light, hard rim."),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByLabel("Library").getByText("Soft side light, hard rim."),
  ).toBeVisible();
});

test("saving a link with Alt+K survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Alt+k");

  await page.getByLabel("Link or note").fill("https://example.com/path");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("heading", { name: "example.com" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "https://example.com/path" }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("link", { name: "https://example.com/path" }),
  ).toBeVisible();
});

test("Cancel closes the capture dialog", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Alt+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("Ctrl+Enter saves a note from the textarea", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Alt+k");
  await page.getByLabel("Link or note").fill("From keyboard shortcut");
  await page.getByLabel("Link or note").press("Control+Enter");

  await expect(
    page.getByLabel("Library").getByText("From keyboard shortcut"),
  ).toBeVisible();
});
