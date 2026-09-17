import { expect, test, type Page } from "@playwright/test";

async function openCaptureFromShortcut(page: Page) {
  await expect(
    page.getByRole("button", { name: "Save item", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Alt+k");
  await expect(
    page.getByRole("dialog", { name: "Save to Keepall" }),
  ).toBeVisible();
}

test("Save item and Alt+K open the capture flow from the side", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const main = page.locator("main");
  const mainBefore = (await main.boundingBox())!;

  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall" });
  await expect(capture).toBeVisible();
  await expect.poll(async () => {
    const box = await capture.boundingBox();
    return box ? Math.round(box.x + box.width) : null;
  }).toBe(1432);
  expect((await capture.boundingBox())!.height).toBe(884);
  expect(await main.boundingBox()).toMatchObject({
    x: mainBefore.x,
    width: mainBefore.width,
  });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(capture).toBeHidden();

  await openCaptureFromShortcut(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await openCaptureFromShortcut(page);
  await expect.poll(async () => {
    const box = await capture.boundingBox();
    return box ? Math.round(box.x + box.width) : null;
  }).toBe(382);
  expect((await capture.boundingBox())!.x).toBe(8);
});

test("saving a note with Alt+K survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);

  await page.getByLabel("Link, note, or image").fill("Soft side light, hard rim.");
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
  await openCaptureFromShortcut(page);

  await page.getByLabel("Link, note, or image").fill("https://example.com/path");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("heading", { name: "example.com" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "example.com" }),
  ).toHaveAttribute("href", "https://example.com/path");

  await page.reload();

  await expect(
    page.getByRole("link", { name: "example.com" }),
  ).toHaveAttribute("href", "https://example.com/path");
});

test("Cancel closes the capture dialog", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("deleting a note after confirm survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("Remove this note.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByLabel("Library").getByText("Remove this note."),
  ).toBeVisible();

  const removable = page.locator(".library-card").filter({ hasText: "Remove this note." });
  await removable.hover();
  await removable.locator("summary").click();
  await removable.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();

  await expect(
    page.getByLabel("Library").getByText("Remove this note."),
  ).toBeHidden();
  await expect(page.getByText("No items yet.")).toBeVisible();

  await page.reload();

  await expect(page.getByText("No items yet.")).toBeVisible();
  await expect(
    page.getByLabel("Library").getByText("Remove this note."),
  ).toBeHidden();
});

test("editing a note survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("Original note body.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByLabel("Library").getByText("Original note body."),
  ).toBeVisible();

  const editableNote = page.locator(".library-card").filter({ hasText: "Original note body." });
  await editableNote.hover();
  await editableNote.locator("summary").click();
  await editableNote.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Note content").fill("Edited note body.");
  await page.getByRole("button", { name: "Save note" }).click();

  await expect(
    page.getByLabel("Library").getByText("Edited note body."),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByLabel("Library").getByText("Edited note body."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Library").getByText("Original note body."),
  ).toBeHidden();
});

test("editing a link URL survives a reload", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("https://example.com/old");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("link", { name: "example.com" }),
  ).toHaveAttribute("href", "https://example.com/old");

  const editableLink = page.locator(".library-card").filter({ hasText: "example.com" });
  await editableLink.hover();
  await editableLink.locator("summary").click();
  await editableLink.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("URL").fill("https://example.com/new");
  await page.getByRole("button", { name: "Save link" }).click();

  await expect(
    page.getByRole("link", { name: "example.com" }),
  ).toHaveAttribute("href", "https://example.com/new");

  await page.reload();

  await expect(
    page.getByRole("link", { name: "example.com" }),
  ).toHaveAttribute("href", "https://example.com/new");
  await expect(
    page.locator('a[href="https://example.com/old"]'),
  ).toHaveCount(0);
});

test("Ctrl+Enter saves a note from the textarea", async ({ page }) => {
  await page.goto("/");
  await openCaptureFromShortcut(page);
  await page.getByLabel("Link, note, or image").fill("From keyboard shortcut");
  await page.getByLabel("Link, note, or image").press("Control+Enter");

  await expect(
    page.getByLabel("Library").getByText("From keyboard shortcut"),
  ).toBeVisible();
});
