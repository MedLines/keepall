import { expect, test } from "@playwright/test";

test("capture example keeps its text clear of the save action at narrow widths", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => document.fonts.ready);

  for (const width of [320, 390, 600, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const capture = page.getByRole("region", { name: "Found it? Keep it." });
    await capture.getByRole("button", { name: "Text", exact: true }).click();
    await capture.getByRole("button", { name: "Right-click the selection" }).click();
    const save = capture.getByRole("button", { name: "Save to Keepall" });
    await save.scrollIntoViewIfNeeded();

    const passage = await page.locator(".ka-demo-passage").boundingBox();
    const action = await save.boundingBox();
    expect(passage).not.toBeNull();
    expect(action).not.toBeNull();
    expect(action!.y, `Save must sit below the passage at ${width}px`).toBeGreaterThanOrEqual(passage!.y + passage!.height);

    const typeSizes = await capture.evaluate((section) => ({
      section: parseFloat(getComputedStyle(section.querySelector("h2")!).fontSize),
      example: parseFloat(getComputedStyle(section.querySelector("h3")!).fontSize),
    }));
    expect(typeSizes.example).toBeLessThan(typeSizes.section);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await save.click();
    await expect(capture.getByRole("status")).toContainText("Passage saved with its source link");
    await capture.getByRole("button", { name: "Try again" }).click();
    await expect(capture.getByRole("button", { name: "Right-click the selection" })).toBeFocused();
  }
});

test("capture confirmation and replay work by keyboard with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const capture = page.getByRole("region", { name: "Found it? Keep it." });
  const text = capture.getByRole("button", { name: "Text", exact: true });
  await text.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const trigger = capture.getByRole("button", { name: "Right-click the selection" });
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  const save = capture.getByRole("button", { name: "Save to Keepall" });
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(capture.getByRole("status")).toContainText("Passage saved with its source link");
  expect(await capture.evaluate((section) => section.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(capture.getByRole("button", { name: "Try again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
});

test("feature previews can be changed by keyboard and keep their layout on a phone", async ({ page }) => {
  await page.goto("/about");
  const gallery = page.locator(".ka-gallery");
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const collections = gallery.getByRole("button", { name: "Collections", exact: true });
    await collections.focus();
    await page.keyboard.press("Enter");
    await expect(collections).toHaveAttribute("aria-pressed", "true");
    await expect(gallery.getByRole("region", { name: "Collections", exact: true })).toBeVisible();
    await gallery.getByRole("button", { name: "Next feature" }).click();
    await expect(gallery.getByRole("region", { name: "Search", exact: true })).toBeVisible();
    await gallery.getByRole("button", { name: "Next feature" }).click();
    await expect(gallery.getByRole("region", { name: "Your library", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("scrolling stacks feature cards reversibly and reduced motion restores ordinary flow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/about");
  const stack = page.locator(".ka-stack");
  const start = await stack.evaluate((element) => element.getBoundingClientRect().top + window.scrollY - 108);
  const surfaces = page.locator(".ka-stack-surface");
  await page.evaluate((y) => window.scrollTo(0, y), start);
  await expect.poll(() => surfaces.first().evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(1060);
  await page.evaluate((y) => window.scrollTo(0, y + 1320), start);
  await expect.poll(() => surfaces.first().evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(1000);
  const last = surfaces.last();
  await expect.poll(() => last.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(160);
  await expect(page.getByRole("heading", { name: "Your interests. Your device. Your library." })).toBeVisible();
  await page.evaluate((y) => window.scrollTo(0, y), start);
  await expect.poll(() => surfaces.first().evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(1060);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator(".ka-stack-card").first().evaluate((element) => getComputedStyle(element).position)).toBe("relative");
  await expect.poll(() => surfaces.first().evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});
