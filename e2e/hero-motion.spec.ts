import { expect, test } from "@playwright/test";

test("hero phrases fade upward in reading order", async ({ page }) => {
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".ka-hero-phrase").forEach(element => element.getAnimations().forEach(animation => animation.pause()));
  }, { once: true }));
  await page.goto("/about");
  const phrases = page.locator(".ka-hero-phrase");
  await expect(phrases).toHaveCount(5);
  await expect(page.getByRole("group", { name: "Compare hero animations" })).toHaveCount(0);
  const frames = await phrases.evaluateAll(elements => elements.map(element => {
    const animation = element.getAnimations()[0];
    if (!animation) throw new Error("Hero entrance animation was not found");
    animation.pause();
    const delay = Number(animation.effect!.getTiming().delay);
    animation.currentTime = delay;
    const start = element.getBoundingClientRect().top;
    animation.currentTime = delay + 80;
    const opacity = Number(getComputedStyle(element).opacity);
    const middle = element.getBoundingClientRect().top;
    animation.finish();
    const end = element.getBoundingClientRect().top;
    return { start, middle, end, opacity, delay };
  }));
  expect(frames.map(frame => Math.round(frame.delay))).toEqual([80, 165, 250, 335, 420]);
  for (const frame of frames) {
    expect(frame.start - frame.end).toBeGreaterThanOrEqual(13);
    expect(frame.middle).toBeLessThan(frame.start);
    expect(frame.middle).toBeGreaterThan(frame.end);
    expect(frame.opacity).toBeGreaterThan(0);
    expect(frame.opacity).toBeLessThan(1);
  }
});

test("switching between hero icons never replays the previous phrase entrance", async ({ page }) => {
  await page.goto("/about");
  const phrases = page.locator(".ka-hero-phrase");
  await expect.poll(() => phrases.evaluateAll(elements => elements.every(element =>
    element.getAnimations().length === 0 && getComputedStyle(element).opacity === "1",
  ))).toBe(true);
  for (const name of ["links", "notes", "images", "videos", "links"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const samples = await phrases.evaluateAll(async elements => {
      const samples: number[][] = [];
      for (let frame = 0; frame < 12; frame++) {
        samples.push(elements.map(element => Number(getComputedStyle(element).opacity)));
        await new Promise(requestAnimationFrame);
      }
      return samples;
    });
    expect(samples.every(frame => frame.every(opacity => opacity === 1))).toBe(true);
  }
  await page.keyboard.press("Tab");
  expect(await phrases.evaluateAll(elements => elements.every(element =>
    getComputedStyle(element).opacity === "1" && element.getAnimations().length === 0,
  ))).toBe(true);
});

for (const width of [1440, 390, 320]) {
  test(`hero entrance keeps content in blocks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll(".ka-hero-phrase, .ka-hero-description, .ka-hero-actions").forEach(element =>
        element.getAnimations().forEach(animation => animation.pause()),
      );
    }, { once: true }));
    await page.goto("/about");
    const description = page.locator(".ka-hero-description");
    const actions = page.locator(".ka-hero-actions");
    await expect(description).toContainText("Find anything with search.");
    await expect(actions.getByRole("link", { name: "Start your library" })).toBeVisible();
    await expect(actions.locator(".ka-fine-print")).toContainText("No account needed.");
    const blocks = await page.locator(".ka-hero-phrase, .ka-hero-description, .ka-hero-actions").evaluateAll(elements => elements.map(element => {
      const animation = element.getAnimations()[0];
      if (!animation) throw new Error("Block entrance missing");
      const childrenAnimate = [...element.querySelectorAll("*")].some(child => child.getAnimations().some(a => a instanceof CSSAnimation));
      animation.pause();
      const timing = animation.effect!.getTiming();
      const delay = Number(timing.delay);
      const duration = Number(timing.duration);
      animation.currentTime = delay;
      const initialOpacity = Number(getComputedStyle(element).opacity);
      animation.currentTime = delay + Number(duration) / 2;
      const middleOpacity = Number(getComputedStyle(element).opacity);
      animation.finish();
      return { childrenAnimate, initialOpacity, middleOpacity, endOpacity: Number(getComputedStyle(element).opacity), delay };
    }));
    expect(blocks).toHaveLength(7);
    for (const block of blocks) {
      expect(block.childrenAnimate).toBe(false);
      expect(block.initialOpacity).toBe(0);
      expect(block.middleOpacity).toBeGreaterThan(0);
      expect(block.middleOpacity).toBeLessThan(1);
      expect(block.endOpacity).toBe(1);
    }
    expect(blocks.map(block => block.delay)).toEqual([...blocks.map(block => block.delay)].sort((a, b) => a - b));
    await page.setViewportSize({ width: width === 1440 ? 1280 : 375, height: 900 });
    await expect.poll(() => description.evaluate(element => element.getAnimations().length)).toBe(0);
    await expect.poll(() => actions.evaluate(element => element.getAnimations().length)).toBe(0);
  });
}

test("reduced motion shows all entrance blocks immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const blocks = page.locator(".ka-header, .ka-hero-phrase, .ka-hero-description, .ka-hero-actions");
  expect(await blocks.evaluateAll(elements => elements.every(element =>
    element.getAnimations().length === 0 && getComputedStyle(element).opacity === "1" && getComputedStyle(element).transform === "none",
  ))).toBe(true);
});

test("mobile entrance does not reflow when its font arrives late", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route("**/*.woff2*", async route => {
    await new Promise(resolve => setTimeout(resolve, 1100));
    await route.continue();
  });
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  const start = await page.locator(".ka-hero-copy").evaluate(element => ({
    top: element.getBoundingClientRect().top,
    headingHeight: element.querySelector("h1")!.getBoundingClientRect().height,
  }));
  await page.evaluate(() => document.fonts.ready);
  const end = await page.locator(".ka-hero-copy").evaluate(element => ({
    top: element.getBoundingClientRect().top,
    headingHeight: element.querySelector("h1")!.getBoundingClientRect().height,
  }));
  expect(Math.abs(end.top - start.top)).toBeLessThan(2);
  expect(Math.abs(end.headingHeight - start.headingHeight)).toBeLessThan(2);
});
