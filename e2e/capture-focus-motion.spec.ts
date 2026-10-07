import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function prepare(page: Page, delayedClipboard = false) {
  await page.addInitScript(delayed => {
    localStorage.setItem("keepall-shell-panel-open", "closed");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      read: () => delayed ? new Promise(resolve => setTimeout(() => resolve([]), 180)) : Promise.resolve([]),
      readText: () => Promise.resolve(""),
    } });
    const transitions: string[] = [];
    Reflect.set(window, "captureTransitions", transitions);
    document.addEventListener("transitionrun", event => {
      if (event.target instanceof Element && event.target.matches(".ui-drawer-popup, .ui-backdrop")) transitions.push(event.propertyName);
    });
  }, delayedClipboard);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Save first item", exact: true })).toBeVisible();
}

for (const delayedClipboard of [false, true]) {
  test(`shortcut capture keeps input focus with ${delayedClipboard ? "delayed" : "immediate"} clipboard`, async ({ page }) => {
    await prepare(page, delayedClipboard);
    const opener = page.getByRole("button", { name: "Save first item", exact: true });
    await opener.focus();
    await page.keyboard.press("Alt+k");
    const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
    const input = drawer.getByRole("textbox", { name: "Link, note, or image", exact: true });
    await expect(input).toBeEnabled();
    await expect(input).toBeFocused();
    await expect(input.locator("..")).toHaveCSS("outline-style", "solid");
    await expect(input.locator("..")).toHaveCSS("outline-width", "1px");
    const keptFocus = await input.evaluate(node => new Promise<boolean>(resolve => {
      const start = performance.now();
      let focused = true;
      const check = () => {
        focused &&= document.activeElement === node;
        if (performance.now() - start >= 250) resolve(focused);
        else requestAnimationFrame(check);
      };
      check();
    }));
    expect(keptFocus).toBe(true);
    await page.keyboard.type("A stable draft");
    await expect(input).toHaveValue("A stable draft");
    await input.press("Escape");
    const confirmation = page.getByRole("dialog", { name: "Discard unsaved changes?", exact: true });
    await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(input).toBeFocused();
    await input.fill("");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
}

test("Save item click and shortcut use identical drawer and backdrop motion", async ({ page }) => {
  await prepare(page);
  // Save one real note so this exercises the toolbar's Save item entry point.
  await page.getByRole("button", { name: "Save first item", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await drawer.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill("Motion comparison note");
  await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(drawer).toBeHidden();
  const save = page.getByRole("button", { name: "Save item", exact: true });
  await expect(save).toBeVisible();
  const configuration = () => page.locator(".ui-drawer-popup, .ui-drawer-backdrop").evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return { property: style.transitionProperty, duration: style.transitionDuration, easing: style.transitionTimingFunction };
  }));
  let pointerConfiguration;
  for (const mode of ["pointer", "shortcut"]) {
    await page.reload();
    await expect(save).toBeVisible();
    if (mode === "pointer") await save.click();
    else await page.keyboard.press("Alt+k");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("transition-duration", "0.24s");
    await expect(page.locator(".ui-drawer-backdrop")).toHaveCSS("transition-duration", "0.24s");
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "captureTransitions"))).toContain("transform");
    const input = drawer.getByRole("textbox", { name: "Link, note, or image", exact: true });
    await expect(input).toBeFocused();
    const config = await configuration();
    if (mode === "pointer") pointerConfiguration = config;
    else expect(config).toEqual(pointerConfiguration);
    await input.press("Escape");
    await expect(drawer).toBeHidden();
  }
});

test("reduced-motion capture opens without movement and retains input focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page);
  await page.getByRole("button", { name: "Save first item", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("transition-property", "opacity");
  await expect(drawer.getByRole("textbox", { name: "Link, note, or image", exact: true })).toBeFocused();
  expect(await page.evaluate(() => Reflect.get(window, "captureTransitions"))).not.toContain("transform");
});
