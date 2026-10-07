import { expect, test as base } from "@playwright/test";
import sharp from "sharp";

const publicRoutes = [
  "/about", "/help", "/contact", "/changelog", "/privacy", "/blog",
  "/blog/design-reference-library", "/blog/browser-bookmarks",
];
const informationLinks = [
  ["Contact", "/contact"], ["Changelog", "/changelog"], ["Privacy", "/privacy"],
] as const;

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    // Vercel provides this script on deployment; a local Next server has no endpoint.
    await page.route("**/_vercel/insights/script.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "",
    }));
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    await use(errors);
    expect(errors, "browser errors").toEqual([]);
  }, { auto: true }],
});

for (const width of [320, 390, 580, 768, 1024, 1440]) {
  test(`header links fit and Contact works by keyboard at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    const header = page.locator(".ka-header");
    const contact = header.getByRole("link", { name: "Contact", exact: true });
    await expect(contact).toBeInViewport();
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    for (const link of await header.getByRole("link").all()) {
      if (!await link.isVisible()) continue;
      const box = await link.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(headerBox!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(headerBox!.x + headerBox!.width);
      expect(box!.y).toBeGreaterThanOrEqual(headerBox!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height);
    }
    for (let tab = 0; tab < 12; tab += 1) {
      await page.keyboard.press("Tab");
      if (await contact.evaluate(element => element === document.activeElement)) break;
    }
    await expect(contact).toBeFocused();
    await expect(contact).toHaveCSS("outline-style", "solid");
    await page.screenshot({ path: testInfo.outputPath(`about-header-${width}.png`) });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell us what went wrong.");
    await expect(page.getByRole("link", { name: "Open GitHub issues" })).toHaveAttribute("href", "https://github.com/MedLines/keepall/issues");
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`contact-${width}.png`), fullPage: true });
  });
}

for (const width of [320, 1440]) {
  test(`public pages scroll to their footer without overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of publicRoutes) {
      const response = await page.goto(route);
      expect(response!.status(), route).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
      const footer = page.getByRole("navigation", { name: "Footer navigation" });
      await footer.getByRole("link").last().scrollIntoViewIfNeeded();
      await expect(footer.getByRole("link").last(), route).toBeInViewport();
      expect(await page.evaluate(() => scrollY), route).toBeGreaterThan(0);
      for (const [name, href] of informationLinks) {
        await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
      }
      await expect(footer.getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog");
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1).replaceAll("/", "-")}-footer-${width}.png`) });
    }
  });
}

test("Settings and the library expose the public information links", async ({ page }) => {
  await page.goto("/settings");
  const information = page.getByRole("navigation", { name: "Support and information" });
  for (const [name, href] of informationLinks) {
    const link = information.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(information).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Privacy and network requests", exact: true })).toHaveAttribute("href", "/privacy");
  await page.goto("/");
  await page.getByRole("link", { name: "Keepall home", exact: true }).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Keepall navigation" });
  await expect(menu).toBeVisible();
  for (const [name, href] of informationLinks) {
    await expect(menu.getByRole("menuitem", { name, exact: true })).toHaveAttribute("href", href);
  }
});

test("blog articles are linked, show actual screenshots, and link to valid Help anchors", async ({ page, request }, testInfo) => {
  await page.goto("/blog");
  const helpAnchors = new Set<string>();
  for (const slug of ["design-reference-library", "browser-bookmarks"]) {
    const link = page.locator(`main h2 a[href="/blog/${slug}"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
    const screenshots = page.locator("main figure img");
    expect(await screenshots.count()).toBeGreaterThan(0);
    for (const screenshot of await screenshots.all()) {
      await screenshot.scrollIntoViewIfNeeded();
      await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(screenshot).toHaveAttribute("alt", /Keepall/);
    }
    for (const href of await page.locator('main a[href^="/help/"]').evaluateAll(links => links.map(link => link.getAttribute("href")!))) {
      helpAnchors.add(href);
    }
    await page.keyboard.press("Control+Home");
    await page.screenshot({ path: testInfo.outputPath(`blog-${slug}.png`), fullPage: true });
    await page.goto("/blog");
  }
  expect(helpAnchors.size).toBeGreaterThan(0);
  for (const href of helpAnchors) {
    const response = await request.get(href.split("#")[0]);
    expect(response.status(), href).toBe(200);
    await page.goto(href);
    const hash = new URL(page.url()).hash.slice(1);
    if (hash) await expect(page.locator(`[id="${hash}"]`), href).toBeVisible();
  }
});

test("public content links resolve and in-page targets exist", async ({ page, request }) => {
  const links = new Set<string>();
  for (const route of [...publicRoutes, "/extension-privacy"]) {
    await page.goto(route);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/press"]')).toHaveCount(0);
    for (const href of await page.locator('main a[href^="/"], main a[href^="#"]').evaluateAll(elements =>
      elements.map(element => element.getAttribute("href")!)
    )) {
      links.add(href.startsWith("#") ? route + href : href);
    }
  }
  for (const href of links) {
    const url = new URL(href, "http://localhost:3114");
    const response = await request.get(url.pathname + url.search);
    expect(response.status(), href).toBe(200);
    if (url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (url.pathname === "/settings") {
        await page.goto(href);
        await expect(page.locator(`[id="${id}"]`), href).toBeVisible();
      } else {
        expect(await response.text(), href).toContain(`id="${id}"`);
      }
    }
  }
});

test("titles, descriptions and share images are usable on every public route", async ({ page, request }) => {
  const imagePaths = new Set<string>();
  for (const route of ["/", ...publicRoutes]) {
    await page.goto(route);
    await expect(page).toHaveTitle(/Keepall/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S.{30,}/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /\S.{10,}/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /\S.{30,}/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      const url = new URL((await page.locator(selector).getAttribute("content"))!);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("www.keepall.app");
      imagePaths.add(url.pathname + url.search);
    }
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
  }
  for (const path of imagePaths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
    const bytes = await response.body();
    expect(bytes.byteLength).toBeLessThan(5 * 1024 * 1024);
    const dimensions = await sharp(bytes).metadata();
    expect(dimensions.width).toBe(1200);
    expect(dimensions.height).toBe(630);
  }
});
