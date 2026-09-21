import { expect, test, type Page } from "@playwright/test";

type SidebarMotionMeasurements = {
  sidebarWidths: number[];
  mainWidths: number[];
  copyScaleRatios: number[];
  clipPaths: string[];
  transforms: string[];
};

declare global {
  interface Window {
    __keepallObjectUrlCounts?: { created: number; revoked: number };
    __sidebarMotionMeasurements?: SidebarMotionMeasurements;
  }
}

test.use({ serviceWorkers: "block" });

async function seedMeasuredLibrary(page: Page, options?: { imageOnly?: boolean }) {
  await page.evaluate(async ({ imageOnly }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 540;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#b8d4ca";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "assets", "collections"], "readwrite");
        tx.objectStore("assets").put({
          id: "shared-preview",
          bytes,
          mimeType: "image/png",
          byteLength: bytes.length,
          contentHash: "shared-performance-fixture",
          createdAt: 1,
        });
        for (const [collectionId, name] of [
          ["short", "Short cards"],
          ["mixed", "Mixed cards"],
        ] as const) {
          tx.objectStore("collections").put({
            id: collectionId,
            name,
            createdAt: 1,
            pinnedItemIds: [],
          });
          for (let index = 0; index < 90; index += 1) {
            const common = {
              id: `${collectionId}-${index}`,
              createdAt: 10_000 - index,
              updatedAt: 1,
              collectionIds: [collectionId],
              tagIds: [],
            };
            if (imageOnly || (collectionId === "mixed" && index % 3 === 0)) {
              tx.objectStore("items").put({
                ...common,
                type: "image",
                title: `Reference ${index}`,
                assetIds: ["shared-preview"],
                caption: index % 2 === 0 ? "Tall visual reference" : "",
                sourceUrl: "",
              });
            } else {
              tx.objectStore("items").put({
                ...common,
                type: "note",
                title: `${name} ${index}`,
                content:
                  collectionId === "short"
                    ? "Small note."
                    : "A variable-height design note. ".repeat(1 + (index % 12)),
              });
            }
          }
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, { imageOnly: options?.imageOnly ?? false });
  await page.reload();
}

test("sidebar reveals without scaling text or repeatedly resizing the library", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await seedMeasuredLibrary(page);
  await expect(page.locator(".library-item-root").first()).toBeVisible();

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "256px");
  await expect(sidebar).not.toHaveCSS("transition-property", /(^|, )width(,|$)/);
  const sidebarPanel = sidebar.locator("[data-sidebar-panel]");
  await expect(sidebarPanel).toHaveAttribute("data-state", "open");
  expect(
    await sidebarPanel.evaluate((panel) =>
      panel.contains(document.elementFromPoint(160, 96)),
    ),
  ).toBe(true);

  await sidebar.evaluate((element) => {
    const panel = element.querySelector<HTMLElement>("[data-sidebar-panel]");
    const copy = element.querySelector<HTMLElement>("[data-sidebar-copy]");
    const main = document.querySelector<HTMLElement>(".library-panel");
    if (!panel || !copy || !main) {
      throw new Error("Sidebar motion probes are missing");
    }
    const measurements = {
      sidebarWidths: [element.getBoundingClientRect().width],
      mainWidths: [main.getBoundingClientRect().width],
      copyScaleRatios: [copy.getBoundingClientRect().width / copy.offsetWidth],
      clipPaths: [getComputedStyle(panel).clipPath],
      transforms: [] as string[],
    };
    const resizeObserver = new ResizeObserver(([entry]) => {
      measurements.sidebarWidths.push(entry.contentRect.width);
    });
    resizeObserver.observe(element);

    const stopAt = performance.now() + 300;
    const sampleFrame = () => {
      const currentPanel = element.querySelector<HTMLElement>("[data-sidebar-panel]");
      const currentCopy = element.querySelector<HTMLElement>("[data-sidebar-copy]");
      measurements.mainWidths.push(main.getBoundingClientRect().width);
      if (currentPanel && currentCopy) {
        measurements.copyScaleRatios.push(
          currentCopy.getBoundingClientRect().width / currentCopy.offsetWidth,
        );
        const style = getComputedStyle(currentPanel);
        measurements.clipPaths.push(style.clipPath);
        measurements.transforms.push(style.transform);
      }
      if (performance.now() < stopAt) {
        requestAnimationFrame(sampleFrame);
      } else {
        resizeObserver.disconnect();
      }
    };
    requestAnimationFrame(sampleFrame);
    window.__sidebarMotionMeasurements = measurements;
  });

  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "56px");
  await expect.poll(() => page.evaluate(() =>
    new Set(window.__sidebarMotionMeasurements?.clipPaths).size > 1,
  )).toBe(true);

  await page.waitForTimeout(350);
  const collapseMeasurements = await page.evaluate(() =>
    window.__sidebarMotionMeasurements,
  );
  expect(collapseMeasurements).toBeDefined();
  expect(new Set(
    (collapseMeasurements?.sidebarWidths ?? []).map(Math.round),
  )).toEqual(new Set([56, 256]));
  const observedMainWidths = new Set(
    collapseMeasurements!.mainWidths.map(Math.round),
  );
  expect(observedMainWidths.size).toBeLessThanOrEqual(2);
  expect(
    Math.max(...observedMainWidths) - Math.min(...observedMainWidths),
  ).toBeGreaterThanOrEqual(199);
  expect(collapseMeasurements!.copyScaleRatios.every(
    (ratio) => Math.abs(ratio - 1) <= 0.01,
  )).toBe(true);
  expect(collapseMeasurements!.transforms.every(
    (transform) => transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)",
  )).toBe(true);
  await expect(sidebarPanel).toHaveAttribute("data-state", "closed");
  await expect(sidebarPanel).toHaveCSS("clip-path", "inset(0px 200px 0px 0px)");

  await page.getByRole("button", { name: "Expand", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "256px");
  await expect(sidebar.locator("[data-sidebar-panel]")).toHaveAttribute("data-state", "open");
  await page.waitForTimeout(60);
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "56px");
  await page.waitForTimeout(250);
  await expect(sidebar.locator("[data-sidebar-panel]")).toHaveCSS(
    "clip-path",
    "inset(0px 200px 0px 0px)",
  );
});

