import { expect, test } from "@playwright/test";
import { pdfFixture } from "../test-support/pdf-fixture";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("keepall-shell-panel-open", "closed"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item", exact: true })).toBeVisible();
  // Fixtures only enter this test's disposable browser database.
  await page.evaluate(async pdfBytes => {
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
      const tx = db.transaction(["items", "assets", "thumbnails", "documentAssets"], "readwrite");
      tx.objectStore("assets").put({ id: "handoff-asset", bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: "fixture", createdAt: 1 });
      tx.objectStore("thumbnails").put({ assetId: "handoff-asset", blob });
      tx.objectStore("assets").put({ id: "handoff-second", bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: "fixture-second", createdAt: 1 });
      tx.objectStore("thumbnails").put({ assetId: "handoff-second", blob });
      const base = { createdAt: 1, updatedAt: 1, collectionIds: [], tagIds: [] };
      tx.objectStore("items").put({ ...base, id: "handoff-image", type: "image", title: "Handoff image", assetIds: ["handoff-asset"], caption: "", sourceUrl: "" });
      tx.objectStore("items").put({ ...base, id: "handoff-note", type: "note", title: "Handoff note", content: "Already loaded note content", format: "plain" });
      tx.objectStore("items").put({ ...base, id: "handoff-link", type: "link", title: "Handoff link", url: "https://example.com/article", previewTitle: "Handoff link", previewDescription: "Saved link description", noteContent: "Saved link notes", noteFormat: "plain" });
      tx.objectStore("items").put({ ...base, id: "handoff-gallery", type: "image", title: "Handoff gallery", assetIds: ["handoff-asset", "handoff-second"], caption: "", sourceUrl: "" });
      tx.objectStore("documentAssets").put({ id: "handoff-pdf-asset", bytes: new Uint8Array(pdfBytes), byteLength: pdfBytes.length, contentHash: "fixture-pdf", pdfText: "Handoff document", createdAt: 1 });
      tx.objectStore("items").put({ ...base, id: "handoff-pdf", type: "document", format: "pdf", title: "Handoff pdf", sourceFileName: "handoff.pdf", assetId: "handoff-pdf-asset", noteContent: "" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, Array.from(pdfFixture(["Handoff document"])));
  await page.reload();
  await expect(page.locator('[data-item-id="handoff-image"] img')).toBeVisible();
});

for (const type of ["image", "pdf", "note", "link"]) {
  test(`right-click Preview shares the ${type} from its library card`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const card = page.locator(`[data-item-id="handoff-${type}"]`);
    if (type === "image" || type === "pdf") await expect(card.locator("img").first()).toBeVisible();
    const source = type === "pdf" ? card.locator("[data-pdf-preview]") : type === "image" ? card.locator("img").first() : card;
    const bounds = await source.boundingBox();
    await card.click({ button: "right" });
    await page.evaluate(kind => {
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
        const transition = original(...args);
        void transition.ready.then(() => {
          const group = document.getAnimations().find(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.startsWith(kind === "image" ? "::view-transition-group(item-image" : kind === "pdf" ? "::view-transition-group(item-document" : "::view-transition-group(item-preview-content"));
          if (group) Reflect.set(window, "cardPreviewFrames", (group.effect as KeyframeEffect).getKeyframes());
        }).catch(error => Reflect.set(window, "cardPreviewError", String(error)));
        return transition;
      };
    }, type);
    await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
    const preview = page.locator(".library-quick-preview");
    await expect(preview).toBeVisible();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "cardPreviewFrames"))).toBeTruthy();
    const origin = await page.evaluate(() => {
      const frame = Reflect.get(window, "cardPreviewFrames")[0];
      const matrix = new DOMMatrixReadOnly(frame.transform);
      return { x: matrix.m41, y: matrix.m42, width: parseFloat(frame.width), height: parseFloat(frame.height) };
    });
    for (const axis of ["x", "y", "width", "height"] as const) expect(Math.abs(origin[axis] - bounds![axis])).toBeLessThan(1);
    expect(await page.evaluate(() => Reflect.get(window, "cardPreviewError"))).toBeUndefined();
    expect(errors).toEqual([]);
    await expect(preview).toHaveCSS("transform", "none");
    const targetNode = type === "note" ? preview.locator(".library-preview-document") : type === "link" ? preview.locator('a[aria-label^="Open source:"]').locator("..") : preview.locator("[data-item-transition]");
    const targetBounds = await targetNode.boundingBox();
    const target = await page.evaluate(() => {
      const frames = Reflect.get(window, "cardPreviewFrames");
      const frame = frames[frames.length - 1];
      const matrix = new DOMMatrixReadOnly(frame.transform);
      return { x: matrix.m41, y: matrix.m42, width: parseFloat(frame.width), height: parseFloat(frame.height) };
    });
    for (const axis of ["x", "y", "width"] as const) expect(Math.abs(target[axis] - targetBounds![axis])).toBeLessThan(1);
    await expect.poll(() => preview.evaluate(node => node.contains(document.activeElement))).toBe(true);
  });
}

