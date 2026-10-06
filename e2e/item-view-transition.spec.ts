import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // Fixtures only enter this test's disposable browser database.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 600;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#274555";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "thumbnails"], "readwrite");
      tx.objectStore("assets").put({ id: "handoff-asset", bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: "fixture", createdAt: 1 });
      tx.objectStore("thumbnails").put({ assetId: "handoff-asset", blob });
      const base = { createdAt: 1, updatedAt: 1, collectionIds: [], tagIds: [] };
      tx.objectStore("items").put({ ...base, id: "handoff-image", type: "image", title: "Handoff image", assetIds: ["handoff-asset"], caption: "", sourceUrl: "" });
      tx.objectStore("items").put({ ...base, id: "handoff-note", type: "note", title: "Handoff note", content: "Already loaded note content", format: "plain" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('[data-item-id="handoff-image"] img')).toBeVisible();
});

test("opening images and notes keeps the library and never flashes a loading screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    const state = window as typeof window & { loadingFlashes: string[]; sourceNode: Element | null };
    state.loadingFlashes = [];
    state.sourceNode = document.querySelector('[data-item-id="handoff-image"]');
    new MutationObserver(mutations => {
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        for (const element of [node, ...node.querySelectorAll("p,div")]) {
          if (/^Loading (item|image|note)…$/.test(element.textContent ?? "")) state.loadingFlashes.push(element.textContent!);
        }
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
  const card = page.locator('[data-item-id="handoff-image"]');
  await card.getByRole("link", { name: "Open Handoff image", exact: true }).first().click();
  const viewer = page.getByRole("dialog", { name: "Full item view" });
  await expect(viewer.getByRole("heading", { name: "Handoff image", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { sourceNode: Element }).sourceNode.isConnected)).toBe(true);
  await expect(page.locator("#route-content")).toHaveAttribute("inert", "");
  await page.goBack();
  await expect(viewer).toHaveCount(0);
  await page.goForward();
  await expect(viewer).toBeVisible();
  await page.goBack();
  await expect(viewer).toHaveCount(0);
  await page.getByRole("link", { name: "Open Handoff note", exact: true }).first().click();
  await expect(viewer.getByText("Already loaded note content", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { loadingFlashes: string[] }).loadingFlashes)).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Handoff note", exact: true })).toBeVisible();
  await expect(viewer).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Escape closes the viewer and keyboard focus stays inside it", async ({ page }) => {
  await page.getByRole("link", { name: "Open Handoff image", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  const viewer = page.getByRole("dialog", { name: "Full item view" });
  await expect(viewer).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("link", { name: "Back to library" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await viewer.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(page.locator("#route-content")).not.toHaveAttribute("inert", "");
});

for (const width of [390, 1280, 1920]) {
  test(`the image outline follows the visible image inside its frame at ${width}px`, async ({ page }) => {
    await page.getByRole("link", { name: "Open Handoff image", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "Full item view" })).toBeVisible();
    await page.setViewportSize({ width, height: 978 });
    const image = page.getByRole("dialog", { name: "Full item view" }).locator(".item-workspace-media img");
    await expect(image).toBeVisible();
    const geometry = await image.evaluate(node => {
      const image = node as HTMLImageElement;
      const bounds = image.getBoundingClientRect();
      const frame = image.closest(".item-workspace-media")!.getBoundingClientRect();
      return { ratio: bounds.width / bounds.height, naturalRatio: image.naturalWidth / image.naturalHeight,
        centerX: bounds.x + bounds.width / 2, centerY: bounds.y + bounds.height / 2,
        frameCenterX: frame.x + frame.width / 2, frameCenterY: frame.y + frame.height / 2 };
    });
    expect(geometry.ratio).toBeCloseTo(geometry.naturalRatio, 2);
    expect(geometry.centerX).toBeCloseTo(geometry.frameCenterX, 0);
    expect(geometry.centerY).toBeCloseTo(geometry.frameCenterY, 0);
  });
}

test("browser Back shares the image back into its library card", async ({ page }) => {
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole("link", { name: "Open Handoff image", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Full item view" })).toBeVisible();
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation =>
      (animation.effect as KeyframeEffect)?.pseudoElement?.includes("item-image")
    ).map(animation => animation.finished.catch(() => {})));
    const state = window as typeof window & { returnMorph: boolean };
    state.returnMorph = false;
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
      const transition = original(...args);
      void transition.ready.then(() => {
        state.returnMorph = document.getAnimations().some(animation => {
          const effect = animation.effect as KeyframeEffect | null;
          return effect?.pseudoElement?.includes("item-image") &&
            effect.getKeyframes().some(frame => frame.transform !== undefined || frame.width !== undefined);
        });
      }).catch(() => {});
      return transition;
    };
  });
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Full item view" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { returnMorph: boolean }).returnMorph)).toBe(true);
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
  await page.goForward();
  await expect(page.getByRole("dialog", { name: "Full item view" })).toBeVisible();
});

