import { expect, test as base } from "@playwright/test";
import sharp from "sharp";

const publicRoutes = [
  "/about", "/help", "/contact", "/changelog", "/privacy", "/blog",
  "/blog/design-reference-library", "/blog/browser-bookmarks",
  "/blog/project-research", "/blog/searchable-screenshots",
  "/help/search", "/help/documents", "/help/preview", "/help/notes",
];
const informationLinks = [
  ["Contact", "/contact"], ["Changelog", "/changelog"], ["Privacy", "/privacy"],
] as const;

const test = base.extend<{ browserErrors: string[]; expectedContactRateLimit: boolean }>({
  expectedContactRateLimit: [false, { option: true }],
  browserErrors: [async ({ page, expectedContactRateLimit }, use) => {
    const errors: string[] = [];
    // Vercel provides this script on deployment; a local Next server has no endpoint.
    await page.route("**/_vercel/insights/script.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "",
    }));
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const expectedRejection = expectedContactRateLimit
        && message.location().url.endsWith("/api/contact")
        && message.text() === "Failed to load resource: the server responded with a status of 429 (Too Many Requests)";
      if (!expectedRejection) errors.push(message.text());
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
    await expect(header.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Contact", exact: true })).toBeVisible();
    await expect(contact).not.toHaveClass(/ka-header-open|ka-button/);
    await expect(contact).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's hear from you.");
    await expect(page.getByRole("form", { name: "Contact Keepall" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open GitHub draft" })).toHaveAttribute("href", /^https:\/\/github\.com\/MedLines\/keepall\/issues\/new\?/);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`contact-${width}.png`), fullPage: true });
  });
}

test("text-only website buttons have balanced padding", async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    for (const button of await page.locator('main .ka-button:not(:has(svg))').all()) {
      const padding = await button.evaluate(element => {
        const style = getComputedStyle(element);
        return { left: style.paddingLeft, right: style.paddingRight };
      });
      expect(padding.left, `${route}: ${await button.textContent()}`).toBe(padding.right);
    }
  }
});

test("About and Contact buttons leave less space beside their icons", async ({ page }) => {
  await page.setViewportSize({ width: 1707, height: 825 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/about", "/contact"]) {
    await page.goto(route);
    const buttons = page.locator(".ka-header-open, .ka-button:has(> svg:last-child):not(:has(> .ka-chrome-mark))");
    expect(await buttons.count()).toBeGreaterThan(0);
    for (const button of await buttons.all()) {
      const padding = await button.evaluate(element => {
        const style = getComputedStyle(element);
        return { text: parseFloat(style.paddingLeft), icon: parseFloat(style.paddingRight) };
      });
      expect(padding.icon, `${route}: ${await button.textContent()}`).toBeLessThan(padding.text);
    }
  }
});

test("Contact has an inset Topic arrow and matching report actions", async ({ page }) => {
  await page.setViewportSize({ width: 1707, height: 825 });
  await page.goto("/contact");
  const topic = page.getByLabel("Topic", { exact: true });
  const inset = await topic.evaluate(element => {
    const style = getComputedStyle(element);
    const arrow = element.parentElement!.querySelector("svg")!.getBoundingClientRect();
    const select = element.getBoundingClientRect();
    return { text: parseFloat(style.paddingLeft), arrow: select.right - arrow.right, pointerEvents: getComputedStyle(element.parentElement!.querySelector("svg")!).pointerEvents };
  });
  expect(Math.abs(inset.text - inset.arrow)).toBeLessThanOrEqual(1);
  expect(inset.arrow).toBeGreaterThanOrEqual(12);
  expect(inset.pointerEvents).toBe("none");
  await topic.focus();
  await page.keyboard.press("b");
  await page.keyboard.press("Tab");
  await expect(topic).toHaveValue("bug");
  await expect(page.getByLabel("Browser and device")).toBeVisible();
  const copy = page.getByRole("button", { name: "Copy report" });
  const github = page.getByRole("link", { name: "Open GitHub draft" });
  for (const action of [copy, github]) await expect(action).toHaveClass(/ka-button/);
  const appearance = async (element: typeof copy) => element.evaluate(button => {
    const style = getComputedStyle(button);
    return { radius: style.borderRadius, corner: style.getPropertyValue("corner-shape"), background: style.backgroundImage, height: button.getBoundingClientRect().height, margin: style.marginTop };
  });
  expect(await appearance(copy)).toEqual(await appearance(github));
  for (const control of [copy, github, page.getByRole("button", { name: "Send message" }), page.locator(".ka-header-open")]) {
    await expect(control).toHaveCSS("border-radius", "999px");
    const corner = await control.evaluate(element => getComputedStyle(element).getPropertyValue("corner-shape"));
    if (corner) expect(corner).toBe("round");
  }
});

test("Contact keeps unsent bug reports available without email setup", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const submissions: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && request.url().endsWith("/api/contact")) submissions.push(request.url());
  });
  await page.goto("/contact");
  await expect(page.getByText("Email sending isn't available yet.", { exact: false })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Preview tester");
  await page.getByLabel("Email", { exact: true }).fill("preview@example.com");
  await page.getByLabel("Topic", { exact: true }).selectOption("bug");
  await page.getByLabel("Message", { exact: true }).fill("The bookmark import stopped.");
  await page.getByLabel("Browser and device").fill("Firefox on Android");
  await page.getByLabel("Steps to reproduce").fill("Choose Bulk import and select a bookmarks file.");
  await page.getByLabel("Expected result").fill("The bookmarks appear in my library.");
  await page.getByLabel("Actual result").fill("The import closes before completing.");
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await page.getByRole("button", { name: "Copy report" }).click();
  await expect(page.getByText(/Report copied\. Review it before posting publicly\.|Select the report below and copy it\./)).toBeVisible();
  const report = page.getByRole("textbox", { name: "Report to copy" });
  if (!await report.isVisible()) await page.getByText("Review report", { exact: true }).click();
  await expect(report).toHaveValue(/Firefox on Android/);
  await expect(report).toHaveValue(/The import closes before completing/);
  await expect(report).not.toHaveValue(/preview@example\.com|Preview tester/);
  const github = new URL((await page.getByRole("link", { name: "Open GitHub draft" }).getAttribute("href"))!);
  expect(github.searchParams.get("body")).toContain("The bookmark import stopped.");
  expect(github.searchParams.get("body")).not.toContain("preview@example.com");
  expect(submissions).toEqual([]);
});

