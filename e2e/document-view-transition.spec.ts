import { expect, test, type Page } from "@playwright/test";
import { pdfFixture } from "../test-support/pdf-fixture";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async pdfBytes => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const originals = {
      text: new TextEncoder().encode("Visible text preview\n\n" + "Saved paragraph. ".repeat(120) + "\n\nFull file footer"),
      markdown: new TextEncoder().encode("# Visible markdown preview\n\n" + "Saved paragraph. ".repeat(120) + "\n\nFull file footer"),
      pdf: new Uint8Array(pdfBytes),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "documentAssets"], "readwrite");
      for (const format of ["text", "markdown", "pdf"] as const) {
        const id = `transition-${format}`;
        const bytes = originals[format];
        tx.objectStore("documentAssets").put({ id: `${id}-asset`, bytes, byteLength: bytes.length, contentHash: id, createdAt: 1 });
        tx.objectStore("items").put({ id, type: "document", format, title: `Transition ${format}`, sourceFileName: `fixture.${format === "text" ? "txt" : format === "markdown" ? "md" : "pdf"}`, assetId: `${id}-asset`, noteContent: "", createdAt: 1, updatedAt: 1, collectionIds: [], tagIds: [] });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, Array.from(pdfFixture(["Visible PDF preview", "Second page"])));
  await page.reload();
  await expect(page.locator('[data-item-id="transition-pdf"] [data-pdf-preview] img')).toBeVisible();
  await expect(page.locator('[data-item-id="transition-text"] [data-document-preview]')).toHaveAttribute("data-document-preview", /Visible text preview/);
  await expect(page.locator('[data-item-id="transition-markdown"] [data-document-preview]')).toHaveAttribute("data-document-preview", /Visible markdown preview/);
});

