import { expect, test } from "@playwright/test";

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
    await expect(gallery.getByRole("region", { name: "Tags", exact: true })).toBeVisible();
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
  const end = await stack.evaluate(element => element.getBoundingClientRect().bottom + window.scrollY - 786);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), end);
  await expect.poll(() => surfaces.first().evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(1000);
  const last = surfaces.last();
  await expect.poll(() => last.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(160);
  const edges = await surfaces.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(edges[0]).toBeGreaterThanOrEqual(100);
  expect(edges[1] - edges[0]).toBeGreaterThanOrEqual(23);
  expect(edges[2] - edges[1]).toBeGreaterThanOrEqual(23);
  expect(await surfaces.evaluateAll(elements => elements.every(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.top + 8));
  }))).toBe(true);
  await expect(page.getByRole("heading", { name: "Your interests. Your device. Your library." })).toBeVisible();
  for (const distance of [20, 120]) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: "instant" }), end + distance);
    await expect.poll(async () => Math.abs((await last.evaluate(element => element.getBoundingClientRect().top)) - (edges[2] - distance))).toBeLessThan(1);
    const released = await surfaces.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    released.forEach((top, index) => expect(Math.abs(top - (edges[index] - distance))).toBeLessThan(1));
  }
  await page.evaluate((y) => window.scrollTo(0, y), start);
  await expect.poll(() => surfaces.first().evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(1060);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator(".ka-stack-card").first().evaluate((element) => getComputedStyle(element).position)).toBe("relative");
  await expect.poll(() => surfaces.first().evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});

test("ordinary feature flow has no stack hold on phones or short screens", async ({ page }) => {
  await page.goto("/about");
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 700 }, { width: 1000, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".ka-stack-card").last()).toHaveCSS("position", "relative");
    expect(await page.locator(".ka-stack").evaluate(element => Math.abs(element.getBoundingClientRect().bottom - element.lastElementChild!.getBoundingClientRect().bottom))).toBeLessThan(1);
  }
});


