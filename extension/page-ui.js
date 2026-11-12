if (!globalThis.__keepallPageUi) {
  globalThis.__keepallPageUi = true;

  const host = document.createElement("div");
  host.id = "keepall-capture-ui";
  const shadow = host.attachShadow({ mode: "closed" });
  let editorSurface;
  const colorScheme = matchMedia("(prefers-color-scheme: dark)");
  let themePreference = "system";
  function applyTheme(preference) {
    themePreference = ["light", "dark"].includes(preference) ? preference : "system";
    host.dataset.theme = themePreference === "system" ? (colorScheme.matches ? "dark" : "light") : themePreference;
    if (editorSurface) editorSurface.document.documentElement.dataset.theme = host.dataset.theme;
  }
  colorScheme.addEventListener("change", () => applyTheme(themePreference));
  applyTheme("system");
  // Chrome ignores @font-face inside a shadow root, so register the bundled Inter on the page itself.
  try {
    const inter = new FontFace("Keepall Inter", `url("${chrome.runtime.getURL("inter-latin-wght-normal.woff2")}") format("woff2")`, { style: "normal", weight: "100 900", display: "swap" });
    document.fonts.add(inter);
    void inter.load().catch(() => {});
  } catch {}
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial; color-scheme: light;
      --canvas: oklch(0.969593227 0.002647287 106.448873318); --control: oklch(0.993770382 0.001316042 106.423529177); --raised: oklch(0.924095637 0.004017056 106.477949299);
      --primary: oklch(0.262806549 0.003482183 228.926903774); --secondary: oklch(0.506161125 0.010181703 264.477327445); --border: oklch(0 0 0 / 0.078431373);
      --focus: oklch(0.52 0 0); --action: oklch(0.262806549 0.003482183 228.926903774); --action-hover: oklch(0.340266774 0.007499577 264.468737509); --on-action: oklch(1 0 0);
      --danger: oklch(0.500335978 0.182051182 29.512714275); --scrim: oklch(0 0 0 / 0.149019608); --toast: oklch(1 0 0);
      --selected: oklch(0.93220818 0.002520972 165.072879009); --active: oklch(0 0 0 / 0.050980392); --active-edge: oklch(1 0 0 / 0.8);
      --scroll-thumb: oklch(0.883390679 0.005512472 117.935225642);
      font-family: "Keepall Inter", Inter, ui-sans-serif, system-ui, sans-serif;
    }
    :host([data-theme="dark"]) {
        color-scheme: dark;
        --canvas: oklch(0.164204829 0.002071559 286.169336643); --control: oklch(0.225777762 0.002465731 247.935528101); --raised: oklch(0.288240789 0.006169116 258.356062838);
        --primary: oklch(0.960592553 0.002653442 106.449449342); --secondary: oklch(0.749761596 0.010981499 261.783842373); --border: oklch(1 0 0 / 0.078431373);
        --focus: oklch(0.60 0 0); --action: oklch(0.749761596 0.010981499 261.783842373); --action-hover: oklch(0.960592553 0.002653442 106.449449342); --on-action: oklch(0.2098857 0.00390174 286.058756954);
        --danger: oklch(0.807689675 0.103485729 19.570623816); --scrim: oklch(0 0 0 / 0.4); --toast: oklch(0.260324813 0 0);
        --selected: oklch(0.327186684 0.006741073 248.034104045); --active: oklch(1 0 0 / 0.121568627); --active-edge: oklch(1 0 0 / 0.058823529);
        --scroll-thumb: oklch(0.340266774 0.007499577 264.468737509);
    }
    *, *::before, *::after { box-sizing: border-box; }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    .editor-surface[open] { inset: 0; width: 100vw; max-width: none; max-height: 100dvh; height: 100dvh; margin: 0; padding: 0; border: 0; background: transparent; box-shadow: none; animation: none; }
    .editor-surface::backdrop { background: transparent; backdrop-filter: none; animation: none; }
    .editor-frame { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
    .toast { font-family: "Keepall Inter", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-style: normal; letter-spacing: normal; text-transform: none; text-align: left; --toast-offset: max(20px, env(safe-area-inset-right)); position: fixed; z-index: 2147483647; right: var(--toast-offset); top: max(20px, env(safe-area-inset-top)); display: grid; width: max-content; max-width: min(320px, calc(100vw - 40px)); border-radius: 28px; color: var(--primary); font-size: 14px; font-weight: 500; line-height: 1.4; opacity: 0; transform: translateX(calc(100% + var(--toast-offset))); transition: transform 260ms cubic-bezier(.32, .72, 0, 1), opacity 180ms cubic-bezier(.32, .72, 0, 1); }
    .toast-card { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 32px; corner-shape: superellipse(1.5); background: var(--toast); box-shadow: 0 12px 36px oklch(0 0 0 / 0.141176471), 0 2px 8px oklch(0 0 0 / 0.070588235); }
    .toast.is-visible { opacity: 1; transform: translateX(0); }
    .toast.has-actions { width: min(320px, calc(100vw - 40px)); }
    dialog .toast { position: absolute; top: 88px; }
    .toast.is-leaving { pointer-events: none; transition-duration: 180ms, 140ms; }
    .toast-mark { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--action); color: var(--on-action); font-size: 12px; }
    .toast-mark svg { width: 16px; height: 16px; }
    .toast[data-success="false"] .toast-mark { background: var(--danger); color: var(--canvas); }
    .toast-label { flex: 0 1 auto; overflow-wrap: anywhere; }
    .toast-content { min-width: 0; flex: 1; }
    .toast-actions { display: flex; flex-wrap: wrap; justify-self: center; gap: 2px; max-width: 100%; margin-top: 6px; padding: 2px; border: 1px solid var(--border); border-radius: 24px; corner-shape: superellipse(1.5); background: var(--toast); box-shadow: 0 4px 12px oklch(0 0 0 / 0.078431373), 0 1px 3px oklch(0 0 0 / 0.050980392); }
    .toast-action { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 28px; padding: 3px 8px; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 12px; font-weight: 500; transition: transform 150ms ease-out; }
    .toast-action svg { width: 14px; height: 14px; flex: none; }
    .toast-action[data-action="screenshot"] { min-width: 36px; padding: 3px 9px; }
    .toast-action[data-action="screenshot"] svg { width: 18px; height: 18px; }
    .toast-action:hover { background: var(--raised); color: var(--primary); }
    .toast-action:active { transform: scale(.96); }
    @media (prefers-reduced-motion: reduce) { .toast-action { transition: none; } .toast-action:active { transform: none; } }
    .toast-collections { width: 100%; min-width: 0; height: min(320px, calc(100dvh - 144px)); display: flex; flex-direction: column; overflow: hidden; margin-top: 8px; padding: 8px; background: var(--toast); border: 1px solid var(--border); border-radius: 24px; corner-shape: superellipse(1.5); box-shadow: 0 8px 24px oklch(0 0 0 / 0.078431373); animation: collection-enter 160ms cubic-bezier(.2, 0, 0, 1); }
    .toast-collections-header { display: flex; align-items: center; justify-content: space-between; padding-left: 6px; font-size: 12px; font-weight: 600; }
    .toast-collections-controls { flex: none; min-width: 0; overflow-y: hidden; scrollbar-width: thin; scrollbar-gutter: stable; }
    .toast-organize-types { display: flex; flex: none; gap: 4px; margin: 4px 0; padding: 3px; border: 1px solid var(--border); border-radius: 12px; background: var(--control); }
    .toast-organize-types button { flex: 1; min-height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--secondary); font-size: 12px; }
    .toast-organize-types button:hover { background: var(--raised); }
    .toast-organize-types button[aria-pressed="true"] { background: var(--selected); color: var(--primary); }
    .toast-collections-search-wrap { position: relative; display: flex; align-items: center; height: 44px; margin: 4px 0 6px; }
    .toast-collections-search { display: block; flex: none; width: 100%; min-width: 0; min-height: 40px; padding: 8px 44px 8px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--control); color: var(--primary); font-size: 12px; }
    .toast-collections-search::-webkit-search-cancel-button { display: none; }
    .toast-search-clear { position: absolute; right: 0; top: 0; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: 0; background: transparent; color: var(--secondary); }
    .toast-search-clear[hidden] { display: none; }
    .toast-search-clear > span { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; }
    .toast-search-clear svg { width: 16px; height: 16px; }
    .toast-search-clear:hover:not(:disabled) > span { background: var(--raised); color: var(--primary); }
    .toast-collections-search::placeholder { color: var(--secondary); }
    .toast-collections-list { display: grid; align-content: start; flex: 1; gap: 2px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; scrollbar-gutter: stable; }
    .toast-collection { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; padding: 8px; border: 0; border-radius: 10px; background: transparent; color: var(--primary); text-align: left; font-size: 12px; }
    .toast-collection-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toast-collection-check { flex: none; width: 14px; }
    .toast-collection:hover { background: var(--raised); }
    .toast-collection[aria-pressed="true"] { background: var(--selected); }
    .toast-create { justify-content: flex-start; min-height: 36px; border: 1px solid transparent; background: transparent; color: var(--primary); font-weight: 500; }
    .toast-create:hover { background: var(--raised); }
    .toast-create-icon { display: flex; flex: none; width: 16px; height: 16px; }
    .toast-create-icon svg { width: 100%; height: 100%; }
    .toast-create:active { background: var(--selected); }
    .toast-collections-footer { display: flex; flex: none; align-items: center; gap: 8px; min-height: 28px; margin-top: 4px; overflow-y: hidden; scrollbar-width: thin; scrollbar-gutter: stable; }
    .toast-collections-status { flex: 1; min-width: 0; margin: 0 6px; overflow-wrap: anywhere; font-size: 12px; color: var(--secondary); }
    .toast-collections-retry { flex: none; min-height: 28px; padding: 4px 8px; border: 0; border-radius: 8px; background: var(--action); color: var(--on-action); font-size: 12px; font-weight: 500; }
    .toast-collections-retry:hover { background: color-mix(in srgb, var(--action) 90%, var(--toast)); }
    .toast-collections-retry[hidden] { display: none; }
    .toast-collections-status[role="alert"] { color: var(--danger); }
    .toast-collections-status[hidden] { display: none; }
    .toast-collections-footer:has(.toast-collections-status:empty):has(.toast-collections-retry[hidden]) { min-height: 0; margin-top: 0; }
    .toast-collections-group { padding: 6px 8px 2px; color: var(--secondary); font-size: 11px; font-weight: 500; }
    .toast-collections-group:first-child { padding-top: 2px; }
    .toast button:focus-visible, .toast input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    .toast .toast-collections-search:focus-visible { outline: none; border-color: var(--focus); }
    .toast-collections-controls button:focus-visible { outline-width: 1px; outline-offset: -2px; }
    .toast .toast-collection:focus-visible { outline: 1px solid var(--focus); outline-offset: -1px; }
    .toast .toast-collection:focus-visible:not([aria-pressed="true"]) { background: var(--raised); }
    .toast button:disabled { cursor: default; opacity: .5; }
    @keyframes collection-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .toast-collections { animation: none; } }
    .toast-close { display: grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 19px; }
    .toast-close:hover { background: var(--raised); color: var(--primary); }
    @media (prefers-reduced-motion: reduce) { .toast, .toast.is-visible { transform: none; transition: opacity 140ms ease-out; } }
  `;
  shadow.append(style);
  document.documentElement.append(host);

  // Outside a closed shadow root, a keystroke in our search looks like one on a plain div, so site
  // shortcuts (such as "d" for theme) would fire. Stop it at the earliest point we control and hand
  // keydown to the organizer directly. Typing itself is a default action and is unaffected.
  let organizerKeys;
  const guardTyping = (event) => {
    if (event.target !== host || !shadow.activeElement?.matches("input, textarea")) return;
    event.stopImmediatePropagation();
    if (event.type === "keydown") organizerKeys?.(event, shadow.activeElement);
  };
  for (const type of ["keydown", "keypress", "keyup"]) window.addEventListener(type, guardTyping, true);

  let dialog;
  let saveButton;
  let errorLine;
  let currentEditorId;
  let onOrganizationMessage;
  let onEditorFeedback;
  let toastTimer;
  let toastExitTimer;
  let cleanupToast;
  let closeTimer;
  let currentPicker;
  let stopFieldFades;
  let destroyEditorContent;
  const drafts = new Map();
  let rememberDraft;

  function createEditorSurface() {
    // A separate document keeps site capture listeners out of the editor's key events.
    const modal = document.createElement("dialog");
    modal.className = "editor-surface";
    modal.setAttribute("aria-label", "Keepall capture");
    const updateScale = () => {
      const pageZoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      modal.style.zoom = String(1 / pageZoom);
    };
    updateScale();
    const scaleObserver = new MutationObserver(updateScale);
    scaleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    window.addEventListener("resize", updateScale);
    const frame = document.createElement("iframe");
    frame.className = "editor-frame";
    frame.title = "Keepall capture editor";
    modal.append(frame);
    shadow.append(modal);
    const scrollStyles = [document.documentElement, document.body].filter(Boolean).map((node) => ({
      node,
      value: node.style.getPropertyValue("overflow"),
      priority: node.style.getPropertyPriority("overflow"),
    }));
    for (const { node } of scrollStyles) node.style.setProperty("overflow", "hidden", "important");
    modal.showModal();
    const frameDocument = frame.contentDocument;
    frameDocument.documentElement.dataset.theme = host.dataset.theme;
    frameDocument.documentElement.lang = "en";
    frameDocument.documentElement.dir = "ltr";
    frameDocument.body.className = "text-text-primary antialiased";
    for (const [name, value] of Object.entries(globalThis.__keepallDrawerUi.motionCssVariables)) frameDocument.body.style.setProperty(name, value);
    const appStyle = frameDocument.createElement("style");
    appStyle.textContent = globalThis.__keepallDrawerStyles;
    const fontStyle = frameDocument.createElement("style");
    fontStyle.textContent = `@font-face { font-family: "Inter Variable"; src: url("${chrome.runtime.getURL("inter-latin-wght-normal.woff2")}") format("woff2"); font-style: normal; font-weight: 100 900; font-display: swap; }`;
    const toastStyle = frameDocument.createElement("style");
    const toastRoles = { canvas: "bg-canvas", control: "bg-control", raised: "bg-raised", primary: "text-primary", secondary: "text-secondary", border: "border-control", focus: "border-focus", action: "action-primary", "action-hover": "action-primary-hover", "on-action": "text-on-action", danger: "text-danger", toast: "bg-surface", selected: "bg-active", "scroll-thumb": "border-subtle" };
    toastStyle.textContent = ":root{" + Object.entries(toastRoles).map(([name, role]) => `--${name}:var(--color-${role});`).join("") + "}" + style.textContent.slice(style.textContent.indexOf("    .toast {"));
    frameDocument.head.append(appStyle, fontStyle, toastStyle);
    const frameHost = frameDocument.createElement("div");
    frameHost.dataset.theme = host.dataset.theme;
    const frameShadow = frameHost;
    frameDocument.body.append(frameHost);
    return {
      document: frameDocument,
      shadow: frameShadow,
      host: frameHost,
      destroy() {
        scaleObserver.disconnect();
        window.removeEventListener("resize", updateScale);
        modal.close();
        modal.remove();
        for (const { node, value, priority } of scrollStyles) {
          if (value) node.style.setProperty("overflow", value, priority);
          else node.style.removeProperty("overflow");
        }
      },
    };
  }

  function dismissToast(immediate = false) {
    cleanupToast?.();
    cleanupToast = undefined;
    clearTimeout(toastTimer);
    clearTimeout(toastExitTimer);
    const node = shadow.querySelector(".toast");
    if (!node) return;
    if (immediate) {
      node.remove();
      return;
    }
    node.classList.add("is-leaving");
    node.classList.remove("is-visible");
    toastExitTimer = setTimeout(() => node.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 140 : 180);
  }

  function toast(message, success, actions) {
    dismissToast(true);
    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.success = String(success);
    node.setAttribute("role", success ? "status" : "alert");
    const mark = document.createElement("span");
    mark.className = "toast-mark";
    mark.setAttribute("aria-hidden", "true");
    function setMark(value) {
      const paths = value ? '<path d="M5 14L8.5 17.5L19 6.5"/>' : '<path d="M12 6v8M12 18h.01"/>';
      mark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    }
    setMark(success);
    const label = document.createElement("span");
    label.className = "toast-label";
    label.textContent = message;
    const content = document.createElement("div");
    content.className = "toast-content";
    content.append(label);
    let actionRow;
    let busy = false;
    let collectionPicker;
    let undoTimer;
    let undoDeadline = Number.isFinite(actions?.undoExpiresAt) ? actions.undoExpiresAt : Date.now() + 60_000;
    let failed = !success;
    let hiddenAt = 0;
    let pauseUndo = () => {};
    let resumeUndo = () => {};
    const onVisibility = () => {
      if (!node.isConnected) return;
      if (document.hidden) {
        if (!hiddenAt) hiddenAt = Date.now();
        clearTimeout(toastTimer);
        pauseUndo();
        return;
      }
      if (hiddenAt) undoDeadline += Date.now() - hiddenAt;
      hiddenAt = 0;
      resumeUndo();
      scheduleDismiss();
    };
    document.addEventListener("visibilitychange", onVisibility);
    cleanupToast = () => {
      clearTimeout(undoTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      collectionPicker?.destroy();
      organizerKeys = undefined;
    };
    const duration = actions ? 8000 : 4000;
    const scheduleDismiss = () => {
      if (!node.isConnected) return;
      clearTimeout(toastTimer);
      if (failed || document.hidden) return;
      if (!busy && !collectionPicker && !node.matches(":hover") && !node.contains(node.getRootNode().activeElement)) {
        toastTimer = setTimeout(() => dismissToast(), duration);
      }
    };
    if (actions?.settings) {
      node.classList.add("has-actions");
      const buttons = document.createElement("div");
      buttons.className = "toast-actions";
      buttons.setAttribute("role", "group");
      buttons.setAttribute("aria-label", "Settings");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-action";
      button.dataset.action = "settings";
      button.title = "Open Keepall settings";
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.3175 7.14139L20.8239 6.28479C20.4506 5.63696 20.264 5.31305 19.9464 5.18388C19.6288 5.05472 19.2696 5.15664 18.5513 5.36048L17.3311 5.70418C16.8725 5.80994 16.3913 5.74994 15.9726 5.53479L15.6357 5.34042C15.2766 5.11043 15.0004 4.77133 14.8475 4.37274L14.5136 3.37536C14.294 2.71534 14.1842 2.38533 13.9228 2.19657C13.6615 2.00781 13.3143 2.00781 12.6199 2.00781H11.5051C10.8108 2.00781 10.4636 2.00781 10.2022 2.19657C9.94085 2.38533 9.83106 2.71534 9.61149 3.37536L9.27753 4.37274C9.12465 4.77133 8.84845 5.11043 8.48937 5.34042L8.15249 5.53479C7.73374 5.74994 7.25259 5.80994 6.79398 5.70418L5.57375 5.36048C4.85541 5.15664 4.49625 5.05472 4.17867 5.18388C3.86109 5.31305 3.67445 5.63696 3.30115 6.28479L2.80757 7.14139C2.45766 7.74864 2.2827 8.05227 2.31666 8.37549C2.35061 8.69871 2.58483 8.95918 3.05326 9.48012L4.0843 10.6328C4.3363 10.9518 4.51521 11.5078 4.51521 12.0077C4.51521 12.5078 4.33636 13.0636 4.08433 13.3827L3.05326 14.5354C2.58483 15.0564 2.35062 15.3168 2.31666 15.6401C2.2827 15.9633 2.45766 16.2669 2.80757 16.8741L3.30114 17.7307C3.67443 18.3785 3.86109 18.7025 4.17867 18.8316C4.49625 18.9608 4.85542 18.8589 5.57377 18.655L6.79394 18.3113C7.25263 18.2055 7.73387 18.2656 8.15267 18.4808L8.4895 18.6752C8.84851 18.9052 9.12464 19.2442 9.2775 19.6428L9.61149 20.6403C9.83106 21.3003 9.94085 21.6303 10.2022 21.8191C10.4636 22.0078 10.8108 22.0078 11.5051 22.0078H12.6199C13.3143 22.0078 13.6615 22.0078 13.9228 21.8191C14.1842 21.6303 14.294 21.3003 14.5136 20.6403L14.8476 19.6428C15.0004 19.2442 15.2765 18.9052 15.6356 18.6752L15.9724 18.4808C16.3912 18.2656 16.8724 18.2055 17.3311 18.3113L18.5513 18.655C19.2696 18.8589 19.6288 18.9608 19.9464 18.8316C20.264 18.7025 20.4506 18.3785 20.8239 17.7307L21.3175 16.8741C21.6674 16.2669 21.8423 15.9633 21.8084 15.6401C21.7744 15.3168 21.5402 15.0564 21.0718 14.5354L20.0407 13.3827C19.7887 13.0636 19.6098 12.5078 19.6098 12.0077C19.6098 11.5078 19.7888 10.9518 20.0407 10.6328L21.0718 9.48012C21.5402 8.95918 21.7744 8.69871 21.8084 8.37549C21.8423 8.05227 21.6674 7.74864 21.3175 7.14139Z"/><path d="M15.5195 12C15.5195 13.933 13.9525 15.5 12.0195 15.5C10.0865 15.5 8.51953 13.933 8.51953 12C8.51953 10.067 10.0865 8.5 12.0195 8.5C13.9525 8.5 15.5195 10.067 15.5195 12Z"/></svg>';
      button.append(document.createTextNode("Open settings"));
      button.addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        button.disabled = true;
        try {
          const result = await chrome.runtime.sendMessage({ type: "open-options", section: actions.settings });
          if (!result?.success) throw new Error(result?.error || "Could not open settings. Try again.");
          dismissToast();
        } catch (error) {
          if (!node.isConnected) return;
          label.textContent = error.message || "Could not open settings. Try again.";
          busy = false;
          button.disabled = false;
        }
      });
      buttons.append(button);
      actionRow = buttons;
    } else if (actions) {
      node.classList.add("has-actions");
      const buttons = document.createElement("div");
      buttons.className = "toast-actions";
      buttons.setAttribute("role", "group");
      buttons.setAttribute("aria-label", "Save actions");
      function expireUndo() {
        const undo = buttons.querySelector('[data-action="undo"]');
        if (!undo) return;
        const wasFocused = node.getRootNode().activeElement === undo;
        undo.disabled = true;
        undo.title = "Undo expired. You can remove this item in Keepall.";
        undo.setAttribute("aria-description", undo.title);
        if (wasFocused && !busy) buttons.querySelector('[data-action="organize"]')?.focus();
      }
      let screenshotLimitReached = false;
      function setActionsDisabled(value) {
        for (const control of buttons.children) control.disabled = value;
        if (Date.now() >= undoDeadline) expireUndo();
        const screenshot = buttons.querySelector('[data-action="screenshot"]');
        if (screenshot && screenshotLimitReached) {
          screenshot.disabled = true;
          screenshot.title = "This link has the most screenshots it can hold.";
          screenshot.setAttribute("aria-description", screenshot.title);
        }
      }
      async function takeScreenshot() {
        closeCollections(false);
        busy = true;
        clearTimeout(toastTimer);
        setActionsDisabled(true);
        try {
          // The worker hides this UI for the capture, then shows it again.
          const result = await chrome.runtime.sendMessage({ type: "capture-feedback-action", action: "screenshot", actionId: actions.id });
          if (!result?.success) throw new Error(result?.error || "Could not save the screenshot. Try again.");
          if (!node.isConnected) return;
          failed = false;
          label.textContent = result.count === 1 ? "Screenshot added" : `Screenshot added (${result.count})`;
          node.dataset.success = "true";
          node.setAttribute("role", "status");
          setMark(true);
          screenshotLimitReached = Number.isInteger(result.limit) && result.count >= result.limit;
        } catch (error) {
          if (!node.isConnected) return;
          failed = true;
          label.textContent = error.message || "Could not save the screenshot. Try again.";
          node.dataset.success = "false";
          node.setAttribute("role", "alert");
          setMark(false);
        } finally {
          busy = false;
          if (node.isConnected) {
            setActionsDisabled(false);
            scheduleDismiss();
          }
        }
      }
      // Hugeicons, matching the app's icon family.
      const actionIcons = {
        open: '<path d="M11.0991 3.00012C7.45013 3.00669 5.53932 3.09629 4.31817 4.31764C3.00034 5.63568 3.00034 7.75704 3.00034 11.9997C3.00034 16.2424 3.00034 18.3638 4.31817 19.6818C5.63599 20.9999 7.75701 20.9999 11.9991 20.9999C16.241 20.9999 18.3621 20.9999 19.6799 19.6818C20.901 18.4605 20.9906 16.5493 20.9972 12.8998"/><path d="M20.556 3.49612L11.0487 13.0586M20.556 3.49612C20.062 3.00151 16.7343 3.04761 16.0308 3.05762M20.556 3.49612C21.05 3.99074 21.0039 7.32273 20.9939 8.02714"/>',
        organize: '<path d="M8.64298 3.14559L6.93816 3.93362C4.31272 5.14719 3 5.75397 3 6.75C3 7.74603 4.31272 8.35281 6.93817 9.56638L8.64298 10.3544C10.2952 11.1181 11.1214 11.5 12 11.5C12.8786 11.5 13.7048 11.1181 15.357 10.3544L17.0618 9.56638C19.6873 8.35281 21 7.74603 21 6.75C21 5.75397 19.6873 5.14719 17.0618 3.93362L15.357 3.14559C13.7048 2.38186 12.8786 2 12 2C11.1214 2 10.2952 2.38186 8.64298 3.14559Z"/><path d="M20.788 11.0972C20.9293 11.2959 21 11.5031 21 11.7309C21 12.7127 19.6873 13.3109 17.0618 14.5072L15.357 15.284C13.7048 16.0368 12.8786 16.4133 12 16.4133C11.1214 16.4133 10.2952 16.0368 8.64298 15.284L6.93817 14.5072C4.31272 13.3109 3 12.7127 3 11.7309C3 11.5031 3.07067 11.2959 3.212 11.0972"/><path d="M20.3767 16.2661C20.7922 16.5971 21 16.927 21 17.3176C21 18.2995 19.6873 18.8976 17.0618 20.0939L15.357 20.8707C13.7048 21.6236 12.8786 22 12 22C11.1214 22 10.2952 21.6236 8.64298 20.8707L6.93817 20.0939C4.31272 18.8976 3 18.2995 3 17.3176C3 16.927 3.20778 16.5971 3.62334 16.2661"/>',
        screenshot: '<path d="M12.6974 3.5H11.303C10.5884 3.5 10.2311 3.5 9.91067 3.612C9.71499 3.68039 9.53113 3.77879 9.36568 3.90367C9.09474 4.10816 8.89655 4.40544 8.50018 5L8.50017 5.00001C8.29717 5.30453 7.99794 5.75337 7.87867 5.87871C7.58314 6.18927 7.19563 6.39666 6.77329 6.47029C6.60284 6.5 6.41985 6.5 6.05387 6.5C5.07379 6.5 4.58376 6.5 4.18307 6.61342C3.18074 6.89716 2.39734 7.68055 2.1136 8.68289C2.00018 9.08357 2.00018 9.57361 2.00018 10.5537V14.5C2.00018 17.3284 2.00018 18.7426 2.87886 19.6213C3.75754 20.5 5.17176 20.5 8.00018 20.5H16.0002C18.8286 20.5 20.2428 20.5 21.1215 19.6213C22.0002 18.7426 22.0002 17.3284 22.0002 14.5V10.5537C22.0002 9.57361 22.0002 9.08357 21.8868 8.68289C21.603 7.68055 20.8196 6.89716 19.8173 6.61342C19.4166 6.5 18.9266 6.5 17.9465 6.5C17.5805 6.5 17.3975 6.5 17.2271 6.47029C16.8047 6.39666 16.4172 6.18927 16.1217 5.87871C16.0024 5.75336 15.7032 5.30451 15.5002 5C15.1038 4.40544 14.9056 4.10816 14.6347 3.90367C14.4692 3.77879 14.2854 3.68039 14.0897 3.612C13.7693 3.5 13.412 3.5 12.6974 3.5Z"/><path d="M16.0002 13C16.0002 15.2091 14.2093 17 12.0002 17C9.79104 17 8.00018 15.2091 8.00018 13C8.00018 10.7909 9.79104 9 12.0002 9C14.2093 9 16.0002 10.7909 16.0002 13Z"/><path d="M19.1252 9.5H19.0002M19.2502 9.5C19.2502 9.63807 19.1383 9.75 19.0002 9.75C18.8621 9.75 18.7502 9.63807 18.7502 9.5C18.7502 9.36193 18.8621 9.25 19.0002 9.25C19.1383 9.25 19.2502 9.36193 19.2502 9.5Z"/>',
        undo: '<path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C8.66873 3 5.76018 4.80989 4.20404 7.5"/><path d="M3 3V4.27816C3 6.47004 3 7.56599 3.70725 8.16512C4.4145 8.76425 5.49553 8.58408 7.6576 8.22373L9 8"/>',
      };
      // Screenshot is icon-only and last, so four actions still fit on one row.
      for (const [action, text] of [["open", "Open"], ["organize", "Organize"], ...(actions.canUndo ? [["undo", "Undo"]] : []), ...(actions.canScreenshot ? [["screenshot", ""]] : [])]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "toast-action";
        button.dataset.action = action;
        const description = action === "open" ? "Open in Keepall" : action === "screenshot" ? "Add a screenshot of what's on screen" : text;
        button.setAttribute("aria-label", action === "screenshot" ? "Add screenshot" : description);
        button.title = description;
        if (action === "organize") {
          button.setAttribute("aria-expanded", "false");
          button.setAttribute("aria-haspopup", "dialog");
        }
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${actionIcons[action]}</svg>`;
        if (text) button.append(document.createTextNode(text));
        button.addEventListener("click", async () => {
          if (busy) return;
          if (action === "undo" && Date.now() >= undoDeadline) { expireUndo(); return; }
          if (action === "screenshot") { await takeScreenshot(); return; }
          if (action === "organize") {
            if (collectionPicker) { closeCollections(true); return; }
            clearTimeout(toastTimer);
            button.setAttribute("aria-expanded", "true");
            collectionPicker = globalThis.__keepallCreateToastCollections({
              host,
              request: async (operation, payload = {}) => {
                if (operation === "move" || operation === "tag") {
                  busy = true;
                  setActionsDisabled(true);
                }
                try {
                  const result = await chrome.runtime.sendMessage({ type: "capture-feedback-action", action: operation, actionId: actions.id, ...payload });
                  if (!result?.success) throw new Error(result?.error || "Could not organize this item. Try again.");
                  return result;
                } catch (error) {
                  failed = true;
                  throw error;
                } finally {
                  if (operation === "move" || operation === "tag") {
                    busy = false;
                    setActionsDisabled(false);
                    scheduleDismiss();
                  }
                }
              },
              onClose: closeCollections,
              onMoved: (result) => {
                failed = false;
                label.textContent = result.changed ? `Moved to ${result.collectionName}` : `Already in ${result.collectionName}`;
                node.dataset.success = "true";
                node.setAttribute("role", "status");
                setMark(true);
                if (result.changed) buttons.querySelector('[data-action="undo"]')?.remove();
              },
              onTagged: (result) => {
                failed = false;
                node.dataset.success = "true";
                node.setAttribute("role", "status");
                setMark(true);
                if (result.changed) buttons.querySelector('[data-action="undo"]')?.remove();
              },
            });
            node.append(collectionPicker.element);
            organizerKeys = collectionPicker.handleKey;
            collectionPicker.focus();
            return;
          }
          closeCollections(false);
          busy = true;
          clearTimeout(toastTimer);
          setActionsDisabled(true);
          if (action === "undo") label.textContent = "Undoing save…";
          try {
            const result = await chrome.runtime.sendMessage({ type: "capture-feedback-action", action, actionId: actions.id });
            if (!result?.success) throw new Error(result?.error ?? "Could not complete this action. Try again.");
            if (!node.isConnected) return;
            if (action === "undo") toast("Save undone", true);
            else dismissToast();
          } catch (error) {
            if (!node.isConnected) return;
            failed = true;
            label.textContent = error.message || "Could not complete this action. Try again.";
            node.dataset.success = "false";
            node.setAttribute("role", "alert");
            setMark(false);
            busy = false;
            setActionsDisabled(false);
            scheduleDismiss();
          }
        });
        buttons.append(button);
      }
      if (actions.canUndo) {
        if (Date.now() >= undoDeadline) expireUndo();
        else undoTimer = setTimeout(expireUndo, undoDeadline - Date.now());
        pauseUndo = () => clearTimeout(undoTimer);
        resumeUndo = () => {
          clearTimeout(undoTimer);
          if (Date.now() >= undoDeadline) expireUndo();
          else undoTimer = setTimeout(expireUndo, undoDeadline - Date.now());
        };
      }
      function closeCollections(restoreFocus) {
        if (!collectionPicker) return;
        collectionPicker.destroy();
        collectionPicker = undefined;
        organizerKeys = undefined;
        const trigger = buttons.querySelector('[data-action="organize"]');
        trigger.setAttribute("aria-expanded", "false");
        if (restoreFocus) trigger.focus();
        scheduleDismiss();
      }
      actionRow = buttons;
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    close.addEventListener("click", () => dismissToast());
    node.addEventListener("mouseenter", () => clearTimeout(toastTimer));
    node.addEventListener("mouseleave", scheduleDismiss);
    node.addEventListener("focusin", () => clearTimeout(toastTimer));
    node.addEventListener("focusout", () => queueMicrotask(scheduleDismiss));
    const card = document.createElement("div");
    card.className = "toast-card";
    card.append(mark, content, close);
    node.append(card);
    if (actionRow) node.append(actionRow);
    (dialog?.open ? dialog : shadow).append(node);
    void node.offsetWidth;
    node.classList.add("is-visible");
    scheduleDismiss();
  }

  function observeScrollEdges(node) {
    const update = () => {
      node.style.setProperty("--fade-top", node.scrollTop > 1 ? "12px" : "0px");
      node.style.setProperty("--fade-bottom", node.scrollHeight - node.clientHeight - node.scrollTop > 1 ? "12px" : "0px");
    };
    const resize = new ResizeObserver(update);
    resize.observe(node);
    for (const child of node.children) resize.observe(child);
    const changes = new MutationObserver(update);
    changes.observe(node, { childList: true, subtree: true, characterData: true });
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      resize.disconnect();
      changes.disconnect();
      node.removeEventListener("scroll", update);
    };
  }

  function dismissEditor() {
    const target = dialog;
    if (!target?.open || target.dataset.state === "saving" || target.classList.contains("is-closing")) return;
    rememberDraft?.();
    clearTimeout(closeTimer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.close();
      return;
    }
    target.classList.add("is-closing");
    target.dataset.endingStyle = "";
    closeTimer = setTimeout(() => target.close(), parseFloat(getComputedStyle(target).getPropertyValue("--motion-slow-exit")) || 160);
  }

  const drawerClass = (name) => globalThis.__keepallDrawerUi.className(name);
  let noteEditorSequence = 0;
  function createNoteEditor({ document, label, content = "", format = "plain", onChange = () => {} }) {
    const element = document.createElement("div"); element.className = drawerClass("note-editor");
    const head = document.createElement("div"); head.className = drawerClass("note-head");
    const heading = document.createElement("label"); heading.className = drawerClass("field-label"); heading.textContent = label;
    const input = document.createElement("textarea"); input.className = drawerClass("note-input");
    input.id = `keepall-note-${++noteEditorSequence}`; input.value = content;
    input.maxLength = label === "File contents" ? 10 * 1024 * 1024 : 10000; heading.htmlFor = input.id;
    const controlsHost = document.createElement("div"); controlsHost.className = "min-w-0 max-w-full";
    const preview = document.createElement("div"); preview.className = drawerClass("note-preview");
    preview.setAttribute("role", "region"); preview.setAttribute("aria-label", `${label} preview`); preview.tabIndex = 0; preview.hidden = true;
    let showingPreview = false;
    let disabled = false;
    let renderer;
    let controls;
    head.append(heading, controlsHost); element.append(head, input, preview);
    function value() { return { content, format }; }
    function update(next = {}) {
      if (next.content !== undefined) { content = next.content; input.value = content; }
      if (next.format) format = next.format;
      input.hidden = showingPreview; preview.hidden = !showingPreview;
      if (showingPreview) {
        if (!renderer) renderer = globalThis.__keepallNotePreview.mount(preview, value());
        else renderer.update(value());
      }
      input.disabled = disabled;
      const props = { format, preview: showingPreview, disabled, formatDisabled: input.readOnly, portalContainer: dialog,
        onFormatChange(nextFormat) { format = nextFormat; update(); onChange(value()); },
        onPreviewChange(nextPreview) { showingPreview = nextPreview; update(); (showingPreview ? preview : input).focus(); },
      };
      if (controls) controls.update(props);
      else controls = globalThis.__keepallDrawerUi.mountNoteControls(controlsHost, props);
    }
    input.addEventListener("input", () => { content = input.value; onChange(value()); });
    update();
    return { element, input, value, update, setDisabled(value) { disabled = value; update(); }, destroy() { renderer?.destroy(); controls.destroy(); renderer = undefined; } };
  }

  function openEditor(url, title, editorId, origin) {
    if (dialog?.dataset.state === "saving") return false;
    rememberDraft?.();
    const draftKey = JSON.stringify([origin, url]);
    const draft = drafts.get(draftKey);
    dismissToast(true);
    clearTimeout(closeTimer);
    currentPicker?.destroy();
    stopFieldFades?.();
    destroyEditorContent?.();
    dialog?.remove();
    editorSurface?.destroy();
    const surface = createEditorSurface();
    editorSurface = surface;
    const document = surface.document;
    const shadow = surface.shadow;
    currentEditorId = editorId;
    dialog = document.createElement("dialog");
    dialog.className = drawerClass("keepall-drawer ui-native-dialog ui-drawer-popup flex flex-col overflow-hidden border-l border-border-control bg-bg-canvas text-text-primary shadow-menu outline-none");
    const rtl = getComputedStyle(globalThis.document.documentElement).direction === "rtl";
    dialog.dataset.side = rtl ? "left" : "right";
    dialog.setAttribute("aria-labelledby", "keepall-editor-title");
    dialog.setAttribute("aria-describedby", "keepall-editor-description");
    const header = document.createElement("header");
    header.className = drawerClass("header");
    const headingBlock = document.createElement("div");
    headingBlock.className = drawerClass("heading");
    const heading = document.createElement("h2");
    heading.id = "keepall-editor-title";
    heading.className = drawerClass("title");
    heading.textContent = "Save to Keepall";
    const description = document.createElement("p");
    description.id = "keepall-editor-description";
    description.className = drawerClass("description");
    description.textContent = url;
    description.title = url;
    headingBlock.append(heading, description);
    const close = document.createElement("button");
    close.type = "button";
    close.className = drawerClass("close");
    close.setAttribute("aria-label", "Close drawer");
    close.innerHTML = globalThis.__keepallDrawerUi.icon("close", "size-[18px]");
    close.addEventListener("click", dismissEditor);
    header.append(headingBlock, close);
    const form = document.createElement("form");
    form.className = drawerClass("form");
    const fields = document.createElement("div");
    fields.className = drawerClass("fields body");
    const titleLabel = document.createElement("label");
    titleLabel.className = drawerClass("field");
    const titleName = document.createElement("span");
    titleName.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.className = drawerClass("text-input");
    titleName.className = drawerClass("field-label");
    titleInput.maxLength = 500;
    titleInput.value = title;
    titleLabel.append(titleName, titleInput);
    const noteEditor = createNoteEditor({ document, label: "Your note (optional)", onChange() { noteDirty = true; markdownDirty = true; } });
    const noteLabel = noteEditor.element;
    const noteInput = noteEditor.input;
    noteInput.placeholder = "Why are you saving this link?";
    const noteHelp = document.createElement("p"); noteHelp.className = drawerClass("note-help"); noteHelp.id = "keepall-note-help";
    noteHelp.textContent = "This note includes local images. Edit its contents in Keepall."; noteHelp.hidden = true; noteLabel.append(noteHelp);
    const picker = globalThis.__keepallCreateOrgPicker(shadow, observeScrollEdges, {
      onRetry: () => { void Promise.resolve(chrome.runtime.sendMessage({ type: "retry-editor-organizations", editorId })).catch(() => {}); },
    });
    currentPicker = picker;
    let existingLink = draft?.existingLink;
    let snapshotLoaded = draft?.snapshotLoaded ?? false;
    let refreshingAfterConflict = false;
    let keptSelection;
    let titleDirty = draft?.title !== undefined;
    let noteDirty = draft?.noteContent !== undefined;
    let markdownDirty = draft?.markdown !== undefined;
    let initialSelection = {};
    let discarded = false;
    let saved = false;
    let fileCapture;
    let organizationReady = false;
    let deferredOrganizations;
    let organizationGrace;
    if (titleDirty) titleInput.value = draft.title;
    if (noteDirty) noteEditor.update({ content: draft.noteContent });
    if (markdownDirty) noteEditor.update({ format: draft.markdown ? "markdown" : "plain" });
    rememberDraft = () => {
      if (saved || discarded) return;
      const selection = picker.loaded ? picker.selection() : draft?.selection;
      const organizationDirty = selection && JSON.stringify(selection) !== JSON.stringify(initialSelection);
      const fileDraft = fileCapture?.hasFiles && !fileCapture.draft().entries.every(entry => entry.saved) ? fileCapture.draft() : undefined;
      if (!titleDirty && !noteDirty && !markdownDirty && !organizationDirty && !fileDraft) {
        drafts.delete(draftKey);
        return;
      }
      drafts.set(draftKey, {
        ...(titleDirty ? { title: titleInput.value } : {}),
        ...(noteDirty ? { noteContent: noteInput.value } : {}),
        ...(markdownDirty ? { markdown: noteEditor.value().format === "markdown" } : {}),
        ...(organizationDirty ? { selection } : {}),
        existingLink,
        snapshotLoaded: snapshotLoaded && !refreshingAfterConflict,
        ...(fileDraft ? { files: fileDraft } : {}),
      });
    };
    titleInput.addEventListener("input", () => { titleDirty = true; });
    noteInput.addEventListener("input", () => { noteDirty = true; });
    onOrganizationMessage = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
      clearTimeout(organizationGrace);
      if (dialog.dataset.state === "saving") {
        deferredOrganizations = message;
        return;
      }
      // Retain a restored draft's original snapshot for the save conflict check.
      if (message.type === "organizations" && !snapshotLoaded) {
        existingLink = message.existingLink;
        snapshotLoaded = true;
      }
      if (message.type === "organizations" && message.existingLink) {
        if (!fileCapture?.hasFiles) heading.textContent = "Edit saved link";
        if (!titleDirty) titleInput.value = message.existingLink.title;
        if (!noteDirty || message.existingNoteHasImages) noteEditor.update({ content: message.existingLink.noteContent });
        if (message.existingNoteHasImages) {
          noteInput.readOnly = true;
          noteInput.setAttribute("aria-describedby", noteHelp.id);
          noteHelp.hidden = false;
        }
        if (!markdownDirty) noteEditor.update({ format: message.existingLink.noteFormat ?? "plain" });
        noteEditor.update();
      }
      if (refreshingAfterConflict && message.type === "organizations") {
        if (message.existingLink) errorLine.textContent = "Loaded the latest version from Keepall. Review your changes, then save again.";
        else {
          heading.textContent = "Save to Keepall";
          errorLine.textContent = "This link is no longer in Keepall. Saving will add it again.";
          saveButton.textContent = "Save";
        }
      }
      picker.load(message);
      initialSelection = picker.selection();
      if (refreshingAfterConflict && keptSelection && picker.loaded) picker.restore(keptSelection);
      else if (draft?.selection && picker.loaded) picker.restore(draft.selection);
      if (message.type === "organizations" && picker.loaded) { refreshingAfterConflict = false; keptSelection = undefined; }
      if (draft?.selection && !picker.loaded && !refreshingAfterConflict) {
        errorLine.textContent = "Could not restore your collection and tags. Close and reopen the drawer to try again.";
        saveButton.textContent = "Save";
        return;
      }
      organizationReady = true;
      bulk.disabled = fileCapture?.locked ?? false;
      saveButton.disabled = fileCapture?.locked ?? false;
      saveButton.textContent = fileCapture?.hasFiles ? "Save files" : existingLink ? "Save changes" : "Save";
    };
    errorLine = document.createElement("p");
    errorLine.className = drawerClass("error");
    errorLine.setAttribute("role", "alert");
    fields.append(titleLabel, noteLabel, picker.element, errorLine);
    if (draft) {
      const notice = document.createElement("div");
      notice.className = drawerClass("draft-notice");
      const label = document.createElement("span");
      label.setAttribute("role", "status");
      label.textContent = "Draft restored";
      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = drawerClass("discard-draft");
      discard.textContent = "Discard draft";
      discard.addEventListener("click", () => {
        if (dialog?.dataset.state === "saving") return false;
        discarded = true;
        drafts.delete(draftKey);
        dismissEditor();
      });
      notice.append(label, discard);
      fields.prepend(notice);
    }
    const footer = document.createElement("div");
    footer.className = drawerClass("footer");
    saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = drawerClass("primary");
    saveButton.textContent = "Loading…";
    saveButton.disabled = true;
    organizationGrace = setTimeout(() => {
      if (organizationReady || dialog?.dataset.state === "saving" || draft?.selection) return;
      organizationReady = true;
      saveButton.disabled = fileCapture?.locked ?? false;
      saveButton.textContent = fileCapture?.hasFiles ? "Save files" : existingLink ? "Save changes" : "Save";
    }, 3000);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = drawerClass("secondary");
    cancel.textContent = "Close";
    cancel.addEventListener("click", dismissEditor);
    const hint = document.createElement("span");
    hint.className = drawerClass("hint");
    hint.textContent = "Ctrl/⌘ Enter to save";
    const bulk = document.createElement("button"); bulk.type = "button"; bulk.className = drawerClass("bulk-import"); bulk.textContent = "Bulk import"; bulk.disabled = true;
    bulk.addEventListener("click", async () => {
      if (bulk.disabled) return;
      rememberDraft?.(); bulk.disabled = true; errorLine.textContent = "";
      try {
        const result = await chrome.runtime.sendMessage({ type: "editor-file-action", editorId, operation: "open-bulk-import", payload: {} });
        if (!result?.success) throw new Error(result?.error || "Could not open Bulk import. Try again.");
      } catch (error) { errorLine.textContent = error.message; }
      finally { bulk.disabled = false; }
    });
    footer.append(bulk, cancel, saveButton);
    const shortcut = document.createElement("div"); shortcut.className = drawerClass("footer-hint"); shortcut.append(hint);
    footer.append(shortcut);
    form.append(fields, footer);
    const complete = document.createElement("div");
    complete.className = drawerClass("save-complete");
    complete.setAttribute("role", "status");
    complete.setAttribute("aria-live", "polite");
    complete.setAttribute("aria-hidden", "true");
    complete.tabIndex = -1;
    const completeMark = document.createElement("div");
    completeMark.className = drawerClass("save-complete-mark");
    completeMark.setAttribute("aria-hidden", "true");
    completeMark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>';
    const completeTitle = document.createElement("p");
    completeTitle.className = drawerClass("save-complete-title");
    const completeActions = document.createElement("div");
    completeActions.className = drawerClass("save-complete-actions");
    completeActions.hidden = true;
    const openSaved = document.createElement("button");
    openSaved.type = "button";
    openSaved.className = drawerClass("primary");
    openSaved.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-3M14 3h7v7M21 3l-9 9"/></svg><span>Open in Keepall</span>';
    const done = document.createElement("button");
    done.type = "button";
    done.className = drawerClass("secondary");
    done.textContent = "Close";
    done.addEventListener("click", dismissEditor);
    const completeError = document.createElement("p");
    completeError.className = drawerClass("error");
    completeError.setAttribute("role", "alert");
    let savedActionId;
    openSaved.addEventListener("click", async () => {
      if (!savedActionId || openSaved.disabled) return;
      openSaved.disabled = true;
      done.disabled = true;
      completeError.textContent = "";
      try {
        const result = await chrome.runtime.sendMessage({ type: "capture-feedback-action", action: "open", actionId: savedActionId });
        if (!result?.success) throw new Error(result?.error || "Could not open Keepall. Try again.");
        dismissEditor();
      } catch (error) {
        completeError.textContent = error.message || "Could not open Keepall. Try again.";
        openSaved.disabled = false;
        done.disabled = false;
        openSaved.focus();
      }
    });
    completeActions.append(openSaved, done, completeError);
    complete.append(completeMark, completeTitle, completeActions);
    let saveWatchdog;
    let lastFocusBeforeSave;
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      } else if (event.key === "Enter" && event.target instanceof event.target.ownerDocument.defaultView.HTMLInputElement) {
        event.preventDefault();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveButton.disabled) return;
      if (fileCapture?.hasFiles) { void fileCapture.save(); return; }
      const focusBeforeSave = document.activeElement;
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      dialog.dataset.state = "saving";
      titleInput.disabled = true;
      close.disabled = true;
      cancel.disabled = true;
      picker.setDisabled(true);
      noteEditor.setDisabled(true);
      fileCapture.setDisabled(true);
      bulk.disabled = true;
      errorLine.textContent = "";
      lastFocusBeforeSave = focusBeforeSave;
      const failSave = (text) => onEditorFeedback?.({ editorId, success: false, message: text });
      const restarted = "Keepall Capture was updated or restarted. Copy your text, reload this page, and try again.";
      saveWatchdog = setTimeout(() => failSave("Keepall did not answer. Your text is still here. Try again."), 40000);
      try {
        Promise.resolve(chrome.runtime.sendMessage({
          type: "save-from-editor",
          editorId,
          title: titleInput.value,
          noteContent: noteInput.value,
          noteFormat: noteEditor.value().format,
          ...(existingLink ? { existingLink } : {}),
          ...picker.selection(),
        })).catch(() => {
          clearTimeout(saveWatchdog);
          failSave(restarted);
        });
      } catch {
        clearTimeout(saveWatchdog);
        failSave(restarted);
      }
    });
    onEditorFeedback = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
      clearTimeout(saveWatchdog);
      if (message.success) {
        saved = true;
        drafts.delete(draftKey);
        dismissToast(true);
        picker.destroy();
        form.inert = true;
        header.inert = true;
        completeTitle.textContent = message.message;
        complete.setAttribute("aria-hidden", "false");
        dialog.dataset.state = "saved";
        savedActionId = message.actions?.id;
        completeActions.hidden = !savedActionId;
        if (savedActionId) openSaved.focus({ preventScroll: true });
        else {
          complete.focus({ preventScroll: true });
          closeTimer = setTimeout(() => dismissEditor(), 1600);
        }
      } else {
        dialog.dataset.state = "error";
        saveButton.disabled = false;
        saveButton.textContent = existingLink ? "Save changes" : "Save";
        titleInput.disabled = false;
        close.disabled = false;
        cancel.disabled = false;
        picker.setDisabled(false);
        noteEditor.setDisabled(false);
        fileCapture.setDisabled(false);
        bulk.disabled = false;
        errorLine.textContent = message.message;
        if (typeof message.message === "string" && message.message.includes("changed in Keepall")) {
          keptSelection = picker.loaded ? picker.selection() : keptSelection;
          snapshotLoaded = false;
          refreshingAfterConflict = true;
          errorLine.textContent = "This link changed in Keepall. Loading the latest version… Your text is kept.";
          void Promise.resolve(chrome.runtime.sendMessage({ type: "retry-editor-organizations", editorId })).catch(() => {});
        }
        const refocus = lastFocusBeforeSave?.isConnected && !lastFocusBeforeSave.disabled ? lastFocusBeforeSave : saveButton;
        refocus.focus({ preventScroll: true });
        if (deferredOrganizations) {
          const late = deferredOrganizations;
          deferredOrganizations = undefined;
          onOrganizationMessage(late);
        }
      }
    };
    function refreshFilePresentation() {
        if (!fileCapture) return;
        const mode = fileCapture.hasFiles;
        titleLabel.hidden = mode; noteLabel.hidden = mode;
        heading.textContent = mode ? "Save files to Keepall" : existingLink ? "Edit saved link" : "Save to Keepall";
        cancel.textContent = mode && fileCapture.draft().entries.some(entry => entry.saved) ? "Done" : "Close";
        saveButton.hidden = mode && fileCapture.draft().entries.every(entry => entry.saved);
        saveButton.textContent = mode ? "Save files" : existingLink ? "Save changes" : "Save";
    }
    fileCapture = globalThis.__keepallCreateFileCapture({
      document, sourceUrl: url, draft: draft?.files,
      request: (operation, payload) => chrome.runtime.sendMessage({ type: "editor-file-action", editorId, operation, payload }),
      getOrganization: () => picker.selection(),
      createNoteEditor: (options) => createNoteEditor({ document, ...options }),
      onChange: refreshFilePresentation,
      onBusy(value) {
        dialog.dataset.state = value ? "saving" : "editing";
        saveButton.disabled = value || !organizationReady;
        close.disabled = value; cancel.disabled = value; bulk.disabled = value;
        picker.setDisabled(value); noteEditor.setDisabled(value);
      },
      onComplete() { rememberDraft?.(); },
    });
    fields.prepend(fileCapture.element);
    fields.insertBefore(fileCapture.addControl, picker.element);
    refreshFilePresentation();
    form.addEventListener("paste", (event) => fileCapture.paste(event));
    dialog.append(header, form, complete);
    const currentDialog = dialog;
    const destroyContent = () => { noteEditor.destroy(); fileCapture.destroy(); };
    destroyEditorContent = destroyContent;
    const stopFades = observeScrollEdges(fields);
    stopFieldFades = stopFades;
    dialog.addEventListener("close", () => {
      clearTimeout(organizationGrace);
      picker.destroy();
      stopFades();
      destroyContent();
      currentDialog.remove();
      surface.destroy();
      if (dialog === currentDialog) {
        dialog = undefined;
        editorSurface = undefined;
      }
    }, { once: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismissEditor();
    });
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right)) dismissEditor();
    });
    shadow.append(dialog);
    dialog.dataset.startingStyle = "";
    dialog.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => { delete currentDialog.dataset.startingStyle; }));
    if (fileCapture.hasFiles) (fileCapture.element.querySelector("button:not(:disabled), textarea") ?? fileCapture.addControl.querySelector("button")).focus();
    else { titleInput.focus(); titleInput.select(); }
    return true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "theme" || message?.theme !== undefined) applyTheme(message.theme);
    if (message?.type === "editor") { const accepted = openEditor(message.url, message.title, message.editorId, message.origin); respond?.({ accepted }); }
    if (message?.type === "organizations" || message?.type === "organization-error") onOrganizationMessage?.(message);
    if (message?.type === "toast-feedback") toast(message.message, message.success, message.actions);
    if (message?.type === "editor-feedback") onEditorFeedback?.(message);
    if (message?.type === "screenshot-hide") {
      host.style.setProperty("visibility", "hidden", "important");
      // Two frames let the page repaint without Keepall before the capture.
      requestAnimationFrame(() => requestAnimationFrame(() => respond?.({ hidden: true })));
      return true;
    }
    if (message?.type === "screenshot-show") host.style.removeProperty("visibility");
  });
}