for (const type of ["image", "pdf", "note", "link"]) {
  test(`Preview hands off to the full ${type} with a transition and closes its modal`, async ({ page }) => {
    await page.locator(`[data-item-id="handoff-${type}"]`).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
    const preview = page.locator(".library-quick-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS("transform", "none");
    if (type === "pdf") await expect(preview.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    await page.route(`**/items/handoff-${type}*`, async route => {
      await new Promise(resolve => setTimeout(resolve, 350));
      await route.continue();
    });
    await page.evaluate(kind => {
      Reflect.set(window, "previewItemTransition", false);
      const gaps: number[] = [];
      Reflect.set(window, "previewHandoffGaps", gaps);
      const check = () => {
        if (document.querySelector("[data-item-route-viewer]")) return;
        if (!document.querySelector(".library-quick-preview")) gaps.push(performance.now());
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
        const node = document.querySelector(".library-quick-preview")!;
        const content = kind === "image" || kind === "pdf" ? node.querySelector("[data-item-transition]")! : kind === "note" ? node.querySelector(".library-preview-document")! : node.querySelector('a[aria-label^="Open source:"]')!.parentElement!;
        const { x, y, width, height } = content.getBoundingClientRect();
        Reflect.set(window, "previewSourceAtSnapshot", { x, y, width, height });
        Reflect.set(window, "previewAtSnapshot", !!node);
        const transition = original(...args);
        void transition.ready.then(() => {
          const animations = document.getAnimations();
          const group = animations.find(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.startsWith(kind === "image" ? "::view-transition-group(item-image" : kind === "pdf" ? "::view-transition-group(item-document" : "::view-transition-group(item-preview-content"));
          Reflect.set(window, "previewFrameMoves", animations.some(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.startsWith("::view-transition-group(item-preview-handoff")));
          if (group) Reflect.set(window, "previewTransitionFrames", (group.effect as KeyframeEffect).getKeyframes());
          if (animations.some(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.includes("item-preview"))) Reflect.set(window, "previewItemTransition", true);
        }).catch(error => Reflect.set(window, "previewTransitionError", String(error)));
        return transition;
      };
    }, type);
    await preview.getByRole("button", { name: "Open full item", exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "Full item view", exact: true });
    await expect(viewer.getByRole("heading", { name: `Handoff ${type}`, exact: true })).toBeVisible();
    await expect(preview).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "previewItemTransition"))).toBe(true);
    expect(await page.evaluate(() => Reflect.get(window, "previewAtSnapshot"))).toBe(true);
    expect(await page.evaluate(() => Reflect.get(window, "previewHandoffGaps"))).toEqual([]);
    const sourceBounds = await page.evaluate(() => Reflect.get(window, "previewSourceAtSnapshot") as { x: number; y: number; width: number; height: number });
    const frames = await page.evaluate(() => Reflect.get(window, "previewTransitionFrames") as { width: string; height: string; transform: string }[]);
    expect(Math.abs(parseFloat(frames[0].width) - sourceBounds.width)).toBeLessThan(1);
    expect(Math.abs(parseFloat(frames[0].height) - sourceBounds.height)).toBeLessThan(1);
    const firstPosition = await page.evaluate(transform => {
      const matrix = new DOMMatrixReadOnly(transform);
      return { x: matrix.m41, y: matrix.m42 };
    }, frames[0].transform);
    expect(Math.abs(firstPosition.x - sourceBounds.x)).toBeLessThan(1);
    expect(Math.abs(firstPosition.y - sourceBounds.y)).toBeLessThan(1);
    expect(await page.evaluate(() => Reflect.get(window, "previewFrameMoves"))).toBe(false);
    await expect.poll(() => viewer.evaluate(node => node.contains(document.activeElement))).toBe(true);
    if (type === "link") {
      await expect(viewer.getByRole("heading", { name: "My note", exact: true })).toBeVisible();
      await expect(viewer.getByText("Saved link notes", { exact: true })).toBeVisible();
      await viewer.getByRole("button", { name: "Edit details", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "Edit link details", exact: true });
      await editor.getByRole("textbox", { name: "My note (optional)", exact: true }).fill("Notes saved from the full link page");
      await editor.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(editor).toHaveCount(0);
      await expect(viewer.getByText("Notes saved from the full link page", { exact: true })).toBeVisible();
      await expect.poll(() => viewer.evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(preview).toHaveCount(0);
    await expect(page.locator("#route-content")).not.toHaveAttribute("inert");
  });
}

for (const type of ["image", "pdf"]) {
  test(`Unsorted Review opens its full ${type} with Enter and restores card transitions`, async ({ page }) => {
    await page.evaluate(async id => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        const store = tx.objectStore("items");
        const request = store.getAll();
        request.onsuccess = () => { for (const item of request.result) if (item.id !== id) store.delete(item.id); };
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, `handoff-${type}`);
    await page.goto("/?unsorted=1");
    await page.getByRole("button", { name: "Review Unsorted", exact: true }).click();
    const preview = page.locator(".library-quick-preview");
    await expect(preview.locator("[data-item-transition]")).toBeVisible();
    if (type === "pdf") await expect(preview.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    await preview.focus();
    await page.keyboard.press("Enter");
    const viewer = page.getByRole("dialog", { name: "Full item view", exact: true });
    await expect(viewer).toBeVisible();
    await expect(preview).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await page.evaluate(kind => {
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
        const transition = original(...args);
        void transition.ready.then(() => Reflect.set(window, "reviewReturnCardTransition", document.getAnimations().some(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.startsWith(kind === "image" ? "::view-transition-group(item-image" : "::view-transition-group(item-document"))));
        return transition;
      };
    }, type);
    await page.locator(`[data-item-id="handoff-${type}"]`).getByRole("link", { name: `Open Handoff ${type}`, exact: true }).first().click();
    await expect(viewer).toBeVisible();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "reviewReturnCardTransition"))).toBe(true);
  });
}

