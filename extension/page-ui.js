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
  const style = document.createElement("style");
  style.textContent = `
    @font-face { font-family: "Keepall Inter"; src: url("${chrome.runtime.getURL("inter-latin-wght-normal.woff2")}") format("woff2"); font-style: normal; font-weight: 100 900; font-display: swap; }
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
    .toast { --toast-offset: max(20px, env(safe-area-inset-right)); position: fixed; z-index: 2147483647; right: var(--toast-offset); top: max(20px, env(safe-area-inset-top)); display: grid; width: max-content; max-width: min(320px, calc(100vw - 40px)); border-radius: 28px; color: var(--primary); font-size: 14px; font-weight: 500; line-height: 1.4; opacity: 0; transform: translateX(calc(100% + var(--toast-offset))); transition: transform 260ms cubic-bezier(.32, .72, 0, 1), opacity 180ms cubic-bezier(.32, .72, 0, 1); }
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
    .toast-collections-search { display: block; flex: none; width: 100%; min-width: 0; min-height: 34px; margin: 4px 0 6px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--control); color: var(--primary); font-size: 12px; }
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
    .toast button:focus-visible, .toast input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    .toast .toast-collections-search:focus-visible { outline: none; border-color: var(--focus); }
    .toast-collections-controls button:focus-visible { outline-width: 1px; outline-offset: -2px; }
    .toast button:disabled { cursor: default; opacity: .5; }
    @keyframes collection-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .toast-collections { animation: none; } }
    .toast-close { display: grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 19px; }
    .toast-close:hover { background: var(--raised); color: var(--primary); }
    @media (prefers-reduced-motion: reduce) { .toast, .toast.is-visible { transform: none; transition: opacity 140ms ease-out; } }
  `;
  shadow.append(style);
  document.documentElement.append(host);

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
    const undoExpiresAt = Number.isFinite(actions?.undoExpiresAt) ? actions.undoExpiresAt : Date.now() + 60_000;
    cleanupToast = () => { clearTimeout(undoTimer); collectionPicker?.destroy(); };
    const duration = actions ? 8000 : 4000;
    const scheduleDismiss = () => {
      if (!node.isConnected) return;
      clearTimeout(toastTimer);
      if (!busy && !collectionPicker && !node.matches(":hover") && !node.contains(node.getRootNode().activeElement)) {
        toastTimer = setTimeout(() => dismissToast(), duration);
      }
    };
    if (success && actions) {
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
      function setActionsDisabled(value) {
        for (const control of buttons.children) control.disabled = value;
        if (Date.now() >= undoExpiresAt) expireUndo();
      }
      // Hugeicons, matching the app's icon family.
      const actionIcons = {
        open: '<path d="M11.0991 3.00012C7.45013 3.00669 5.53932 3.09629 4.31817 4.31764C3.00034 5.63568 3.00034 7.75704 3.00034 11.9997C3.00034 16.2424 3.00034 18.3638 4.31817 19.6818C5.63599 20.9999 7.75701 20.9999 11.9991 20.9999C16.241 20.9999 18.3621 20.9999 19.6799 19.6818C20.901 18.4605 20.9906 16.5493 20.9972 12.8998"/><path d="M20.556 3.49612L11.0487 13.0586M20.556 3.49612C20.062 3.00151 16.7343 3.04761 16.0308 3.05762M20.556 3.49612C21.05 3.99074 21.0039 7.32273 20.9939 8.02714"/>',
        organize: '<path d="M8.64298 3.14559L6.93816 3.93362C4.31272 5.14719 3 5.75397 3 6.75C3 7.74603 4.31272 8.35281 6.93817 9.56638L8.64298 10.3544C10.2952 11.1181 11.1214 11.5 12 11.5C12.8786 11.5 13.7048 11.1181 15.357 10.3544L17.0618 9.56638C19.6873 8.35281 21 7.74603 21 6.75C21 5.75397 19.6873 5.14719 17.0618 3.93362L15.357 3.14559C13.7048 2.38186 12.8786 2 12 2C11.1214 2 10.2952 2.38186 8.64298 3.14559Z"/><path d="M20.788 11.0972C20.9293 11.2959 21 11.5031 21 11.7309C21 12.7127 19.6873 13.3109 17.0618 14.5072L15.357 15.284C13.7048 16.0368 12.8786 16.4133 12 16.4133C11.1214 16.4133 10.2952 16.0368 8.64298 15.284L6.93817 14.5072C4.31272 13.3109 3 12.7127 3 11.7309C3 11.5031 3.07067 11.2959 3.212 11.0972"/><path d="M20.3767 16.2661C20.7922 16.5971 21 16.927 21 17.3176C21 18.2995 19.6873 18.8976 17.0618 20.0939L15.357 20.8707C13.7048 21.6236 12.8786 22 12 22C11.1214 22 10.2952 21.6236 8.64298 20.8707L6.93817 20.0939C4.31272 18.8976 3 18.2995 3 17.3176C3 16.927 3.20778 16.5971 3.62334 16.2661"/>',
        undo: '<path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C8.66873 3 5.76018 4.80989 4.20404 7.5"/><path d="M3 3V4.27816C3 6.47004 3 7.56599 3.70725 8.16512C4.4145 8.76425 5.49553 8.58408 7.6576 8.22373L9 8"/>',
      };
      for (const [action, text] of [["open", "Open"], ["organize", "Organize"], ...(actions.canUndo ? [["undo", "Undo"]] : [])]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "toast-action";
        button.dataset.action = action;
        button.setAttribute("aria-label", action === "open" ? "Open in Keepall" : text);
        button.title = action === "open" ? "Open in Keepall" : text;
        if (action === "organize") {
          button.setAttribute("aria-expanded", "false");
          button.setAttribute("aria-haspopup", "dialog");
        }
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${actionIcons[action]}</svg>`;
        button.append(document.createTextNode(text));
        button.addEventListener("click", async () => {
          if (busy) return;
          if (action === "undo" && Date.now() >= undoExpiresAt) { expireUndo(); return; }
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
                label.textContent = result.changed ? `Moved to ${result.collectionName}` : `Already in ${result.collectionName}`;
                node.dataset.success = "true";
                node.setAttribute("role", "status");
                setMark(true);
                if (result.changed) buttons.querySelector('[data-action="undo"]')?.remove();
              },
              onTagged: (result) => {
                node.dataset.success = "true";
                node.setAttribute("role", "status");
                setMark(true);
                if (result.changed) buttons.querySelector('[data-action="undo"]')?.remove();
              },
            });
            node.append(collectionPicker.element);
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
        if (Date.now() >= undoExpiresAt) expireUndo();
        else undoTimer = setTimeout(expireUndo, undoExpiresAt - Date.now());
      }
      function closeCollections(restoreFocus) {
        if (!collectionPicker) return;
        collectionPicker.destroy();
        collectionPicker = undefined;
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
    dialog.dataset.side = "right";
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
    titleInput.className = "ui-field min-h-11 w-full px-3 py-2 text-sm disabled:opacity-60";
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
    const picker = globalThis.__keepallCreateOrgPicker(shadow, observeScrollEdges);
    currentPicker = picker;
    let existingLink = draft?.existingLink;
    let snapshotLoaded = draft?.snapshotLoaded ?? false;
    let titleDirty = draft?.title !== undefined;
    let noteDirty = draft?.noteContent !== undefined;
    let markdownDirty = draft?.markdown !== undefined;
    let initialSelection = {};
    let discarded = false;
    let saved = false;
    let fileCapture;
    let organizationReady = false;
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
        snapshotLoaded,
        ...(fileDraft ? { files: fileDraft } : {}),
      });
    };
    titleInput.addEventListener("input", () => { titleDirty = true; });
    noteInput.addEventListener("input", () => { noteDirty = true; });
    onOrganizationMessage = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
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
      picker.load(message);
      initialSelection = picker.selection();
      if (draft?.selection && picker.loaded) picker.restore(draft.selection);
      if (draft?.selection && !picker.loaded) {
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
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveButton.disabled) return;
      if (fileCapture?.hasFiles) { void fileCapture.save(); return; }
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      dialog.dataset.state = "saving";
      close.disabled = true;
      cancel.disabled = true;
      picker.setDisabled(true);
      noteEditor.setDisabled(true);
      fileCapture.setDisabled(true);
      bulk.disabled = true;
      errorLine.textContent = "";
      chrome.runtime.sendMessage({
        type: "save-from-editor",
        editorId,
        title: titleInput.value,
        noteContent: noteInput.value,
        noteFormat: noteEditor.value().format,
        ...(existingLink ? { existingLink } : {}),
        ...picker.selection(),
      });
    });
    onEditorFeedback = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
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
        close.disabled = false;
        cancel.disabled = false;
        picker.setDisabled(false);
        noteEditor.setDisabled(false);
        fileCapture.setDisabled(false);
        bulk.disabled = false;
        errorLine.textContent = message.message;
        toast("Couldn't save to Keepall", false);
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
      if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dismissEditor();
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
  });
}
