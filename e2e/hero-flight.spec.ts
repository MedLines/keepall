import { expect, test } from "@playwright/test";

test("old preview hash uses the same single hero animation", async ({ page }) => {
  await page.goto("/about#scroll-preview");
  await expect(page.locator(".ka-hero-flight-layer")).toHaveCount(1);
  await expect(page.locator(".ka-hero")).toHaveCSS("position", "relative");
  await expect(page.locator(".ka-hero-track")).toHaveCount(0);
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  await page.evaluate(() => scrollTo({ top: 100, behavior: "instant" }));
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "true");
});

test("reduced motion preserves the original icons and readable copy", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  await page.evaluate(() => window.scrollTo({ top: 240, behavior: "instant" }));
  await expect(page.locator(".ka-hero-flight-layer")).toHaveCount(0);
  await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
  expect(await page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "visible"))).toBe(true);
  await expect(page.locator(".ka-hero")).toHaveCSS("position", "relative");
});

test("changing reduced motion during a flight restores the original icons", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  await page.evaluate(() => scrollTo({ top: 90, behavior: "instant" }));
  await expect.poll(() => page.locator('[data-flight-icon="links"]').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".ka-hero-flight-layer")).toHaveCount(0);
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element =>
    getComputedStyle(element).visibility === "visible" && element.getBoundingClientRect().width > 30,
  ))).toBe(true);
  await expect(page.locator(".ka-hero")).not.toHaveAttribute("data-hero-compact", "true");
});

for (const width of [2134, 1440, 390, 320]) {
  test(`auto drop finishes without more scrolling at ${width}px`, async ({ page }) => {
    const height = width === 2134 ? 1032 : 900;
    await page.setViewportSize({ width, height });
    await page.goto("/about");
    await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
    const copy = await page.locator(".ka-hero-copy").boundingBox();
    expect(Math.abs(copy!.y + copy!.height / 2 - height / 2)).toBeLessThan(2);
    const trigger = await page.evaluate(() => {
      const top = Math.min(...[...document.querySelectorAll("[data-hero-icon]")].map(element => element.getBoundingClientRect().top));
      return Math.ceil(top - document.querySelector(".ka-header")!.getBoundingClientRect().bottom - 72) + 2;
    });
    const timing = page.evaluate(async top => {
      scrollTo({ top, behavior: "instant" });
      const started = performance.now();
      let seen = false;
      while (performance.now() - started < 2000) {
        await new Promise(requestAnimationFrame);
        const visible = [...document.querySelectorAll("[data-flight-icon]")].some(element => Number(getComputedStyle(element).opacity) > 0);
        if (seen && !visible) return performance.now() - started;
        seen ||= visible;
      }
      return Infinity;
    }, trigger);
    const icons = page.locator("[data-flight-icon]");
    await expect.poll(() => icons.first().evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
    const initial = await icons.first().boundingBox();
    await page.waitForTimeout(350);
    const later = await icons.first().boundingBox();
    expect(Math.hypot(later!.x - initial!.x, later!.y - initial!.y)).toBeGreaterThan(15);
    await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
    await expect.poll(() => icons.evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
    expect(await timing).toBeLessThan(1250);
    await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width < 1))).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBe(trigger);
    const landed = await icons.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      const preview = document.querySelector(".ka-hero-library")!.getBoundingClientRect();
      return { inside: box.top >= preview.top && box.bottom <= preview.bottom, depth: (box.y + box.height / 2 - preview.y) / preview.height };
    }));
    expect(landed.every(point => point.inside)).toBe(true);
    expect(landed.filter(point => point.depth >= .4 && point.depth <= .65)).toHaveLength(2);
    expect(landed.filter(point => point.depth > .8)).toHaveLength(1);
    await page.setViewportSize({ width, height: height + 40 });
    await expect.poll(() => icons.evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect.poll(() => page.locator("[data-hero-icon]").first().evaluate(element => getComputedStyle(element).visibility)).toBe("visible");
    await page.evaluate(top => scrollTo({ top, behavior: "instant" }), trigger);
    await expect.poll(() => icons.first().evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
    await expect.poll(() => icons.evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
  });
}

