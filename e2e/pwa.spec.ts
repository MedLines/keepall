import { expect, test } from "@playwright/test";

test.describe("PWA / offline shell", () => {
  test("registers a service worker in production", async ({ page }) => {
    await page.goto("/");

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            if (!("serviceWorker" in navigator)) {
              return null;
            }
            const registration = await navigator.serviceWorker.ready;
            return registration.active?.scriptURL ?? null;
          }),
        { timeout: 20_000 },
      )
      .toMatch(/\/sw\.js$/);
  });

  test("saved item survives offline reload", async ({ page, context }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Keepall" }).click();
    await page.keyboard.press("Alt+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Link or note").fill("Offline survival note.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByLabel("Library").getByText("Offline survival note."),
    ).toBeVisible();

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            if (!("serviceWorker" in navigator)) {
              return false;
            }
            await navigator.serviceWorker.ready;
            return true;
          }),
        { timeout: 20_000 },
      )
      .toBe(true);

    // Ensure this document is controlled, then prove IndexedDB survives offline reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect
      .poll(
        async () =>
          page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect(
      page.getByLabel("Library").getByText("Offline survival note."),
    ).toBeVisible();

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByLabel("Library").getByText("Offline survival note."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows offline banner after offline reload", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Keepall" })).toBeVisible();

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            if (!("serviceWorker" in navigator)) {
              return false;
            }
            await navigator.serviceWorker.ready;
            return true;
          }),
        { timeout: 20_000 },
      )
      .toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect
      .poll(
        async () =>
          page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
        { timeout: 20_000 },
      )
      .toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });

    // Playwright can keep navigator.onLine true on SW-cached reloads; re-applying
    // offline fires the browser offline event on the new document.
    await context.setOffline(false);
    await context.setOffline(true);

    await expect(page.getByTestId("offline-banner")).toBeVisible({
      timeout: 10_000,
    });

    await context.setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("offline-banner")).toBeHidden({
      timeout: 10_000,
    });
  });
});
