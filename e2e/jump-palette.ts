import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The sidebar lists pinned collections only. Every other collection and tag is reached through the
 * jump palette, which the sidebar's Collections and Tags rows (and Ctrl+K) open.
 */
export function sidebar(page: Page): Locator {
  return page.getByRole("complementary", { name: "Sidebar" });
}

export function jumpPalette(page: Page): Locator {
  return page.getByRole("dialog", { name: "Jump to a collection or tag" });
}

/** Opens the palette from the sidebar row. Pass the mobile navigation dialog as `from` when it is open. */
export async function openJumpPalette(page: Page, row: "Collections" | "Tags", from: Locator = sidebar(page)): Promise<Locator> {
  await from.getByRole("button", { name: row, exact: true }).click();
  const palette = jumpPalette(page);
  await expect(palette.getByRole("combobox", { name: "Search collections and tags" })).toBeFocused();
  return palette;
}

/** Opens a collection or tag by its exact name through the palette. */
export async function jumpTo(page: Page, name: string, row: "Collections" | "Tags" = "Collections", from?: Locator): Promise<void> {
  const palette = await openJumpPalette(page, row, from);
  await palette.getByRole("combobox", { name: "Search collections and tags" }).fill(name);
  await palette.getByRole("option").filter({ has: page.getByText(name, { exact: true }) }).first().click();
  await expect(palette).toHaveCount(0);
}

/** Opens the All collections or All tags overview from the palette footer. */
export async function openOverview(page: Page, overview: "All collections" | "All tags", from?: Locator): Promise<void> {
  const palette = await openJumpPalette(page, overview === "All collections" ? "Collections" : "Tags", from);
  await palette.getByRole("button", { name: overview, exact: true }).click();
  await expect(palette).toHaveCount(0);
}

/** Pins collections before the library loads, so they appear in the sidebar as drop targets. */
export async function seedPinnedCollections(page: Page, ids: string[]): Promise<void> {
  await page.evaluate(async (pinnedCollectionIds) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("preferences", "readwrite");
        const store = tx.objectStore("preferences");
        const read = store.get("library");
        read.onsuccess = () => store.put({ ...(read.result ?? { id: "library" }), id: "library", pinnedCollectionIds });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, ids);
}