for (const width of [2134, 390]) {
  test(`fast scrolling keeps the flight visible near the library bottom at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/about");
    await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
    const visibleLanding = await page.evaluate(async () => {
      const library = document.querySelector(".ka-hero-library")!.getBoundingClientRect();
      scrollTo({ top: scrollY + library.bottom - innerHeight * .8, behavior: "instant" });
      const started = performance.now();
      while (performance.now() - started < 1600) {
        await new Promise(requestAnimationFrame);
        const preview = document.querySelector(".ka-hero-library")!.getBoundingClientRect();
        const visible = [...document.querySelectorAll("[data-flight-icon]")].some(element => {
          const box = element.getBoundingClientRect();
          return Number(getComputedStyle(element).opacity) > .2 && box.top >= preview.top + preview.height * .7 && box.bottom < innerHeight && box.top > 100;
        });
        if (visible) return true;
      }
      return false;
    });
    expect(visibleLanding).toBe(true);
    await expect.poll(() => page.locator("[data-flight-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "visible" && element.getBoundingClientRect().width > 30))).toBe(true);
  });
}

test("auto drop reverses mid-flight and can be sent down again", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  const trigger = await page.evaluate(() => Math.ceil(Math.min(...[...document.querySelectorAll("[data-hero-icon]")].map(element => element.getBoundingClientRect().top)) - document.querySelector(".ka-header")!.getBoundingClientRect().bottom - 72) + 2);
  const icon = page.locator('[data-flight-icon="links"]');
  await page.evaluate(top => scrollTo({ top, behavior: "instant" }), trigger);
  await expect(icon).toHaveCSS("opacity", "1");
  await page.waitForTimeout(100);
  await page.evaluate(top => scrollTo({ top: top - 35, behavior: "instant" }), trigger);
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "false");
  await expect(icon).toHaveCSS("opacity", "1");
  await page.waitForTimeout(90);
  const duringReturn = await icon.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).f);
  await page.evaluate(top => scrollTo({ top: top + 30, behavior: "instant" }), trigger);
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "true");
  const afterRedirect = await icon.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).f);
  expect(Math.abs(afterRedirect - duringReturn)).toBeLessThan(100);
  await expect.poll(() => page.locator("[data-flight-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(icon).toHaveCSS("opacity", "1");
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "visible" && element.getBoundingClientRect().width > 30))).toBe(true);
});

test("auto drop returns its icons after a narrow resize mid flight", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  await page.evaluate(() => scrollTo({ top: 90, behavior: "instant" }));
  await expect.poll(() => page.locator('[data-flight-icon="links"]').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element =>
    getComputedStyle(element).visibility === "visible" && element.getBoundingClientRect().width > 30,
  ))).toBe(true);
  await expect.poll(() => page.locator("[data-flight-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("automatic flight keeps mobile copy anchored as icons leave and return", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  const copy = page.locator(".ka-hero-copy");
  const initialTop = (await copy.boundingBox())!.y;
  await page.evaluate(() => scrollTo({ top: 100, behavior: "instant" }));
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "true");
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width < 1))).toBe(true);
  expect(Math.abs((await copy.boundingBox())!.y - (initialTop - 100))).toBeLessThan(3);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "false");
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width > 30))).toBe(true);
  expect(Math.abs((await copy.boundingBox())!.y - initialTop)).toBeLessThan(3);
});

test("early scrolling waits for the hero entrance before starting the flight", async ({ page }) => {
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  const library = page.locator(".ka-hero-library");
  await library.evaluate(element => element.getAnimations()[0]?.pause());
  await page.evaluate(() => scrollTo({ top: 100, behavior: "instant" }));
  await page.waitForTimeout(300);
  expect(await page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element =>
    getComputedStyle(element).visibility === "visible" && element.getBoundingClientRect().width > 30,
  ))).toBe(true);
  await library.evaluate(element => element.getAnimations()[0]?.play());
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "true");
});

test("automatic flight starts after restoring an already scrolled page", async ({ page }) => {
  await page.addInitScript(() => window.addEventListener("DOMContentLoaded", () => scrollTo({ top: 100, behavior: "instant" }), { once: true }));
  await page.goto("/about");
  expect(await page.evaluate(() => scrollY)).toBe(100);
  await expect(page.locator(".ka-hero")).toHaveAttribute("data-hero-compact", "true");
  await expect.poll(() => page.locator("[data-flight-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width < 1))).toBe(true);
});
