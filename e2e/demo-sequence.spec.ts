import { expect, test } from "@playwright/test";

const demos = [
  { name: "library", anchor: "collection", root: ".ka-gallery", panels: ".ka-gallery-content", labels: ["Your library", "Collections", "Tags", "Search"] },
  { name: "capture", anchor: "extension", root: "#extension", panels: ".ka-capture-video", labels: ["Page", "Image", "Text", "Organize", "Alt+K"] },
];

for (const demo of demos) {
  test(`${demo.name} advances on video completion, wraps, and ignores inactive clips`, async ({ page }) => {
    await page.goto(`/about#${demo.anchor}`);
    const root = page.locator(demo.root);
    const activeVideo = root.locator(`${demo.panels}[aria-hidden="false"] video`);
    await activeVideo.scrollIntoViewIfNeeded();
    await expect.poll(() => activeVideo.evaluate(element => !(element as HTMLVideoElement).paused && Number.isFinite((element as HTMLVideoElement).duration))).toBe(true);
    expect(await activeVideo.evaluate(element => (element as HTMLVideoElement).loop)).toBe(false);
    await activeVideo.evaluate(element => { const video = element as HTMLVideoElement; video.currentTime = video.duration - .15; });
    await expect(root.getByRole("button", { name: demo.labels[1], exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => activeVideo.evaluate(element => !(element as HTMLVideoElement).paused)).toBe(true);

    await root.locator(`${demo.panels}[aria-hidden="true"] video`).first().dispatchEvent("ended");
    await expect(root.getByRole("button", { name: demo.labels[1], exact: true })).toHaveAttribute("aria-pressed", "true");

    await root.getByRole("button", { name: demo.labels.at(-1)!, exact: true }).click();
    await activeVideo.scrollIntoViewIfNeeded();
    await expect.poll(() => activeVideo.evaluate(element => !(element as HTMLVideoElement).paused && Number.isFinite((element as HTMLVideoElement).duration))).toBe(true);
    await activeVideo.evaluate(element => { const video = element as HTMLVideoElement; video.currentTime = video.duration - .15; });
    await expect(root.getByRole("button", { name: demo.labels[0], exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => activeVideo.evaluate(element => !(element as HTMLVideoElement).paused && (element as HTMLVideoElement).currentTime < 2)).toBe(true);
    expect(await root.locator(`${demo.panels}[aria-hidden="true"] video`).evaluateAll(elements => elements.every(element => (element as HTMLVideoElement).paused))).toBe(true);
  });

  test(`${demo.name} stays on the chosen walkthrough with reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/about#${demo.anchor}`);
    const root = page.locator(demo.root);
    const video = root.locator(`${demo.panels}[aria-hidden="false"] video`);
    await video.scrollIntoViewIfNeeded();
    const play = root.getByRole("button", { name: /^Play .* demo$/ });
    await play.click();
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await expect.poll(() => video.evaluate(element => !(element as HTMLVideoElement).paused && Number.isFinite((element as HTMLVideoElement).duration))).toBe(true);
    await video.evaluate(element => { const video = element as HTMLVideoElement; video.currentTime = video.duration - .15; });
    await expect(root.getByRole("button", { name: /^Replay .* demo$/ })).toBeVisible();
    await expect(root.getByRole("button", { name: demo.labels[0], exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}

test("video completion preserves keyboard focus on playback controls", async ({ page }) => {
  await page.goto("/about#collection");
  const gallery = page.locator(".ka-gallery");
  const video = gallery.locator('.ka-gallery-content[aria-hidden="false"] video');
  await video.scrollIntoViewIfNeeded();
  const control = gallery.getByRole("button", { name: "Pause Your library demo" });
  await control.focus();
  await expect.poll(() => video.evaluate(element => Number.isFinite((element as HTMLVideoElement).duration))).toBe(true);
  await video.evaluate(element => { const video = element as HTMLVideoElement; video.currentTime = video.duration - .15; });
  await expect(gallery.getByRole("button", { name: "Replay Your library demo" })).toBeFocused();
  await expect(gallery.getByRole("button", { name: "Your library", exact: true })).toHaveAttribute("aria-pressed", "true");
});
