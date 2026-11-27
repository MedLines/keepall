import { expect, test } from "@playwright/test";
import { jumpPalette, openOverview } from "./jump-palette";

test.use({ serviceWorkers: "block" });

for (const width of [320, 767]) {
  test(`mobile navigation at ${width}px contains focus and restores each opener`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
    await page.goto("/");
    const expand = page.getByRole("button", { name: "Expand", exact: true });
    const search = page.getByRole("searchbox", { name: "Search" });
    await expect(expand).toBeVisible();
    await expand.focus();
    await expand.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Sidebar navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "All items" })).toBeFocused();
    await expect(search).toHaveCount(0);
    const settings = dialog.getByRole("link", { name: "Settings" });
    const logo = dialog.getByRole("link", { name: "Keepall home" });
    await settings.focus();
    await page.keyboard.press("Tab");
    await expect(logo).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(settings).toBeFocused();

    await page.keyboard.press("Escape");
    expect(await page.locator("#library-sidebar").count()).toBe(1);
    await expect(dialog).toHaveCount(0);
    await expect(expand).toBeFocused();
    await expect(search).toBeVisible();

    // The rail's Collections icon opens the jump palette, not the navigation dialog.
    const collections = page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Collections", exact: true });
    const palette = jumpPalette(page);
    const paletteSearch = palette.getByRole("combobox", { name: "Search collections and tags" });
    await collections.focus();
    await collections.press("Enter");
    await expect(paletteSearch).toBeFocused();
    await expect(palette.getByRole("button", { name: /^Collections/ })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog).toHaveCount(0);
    await palette.getByRole("button", { name: "Close", exact: true }).click();
    expect(await page.locator("#library-sidebar").count()).toBe(1);
    await expect(palette).toHaveCount(0);
    // Closing the palette returns focus to its opener; soft so the rest of the flow still runs.
    await expect.soft(collections).toBeFocused();

    // Opened from inside the navigation dialog, the palette returns focus there and leaves the dialog open.
    await expand.press("Enter");
    await expect(dialog).toBeVisible();
    const dialogTags = dialog.getByRole("button", { name: "Tags", exact: true });
    await dialogTags.focus();
    await dialogTags.press("Enter");
    await expect(paletteSearch).toBeFocused();
    await expect(palette.getByRole("button", { name: /^Tags/ })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect.soft(dialogTags).toBeFocused();
  });
}

test("mobile navigation releases its modal state at the desktop breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 844 });
  await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
  await page.goto("/");
  await page.getByRole("button", { name: "Expand", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sidebar navigation" })).toBeVisible();
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(page.getByRole("dialog", { name: "Sidebar navigation" })).toHaveCount(0);
  await expect(page.locator("#library-sidebar")).toHaveCount(1);
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  await page.setViewportSize({ width: 767, height: 844 });
  await expect(page.getByRole("dialog", { name: "Sidebar navigation" })).toBeVisible();
  await expect(page.locator("#library-sidebar")).toHaveCount(1);
});

test("Escape dismisses the top sidebar overlay while preserving the underlying selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["collections", "preferences"], "readwrite");
        tx.objectStore("collections").put({ id: "design", name: "Design", createdAt: 1, pinnedItemIds: [] });
        // Only pinned collections have sidebar rows, and this test opens the row's menu.
        tx.objectStore("preferences").put({ id: "library", pinnedCollectionIds: ["design"] });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();

  const expand = page.getByRole("button", { name: "Expand", exact: true });
  await expand.click();
  let sidebar = page.getByRole("dialog", { name: "Sidebar navigation" });
  await openOverview(page, "All collections", sidebar);
  await expect(sidebar).toHaveCount(0);
  const selected = page.getByRole("checkbox", { name: "Select Design" });
  // The select control shows on hover; the palette footer leaves the pointer away from the card.
  await page.locator(".organization-card").filter({ has: selected }).hover();
  await selected.locator("..").click();
  await expect(selected).toBeChecked();

  await expand.click();
  sidebar = page.getByRole("dialog", { name: "Sidebar navigation" });
  const actions = sidebar.getByRole("button", { name: "Design actions" });
  await actions.click();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await expect(sidebar).toBeVisible();
  await expect(actions).toBeFocused();

  await actions.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete collection?" });
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(sidebar).toBeVisible();
  await expect(actions).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sidebar).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect(selected).toBeChecked();
});
