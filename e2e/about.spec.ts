import { expect, test } from "@playwright/test";

test("capture example keeps its text clear of the save action at narrow widths", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => document.fonts.ready);

  for (const width of [320, 390, 600, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const capture = page.getByRole("region", { name: "Found it? Keep it." });
    await capture.getByRole("button", { name: "Text", exact: true }).click();
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
    await expect(save).toBeVisible();
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
  const save = capture.getByRole("button", { name: "Save to Keepall" });
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(capture.getByRole("status")).toContainText("Passage saved with its source link");
  expect(await capture.evaluate((section) => section.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Tab");
  await expect(capture.getByRole("button", { name: "Try again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(save).toBeVisible();
});
