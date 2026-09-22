if (!globalThis.__keepallPageUi) {
  globalThis.__keepallPageUi = true;

  const host = document.createElement("div");
  host.id = "keepall-capture-ui";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .toast { position: fixed; z-index: 2147483647; top: 20px; right: 20px; max-width: min(360px, calc(100vw - 40px)); padding: 12px 16px; border: 1px solid #d4d4d8; border-radius: 12px; background: #fff; color: #18181b; box-shadow: 0 12px 30px #0002; font: 500 14px/1.4 Inter, system-ui, sans-serif; }
    .toast[data-success="false"] { border-color: #fda29b; }
    dialog { width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 24px; border: 1px solid #d4d4d8; border-radius: 16px; background: #fff; color: #18181b; box-shadow: 0 24px 70px #0004; font: 14px/1.5 Inter, system-ui, sans-serif; }
    dialog::backdrop { background: #09090b99; }
    h2 { margin: 0 0 4px; font-size: 20px; line-height: 1.3; }
    .url { margin: 0 0 20px; overflow: hidden; color: #52525b; text-overflow: ellipsis; white-space: nowrap; }
    label { display: block; margin: 16px 0 6px; font-weight: 600; }
    input, textarea { width: 100%; padding: 10px 12px; border: 1px solid #a1a1aa; border-radius: 8px; background: #fff; color: #18181b; font: inherit; }
    textarea { min-height: 110px; resize: vertical; }
    input:focus, textarea:focus, button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    button { min-height: 40px; padding: 0 16px; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; color: #18181b; font: 600 14px Inter, system-ui, sans-serif; cursor: pointer; }
    button.primary { border-color: #18181b; background: #18181b; color: #fff; }
    button:disabled { opacity: .55; cursor: wait; }
    .error { min-height: 20px; margin: 10px 0 0; color: #b42318; }
  `;
  shadow.append(style);
  document.documentElement.append(host);

  let dialog;
  let saveButton;
  let errorLine;

  function toast(message, success) {
    shadow.querySelector(".toast")?.remove();
    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.success = String(success);
    node.setAttribute("role", "status");
    node.textContent = message;
    shadow.append(node);
    setTimeout(() => node.remove(), 4500);
  }

  function openEditor(url, title) {
    dialog?.remove();
    dialog = document.createElement("dialog");
    const heading = document.createElement("h2");
    heading.textContent = "Save to Keepall";
    const urlLine = document.createElement("p");
    urlLine.className = "url";
    urlLine.textContent = url;
    urlLine.title = url;
    const form = document.createElement("form");
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.maxLength = 500;
    titleInput.value = title;
    titleLabel.append(titleInput);
    const noteLabel = document.createElement("label");
    noteLabel.textContent = "Personal note";
    const noteInput = document.createElement("textarea");
    noteInput.maxLength = 10000;
    noteInput.placeholder = "Why are you saving this link?";
    noteLabel.append(noteInput);
    errorLine = document.createElement("p");
    errorLine.className = "error";
    errorLine.setAttribute("role", "alert");
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => dialog.close());
    saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "primary";
    saveButton.textContent = "Save link";
    actions.append(cancel, saveButton);
    form.append(titleLabel, noteLabel, errorLine, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      errorLine.textContent = "";
      chrome.runtime.sendMessage({ type: "save-from-editor", title: titleInput.value, noteContent: noteInput.value });
    });
    dialog.append(heading, urlLine, form);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    shadow.append(dialog);
    dialog.showModal();
    titleInput.focus();
    titleInput.select();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "editor") openEditor(message.url, message.title);
    if (message?.type === "feedback") {
      toast(message.message, message.success);
      if (dialog?.open) {
        if (message.success) dialog.close();
        else {
          saveButton.disabled = false;
          saveButton.textContent = "Save link";
          errorLine.textContent = message.message;
        }
      }
    }
  });
}