test("Preview opens the currently displayed gallery image in the full item", async ({ page }) => {
  await page.locator('[data-item-id="handoff-gallery"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
  const preview = page.locator(".library-quick-preview");
  await preview.getByRole("button", { name: "Next gallery image", exact: true }).click();
  const image = preview.locator('img[data-preview-image-asset="handoff-second"]');
  await expect(image).toBeVisible();
  const url = await image.getAttribute("src");
  await preview.getByRole("button", { name: "Open full item", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Full item view", exact: true });
  await expect(viewer.getByRole("heading", { name: "Handoff gallery", exact: true })).toBeVisible();
  await expect(viewer.locator(".image-viewer-canvas img")).toHaveAttribute("src", url!);
});

test("Preview handoff uses an opacity transition without movement with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-item-id="handoff-note"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
  const preview = page.locator(".library-quick-preview");
  await expect(preview).toHaveCSS("opacity", "1");
  await page.evaluate(() => {
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
      const transition = original(...args);
      void transition.ready.then(() => Reflect.set(window, "reducedPreviewAnimations", document.getAnimations()
        .filter(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.includes("item-preview"))
        .map(animation => ({ pseudo: (animation.effect as KeyframeEffect).pseudoElement, frames: (animation.effect as KeyframeEffect).getKeyframes() }))));
      return transition;
    };
  });
  await preview.getByRole("button", { name: "Open full item", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Full item view", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "reducedPreviewAnimations")?.length)).toBeGreaterThan(0);
  const animations = await page.evaluate(() => Reflect.get(window, "reducedPreviewAnimations") as { pseudo: string; frames: Record<string, unknown>[] }[]);
  expect(animations.every(animation => animation.pseudo.startsWith("::view-transition-new"))).toBe(true);
  expect(animations.flatMap(animation => animation.frames).every(frame => !("transform" in frame))).toBe(true);
});

test("card image navigation still morphs after returning from the full Preview item", async ({ page }) => {
  const card = page.locator('[data-item-id="handoff-image"]');
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
  await page.locator(".library-quick-preview").getByRole("button", { name: "Open full item", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Full item view", exact: true });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await page.evaluate(() => {
    Reflect.set(window, "cardMorphAfterPreview", false);
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
      const transition = original(...args);
      void transition.ready.then(() => {
        Reflect.set(window, "cardMorphAfterPreview", document.getAnimations().some(animation => (animation.effect as KeyframeEffect)?.pseudoElement?.includes("item-image")));
      });
      return transition;
    };
  });
  await card.getByRole("link", { name: "Open Handoff image", exact: true }).first().click();
  await expect(viewer).toBeVisible();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "cardMorphAfterPreview"))).toBe(true);
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