test("Contact validates required fields and confirms only accepted submission", async ({ page }) => {
  let posted: Record<string, string> | undefined;
  await page.route("**/api/contact", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true } });
    } else {
      posted = route.request().postDataJSON();
      await route.fulfill({ json: { accepted: true } });
    }
  });
  await page.goto("/contact");
  const submit = page.getByRole("button", { name: "Send message" });
  await expect(submit).toBeEnabled();
  await submit.click();
  expect(posted).toBeUndefined();
  await page.getByLabel("Name", { exact: true }).fill("Preview tester");
  await page.getByLabel("Email", { exact: true }).fill("preview@example.com");
  await page.getByLabel("Message", { exact: true }).fill("Thanks for adding bookmark imports.");
  await submit.click();
  await expect(page.getByText("Your message was submitted. We'll reply to the email you provided.")).toBeVisible();
  expect(posted).toMatchObject({ email: "preview@example.com", topic: "help", message: "Thanks for adding bookmark imports." });
});

test("every Help guide has a loaded preview image", async ({ page }) => {
  await page.goto("/help");
  const previews = page.locator(".kh-guide-thumbnail > img");
  await expect(page.locator('.kh-guide-row[href="/help/install-keepall"] .kh-install-compact')).toBeVisible();
  expect(await previews.count()).toBeGreaterThan(0);
  for (const preview of await previews.all()) {
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toHaveAttribute("src", /\S/);
    await expect.poll(() => preview.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

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
  const thumbnails = page.locator(".kb-post-thumbnail img");
  await expect(thumbnails).toHaveCount(4);
  for (const thumbnail of await thumbnails.all()) {
    await thumbnail.scrollIntoViewIfNeeded();
    await expect.poll(() => thumbnail.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  const helpAnchors = new Set<string>();
  for (const slug of ["design-reference-library", "browser-bookmarks", "project-research", "searchable-screenshots"]) {
    const link = page.locator(`.kb-post-list a[href="/blog/${slug}"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
    const screenshots = page.locator("main figure img");
    expect(await screenshots.count()).toBeGreaterThan(0);
    for (const screenshot of await screenshots.all()) {
      await screenshot.scrollIntoViewIfNeeded();
      await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(screenshot).toHaveAttribute("alt", /\S/);
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

for (const width of [390, 1707]) {
  test(`About preserves the stack and uses six live demos in an asymmetric bento at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 825 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    await expect(page.locator(".ka-stack .ka-feature-card")).toHaveCount(3);
    await expect(page.locator(".ka-bento-card")).toHaveCount(6);
    await expect(page.locator(".ka-bento-visual [data-feature-demo]")).toHaveCount(6);
    await expect(page.locator('.ka-bento-visual img[src*="/details/"]')).toHaveCount(0);
    if (width === 1707) {
      const reading = (await page.locator(".ka-bento-reading").boundingBox())!;
      const images = (await page.locator(".ka-bento-images").boundingBox())!;
      const notes = (await page.locator(".ka-bento-notes").boundingBox())!;
      const video = (await page.locator(".ka-bento-video").boundingBox())!;
      const preview = (await page.locator(".ka-bento-preview").boundingBox())!;
      const importing = (await page.locator(".ka-bento-import").boundingBox())!;
      expect(reading.width).toBeGreaterThan(images.width * 1.4);
      expect(reading.height).toBeGreaterThan(notes.height * 1.4);
      expect(reading.height).toBeGreaterThan(images.height * 1.4);
      expect(Math.abs(video.y - preview.y)).toBeLessThan(2);
      expect(Math.abs(video.y - importing.y)).toBeLessThan(2);
    }
    await expect(page.locator(".ka-gallery-tabs button")).toHaveCount(4);
    for (const id of ["reading", "image-tools", "extension", "your-library"]) {
      const card = page.locator(`#${id}`);
      await expect(card).toHaveCount(1);
      await card.evaluate(element => element.scrollIntoView({ block: "start" }));
      const header = (await page.locator(".ka-header").boundingBox())!;
      expect((await card.locator("h3").boundingBox())!.y).toBeGreaterThan(header.y + header.height);
    }
    for (const tile of await page.locator(".ka-bento-card").all()) {
      await tile.scrollIntoViewIfNeeded();
      const bounds = (await tile.boundingBox())!;
      for (const text of await tile.locator(".ka-bento-copy > *").all()) {
        const box = (await text.boundingBox())!;
        expect(box.x - bounds.x).toBeGreaterThanOrEqual(20);
        expect(bounds.x + bounds.width - box.x - box.width).toBeGreaterThanOrEqual(20);
        expect(box.y + box.height).toBeLessThan(bounds.y + bounds.height);
      }
      for (const image of await tile.locator("img").all()) {
        await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        if (await image.evaluate(element => element.parentElement!.classList.contains("ka-bento-visual"))) {
          await expect(image).toHaveCSS("object-fit", "contain");
        }
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [390, 1707]) {
  test(`Live About demos respond to sample interactions at ${width}px`, async ({ page, context, browserName }) => {
    await page.setViewportSize({ width, height: 825 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/about");
    const search = page.getByRole("region", { name: "Search a sample library", exact: true });
    await search.getByRole("button", { name: "notes", exact: true }).click();
    await expect(search.locator(".ka-search-demo-results > li")).toHaveCount(1);
    await search.getByRole("button", { name: "Preview Website project" }).click();
    await expect(search.getByRole("region", { name: "Sample item preview" })).toContainText("Collect layout references.");
    await search.getByRole("button", { name: "Back to results" }).click();
    await search.getByRole("searchbox").fill("nomatchhere");
    await expect(search.getByText("No matches.", { exact: false })).toBeVisible();
    await search.getByRole("button", { name: "Clear sample search" }).click();
    await expect(search.locator(".ka-search-demo-results > li")).toHaveCount(3);
    await expect(search).toHaveCSS("color-scheme", "dark");

    const notes = page.locator('[data-feature-demo="notes"]');
    await notes.getByRole("button", { name: "Edit", exact: true }).click();
    await notes.getByRole("textbox", { name: "Edit sample note" }).fill("# My project\n\nKeep **useful references** here.");
    await notes.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(notes.locator("strong")).toHaveText("useful references");
    await notes.getByRole("button", { name: "Edit", exact: true }).click();
    await notes.getByRole("button", { name: "Plain text", exact: true }).click();
    await notes.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(notes.locator(".kd-note-body")).toContainText("**useful references**");

    const reading = page.locator('[data-feature-demo="reading"]');
    await reading.getByRole("button", { name: "Open PDF", exact: true }).click();
    await expect(reading.locator('[data-pdf-ready="1"]')).toBeVisible();
    await reading.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(reading.getByRole("textbox", { name: "PDF page number" })).toHaveValue("2");
    await expect(reading.locator('[data-pdf-ready="2"]')).toBeVisible();
    await reading.getByRole("button", { name: "Previous page", exact: true }).click();
    await expect(reading.getByRole("textbox", { name: "PDF page number" })).toHaveValue("1");

    const imageTools = page.locator('[data-feature-demo="image-tools"]');
    await imageTools.getByRole("button", { name: "Copy color #F7F3E8", exact: true }).click();
    await expect(imageTools.getByRole("status")).toContainText(/#F7F3E8/);
    await imageTools.getByRole("button", { name: "Show text", exact: true }).click();
    await expect(imageTools.getByRole("region", { name: "Extracted text from image 1" })).toContainText("FIELD NOTES");

    const preview = page.locator('[data-feature-demo="preview"]');
    await expect(preview.getByRole("img", { name: "A sunlit reading corner" })).toBeVisible();
    await preview.getByRole("button", { name: "Next sample preview", exact: true }).click();
    await expect(preview.getByRole("status")).toContainText("a-little-pause.md");
    await expect(preview.locator(".kd-preview-note")).toContainText("Leave the afternoon open.");
    await preview.getByRole("button", { name: "Previous sample preview", exact: true }).click();
    await expect(preview.getByRole("status")).toContainText("reading-corner.webp");
    await expect(preview.getByRole("img", { name: "A sunlit reading corner" })).toBeVisible();

    const importing = page.locator('[data-feature-demo="import"]');
    await importing.getByRole("button", { name: "Reset sample files", exact: true }).click();
    await expect(importing.getByRole("region", { name: "Selected files" }).locator("li")).toHaveCount(2);
    await importing.getByRole("button", { name: "Remove file weekend-notes.md", exact: true }).click();
    await expect(importing.getByRole("region", { name: "Selected files" }).locator("li")).toHaveCount(1);
    await importing.getByRole("button", { name: "Reset sample files", exact: true }).click();
    await expect(importing.getByRole("region", { name: "Selected files" }).locator("li")).toHaveCount(2);

    const video = page.locator('[data-feature-demo="video"] video');
    expect(await video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
    await page.getByRole("button", { name: "Play sample video", exact: true }).click();
    await expect(video).toHaveAttribute("controls", "");
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
    await video.evaluate(element => (element as HTMLVideoElement).pause());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [390, 1707]) {
  test(`Blog articles keep their section navigation accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 825 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const slug of ["design-reference-library", "browser-bookmarks", "project-research", "searchable-screenshots"]) {
      await page.goto(`/blog/${slug}`);
      const sidebar = page.locator(".kb-sidebar");
      const article = page.locator(".kb-editorial-article");
      const contents = page.getByRole("navigation", { name: "In this article", exact: true });
      if (width === 390) {
        await expect(contents).toHaveCount(0);
        await page.locator(".kb-mobile-contents summary").click();
        await expect(contents).toBeVisible();
        expect((await sidebar.boundingBox())!.y).toBeLessThan((await article.boundingBox())!.y);
      } else {
        await expect(contents).toBeVisible();
        const side = (await sidebar.boundingBox())!;
        expect(side.x + side.width).toBeLessThan((await article.boundingBox())!.x);
        await page.evaluate(() => window.scrollTo(0, 600));
        expect((await sidebar.boundingBox())!.y).toBeCloseTo(112, 0);
      }
      const links = contents.locator('a[href^="#"]');
      expect(await links.count()).toBeGreaterThan(0);
      for (const hash of await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")!.slice(1)))) {
        await expect(page.locator(`[id="${hash}"]`)).toHaveCount(1);
      }
      await links.last().click();
      const target = page.locator((await links.last().getAttribute("href"))!);
      const header = (await page.locator(".ka-header").boundingBox())!;
      expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/blog/searchable-screenshots#palette");
    await expect(page.locator("#palette h2")).toBeInViewport();
    const header = (await page.locator(".ka-header").boundingBox())!;
    expect((await page.locator("#palette").boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height);
  });
}

for (const width of [320, 1440]) {
  test(`Help guides keep readable procedures and working section links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/help");
    const routes = await page.locator(".kh-guide-row").evaluateAll(links => links.map(link => link.getAttribute("href")!));
    expect(routes).toHaveLength(13);
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response!.status(), route).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator(".kh-steps:not(:has(li))")).toHaveCount(0);
      for (const paragraph of await page.locator(".kh-article-body section > p:not(.kh-note)").all()) {
        await expect(paragraph).toHaveCSS("font-size", "16px");
        await expect(paragraph).toHaveCSS("line-height", "25.6px");
      }
      for (const step of await page.locator(".kh-steps li").all()) {
        await expect(step).toHaveCSS("font-size", "16px");
      }
      for (const id of await page.locator('.kh-sidebar a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute("href")!.slice(1)))) {
        await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    }
  });
}

test.describe("Contact rate limit", () => {
  test.use({ expectedContactRateLimit: true });
  test("keeps the draft and displays Retry-After", async ({ page }) => {
    await page.route("**/api/contact", route => route.fulfill(route.request().method() === "GET"
      ? { json: { available: true } }
      : { status: 429, headers: { "Retry-After": "153" }, json: { retryAfter: 153 } }));
    await page.goto("/contact");
    const submit = page.getByRole("button", { name: "Send message" });
    await expect(submit).toBeEnabled();
    await page.getByLabel("Name", { exact: true }).fill("Preview tester");
    await page.getByLabel("Email", { exact: true }).fill("preview@example.com");
    await page.getByLabel("Message", { exact: true }).fill("My draft stays here.");
    await submit.click();
    await expect(page.getByRole("form", { name: "Contact Keepall" }).getByRole("alert")).toContainText("Please try again in 3 minutes");
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("My draft stays here.");
  });
});
