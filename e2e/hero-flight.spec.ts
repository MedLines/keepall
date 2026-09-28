import { expect, test } from "@playwright/test";

for (const width of [2134, 1440, 390, 320]) {
  test(`hero icons arc into the preview and return at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 2134 ? 1032 : 900 });
    await page.goto("/about");
    const sources = page.locator("[data-hero-icon]");
    const icons = page.locator("[data-flight-icon]");
    await expect(icons).toHaveCount(4);
    await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
    const gap = await page.evaluate(() => document.querySelector(".ka-hero-library")!.getBoundingClientRect().top - document.querySelector(".ka-hero-copy")!.getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(115);
    expect(gap).toBeLessThanOrEqual(180);
    const samples = [];
    for (let top = 0; top <= 1600; top += 20) {
      await page.evaluate(async top => {
        window.scrollTo({ top, behavior: "instant" });
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }, top);
      samples.push(await icons.evaluateAll(elements => {
        const navBottom = document.querySelector(".ka-header")!.getBoundingClientRect().bottom;
        const preview = document.querySelector(".ka-hero-library")!.getBoundingClientRect();
        return elements.map(element => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const matrix = new DOMMatrixReadOnly(style.transform);
          return { opacity: Number(style.opacity), scale: Math.hypot(matrix.a, matrix.b), top: box.top, navBottom,
            insideViewport: box.left >= 0 && box.right <= innerWidth,
            insidePreview: box.x + box.width / 2 >= preview.left && box.x + box.width / 2 <= preview.right && box.y + box.height / 2 >= preview.top && box.y + box.height / 2 <= preview.bottom };
        });
      }));
    }
    for (let index = 0; index < 4; index++) {
      const visible = samples.map(sample => sample[index]).filter(sample => sample.opacity > .01);
      expect(visible.length).toBeGreaterThan(15);
      expect(visible.every(sample => sample.insideViewport && sample.top >= sample.navBottom + 2)).toBe(true);
      expect(Math.max(...visible.map(sample => sample.scale))).toBeGreaterThan(1.1);
      const landing = visible.filter(sample => sample.opacity < .9);
      expect(landing.length).toBeGreaterThan(0);
      expect(landing.every(sample => sample.insidePreview && sample.scale < .5)).toBe(true);
    }
    await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
    await expect.poll(() => sources.evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width < 1))).toBe(true);
    await expect.poll(() => icons.evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "0"))).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => sources.evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "visible"))).toBe(true);
    await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("reduced motion preserves the original icons and readable copy", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  await page.evaluate(() => window.scrollTo({ top: 240, behavior: "instant" }));
  await expect(page.locator(".ka-hero-flight-layer")).toHaveCount(0);
  await expect(page.locator(".ka-hero-copy")).toHaveCSS("opacity", "1");
  expect(await page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === "visible"))).toBe(true);
  await expect(page.locator(".ka-hero")).toHaveCSS("position", "relative");
  expect(await page.locator(".ka-hero-track").evaluate(element => getComputedStyle(element, "::after").content)).toBe("none");
});

for (const width of [2134, 1440, 390]) {
  test(`auto drop finishes without more scrolling at ${width}px`, async ({ page }) => {
    const height = width === 2134 ? 1032 : 900;
    await page.setViewportSize({ width, height });
    await page.goto("/about#auto-drop-preview");
    await expect(page.locator(".ka-hero")).toHaveAttribute("data-flight-mode", "timed");
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
      return box.top >= preview.top && box.bottom <= innerHeight && box.bottom <= preview.bottom;
    }));
    expect(landed.every(Boolean)).toBe(true);
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

test("auto drop reverses mid-flight and can be sent down again", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about#auto-drop-preview");
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

test("scroll scene stays pinned through a long flight, then releases", async ({ page }) => {
  await page.setViewportSize({ width: 2134, height: 1032 });
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  const copy = page.locator(".ka-hero-copy");
  const centers = [];
  for (const top of [100, 500, 900, 1700]) {
    await page.evaluate(top => scrollTo({ top, behavior: "instant" }), top);
    await page.waitForTimeout(280);
    centers.push(await copy.evaluate(element => { const box = element.getBoundingClientRect(); return box.y + box.height / 2; }));
  }
  expect(Math.abs(centers[1] - centers[0])).toBeLessThan(2);
  expect(Math.abs(centers[2] - centers[0])).toBeLessThan(2);
  expect(centers[2] - centers[3]).toBeGreaterThan(200);
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width < 1))).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.locator("[data-hero-icon]").evaluateAll(elements => elements.every(element => element.getBoundingClientRect().width > 60))).toBe(true);
  await expect(copy).toHaveCSS("transform", "none");
});

for (const width of [2134, 390]) {
  test(`scroll library grows toward the viewport center and shrinks on return at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1032 });
    await page.goto("/about");
    const preview = page.locator(".ka-hero-preview-scroll");
    await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
    const scale = () => preview.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
    const initial = await scale();
    expect(initial).toBeGreaterThanOrEqual(.88);
    expect(initial).toBeLessThan(.91);
    const { release, center } = await page.evaluate(() => {
      const box = document.querySelector(".ka-hero-library")!.getBoundingClientRect();
      return { release: parseFloat(getComputedStyle(document.querySelector(".ka-hero-track")!, "::after").height), center: box.y + box.height / 2 - innerHeight / 2 };
    });
    await page.evaluate(top => scrollTo({ top, behavior: "instant" }), release + center / 2);
    await expect.poll(scale).toBeGreaterThan(initial + .02);
    expect(await scale()).toBeLessThan(.99);
    await page.evaluate(top => scrollTo({ top, behavior: "instant" }), Math.ceil(release + center));
    await expect.poll(scale).toBeCloseTo(1, 3);
    const box = await page.locator(".ka-hero-library").boundingBox();
    expect(Math.abs(box!.y + box!.height / 2 - 516)).toBeLessThan(2);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(scale).toBeCloseTo(initial, 3);
    await page.goto("/about#auto-drop-preview");
    await expect(page.locator(".ka-hero")).toHaveAttribute("data-flight-mode", "timed");
    await expect.poll(scale).toBe(1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    await expect(preview).toHaveCSS("transform", "none");
  });
}