async function recordTransitions(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & { documentMorphs: { duration: number; moving: boolean }[]; loadingFlashes: string[] };
    state.documentMorphs = [];
    state.loadingFlashes = [];
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (...args: Parameters<typeof document.startViewTransition>) => {
      const transition = original(...args);
      void transition.ready.then(() => {
        for (const animation of document.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null;
          if (!effect?.pseudoElement?.includes("item-document")) continue;
          state.documentMorphs.push({ duration: Number(effect.getTiming().duration), moving: effect.getKeyframes().some(frame => frame.transform !== undefined || frame.width !== undefined) });
        }
      }).catch(() => {});
      return transition;
    };
    new MutationObserver(mutations => {
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        for (const element of [node, ...node.querySelectorAll("p")]) {
          if (/^Loading (item|document|PDF)…$/.test(element.textContent ?? "") && element.checkVisibility({ visibilityProperty: true })) state.loadingFlashes.push(element.textContent!);
        }
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
}

for (const format of ["text", "markdown", "pdf"]) {
  test(`${format} morphs from its preview and back without a loading flash`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await recordTransitions(page);
    await page.getByRole("link", { name: `Open Transition ${format}`, exact: true }).first().click();
    const viewer = page.getByRole("dialog", { name: "Full item view" });
    await expect(viewer.getByRole("heading", { name: `Transition ${format}`, exact: true })).toBeVisible();
    if (format === "pdf") {
      await expect(viewer.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
      await expect(viewer.locator("[data-pdf-opening-preview]")).toHaveCount(0);
    } else await expect(viewer.getByRole("article", { name: "Document content" })).toContainText("Full file footer");
    await expect.poll(() => page.evaluate(() => (window as typeof window & { documentMorphs: { moving: boolean }[] }).documentMorphs.filter(animation => animation.moving).length)).toBeGreaterThan(0);
    await page.goBack();
    await expect(viewer).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as typeof window & { documentMorphs: { moving: boolean }[] }).documentMorphs.filter(animation => animation.moving).length)).toBeGreaterThan(1);
    expect(await page.evaluate(() => (window as typeof window & { loadingFlashes: string[] }).loadingFlashes)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${format} also opens from list view with a shared return transition`, async ({ page }) => {
    await page.getByRole("button", { name: "List view", exact: true }).click();
    const card = page.locator(`[data-item-id="transition-${format}"]`);
    if (format === "pdf") await expect(card.locator("[data-pdf-preview] img")).toBeVisible();
    const link = card.getByRole("link", { name: `Open Transition ${format}`, exact: true }).last();
    await link.hover();
    await recordTransitions(page);
    await link.click();
    const viewer = page.getByRole("dialog", { name: "Full item view" });
    await expect(viewer.getByRole("heading", { name: `Transition ${format}`, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { documentMorphs: { moving: boolean }[] }).documentMorphs.filter(animation => animation.moving).length)).toBeGreaterThan(0);
    await page.goBack();
    await expect(viewer).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as typeof window & { documentMorphs: { moving: boolean }[] }).documentMorphs.filter(animation => animation.moving).length)).toBeGreaterThan(1);
    expect(await page.evaluate(() => (window as typeof window & { loadingFlashes: string[] }).loadingFlashes)).toEqual([]);
  });
}

test("documents use a stationary fade with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordTransitions(page);
  await page.getByRole("link", { name: "Open Transition markdown", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Full item view" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { documentMorphs: unknown[] }).documentMorphs.length)).toBeGreaterThan(0);
  const animations = await page.evaluate(() => (window as typeof window & { documentMorphs: { duration: number; moving: boolean }[] }).documentMorphs);
  expect(animations.some(animation => animation.duration === 100 && !animation.moving)).toBe(true);
  expect(animations.some(animation => animation.duration > 0 && animation.moving)).toBe(false);
});

test("PDF navigation, reading modes, and zoom work after the preview handoff", async ({ page }) => {
  await page.getByRole("link", { name: "Open Transition pdf", exact: true }).first().click();
  const viewer = page.getByRole("dialog", { name: "Full item view" });
  await expect(viewer.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(viewer.getByRole("textbox", { name: "PDF page number" })).toHaveValue("2");
  await expect(viewer.getByRole("img", { name: "PDF page 2", exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(viewer.getByRole("img", { name: "PDF page 2", exact: true })).toBeVisible();
  await viewer.getByRole("combobox", { name: /^PDF zoom:/ }).click();
  await page.getByRole("option", { name: "75%", exact: true }).click();
  await expect.poll(() => viewer.getByRole("img", { name: "PDF page 2", exact: true }).evaluate(canvas => Number.parseFloat((canvas as HTMLElement).style.width))).toBeCloseTo(459, 0);
  await viewer.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(viewer.getByRole("textbox", { name: "PDF page number" })).toHaveValue("1");
  await expect(viewer.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`PDF controls and first-page position stay fixed while loading at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    // A resized library can open its mobile sidebar; dismiss it before choosing a file.
    if (width === 390) await page.getByRole("button", { name: "Close navigation", exact: true }).click();
    await page.evaluate(() => {
      const state = window as typeof window & { pdfInitialLayout: Record<string, number> | null };
      state.pdfInitialLayout = null;
      const observer = new MutationObserver(() => {
        const preview = document.querySelector("[data-pdf-opening-preview]");
        const image = preview?.querySelector<HTMLImageElement>("img");
        const toolbar = preview?.querySelector("[data-pdf-toolbar]");
        const article = preview?.closest("article");
        if (!image?.complete || !image.naturalWidth || !toolbar || !article) return;
        const origin = article.getBoundingClientRect();
        const controls = toolbar.getBoundingClientRect();
        state.pdfInitialLayout = { toolbarY: controls.y - origin.y, toolbarHeight: controls.height, pageY: image.getBoundingClientRect().y - origin.y };
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await page.locator('[data-item-id="transition-pdf"] a[href^="/items/"]').first().click();
    const viewer = page.getByRole("dialog", { name: "Full item view" });
    await expect(viewer.getByRole("img", { name: "PDF page 1", exact: true })).toBeVisible();
    await expect(viewer.locator("[data-pdf-opening-preview]")).toHaveCount(0);
    const initial = await page.evaluate(() => (window as typeof window & { pdfInitialLayout: Record<string, number> | null }).pdfInitialLayout);
    expect(initial).not.toBeNull();
    const final = await viewer.getByRole("article", { name: "Document content" }).evaluate(article => {
      const origin = article.getBoundingClientRect();
      const toolbar = article.querySelector("[data-pdf-toolbar]")!.getBoundingClientRect();
      const page = article.querySelector('[data-pdf-ready="1"]')!.getBoundingClientRect();
      return { toolbarY: toolbar.y - origin.y, toolbarHeight: toolbar.height, pageY: page.y - origin.y };
    });
    expect(final.toolbarY).toBeCloseTo(initial!.toolbarY, 0);
    expect(final.toolbarHeight).toBeCloseTo(initial!.toolbarHeight, 0);
    expect(final.pageY).toBeCloseTo(initial!.pageY, 0);
  });
}

test("PDF sharpness and active controls fade in after enlargement", async ({ page }) => {
  await page.evaluate(() => {
    const state = window as typeof window & { pdfReveal: { duration: number; overlappingMorph: boolean; previewRetained: boolean } | null };
    state.pdfReveal = null;
    document.addEventListener("animationstart", event => {
      if (event.animationName !== "pdf-preview-reveal") return;
      state.pdfReveal = {
        duration: Number.parseFloat(getComputedStyle(event.target as Element).animationDuration) * 1000,
        overlappingMorph: document.getAnimations().some(animation => animation.playState === "running" && animation.effect instanceof KeyframeEffect && !!animation.effect.pseudoElement?.includes("item-document-transition-pdf")),
        previewRetained: !!document.querySelector("[data-pdf-opening-preview]"),
      };
    });
  });
  await page.getByRole("link", { name: "Open Transition pdf", exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { pdfReveal: unknown }).pdfReveal)).not.toBeNull();
  expect(await page.evaluate(() => (window as typeof window & { pdfReveal: unknown }).pdfReveal)).toEqual({ duration: 180, overlappingMorph: false, previewRetained: true });
  await expect(page.locator("[data-document-pdf-shell] [data-pdf-opening-preview]")).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Next page", exact: true })).toBeEnabled();
});
