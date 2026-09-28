import { expect, test } from "@playwright/test";

for (const width of [2134, 390]) {
  test(`guide navigation stays reachable and scrolls smoothly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1032 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/help/install-keepall#computer");
    const sidebar = page.locator(".kh-sidebar");
    const back = sidebar.getByRole("link", { name: "All guides", exact: true });
    await expect(back).toBeVisible();

    for (const id of ["iphone", "choose"]) {
      await page.evaluate(() => {
        const positions: number[] = [];
        Object.assign(window, { helpScrollPositions: positions });
        window.addEventListener("scroll", () => positions.push(window.scrollY), { passive: true });
      });
      await sidebar.locator(`a[href="#${id}"]`).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      const target = page.locator(`#${id}`);
      await expect.poll(async () => {
        const [section, navigation, header] = await Promise.all([
          target.boundingBox(), sidebar.boundingBox(), page.locator(".ka-header").boundingBox(),
        ]);
        const obstruction = width > 760 ? header! : navigation!;
        return section!.y - obstruction.y - obstruction.height;
      }).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate(() => {
        const positions = Reflect.get(window, "helpScrollPositions") as number[];
        return new Set(positions).size;
      })).toBeGreaterThan(3);
      await expect.poll(() => target.evaluate(element => {
        const top = element.getBoundingClientRect().top;
        return Math.abs(top - parseFloat(getComputedStyle(element).scrollMarginTop));
      })).toBeLessThan(2);
      const header = await page.locator(".ka-header").boundingBox();
      const backBox = await back.boundingBox();
      expect(backBox!.y).toBeGreaterThan(header!.y + header!.height);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
    await back.click();
    await expect(page).toHaveURL(/\/help$/);
  });
}