test("gallery videos autoplay, restart on selection, advance, and respect manual pause", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/about");
  const gallery = page.locator(".ka-gallery");
  const videos = gallery.locator("video");
  expect(await videos.evaluateAll(elements => elements.every(video => (video as HTMLVideoElement).paused))).toBe(true);
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.getByRole("button", { name: "Pause Your library demo" })).toBeVisible();
  await expect.poll(() => videos.first().evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  await videos.first().evaluate(video => { (video as HTMLVideoElement).currentTime = 4; });
  await gallery.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(gallery.getByRole("button", { name: "Pause Collections demo" })).toBeVisible();
  expect(await videos.first().evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
  await gallery.getByRole("button", { name: "Tags", exact: true }).click();
  await expect(gallery.getByRole("button", { name: "Pause Tags demo" })).toBeVisible();
  await expect.poll(() => gallery.locator('.ka-gallery-content[aria-hidden="false"] video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  await gallery.getByRole("button", { name: "Your library", exact: true }).click();
  await expect.poll(() => videos.first().evaluate(video => (video as HTMLVideoElement).currentTime)).toBeLessThan(2);
  await videos.first().evaluate(element => { const video = element as HTMLVideoElement; video.currentTime = video.duration - .1; });
  await expect(gallery.getByRole("button", { name: "Collections", exact: true })).toHaveAttribute("aria-pressed", "true");
  const selectedVideo = gallery.locator('.ka-gallery-content[aria-hidden="false"] video');
  await gallery.getByRole("button", { name: "Pause Collections demo" }).click();
  expect(await selectedVideo.evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.getByRole("button", { name: "Resume Collections demo" })).toBeVisible();
  expect(await selectedVideo.evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
  await gallery.getByRole("button", { name: "Resume Collections demo" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => selectedVideo.evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
});

test("extension examples are recorded videos with responsive controls", async ({ page }) => {
  await page.goto("/about#extension");
  const capture = page.locator("#extension");
  await expect(capture.getByText("See it in action", { exact: true })).toBeVisible();
  await expect(capture.getByText("Interactive demo", { exact: true })).toHaveCount(0);
  await expect(capture.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
  for (const width of [320, 390, 2134]) {
    await page.setViewportSize({ width, height: 1032 });
    const rows = await capture.locator(".ka-demo-choices button").evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)));
    expect(new Set(rows).size).toBe(width <= 520 ? 2 : 1);
    expect(await capture.locator(".ka-demo-choices").evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.scrollWidth <= element.clientWidth && [...element.querySelectorAll("button")].every(button => {
        const rect = button.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right;
      });
    })).toBe(true);
    for (const name of ["Page", "Image", "Text", "Organize", "Alt+K"]) {
      await capture.getByRole("button", { name, exact: true }).click();
      const recording = capture.locator('.ka-capture-video[aria-hidden="false"]');
      await recording.scrollIntoViewIfNeeded();
      await expect(recording.getByRole("button", { name: `Pause ${name} capture demo` })).toBeVisible();
      await expect.poll(() => recording.locator("video").evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
      expect(await capture.locator('.ka-capture-video[aria-hidden="true"] video').evaluateAll(elements => elements.every(video => (video as HTMLVideoElement).paused))).toBe(true);
      await expect.poll(() => recording.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)).toBe(0);
      const frame = await recording.boundingBox();
      expect(frame!.x).toBeGreaterThanOrEqual(0);
      expect(frame!.x + frame!.width).toBeLessThanOrEqual(width);
      const scene = await capture.locator(".ka-card-scene").boundingBox();
      const demo = await capture.locator(".ka-demo").boundingBox();
      expect(demo!.y).toBeGreaterThanOrEqual(scene!.y);
      expect(demo!.y + demo!.height).toBeLessThanOrEqual(scene!.y + scene!.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test("rapid gallery changes settle on the last choice and respect reduced motion", async ({ page }) => {
  await page.goto("/about#collection");
  const gallery = page.locator(".ka-gallery");
  await gallery.scrollIntoViewIfNeeded();
  await gallery.evaluate(async element => {
    const choices = element.querySelectorAll<HTMLButtonElement>(".ka-gallery-tabs button");
    for (const index of [1, 3, 0, 2]) {
      choices[index].click();
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  });
  await expect(gallery.getByRole("button", { name: "Pause Tags demo" })).toBeVisible();
  const active = gallery.locator('.ka-gallery-content[aria-hidden="false"]');
  await expect(active).toHaveCSS("opacity", "1");
  await expect.poll(() => active.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)).toBe(0);
  expect(await gallery.locator('.ka-gallery-content[aria-hidden="true"] video').evaluateAll(elements => elements.every(element => (element as HTMLVideoElement).paused))).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gallery.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(active).toHaveCSS("opacity", "1");
  await expect(active).toHaveCSS("transition-duration", "0s");
  await expect(active).toHaveCSS("transform", "none");
});

for (const demo of [
  { name: "gallery", anchor: "collection", root: ".ka-gallery", buttons: ".ka-gallery-tabs button", panels: ".ka-gallery-content", labels: ["Your library", "Collections", "Tags", "Search"] },
  { name: "extension", anchor: "extension", root: "#extension", buttons: ".ka-demo-choices button", panels: ".ka-capture-video", labels: ["Page", "Image", "Text", "Organize", "Alt+K"] },
]) {
test(`${demo.name} slides follow the selected tab's direction while crossfading`, async ({ page }) => {
  await page.goto(`/about#${demo.anchor}`);
  const gallery = page.locator(demo.root);
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.locator(demo.buttons)).toHaveText(demo.labels);
  const samples = await gallery.evaluate(async (element, selectors) => {
    const buttons = element.querySelectorAll<HTMLButtonElement>(selectors.buttons);
    const panels = [...element.querySelectorAll<HTMLElement>(selectors.panels)];
    async function sample(index: number) {
      buttons[index].click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const animations = panels.flatMap(panel => panel.getAnimations());
      animations.forEach(animation => { animation.pause(); animation.currentTime = 100; });
      const frames = panels.map(panel => ({ x: new DOMMatrixReadOnly(getComputedStyle(panel).transform).m41 / panel.clientWidth, opacity: Number(getComputedStyle(panel).opacity) }));
      animations.forEach(animation => animation.finish());
      return frames;
    }
    return { forward: await sample(2), backward: await sample(0) };
  }, { buttons: demo.buttons, panels: demo.panels });
  expect(samples.forward[0].x).toBeLessThan(-.25);
  expect(samples.forward[2].x).toBeGreaterThan(.25);
  expect(samples.backward[0].x).toBeLessThan(-.25);
  expect(samples.backward[2].x).toBeGreaterThan(.25);
  for (const frames of Object.values(samples)) {
    for (const index of [0, 2]) {
      expect(frames[index].opacity).toBeGreaterThan(0);
      expect(frames[index].opacity).toBeLessThan(1);
    }
  }
});
}

test("footer needs extra scrolling and drops icons to the floor with CSS motion", async ({ page }) => {
  await page.goto("/about");
  const content = page.locator(".ka-footer-wordmark-cover");
  const offset = () => content.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  await page.mouse.wheel(0, 100);
  expect(await offset()).toBe(0);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const wordmark = page.locator(".ka-footer-wordmark");
  await expect(wordmark).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(wordmark).toHaveCSS("opacity", "0.3");
  const wordmarkBefore = await wordmark.boundingBox();
  await page.waitForTimeout(300);
  expect(await offset()).toBe(0);
  await expect(wordmark).toHaveCSS("transform", "none");
  await page.mouse.wheel(0, 80);
  await expect.poll(offset, { intervals: [16] }).toBeLessThan(-50);
  await expect(wordmark).toHaveCSS("transform", "none");
  for (let pulse = 0; pulse < 20; pulse += 1) {
    await page.mouse.wheel(0, 40);
  }
  const icons = page.locator(".ka-footer-icon");
  await expect(page.locator(".ka-footer-elastic")).toHaveAttribute("data-footer-launched", "");
  expect(await page.locator(".ka-footer-elastic").evaluate(element => element.getAnimations({ subtree: true }).every(animation => animation instanceof CSSAnimation || animation instanceof CSSTransition))).toBe(true);
  const delays = await icons.evaluateAll(elements => elements.map(element => Number.parseFloat(getComputedStyle(element).animationDelay)));
  expect(delays[3] - delays[0]).toBeGreaterThanOrEqual(.05);
  await expect(page.locator(".ka-footer-elastic")).not.toHaveAttribute("data-footer-launched", "");
  const floors = await icons.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().bottom));
  expect(Math.max(...floors) - Math.min(...floors)).toBeLessThan(8);
  const viewportHeight = page.viewportSize()!.height;
  expect(floors.every(bottom => bottom <= viewportHeight + 8 && bottom >= viewportHeight - 4)).toBe(true);
  expect(await wordmark.boundingBox()).toEqual(wordmarkBefore);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
  await expect.poll(offset).toBe(0);
  await page.mouse.wheel(0, -240);
  await expect.poll(() => page.evaluate(() => scrollY + innerHeight)).toBeLessThan(height - 100);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.mouse.wheel(0, 240);
  expect(await offset()).toBe(0);
});

test("CSS footer return can be interrupted and triggered again", async ({ page }) => {
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - scrollY - innerHeight)).toBeLessThan(3);
  const frame = page.locator(".ka-footer-elastic");
  const offset = () => page.locator(".ka-footer-wordmark-cover").evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  await page.mouse.wheel(0, 80);
  await expect.poll(offset, { intervals: [16] }).toBeLessThan(-50);
  await expect(frame).not.toHaveAttribute("data-footer-pulled", "");
  await page.waitForTimeout(40);
  const continuity = page.evaluate(() => new Promise<number>(resolve => {
    const cover = document.querySelector(".ka-footer-wordmark-cover")!;
    const read = () => new DOMMatrixReadOnly(getComputedStyle(cover).transform).m42;
    let before = 0;
    window.addEventListener("wheel", () => { before = read(); }, { once: true, capture: true });
    window.addEventListener("wheel", () => resolve(Math.abs(read() - before)), { once: true });
  }));
  await page.mouse.wheel(0, 40);
  expect(await continuity).toBeLessThan(3);
  await expect(frame).toHaveAttribute("data-footer-pulled", "");
  await expect.poll(offset).toBe(0);
  await expect(frame).not.toHaveAttribute("data-footer-revealed", "");
  await page.mouse.wheel(0, 80);
  await expect(frame).toHaveAttribute("data-footer-revealed", "");
  await expect.poll(() => page.locator(".ka-footer-icon").first().evaluate(element => Number(getComputedStyle(element).opacity)), { intervals: [16] }).toBeGreaterThan(.8);
});

test("footer returns promptly after a large extra scroll", async ({ page }) => {
  await page.goto("/about");
  await expect.poll(() => page.locator(".ka-hero-library").evaluate(element => element.getAnimations().length)).toBe(0);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - scrollY - innerHeight)).toBeLessThan(3);
  const returnTime = page.evaluate(async () => {
    const cover = document.querySelector(".ka-footer-wordmark-cover")!;
    const started = performance.now();
    let revealed = false;
    while (performance.now() - started < 1500) {
      await new Promise(requestAnimationFrame);
      const y = new DOMMatrixReadOnly(getComputedStyle(cover).transform).m42;
      revealed ||= y < -20;
      if (revealed && Math.abs(y) < .5) return performance.now() - started;
    }
    return Infinity;
  });
  await page.mouse.wheel(0, 1200);
  expect(await returnTime).toBeLessThan(750);
  await expect(page.locator(".ka-footer-elastic")).not.toHaveAttribute("data-footer-revealed", "");
});

test("reduced motion keeps both galleries still until playback is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about#extension");
  const capture = page.locator("#extension");
  await capture.scrollIntoViewIfNeeded();
  expect(await page.locator("video").evaluateAll(elements => elements.every(video => (video as HTMLVideoElement).paused))).toBe(true);
  const play = capture.getByRole("button", { name: "Play Page capture demo" });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(capture.getByRole("button", { name: "Pause Page capture demo" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(capture.getByRole("button", { name: "Resume Page capture demo" })).toBeVisible();
  await capture.getByRole("button", { name: "Text", exact: true }).click();
  const selected = capture.locator('.ka-capture-video[aria-hidden="false"]');
  await expect(selected).toHaveCSS("transform", "none");
  await expect(selected).toHaveCSS("transition-duration", "0s");
  expect(await selected.locator("video").evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
});
