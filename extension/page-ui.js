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
    .toast { --toast-offset: max(20px, env(safe-area-inset-right)); position: fixed; z-index: 2147483647; right: var(--toast-offset); top: max(20px, env(safe-area-inset-top)); display: flex; align-items: center; gap: 10px; width: max-content; max-width: min(320px, calc(100vw - 40px)); min-height: 48px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 28px; corner-shape: squircle; background: var(--toast); color: var(--primary); box-shadow: 0 12px 36px #00000024, 0 2px 8px #00000012; font-size: 14px; font-weight: 500; line-height: 1.4; opacity: 0; transform: translateX(calc(100% + var(--toast-offset))); transition: transform 260ms cubic-bezier(.32, .72, 0, 1), opacity 180ms cubic-bezier(.32, .72, 0, 1); }
    .toast.is-visible { opacity: 1; transform: translateX(0); }
    dialog .toast { position: absolute; top: 88px; }
    .toast.is-leaving { pointer-events: none; transition-duration: 180ms, 140ms; }
    .toast-mark { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--action); color: var(--on-action); font-size: 12px; }
    .toast[data-success="false"] .toast-mark { background: var(--danger); color: var(--canvas); }
    .toast-label { flex: 0 1 auto; overflow-wrap: anywhere; }
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
  let closeTimer;
  let currentPicker;
  const drafts = new Map();
  let rememberDraft;

  function dismissToast(immediate = false) {
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
    (dialog?.open ? dialog : shadow).append(node);
    void node.offsetWidth;
    node.classList.add("is-visible");
    toastTimer = setTimeout(() => dismissToast(), 4000);
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
    if (message?.type === "toast-feedback") toast(message.message, message.success);
    if (message?.type === "editor-feedback") onEditorFeedback?.(message);
  });
}