test("pointer intent prepares the viewer route before clicking", async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on("requestfinished", request => {
    if (request.url().includes("/items/handoff-image") && request.headers()["rsc"]) requests.push(request.url());
  });
  const link = page.getByRole("link", { name: "Open Handoff image", exact: true }).first();
  await link.hover();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const preparedRequests = requests.length;
  await page.evaluate(() => {
    const state = window as typeof window & { openingDelay: number | null };
    state.openingDelay = null;
    let clickedAt = 0;
    document.addEventListener("click", () => { clickedAt = performance.now(); }, { capture: true, once: true });
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
      const transition = original(...args);
      void transition.ready.then(() => { state.openingDelay = performance.now() - clickedAt; });
      return transition;
    };
  });
  await link.click();
  await expect(page.getByRole("dialog", { name: "Full item view" })).toBeVisible();
  expect(requests.length).toBe(preparedRequests);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { openingDelay: number | null }).openingDelay)).not.toBeNull();
  const openingDelay = await page.evaluate(() => (window as typeof window & { openingDelay: number }).openingDelay);
  await testInfo.attach("click-to-animation", { body: `${openingDelay.toFixed(1)}ms`, contentType: "text/plain" });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`image opening uses ${reducedMotion === "reduce" ? "a fade without movement" : "a shared image morph"}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.evaluate(() => {
      const state = window as typeof window & { imageAnimations: { duration: number; moving: boolean; endHeight: number; frameHeight: number }[] };
      state.imageAnimations = [];
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
        const transition = original(...args);
        void transition.ready.then(() => {
          for (const animation of document.getAnimations()) {
            const effect = animation.effect as KeyframeEffect | null;
            if (!effect?.pseudoElement?.includes("item-image")) continue;
            const frames = effect.getKeyframes();
            state.imageAnimations.push({
              duration: Number(effect.getTiming().duration),
              moving: frames.some(frame => frame.transform !== undefined || frame.width !== undefined),
              endHeight: Number.parseFloat(String(frames.at(-1)?.height)),
              frameHeight: document.querySelector('[aria-label="Full item view"] .item-workspace-media')?.getBoundingClientRect().height ?? 0,
            });
          }
        });
        return transition;
      };
    });
    await page.getByRole("link", { name: "Open Handoff image", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "Full item view" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { imageAnimations: unknown[] }).imageAnimations.length)).toBeGreaterThan(0);
    const animations = await page.evaluate(() => (window as typeof window & { imageAnimations: { duration: number; moving: boolean; endHeight: number; frameHeight: number }[] }).imageAnimations);
    if (reducedMotion === "reduce") {
      expect(animations.some(animation => animation.duration === 100 && !animation.moving)).toBe(true);
      expect(animations.some(animation => animation.duration > 0 && animation.moving)).toBe(false);
    } else {
      expect(animations.some(animation => animation.duration === 200 && animation.moving)).toBe(true);
      const morph = animations.find(animation => animation.duration === 200 && animation.moving)!;
      expect(morph.endHeight).toBeCloseTo(morph.frameHeight, 0);
    }
  });
}