test("sidebar animation respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await expect(sidebar.locator("[data-sidebar-panel]")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "56px");
  await expect(sidebar.locator("[data-sidebar-panel]")).toHaveCSS(
    "clip-path",
    "inset(0px 200px 0px 0px)",
  );
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`sidebar icons remain stationary at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });

    // Exercise every section-open combination without changing flags mid-toggle.
    for (const sectionToToggle of [null, "Collections", "Tags", "Collections"]) {
      if (sectionToToggle) {
        await sidebar.getByRole("button", { name: sectionToToggle, exact: true }).click();
      }
      for (const action of ["Collapse", "Expand"]) {
        const samples = sidebar.evaluate(async (element) => {
          const icons = Array.from(element.querySelectorAll<HTMLElement>("[data-sidebar-anchor] [data-sidebar-icon] :is(svg, img)"));
          const bounds = icons.map((icon) => icon.getBoundingClientRect());
          const sidebarX = element.getBoundingClientRect().x;
          let maxShift = 0;
          let maxSizeChange = 0;
          let retained = true;
          let visible = true;
          const until = performance.now() + 450;
          await new Promise<void>((resolve) => {
            const sample = () => {
              icons.forEach((icon, index) => {
                const rect = icon.getBoundingClientRect();
                const start = bounds[index];
                maxShift = Math.max(maxShift, Math.abs(rect.x - start.x), Math.abs(rect.y - start.y));
                maxSizeChange = Math.max(maxSizeChange, Math.abs(rect.width - start.width), Math.abs(rect.height - start.height));
                retained &&= icon.isConnected;
                visible &&= getComputedStyle(icon).visibility === "visible";
              });
              if (performance.now() < until) requestAnimationFrame(sample);
              else resolve();
            };
            requestAnimationFrame(sample);
          });
          return {
            count: icons.length, maxShift, maxSizeChange, retained, visible,
            centers: bounds.map((rect) => rect.x + rect.width / 2 - sidebarX),
          };
        });
        await page.getByRole("button", { name: action, exact: true }).click();
        const result = await samples;
        expect(result.count).toBe(6);
        expect(result.retained).toBe(true);
        expect(result.visible).toBe(true);
        expect(result.maxShift).toBeLessThanOrEqual(1);
        expect(result.maxSizeChange).toBeLessThanOrEqual(1);
        expect(result.centers.every((center) => Math.abs(center - 28) <= 1)).toBe(true);
      }
    }

    await sidebar.getByRole("textbox", { name: "Search collections" }).fill("retained filter");
    // Closing without moving focus first must not strand it in inert details.
    await page.getByRole("button", { name: "Collapse", exact: true }).evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error("Collapse control must be a button.");
      }
      button.click();
    });
    await expect(page.getByRole("button", { name: "Expand", exact: true })).toBeFocused();
    await expect(sidebar.getByRole("textbox")).toHaveCount(0);
    expect(await sidebar.locator("[data-sidebar-details]").evaluateAll((elements) =>
      elements.every((element) => element.hasAttribute("inert")),
    )).toBe(true);
    await page.getByRole("searchbox", { name: "Search", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    await expect(sidebar.getByRole("textbox", { name: "Search collections" })).toHaveValue("retained filter");
  });
}

test("collection switches keep one stable card for every rendered item", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await seedMeasuredLibrary(page);

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await sidebar.getByRole("button", { name: "Short cards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Short cards 0" })).toBeVisible();
  await sidebar.getByRole("button", { name: "Mixed cards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mixed cards", exact: true })).toBeVisible();
  await expect(page.locator(".library-item-root").first()).toBeVisible();

  const identity = await page.locator(".library-item-root").evaluateAll((nodes) => {
    const ids = nodes.map((node) => node.getAttribute("data-item-id"));
    return { count: ids.length, populated: ids.filter(Boolean).length, unique: new Set(ids).size };
  });
  expect(identity.populated).toBe(identity.count);
  expect(identity.unique).toBe(identity.count);

  const motion = await page.locator("[aria-label='Library items']").evaluate(async (grid) => {
    const samples: Record<string, number>[] = [];
    for (let frame = 0; frame < 12; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(Object.fromEntries(
        [...grid.querySelectorAll<HTMLElement>(":scope > .library-item-root")]
          .map((card) => [card.dataset.itemId ?? "", card.getBoundingClientRect().top]),
      ));
    }
    let largestLateShift = 0;
    for (let frame = 4; frame < samples.length; frame += 1) {
      for (const [id, top] of Object.entries(samples[frame])) {
        const previous = samples[frame - 1][id];
        if (previous !== undefined) largestLateShift = Math.max(largestLateShift, Math.abs(top - previous));
      }
    }
    return largestLateShift;
  });
  expect(motion).toBeLessThanOrEqual(1);
});

test("virtualized cards share one object URL for the same local asset", async ({ page }) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    window.__keepallObjectUrlCounts = { created: 0, revoked: 0 };
    URL.createObjectURL = (value) => {
      window.__keepallObjectUrlCounts!.created += 1;
      return create(value);
    };
    URL.revokeObjectURL = (value) => {
      window.__keepallObjectUrlCounts!.revoked += 1;
      revoke(value);
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await seedMeasuredLibrary(page, { imageOnly: true });

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  await sidebar.getByRole("button", { name: "Mixed cards", exact: true }).click();
  await expect(page.locator(".library-card img").first()).toBeVisible();
  const main = page.getByRole("main");
  await main.evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await main.evaluate((node) => node.scrollTo(0, 0));
  await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBe(0);

  await expect.poll(() => page.evaluate(() => window.__keepallObjectUrlCounts)).toEqual({
    created: 1,
    revoked: 0,
  });
});

test("cards load only a favicon when local preview bytes are missing", async ({ page }) => {
  const externalImageRequests: string[] = [];
  await page.route(/https:\/\/(cdn\.example\.com|www\.google\.com)\/.*/, async (route) => {
    externalImageRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      tx.objectStore("items").put({
        id: "remote-preview",
        type: "link",
        title: "Local-only preview",
        url: "https://example.com/article",
        previewStatus: "ready",
        previewTitle: "",
        previewDescription: "",
        previewImageUrl: "https://cdn.example.com/preview.png",
        previewAssetId: null,
        previewRetry: "none",
        previewAttemptedAt: 1,
        collectionIds: [],
        tagIds: [],
        createdAt: 1,
        updatedAt: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Local-only preview" })).toBeVisible();
  await page.waitForTimeout(100);

  expect(externalImageRequests).not.toContain(
    "https://cdn.example.com/preview.png",
  );
  expect(externalImageRequests).toContain(
    "https://www.google.com/s2/favicons?domain=example.com&sz=128",
  );
  await expect(page.locator('.library-card img[src^="https://cdn.example.com"]')).toHaveCount(0);
});
