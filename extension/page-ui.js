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
    .header { display: flex; align-items: flex-start; gap: 16px; padding: 24px 28px; }
    .heading { min-width: 0; flex: 1; }
    h2 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.025em; line-height: 1.35; }
    .description { margin: 4px 0 0; color: var(--secondary); line-height: 1.6; }
    .close { display: grid; flex: none; place-items: center; width: 40px; height: 40px; padding: 0; border: 1px solid var(--border); border-radius: 999px; corner-shape: superellipse(1.5); background: var(--control); color: var(--secondary); transition: transform 150ms ease-out; }
    .close:hover, .secondary:hover { background: var(--raised); color: var(--primary); }
    .close svg { width: 18px; height: 18px; }
    form { display: flex; min-height: 0; flex: 1; flex-direction: column; }
    .fields { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 16px; overflow-y: auto; overscroll-behavior: contain; padding: 8px 28px 20px; }
    .fields, .browse-results { scrollbar-color: var(--scroll-thumb) transparent; scrollbar-width: thin; }
    .fields::-webkit-scrollbar, .browse-results::-webkit-scrollbar { width: 6px; }
    .fields::-webkit-scrollbar-track, .browse-results::-webkit-scrollbar-track { background: transparent; }
    .fields::-webkit-scrollbar-thumb, .browse-results::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--scroll-thumb); }
    .field { display: grid; gap: 8px; font-weight: 500; }
    .url { min-height: 52px; padding: 12px 16px; overflow-wrap: anywhere; border: 1px solid var(--border); border-radius: 16px; background: var(--control); color: var(--secondary); font-weight: 400; }
    input, textarea { width: 100%; border: 1px solid var(--border); border-radius: 16px; background: var(--control); color: var(--primary); font-size: 14px; font-weight: 400; }
    input { min-height: 52px; padding: 12px 16px; }
    textarea { min-height: 128px; padding: 12px; resize: vertical; }
    textarea::placeholder { color: var(--secondary); }
    .org-section { display: grid; gap: 6px; }
    .org-section[hidden], .selected-tags[hidden], .browse-trigger[hidden], .org-status[hidden], .save-status[hidden] { display: none; }
    .org-title { margin: 0; color: var(--secondary); font-weight: 500; }
    .org-head { display: flex; min-height: 32px; align-items: center; justify-content: space-between; gap: 12px; }
    .browse-trigger { min-height: 32px; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 12px; font-weight: 500; }
    .browse-trigger:hover { background: var(--raised); color: var(--primary); }
    .org-search { min-height: 44px; padding: 8px 12px; border-radius: 13px; }
    .choices, .selected-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .choice, .selected-tag { display: inline-flex; min-height: 36px; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; corner-shape: superellipse(1.5); background: var(--control); color: var(--secondary); font-size: 12px; transition: transform 150ms ease-out; }
    .choice:hover { background: var(--raised); color: var(--primary); }
    .choice[aria-pressed="true"], .selected-tag { background: var(--active); color: var(--primary); box-shadow: inset 0 1px 0 var(--active-edge); }
    .remove-tag { display: grid; place-items: center; width: 32px; height: 32px; margin: -3px -7px -3px 0; border: 0; border-radius: 999px; corner-shape: superellipse(1.5); background: transparent; color: var(--secondary); }
    .remove-tag svg { width: 16px; height: 16px; }
    .remove-tag:hover { background: var(--raised); color: var(--danger); }
    .org-panel { display: grid; gap: 24px; padding: 16px 0; }
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
    .error { margin: 0; color: var(--danger); }
    .error:empty { display: none; }
    .footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 20px 28px max(20px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); }
    .footer button { min-height: 40px; padding: 0 16px; border: 1px solid var(--border); border-radius: 999px; corner-shape: superellipse(1.5); font-size: 14px; font-weight: 500; transition: transform 150ms ease-out; }
    .secondary { background: var(--control); color: var(--secondary); }
    .primary { border-color: transparent !important; background: var(--action); color: var(--on-action); }
    .primary:hover { opacity: .9; }
    .primary.is-saved:disabled { opacity: 1; cursor: default; }
    .save-check { width: 17px; height: 17px; margin-right: 7px; vertical-align: -3px; animation: keepall-check-in 180ms cubic-bezier(.16, 1, .3, 1) both; }
    @keyframes keepall-check-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
    .footer button:active, .close:active, .choice:active { transform: scale(.96); }
    button:disabled { opacity: .55; cursor: wait; }
    .hint { margin-left: auto; color: var(--secondary); font-size: 12px; }
    .toast { position: fixed; z-index: 2147483647; right: max(20px, env(safe-area-inset-right)); top: max(20px, env(safe-area-inset-top)); display: flex; align-items: center; gap: 12px; width: min(360px, calc(100vw - 40px)); min-height: 56px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--toast); color: var(--primary); box-shadow: 0 12px 36px #00000024, 0 2px 8px #00000012; font-size: 14px; font-weight: 500; line-height: 1.4; animation: keepall-toast-in 340ms cubic-bezier(.16, 1, .3, 1) both; }
    .toast.is-leaving { animation: keepall-toast-out 180ms ease-in both; }
    .toast-mark { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--action); color: var(--on-action); font-size: 12px; }
    .toast[data-success="false"] .toast-mark { background: var(--danger); color: var(--canvas); }
    .toast-label { flex: 1; }
    .toast-close { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--secondary); font-size: 19px; }
    .toast-close:hover { background: var(--raised); color: var(--primary); }
    @keyframes keepall-toast-in { from { opacity: 0; transform: translateY(-16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes keepall-toast-out { to { opacity: 0; transform: translateY(-12px) scale(.98); } }
    .save-status { margin: 0 0 0 auto; color: var(--secondary); font-size: 12px; animation: keepall-status-in 180ms ease-out both; }
    @keyframes keepall-status-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { dialog, dialog::backdrop, dialog.is-closing, dialog.is-closing::backdrop, .browse, .browse.is-closing, .toast, .toast.is-leaving, .save-status, .save-check { animation: none; } .footer button, .close, .choice { transition: none; } .footer button:active, .close:active, .choice:active { transform: none; } }
    @media (max-width: 480px) { .header { padding: 20px; } .fields { padding: 8px 20px 20px; } .footer { padding: 20px; } .hint { display: none; } }
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
  let closeTimer;
  let footerStatus;
  let currentPicker;

  function dismissToast(immediate = false) {
    clearTimeout(toastTimer);
    const node = shadow.querySelector(".toast");
    if (!node) return;
    if (immediate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.remove();
      return;
    }
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 180);
  }

  function toast(message, success) {
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
    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    close.addEventListener("click", () => dismissToast());
    node.addEventListener("mouseenter", () => clearTimeout(toastTimer));
    node.addEventListener("mouseleave", () => { toastTimer = setTimeout(() => dismissToast(), 4000); });
    node.append(mark, label, close);
    shadow.append(node);
    toastTimer = setTimeout(() => dismissToast(), 4000);
  }

  function dismissEditor() {
    const target = dialog;
    if (!target?.open || target.dataset.state === "saving" || target.classList.contains("is-closing")) return;
    clearTimeout(closeTimer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.close();
      return;
    }
    target.classList.add("is-closing");
    closeTimer = setTimeout(() => target.close(), 180);
  }

  function openEditor(url, title, editorId) {
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
    description.textContent = "Save this page with a personal note.";
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
    const urlLabel = document.createElement("div");
    urlLabel.className = "field";
    const urlName = document.createElement("span");
    urlName.textContent = "Link URL";
    const urlLine = document.createElement("div");
    urlLine.className = "url";
    urlLine.textContent = url;
    urlLine.title = url;
    urlLabel.append(urlName, urlLine);
    const titleLabel = document.createElement("label");
    titleLabel.className = "field";
    const titleName = document.createElement("span");
    titleName.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.maxLength = 500;
    titleInput.value = title;
    titleLabel.append(titleName, titleInput);
    const noteLabel = document.createElement("label");
    noteLabel.className = "field";
    const noteName = document.createElement("span");
    noteName.textContent = "Your note (optional)";
    const noteInput = document.createElement("textarea");
    noteInput.maxLength = 10000;
    noteInput.placeholder = "Why are you saving this link?";
    noteLabel.append(noteName, noteInput);
    const picker = globalThis.__keepallCreateOrgPicker(shadow);
    currentPicker = picker;
    onOrganizationMessage = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
      picker.load(message);
      saveButton.disabled = false;
      saveButton.textContent = "Save";
    };
    errorLine = document.createElement("p");
    errorLine.className = "error";
    errorLine.setAttribute("role", "alert");
    fields.append(urlLabel, titleLabel, noteLabel, picker.element, errorLine);
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
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", dismissEditor);
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Ctrl/⌘ Enter to save";
    footerStatus = document.createElement("p");
    footerStatus.className = "save-status";
    footerStatus.setAttribute("role", "status");
    footerStatus.hidden = true;
    footer.append(saveButton, cancel, hint, footerStatus);
    form.append(fields, footer);
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
        ...picker.selection(),
      });
    });
    onEditorFeedback = (message) => {
      if (message.editorId !== currentEditorId || !dialog?.open) return;
      dialog.dataset.state = message.success ? "saved" : "error";
      if (message.success) {
        const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        check.setAttribute("class", "save-check");
        check.setAttribute("viewBox", "0 0 24 24");
        check.setAttribute("fill", "none");
        check.setAttribute("stroke", "currentColor");
        check.setAttribute("stroke-width", "2.5");
        check.setAttribute("stroke-linecap", "round");
        check.setAttribute("stroke-linejoin", "round");
        check.setAttribute("aria-hidden", "true");
        const mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
        mark.setAttribute("d", "m5 12 4.5 4.5L19 7");
        check.append(mark);
        saveButton.replaceChildren(check, document.createTextNode("Saved"));
        saveButton.classList.add("is-saved");
        footerStatus.textContent = message.message;
        footerStatus.hidden = false;
        hint.hidden = true;
        close.disabled = false;
        cancel.disabled = false;
        closeTimer = setTimeout(() => dismissEditor(), 1200);
      } else {
        saveButton.disabled = false;
        saveButton.textContent = "Save";
        close.disabled = false;
        cancel.disabled = false;
        picker.setDisabled(false);
        errorLine.textContent = message.message;
      }
    };
    dialog.append(header, form);
    dialog.addEventListener("close", () => {
      picker.destroy();
      dialog.remove();
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
    if (message?.type === "editor") openEditor(message.url, message.title, message.editorId);
    if (message?.type === "organizations" || message?.type === "organization-error") onOrganizationMessage?.(message);
    if (message?.type === "toast-feedback") toast(message.message, message.success);
    if (message?.type === "editor-feedback") onEditorFeedback?.(message);
  });
}
