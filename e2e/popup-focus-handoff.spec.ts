import { expect, test, type Page } from "@playwright/test";
import { jumpPalette } from "./jump-palette";

// Base UI hands focus back only after a popup's exit animation. These tests act inside that
// window and check that a closing popup leaves focus alone once something else has claimed it.
const EXIT_ANIMATION_MARGIN = 600;

test.beforeEach(async ({ page }) => {
  // Narrow enough that the bulk toolbar folds its actions into the Selection actions menu.
  await page.setViewportSize({ width: 700, height: 900 });
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
        const tx = db.transaction(["collections", "items"], "readwrite");
        tx.objectStore("collections").put({ id: "design", name: "Design", createdAt: 1, pinnedItemIds: [] });
        tx.objectStore("items").put({ id: "note-design", type: "note", title: "Design note", content: "Saved Design content", collectionIds: ["design"], tagIds: [], createdAt: 1, updatedAt: 1 });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
});

async function deselectAllFromMenu(page: Page) {
  const card = page.locator('[data-item-id="note-design"] .library-card');
  await card.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  const trigger = page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: /^Selection actions:/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Deselect all", exact: true }).click();
}

test("Deselect all from the selection menu returns focus to library search", async ({ page }) => {
  await deselectAllFromMenu(page);
  await expect(page.locator("#library-search")).toBeFocused();
});

test("opening the jump palette while the selection menu closes keeps focus in the palette", async ({ page }) => {
  await deselectAllFromMenu(page);
  await page.keyboard.press("Control+k");
  const search = jumpPalette(page).getByRole("combobox", { name: "Search collections and tags" });
  await expect(search).toBeFocused();
  await page.waitForTimeout(EXIT_ANIMATION_MARGIN);
  await expect(search).toBeFocused();
});

test("focusing library search while the jump palette closes keeps focus in library search", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(jumpPalette(page).getByRole("combobox", { name: "Search collections and tags" })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("/");
  await expect(page.locator("#library-search")).toBeFocused();
  await page.waitForTimeout(EXIT_ANIMATION_MARGIN);
  await expect(page.locator("#library-search")).toBeFocused();
});
