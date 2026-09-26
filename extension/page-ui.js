if (!globalThis.__keepallPageUi) {
  globalThis.__keepallPageUi = true;

  const host = document.createElement("div");
  host.id = "keepall-capture-ui";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    @font-face { font-family: "Keepall Inter"; src: url("${chrome.runtime.getURL("inter-latin-wght-normal.woff2")}") format("woff2"); font-style: normal; font-weight: 100 900; font-display: swap; }
    :host {
      all: initial; color-scheme: light;
      --canvas: #f5f5f3; --control: #fdfdfc; --raised: #e6e6e3;
      --primary: #232526; --secondary: #62656b; --border: #00000014;
      --focus: #737b84; --action: #232526; --on-action: #fff;
      --danger: #b42318; --scrim: #00000026; --toast: #fff;
      --selected: #e7e9e8; --active: #0000000d; --active-edge: #ffffffcc;
      --scroll-thumb: #d8d9d5;
      font-family: "Keepall Inter", Inter, ui-sans-serif, system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        color-scheme: dark;
        --canvas: #0e0e0f; --control: #1b1c1d; --raised: #292b2e;
        --primary: #f2f2f0; --secondary: #aaaeb5; --border: #ffffff14;
        --focus: #8d959f; --action: #f2f2f0; --on-action: #18181a;
        --danger: #fca5a5; --scrim: #00000066; --toast: #242424;
        --selected: #323538; --active: #ffffff1f; --active-edge: #ffffff0f;
        --scroll-thumb: #36383c;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    dialog {
      position: fixed; inset: 0 0 0 auto; width: min(30rem, 100vw); max-width: 100vw;
      height: 100dvh; max-height: 100dvh; margin: 0; padding: 0; overflow: hidden;
      border: 0; border-left: 1px solid var(--border); background: var(--canvas);
      color: var(--primary); box-shadow: 0 4px 16px #00000026;
      font-size: 14px; line-height: 1.5;
      animation: keepall-enter 300ms cubic-bezier(.2, 0, 0, 1) both;
    }
    dialog[open] { display: flex; flex-direction: column; }
    dialog::backdrop { background: var(--scrim); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); animation: keepall-backdrop-in 200ms ease-out both; }
    dialog.is-closing { animation: keepall-exit 180ms cubic-bezier(.4, 0, 1, 1) both; }
    dialog.is-closing::backdrop { animation: keepall-backdrop-out 180ms ease-in both; }
    @keyframes keepall-enter { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes keepall-exit { to { transform: translateX(100%); } }
    @keyframes keepall-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes keepall-backdrop-out { to { opacity: 0; } }
    .header { display: flex; align-items: flex-start; gap: 16px; margin: 0 24px; padding: 18px 0 20px; border-bottom: 1px solid var(--border); }
    .header, form { transition: opacity 160ms cubic-bezier(.19, 1, .22, 1), transform 160ms cubic-bezier(.19, 1, .22, 1); }
    dialog[data-state="saved"] > .header, dialog[data-state="saved"] > form { opacity: 0; transform: translateY(-8px); visibility: hidden; transition: opacity 160ms cubic-bezier(.19, 1, .22, 1), transform 160ms cubic-bezier(.19, 1, .22, 1), visibility 0s linear 160ms; }
    .save-complete { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 20px; padding: 32px; text-align: center; visibility: hidden; opacity: 0; transform: translateY(10px) scale(.96); pointer-events: none; transition: opacity 180ms cubic-bezier(.19, 1, .22, 1), transform 220ms cubic-bezier(.19, 1, .22, 1), visibility 0s linear 220ms; }
    dialog[data-state="saved"] .save-complete { visibility: visible; opacity: 1; transform: none; transition-delay: 40ms, 40ms, 0s; }
    .save-complete-mark { display: grid; place-items: center; width: 96px; height: 96px; border-radius: 32px; corner-shape: squircle; background: var(--action); color: var(--on-action); }
    .save-complete-mark svg { width: 52px; height: 52px; }
    .save-complete-title { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -.025em; line-height: 1.3; }
    .heading { min-width: 0; flex: 1; }
    h2 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.025em; line-height: 1.35; }
    .description { margin: 12px 0 0; max-width: 380px; overflow-wrap: anywhere; color: var(--secondary); line-height: 1.5; }
    .close { display: grid; flex: none; place-items: center; width: 40px; height: 40px; padding: 0; border: 1px solid var(--border); border-radius: 999px; corner-shape: superellipse(1.5); background: var(--control); color: var(--secondary); transition: transform 150ms ease-out; }
    .close:hover, .secondary:hover { background: var(--raised); color: var(--primary); }
    .close svg { width: 18px; height: 18px; }
    form { display: flex; min-height: 0; flex: 1; flex-direction: column; }
    .fields { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 16px; overflow-y: auto; overscroll-behavior: contain; padding: 12px 24px 20px; }
    .fields, .browse-results { scrollbar-color: var(--scroll-thumb) transparent; scrollbar-width: thin; }
    .fields::-webkit-scrollbar, .browse-results::-webkit-scrollbar { width: 6px; }
    .fields::-webkit-scrollbar-track, .browse-results::-webkit-scrollbar-track { background: transparent; }
    .fields::-webkit-scrollbar-thumb, .browse-results::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--scroll-thumb); }
    .field { display: grid; gap: 8px; font-weight: 500; }
    .note-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .markdown-toggle { position: relative; display: inline-flex; min-height: 30px; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 10px; background: var(--control); color: var(--secondary); font-size: 12px; font-weight: 400; cursor: pointer; }
    .markdown-box { position: relative; display: grid; flex: none; width: 16px; height: 16px; }
    .markdown-box input { position: absolute; inset: 0; z-index: 1; width: 16px; height: 16px; min-height: 0; margin: 0; padding: 0; opacity: 0; cursor: pointer; }
    .markdown-check { display: grid; flex: none; place-items: center; width: 16px; height: 16px; border: 1px solid var(--secondary); border-radius: 5px; }
    .markdown-check svg { width: 13px; height: 13px; opacity: 0; }
    .markdown-toggle input:checked + .markdown-check { border-color: var(--action); background: var(--action); color: var(--on-action); }
    .markdown-toggle input:checked + .markdown-check svg { opacity: 1; }
    .markdown-toggle input:focus-visible + .markdown-check { outline: 2px solid var(--focus); outline-offset: 2px; }
    input, textarea { width: 100%; border: 1px solid var(--border); border-radius: 16px; background: var(--control); color: var(--primary); font-size: 14px; font-weight: 400; }
    input { min-height: 44px; padding: 10px 14px; }
    textarea { min-height: 136px; padding: 12px 14px; resize: vertical; }
    textarea::placeholder { color: var(--secondary); }
    textarea[readonly] { background: var(--raised); }
    .org-section { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 16px; }
    .org-section[hidden], .selected-tags[hidden], .browse-trigger[hidden], .org-status[hidden], .save-status[hidden] { display: none; }
    .org-title { display: inline-flex; align-items: center; gap: 8px; margin: 0; color: var(--primary); font-weight: 600; }
    .org-icon { display: inline-flex; width: 16px; height: 16px; flex: none; align-items: center; justify-content: center; }
    .org-icon svg { width: 16px; height: 16px; }
    .org-head { display: flex; min-height: 20px; align-items: center; justify-content: space-between; gap: 12px; }
    .browse-trigger { min-height: 32px; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 12px; font-weight: 500; }
    .browse-trigger:hover { background: var(--raised); color: var(--primary); }
    .org-search-wrap { display: flex; align-items: center; gap: 8px; color: var(--secondary); }
    .org-search { min-width: 0; min-height: 28px; padding: 0; border: 0; border-radius: 0; background: transparent; font-size: 13px; }
    .choices, .selected-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .choice, .selected-tag { display: inline-flex; max-width: 100%; min-height: 28px; align-items: center; gap: 5px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 999px; corner-shape: superellipse(1.5); background: var(--control); color: var(--secondary); font-size: 12px; white-space: nowrap; transition: transform 150ms ease-out; }
    .choice[hidden] { display: none; }
    .choice-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .choice:hover { background: var(--raised); color: var(--primary); }
    .choice[aria-pressed="true"], .selected-tag { background: var(--active); color: var(--primary); box-shadow: inset 0 1px 0 var(--active-edge); }
    .remove-tag { display: grid; place-items: center; width: 32px; height: 32px; margin: -3px -7px -3px 0; border: 0; border-radius: 999px; corner-shape: superellipse(1.5); background: transparent; color: var(--secondary); }
    .remove-tag svg { width: 16px; height: 16px; }
    .remove-tag:hover { background: var(--raised); color: var(--danger); }
    .org-panel { display: grid; gap: 16px; padding: 4px 0; }
    .browse { inset: 0; width: min(28rem, calc(100vw - 32px)); max-width: calc(100vw - 32px); height: auto; max-height: min(80dvh, 36rem); margin: auto; border: 1px solid var(--border); border-radius: 20px; background: var(--control); box-shadow: 0 16px 48px #00000030; animation: keepall-browse-in 180ms cubic-bezier(.2, 0, 0, 1) both; }
    .browse.is-closing { animation: keepall-browse-out 140ms ease-in both; }
    @keyframes keepall-browse-in { from { opacity: 0; transform: scale(.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes keepall-browse-out { to { opacity: 0; transform: scale(.98) translateY(4px); } }
    .browse-header { display: flex; align-items: flex-start; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .browse-heading { min-width: 0; flex: 1; }
    .browse-heading h2 { font-size: 18px; }
    .browse-heading p { margin: 4px 0 0; color: var(--secondary); }
    .browse-search-wrap { padding: 16px 20px; }
    .browse-search { min-height: 44px; padding: 8px 12px; }
    .browse-results { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 12px 12px; }
    .browse-option { display: flex; width: 100%; min-height: 40px; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--primary); text-align: left; font-size: 14px; }
    .browse-option:hover { background: var(--active); }
    .browse-option[aria-pressed="true"] { background: var(--active); box-shadow: inset 0 1px 0 var(--active-edge); }
    .browse-selected { color: var(--secondary); font-size: 12px; }
    .browse-empty { padding: 32px 12px; color: var(--secondary); text-align: center; }
    .org-status { margin: 0; color: var(--secondary); font-size: 12px; }
    :where(button, input, textarea):focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
    .note-help { margin: 0; color: var(--secondary); font-size: 12px; font-weight: 400; }
    .note-help[hidden] { display: none; }
    .draft-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--secondary); font-size: 12px; }
    .discard-draft { min-height: 32px; padding: 4px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--danger); font-size: 12px; }
    .discard-draft:hover { background: var(--raised); }
    .error { margin: 0; color: var(--danger); }
    .error:empty { display: none; }
    .footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 18px 24px max(20px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); }
    .footer button { min-height: 40px; padding: 0 16px; border: 1px solid var(--border); border-radius: 999px; corner-shape: superellipse(1.5); font-size: 14px; font-weight: 500; transition: transform 150ms ease-out; }
    .secondary { background: var(--control); color: var(--secondary); }
    .primary { border-color: transparent !important; background: var(--action); color: var(--on-action); }
    .primary:hover { opacity: .9; }
    .footer button:active, .close:active, .choice:active { transform: scale(.96); }
    button:disabled { opacity: .55; cursor: wait; }
    .hint { margin-left: auto; color: var(--secondary); font-size: 12px; }
    .toast { --toast-offset: max(20px, env(safe-area-inset-right)); position: fixed; z-index: 2147483647; right: var(--toast-offset); top: max(20px, env(safe-area-inset-top)); display: grid; width: max-content; max-width: min(320px, calc(100vw - 40px)); border-radius: 28px; color: var(--primary); font-size: 14px; font-weight: 500; line-height: 1.4; opacity: 0; transform: translateX(calc(100% + var(--toast-offset))); transition: transform 260ms cubic-bezier(.32, .72, 0, 1), opacity 180ms cubic-bezier(.32, .72, 0, 1); }
    .toast-card { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 32px; corner-shape: superellipse(1.5); background: var(--toast); box-shadow: 0 12px 36px #00000024, 0 2px 8px #00000012; }
    .toast.is-visible { opacity: 1; transform: translateX(0); }
    dialog .toast { position: absolute; top: 88px; }
    .toast.is-leaving { pointer-events: none; transition-duration: 180ms, 140ms; }
    .toast-mark { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--action); color: var(--on-action); font-size: 12px; }
    .toast[data-success="false"] .toast-mark { background: var(--danger); color: var(--canvas); }
    .toast-label { flex: 0 1 auto; overflow-wrap: anywhere; }
    .toast-content { min-width: 0; flex: 1; }
    .toast-actions { display: flex; flex-wrap: wrap; justify-self: center; gap: 2px; max-width: 100%; margin-top: 6px; padding: 2px; border: 1px solid var(--border); border-radius: 24px; corner-shape: superellipse(1.5); background: var(--toast); box-shadow: 0 4px 12px #00000014, 0 1px 3px #0000000d; }
    .toast-action { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 28px; padding: 3px 8px; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 12px; font-weight: 500; transition: transform 150ms ease-out; }
    .toast-action svg { width: 14px; height: 14px; flex: none; }
    .toast-action:hover { background: var(--raised); color: var(--primary); }
    .toast-action:active { transform: scale(.96); }
    @media (prefers-reduced-motion: reduce) { .toast-action { transition: none; } .toast-action:active { transform: none; } }
    .toast-collections { width: 100%; min-width: 0; max-height: calc(100dvh - 144px); display: flex; flex-direction: column; margin-top: 8px; padding: 8px; background: var(--toast); border: 1px solid var(--border); border-radius: 24px; corner-shape: superellipse(1.5); box-shadow: 0 8px 24px #00000014; animation: collection-enter 160ms cubic-bezier(.2, 0, 0, 1); }
    .toast-collections-header { display: flex; align-items: center; justify-content: space-between; padding-left: 6px; font-size: 12px; font-weight: 600; }
    .toast-collections-search { display: block; flex: none; width: 100%; min-width: 0; min-height: 34px; margin: 4px 0 6px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--control); color: var(--primary); font-size: 12px; }
    .toast-collections-search::placeholder { color: var(--secondary); }
    .toast-collections-list { display: grid; gap: 2px; min-height: 0; overflow-y: auto; max-height: 180px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; scrollbar-gutter: stable; }
    .toast-collection { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; padding: 8px; border: 0; border-radius: 10px; background: transparent; color: var(--primary); text-align: left; font-size: 12px; }
    .toast-collection > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toast-collection-check { flex: none; width: 14px; }
    .toast-collection:hover { background: var(--raised); }
    .toast-collection[aria-pressed="true"] { background: var(--selected); }
    .toast-collections-status { margin: 6px; font-size: 12px; color: var(--secondary); }
    .toast-collections-status[role="alert"] { color: var(--danger); }
    .toast-collections-status[hidden] { display: none; }
    .toast button:focus-visible, .toast input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    .toast button:disabled { cursor: default; opacity: .5; }
    @keyframes collection-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .toast-collections { animation: none; } }
    .toast-close { display: grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 19px; }
    .toast-close:hover { background: var(--raised); color: var(--primary); }
    @media (prefers-reduced-motion: reduce) { dialog, dialog::backdrop, dialog.is-closing, dialog.is-closing::backdrop, .browse, .browse.is-closing { animation: none; } .toast, .toast.is-visible { transform: none; transition: opacity 140ms ease-out; } .header, form, dialog[data-state="saved"] > .header, dialog[data-state="saved"] > form { transform: none; transition: opacity 120ms ease-out, visibility 0s linear 120ms; } .save-complete, dialog[data-state="saved"] .save-complete { transform: none; transition: opacity 140ms ease-out, visibility 0s linear 140ms; } .footer button, .close, .choice { transition: none; } .footer button:active, .close:active, .choice:active { transform: none; } }
    @media (max-width: 480px) { .header { margin: 0 20px; padding: 18px 0; } .fields { padding: 12px 20px 20px; } .footer { padding: 20px; } .hint { display: none; } }
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
  const drafts = new Map();
  let rememberDraft;

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
    mark.textContent = success ? "✓" : "!";
    const label = document.createElement("span");
    label.className = "toast-label";
    label.textContent = message;
    const content = document.createElement("div");
    content.className = "toast-content";
    content.append(label);
    let actionRow;
    let busy = false;
    let collectionPicker;
    cleanupToast = () => collectionPicker?.destroy();
    const duration = actions ? 8000 : 4000;
    const scheduleDismiss = () => {
      if (!node.isConnected) return;
      clearTimeout(toastTimer);
      if (!busy && !collectionPicker && !node.matches(":hover") && !node.contains(shadow.activeElement)) {
        toastTimer = setTimeout(() => dismissToast(), duration);
      }
    };
    if (success && actions) {
      node.classList.add("has-actions");
      const buttons = document.createElement("div");
      buttons.className = "toast-actions";
      buttons.setAttribute("role", "group");
      buttons.setAttribute("aria-label", "Save actions");
      // Hugeicons, matching the app's icon family.
      const actionIcons = {
        open: '<path d="M11.0991 3.00012C7.45013 3.00669 5.53932 3.09629 4.31817 4.31764C3.00034 5.63568 3.00034 7.75704 3.00034 11.9997C3.00034 16.2424 3.00034 18.3638 4.31817 19.6818C5.63599 20.9999 7.75701 20.9999 11.9991 20.9999C16.241 20.9999 18.3621 20.9999 19.6799 19.6818C20.901 18.4605 20.9906 16.5493 20.9972 12.8998"/><path d="M20.556 3.49612L11.0487 13.0586M20.556 3.49612C20.062 3.00151 16.7343 3.04761 16.0308 3.05762M20.556 3.49612C21.05 3.99074 21.0039 7.32273 20.9939 8.02714"/>',
        organize: '<path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7"/>',
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
          if (action === "organize") {
            if (collectionPicker) { closeCollections(true); return; }
            clearTimeout(toastTimer);
            button.setAttribute("aria-expanded", "true");
            collectionPicker = globalThis.__keepallCreateToastCollections({
              host,
              request: async (operation, payload = {}) => {
                if (operation === "move") {
                  busy = true;
                  for (const control of buttons.children) control.disabled = true;
                }
                try {
                  const result = await chrome.runtime.sendMessage({ type: "capture-feedback-action", action: operation, actionId: actions.id, ...payload });
                  if (!result?.success) throw new Error(result?.error || "Could not organize this item. Try again.");
                  return result;
                } finally {
                  if (operation === "move") {
                    busy = false;
                    for (const control of buttons.children) control.disabled = false;
                    scheduleDismiss();
                  }
                }
              },
              onClose: closeCollections,
              onMoved: (result) => {
                label.textContent = result.changed ? `Moved to ${result.collectionName}` : `Already in ${result.collectionName}`;
                node.dataset.success = "true";
                node.setAttribute("role", "status");
                mark.textContent = "✓";
                if (result.changed) buttons.querySelector('[data-action="undo"]')?.remove();
                closeCollections(true);
              },
            });
            node.append(collectionPicker.element);
            collectionPicker.focus();
            return;
          }
          closeCollections(false);
          busy = true;
          clearTimeout(toastTimer);
          for (const control of buttons.children) control.disabled = true;
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
            mark.textContent = "!";
            busy = false;
            for (const control of buttons.children) control.disabled = false;
            scheduleDismiss();
          }
        });
        buttons.append(button);
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
    closeTimer = setTimeout(() => target.close(), 180);
  }

  function openEditor(url, title, editorId, origin) {
    if (dialog?.dataset.state === "saving") return;
    rememberDraft?.();
    const draftKey = JSON.stringify([origin, url]);
    const draft = drafts.get(draftKey);
    dismissToast(true);
    clearTimeout(closeTimer);
    currentPicker?.destroy();
    dialog?.remove();
    currentEditorId = editorId;
    dialog = document.createElement("dialog");
    dialog.setAttribute("aria-labelledby", "keepall-editor-title");
    dialog.setAttribute("aria-describedby", "keepall-editor-description");
    const header = document.createElement("header");
    header.className = "header";
    const headingBlock = document.createElement("div");
    headingBlock.className = "heading";
    const heading = document.createElement("h2");
    heading.id = "keepall-editor-title";
    heading.textContent = "Save to Keepall";
    const description = document.createElement("p");
    description.id = "keepall-editor-description";
    description.className = "description";
    description.textContent = url;
    headingBlock.append(heading, description);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", "Close drawer");
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
    close.addEventListener("click", dismissEditor);
    header.append(headingBlock, close);
    const form = document.createElement("form");
    const fields = document.createElement("div");
    fields.className = "fields";
    const titleLabel = document.createElement("label");
    titleLabel.className = "field";
    const titleName = document.createElement("span");
    titleName.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.maxLength = 500;
    titleInput.value = title;
    titleLabel.append(titleName, titleInput);
    const noteLabel = document.createElement("div");
    noteLabel.className = "field";
    const noteHead = document.createElement("div");
    noteHead.className = "note-head";
    const noteName = document.createElement("label");
    noteName.htmlFor = "keepall-note-input";
    noteName.textContent = "Your note (optional)";
    const markdownToggle = document.createElement("label");
    markdownToggle.className = "markdown-toggle";
    const markdownInput = document.createElement("input");
    markdownInput.type = "checkbox";
    const markdownCheck = document.createElement("span");
    markdownCheck.className = "markdown-check";
    markdownCheck.setAttribute("aria-hidden", "true");
    markdownCheck.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14L8.5 17.5L19 6.5"/></svg>';
    const markdownBox = document.createElement("span");
    markdownBox.className = "markdown-box";
    markdownBox.append(markdownInput, markdownCheck);
    markdownToggle.append(markdownBox, document.createTextNode("Markdown"));
    const noteInput = document.createElement("textarea");
    noteInput.id = "keepall-note-input";
    noteInput.maxLength = 10000;
    noteInput.placeholder = "Why are you saving this link?";
    const noteHelp = document.createElement("p");
    noteHelp.className = "note-help";
    noteHelp.id = "keepall-note-help";
    noteHelp.textContent = "This note includes local images. Edit its contents in Keepall.";
    noteHelp.hidden = true;
    noteHead.append(noteName, markdownToggle);
    noteLabel.append(noteHead, noteInput, noteHelp);
    const picker = globalThis.__keepallCreateOrgPicker(shadow);
    currentPicker = picker;
    let existingLink = draft?.existingLink;
    let snapshotLoaded = draft?.snapshotLoaded ?? false;
    let titleDirty = draft?.title !== undefined;
    let noteDirty = draft?.noteContent !== undefined;
    let markdownDirty = draft?.markdown !== undefined;
    let initialSelection = {};
    let discarded = false;
    let saved = false;
    if (titleDirty) titleInput.value = draft.title;
    if (noteDirty) noteInput.value = draft.noteContent;
    if (markdownDirty) markdownInput.checked = draft.markdown;
    rememberDraft = () => {
      if (saved || discarded) return;
      const selection = picker.loaded ? picker.selection() : draft?.selection;
      const organizationDirty = selection && JSON.stringify(selection) !== JSON.stringify(initialSelection);
      if (!titleDirty && !noteDirty && !markdownDirty && !organizationDirty) {
        drafts.delete(draftKey);
        return;
      }
      drafts.set(draftKey, {
        ...(titleDirty ? { title: titleInput.value } : {}),
        ...(noteDirty ? { noteContent: noteInput.value } : {}),
        ...(markdownDirty ? { markdown: markdownInput.checked } : {}),
        ...(organizationDirty ? { selection } : {}),
        existingLink,
        snapshotLoaded,
      });
    };
    titleInput.addEventListener("input", () => { titleDirty = true; });
    noteInput.addEventListener("input", () => { noteDirty = true; });
    markdownInput.addEventListener("change", () => { markdownDirty = true; });
    onOrganizationMessage = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
      // Retain a restored draft's original snapshot for the save conflict check.
      if (message.type === "organizations" && !snapshotLoaded) {
        existingLink = message.existingLink;
        snapshotLoaded = true;
      }
      if (message.type === "organizations" && message.existingLink) {
        heading.textContent = "Edit saved link";
        if (!titleDirty) titleInput.value = message.existingLink.title;
        if (!noteDirty || message.existingNoteHasImages) noteInput.value = message.existingLink.noteContent;
        if (message.existingNoteHasImages) {
          noteInput.readOnly = true;
          noteInput.setAttribute("aria-describedby", noteHelp.id);
          noteHelp.hidden = false;
        }
        if (!markdownDirty) markdownInput.checked = message.existingLink.noteFormat === "markdown";
      }
      picker.load(message);
      initialSelection = picker.selection();
      if (draft?.selection && picker.loaded) picker.restore(draft.selection);
      if (draft?.selection && !picker.loaded) {
        errorLine.textContent = "Could not restore your collection and tags. Close and reopen the drawer to try again.";
        saveButton.textContent = "Save";
        return;
      }
      saveButton.disabled = false;
      saveButton.textContent = existingLink ? "Save changes" : "Save";
    };
    errorLine = document.createElement("p");
    errorLine.className = "error";
    errorLine.setAttribute("role", "alert");
    fields.append(titleLabel, noteLabel, picker.element, errorLine);
    if (draft) {
      const notice = document.createElement("div");
      notice.className = "draft-notice";
      const label = document.createElement("span");
      label.setAttribute("role", "status");
      label.textContent = "Draft restored";
      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = "discard-draft";
      discard.textContent = "Discard draft";
      discard.addEventListener("click", () => {
        if (dialog?.dataset.state === "saving") return;
        discarded = true;
        drafts.delete(draftKey);
        dismissEditor();
      });
      notice.append(label, discard);
      fields.prepend(notice);
    }
    const footer = document.createElement("div");
    footer.className = "footer";
    saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "primary";
    saveButton.textContent = "Loading…";
    saveButton.disabled = true;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.textContent = "Close";
    cancel.addEventListener("click", dismissEditor);
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Ctrl/⌘ Enter to save";
    footer.append(saveButton, cancel, hint);
    form.append(fields, footer);
    const complete = document.createElement("div");
    complete.className = "save-complete";
    complete.setAttribute("role", "status");
    complete.setAttribute("aria-live", "polite");
    complete.setAttribute("aria-hidden", "true");
    complete.tabIndex = -1;
    const completeMark = document.createElement("div");
    completeMark.className = "save-complete-mark";
    completeMark.setAttribute("aria-hidden", "true");
    completeMark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>';
    const completeTitle = document.createElement("p");
    completeTitle.className = "save-complete-title";
    complete.append(completeMark, completeTitle);
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveButton.disabled) return;
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      dialog.dataset.state = "saving";
      close.disabled = true;
      cancel.disabled = true;
      picker.setDisabled(true);
      errorLine.textContent = "";
      chrome.runtime.sendMessage({
        type: "save-from-editor",
        editorId,
        title: titleInput.value,
        noteContent: noteInput.value,
        noteFormat: markdownInput.checked ? "markdown" : "plain",
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
        complete.focus({ preventScroll: true });
        closeTimer = setTimeout(() => dismissEditor(), 1600);
      } else {
        dialog.dataset.state = "error";
        saveButton.disabled = false;
        saveButton.textContent = existingLink ? "Save changes" : "Save";
        close.disabled = false;
        cancel.disabled = false;
        picker.setDisabled(false);
        errorLine.textContent = message.message;
        toast("Couldn't save to Keepall", false);
      }
    };
    dialog.append(header, form, complete);
    const currentDialog = dialog;
    dialog.addEventListener("close", () => {
      picker.destroy();
      currentDialog.remove();
      if (dialog === currentDialog) dialog = undefined;
    }, { once: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismissEditor();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dismissEditor();
    });
    shadow.append(dialog);
    dialog.showModal();
    titleInput.focus();
    titleInput.select();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "editor") openEditor(message.url, message.title, message.editorId, message.origin);
    if (message?.type === "organizations" || message?.type === "organization-error") onOrganizationMessage?.(message);
    if (message?.type === "toast-feedback") toast(message.message, message.success, message.actions);
    if (message?.type === "editor-feedback") onEditorFeedback?.(message);
  });
}
