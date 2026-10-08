if (!globalThis.__keepallCreateFileCapture) {
  globalThis.__keepallCreateFileCapture = function ({ document, request, createNoteEditor, getOrganization, sourceUrl, onChange, onBusy, onComplete, draft, pollDelay = 500 }) {
    const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm,.txt,.md,.pdf";
    const CHUNK = 256 * 1024;
    function uuid() {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    const mimeTypes = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", mp4: "video/mp4", webm: "video/webm" };
    const state = draft ?? { entries: [], imageMode: null, gallery: { content: "", format: "plain" }, units: [] };
    let busy = false;
    let uncertain = false;
    let disabled = false;
    let cancelRequested = false;
    let disposed = false;
    let activeUnit;
    let editors = [];
    const urls = new Map();
    const element = node("section", "file-capture");
    const input = node("input"); input.type = "file"; input.multiple = true; input.accept = ACCEPT; input.hidden = true; input.setAttribute("aria-label", "Choose files");
    const add = button("Add files", () => input.click(), "secondary file-add");
    const help = node("p", "note-help", "Images, video, PDF, text, or Markdown. You can also paste an image.");
    const panel = node("div", "file-staging");
    const list = node("ul", "file-list"); list.setAttribute("aria-label", "Files to save");
    const layout = node("div", "file-layout"); layout.setAttribute("role", "group"); layout.setAttribute("aria-label", "Image layout");
    for (const [label, mode] of [["One image item", "gallery"], ["Separate image items", "separate"]]) {
      const control = button(label, () => { state.imageMode = mode; invalidate(); render(); }); control.dataset.mode = mode; layout.append(control);
    }
    const explanation = node("p", "note-help");
    const details = node("div", "file-details");
    const removeAll = button("Remove all files", () => { releaseUrls(); state.entries = []; state.units = []; state.imageMode = null; render(); });
    const progress = node("p", "file-progress"); progress.setAttribute("role", "status");
    const error = node("p", "error"); error.setAttribute("role", "alert");
    const actions = node("div", "file-actions");
    const retry = button("Continue import", () => void save()); retry.hidden = true;
    const cancel = button("Cancel import", () => { cancelRequested = true; cancel.disabled = true; progress.textContent = "Cancelling. Waiting for confirmed save results…"; if (!busy) void save(); }); cancel.hidden = true;
    const open = button("Open in Keepall", async () => {
      open.disabled = true;
      try { await send("open-results", { actionIds: [...new Set(state.units.map(unit => unit.actionId).filter(Boolean))] }); }
      catch (reason) { error.textContent = reason.message; }
      finally { if (!disposed) open.disabled = false; }
    }); open.hidden = true;
    actions.append(retry, cancel, open);
    panel.append(list, layout, explanation, details, removeAll, progress, error, actions);
    element.append(add, input, help, panel);
    input.addEventListener("change", () => { const files = [...input.files]; input.value = ""; void addFiles(files); });

    function node(tag, className, text) {
      const result = document.createElement(tag);
      if (className) result.className = className;
      if (text !== undefined) result.textContent = text;
      return result;
    }
    function button(label, action, className = "secondary") {
      const control = node("button", className, label); control.type = "button"; control.addEventListener("click", action); return control;
    }
    function classify(file) {
      const extension = file.name.split(".").at(-1).toLowerCase();
      if (["txt", "md", "pdf"].includes(extension)) return extension;
      const type = file.type && file.type !== "application/octet-stream" ? file.type.split(";")[0].trim().toLowerCase() : mimeTypes[extension];
      if (Object.values(mimeTypes).slice(0, 6).includes(type)) return "image";
      if (["video/mp4", "video/webm"].includes(type)) return "video";
      return "unsupported";
    }
    function validate(files) {
      if (files.length > 50) throw new Error("Choose up to 50 files per import.");
      if (files.reduce((sum, file) => sum + file.size, 0) > 200 * 1024 * 1024) throw new Error("Choose 200 MiB or less per import.");
      for (const file of files) {
        if (!file.name.trim() || file.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(file.name)) throw new Error("Use a valid filename.");
        const kind = classify(file);
        if (kind === "unsupported") throw new Error("Use PNG, JPEG, GIF, WebP, AVIF, MP4, WebM, .txt, .md, or .pdf files.");
        const limit = kind === "image" ? 20 : kind === "video" ? 100 : kind === "pdf" ? 50 : 10;
        if (file.size > limit * 1024 * 1024) throw new Error(`${file.name} must be ${limit} MiB or smaller.`);
        if (!file.size && ["image", "video"].includes(kind)) throw new Error(`${file.name} is empty.`);
      }
    }
    function releaseUrls() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); }
    function invalidate() { state.units = state.units.filter(unit => unit.saved); }
    function allImages() { return state.entries.length > 0 && state.entries.every(entry => entry.kind === "image"); }
    async function addFiles(files) {
      if (busy || uncertain || disabled || !files.length) return;
      error.textContent = "";
      busy = true; onBusy(true); updateDisabled();
      try {
        validate([...state.entries.map(entry => entry.file), ...files]);
        const additions = [];
        for (const file of files) {
          const kind = classify(file);
          const entry = { id: uuid(), file, kind, title: file.name.replace(/\.[^.]+$/, ""), content: "", format: kind === "md" ? "markdown" : "plain" };
          if (["txt", "md"].includes(kind)) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            try { entry.originalText = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
            catch { throw new Error("Use a UTF-8 text file. This file has an unsupported encoding."); }
            if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(entry.originalText)) throw new Error("This file contains binary data instead of text.");
            entry.content = entry.originalText;
          }
          additions.push(entry);
        }
        if (disposed) return;
        state.entries.push(...additions); invalidate(); render();
      } catch (reason) { error.textContent = reason.message || "Could not read this file."; panel.hidden = false; }
      finally { busy = false; if (!disposed) { onBusy(false); updateDisabled(); } }
    }
    function paste(event) {
      if (busy || uncertain || disabled) return;
      const files = [...(event.clipboardData?.items ?? [])].filter(item => item.kind === "file" && item.type.startsWith("image/")).map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) return;
      event.preventDefault(); void addFiles(files);
    }
    function addEditor(entry, label) {
      const editor = createNoteEditor({ label, content: entry.content, format: entry.format, onChange(value) {
        entry.content = value.content; entry.format = value.format; invalidate(); onChange();
      } });
      editors.push(editor); details.append(editor.element);
    }
    function render() {
      for (const editor of editors) editor.destroy(); editors = [];
      list.replaceChildren(); details.replaceChildren();
      panel.hidden = !state.entries.length && !error.textContent;
      const images = allImages();
      if (state.entries.length < 2 || !images) state.imageMode = null;
      layout.hidden = !images || state.entries.length < 2 || state.entries.some(entry => entry.saved);
      for (const control of layout.children) control.setAttribute("aria-pressed", String(state.imageMode === control.dataset.mode));
      for (const entry of state.entries) {
        const row = node("li", "file-row");
        if (entry.kind === "image") {
          if (!urls.has(entry.id)) urls.set(entry.id, URL.createObjectURL(entry.file));
          const thumbnail = node("img", "file-thumbnail"); thumbnail.src = urls.get(entry.id); thumbnail.alt = ""; row.append(thumbnail);
        }
        const name = node("div", "file-name"); name.append(node("span", "", entry.file.name), node("small", "", `${entry.file.size < 1024 ? entry.file.size + " B" : (entry.file.size / 1024).toFixed(1) + " KiB"}${entry.saved ? " · Saved" : entry.error ? " · " + entry.error : ""}`));
        const remove = button("×", () => {
          if (urls.has(entry.id)) URL.revokeObjectURL(urls.get(entry.id)); urls.delete(entry.id);
          state.entries = state.entries.filter(item => item !== entry); invalidate(); render();
        }, "file-remove"); remove.setAttribute("aria-label", `Remove ${entry.file.name}`); remove.disabled = !!entry.saved;
        row.append(name, remove); list.append(row);
      }
      const single = state.entries.length === 1 ? state.entries[0] : undefined;
      if (single && !single.saved) {
        if (single.kind === "video") {
          const label = node("label", "field", "Video title"); const title = node("input"); title.value = single.title; title.maxLength = 500;
          title.addEventListener("input", () => { single.title = title.value; invalidate(); }); label.append(title); details.append(label);
        }
        if (single.kind !== "pdf") addEditor(single, single.kind === "image" ? "Caption (optional)" : ["txt", "md"].includes(single.kind) ? "File contents" : "Video note (optional)");
      } else if (images && state.imageMode === "gallery" && !state.entries.some(entry => entry.saved)) addEditor(state.gallery, "Caption (optional)");
      explanation.textContent = images && state.entries.length > 1 && !state.imageMode ? "Choose how to save these images." : state.entries.length > 1 && state.imageMode !== "gallery" ? "Each file saves as a separate item with its own filename." : single?.kind === "pdf" ? "The original PDF will be saved. Open it in Keepall to read it." : single && ["txt", "md"].includes(single.kind) ? "Unchanged text keeps the original file bytes. Edits save as a new version of this file." : "Source: " + sourceUrl;
      const saved = state.entries.filter(entry => entry.saved).length;
      open.hidden = !saved || !state.units.some(unit => unit.actionId);
      open.textContent = new Set(state.units.flatMap(unit => unit.results?.filter(result => result.status === "saved").map(result => result.itemId) ?? [])).size > 1 ? "Open library" : "Open in Keepall";
      updateDisabled(); onChange();
    }
    function updateDisabled() {
      const locked = busy || uncertain || disabled;
      for (const control of element.querySelectorAll("input,button")) {
        if ([retry, cancel, open].includes(control)) continue;
        control.disabled = locked || (control.classList.contains("file-remove") && state.entries.some(entry => entry.saved && control.getAttribute("aria-label") === `Remove ${entry.file.name}`));
      }
      for (const editor of editors) editor.setDisabled(locked);
      retry.disabled = busy;
      removeAll.disabled = locked;
    }
    async function send(operation, payload = {}) {
      const result = await request(operation, payload);
      if (!result?.success) throw new Error(result?.error || "Keepall did not confirm the action. Continue to check its status.");
      return result;
    }
    async function freeze() {
      const organization = getOrganization();
      state.units = state.units.filter(unit => unit.saved || (unit.sessionId && !unit.terminal) || JSON.stringify(unit.manifest.organization) === JSON.stringify(organization));
      const pending = state.entries.filter(entry => !entry.saved);
      const covered = new Set(state.units.flatMap(unit => unit.entryIds));
      const newEntries = pending.filter(entry => !covered.has(entry.id));
      const groups = state.imageMode === "gallery" ? (newEntries.length ? [newEntries] : []) : newEntries.map(entry => [entry]);
      for (const entries of groups) {
        const files = entries.map(entry => {
          if (!["txt", "md"].includes(entry.kind)) return entry.file;
          const extension = entry.format === "markdown" ? ".md" : ".txt";
          const name = entry.file.name.replace(/\.(txt|md)$/i, extension);
          return entry.content === entry.originalText && name === entry.file.name ? entry.file : new File([entry.content === entry.originalText ? entry.file : new TextEncoder().encode(entry.content)], name, { type: entry.format === "markdown" ? "text/markdown" : "text/plain" });
        });
        validate(files);
        const entry = entries[0];
        const content = state.imageMode === "gallery" ? state.gallery : entry;
        const metadata = { sourceUrl, ...(["image", "video"].includes(entry.kind) ? { noteContent: content.content, noteFormat: content.format } : {}), ...(entry.kind === "video" ? { title: entry.title } : {}) };
        const manifest = JSON.parse(JSON.stringify({ manifestId: uuid(), itemIds: Array.from({ length: state.imageMode === "gallery" ? 1 : files.length }, () => uuid()), files: files.map(file => ({ name: file.name, type: file.type, size: file.size })), imageMode: state.imageMode === "gallery" ? "gallery" : "separate", organization, metadata }));
        state.units.push({ manifest, files, entryIds: entries.map(entry => entry.id), results: [] });
      }
      validate(state.units.flatMap(unit => unit.files));
    }
    function accept(unit, result) {
      unit.results = result.results ?? unit.results;
      if (result.actionId) unit.actionId = result.actionId;
      for (const item of unit.results) {
        const entry = state.entries.find(entry => entry.id === unit.entryIds[item.fileIndex]);
        if (entry) { entry.saved = item.status === "saved"; entry.error = item.error; }
      }
      unit.saved = unit.results.length === unit.files.length && unit.results.every(item => item.status === "saved");
      unit.terminal = ["complete", "cancelled"].includes(result.stage);
      const count = state.entries.filter(entry => entry.saved).length;
      progress.textContent = `${count} of ${state.entries.length} files saved${result.processing ? ` · ${result.processing === "preparing-video" ? "Preparing video" : result.processing === "reading" ? "Reading files" : "Saving"}` : ""}`;
    }
    async function poll(unit, result) {
      for (let attempt = 0; result.stage === "saving" && attempt < 120; attempt++) {
        accept(unit, result);
        if (cancelRequested) result = await send("cancel", { sessionId: unit.sessionId });
        await new Promise(resolve => setTimeout(resolve, pollDelay));
        result = await send("status", { sessionId: unit.sessionId });
      }
      accept(unit, result);
      if (result.stage === "saving") throw new Error("Keepall is still processing. Continue to check the saved results.");
      return result;
    }
    async function transfer(unit) {
      let result;
      if (unit.sessionId) {
        try { result = await send("status", { sessionId: unit.sessionId }); }
        catch (reason) { if (!/Unknown or expired file session/i.test(reason.message)) throw reason; unit.sessionId = undefined; }
      }
      if (result && ["complete", "cancelled"].includes(result.stage)) {
        accept(unit, result);
        if (unit.saved || cancelRequested) return;
        unit.sessionId = undefined;
        unit.manifest = { ...unit.manifest, manifestId: uuid() };
      }
      if (!unit.sessionId) { unit.terminal = false; result = await send("begin", unit.manifest); unit.sessionId = result.sessionId; accept(unit, result); }
      if (cancelRequested) { await poll(unit, await send("cancel", { sessionId: unit.sessionId })); return; }
      if (result.stage === "saving") { await poll(unit, result); return; }
      if (result.stage === "complete") { accept(unit, result); return; }
      for (let fileIndex = 0; fileIndex < unit.files.length; fileIndex++) {
        const file = unit.files[fileIndex];
        for (let offset = 0; offset < file.size; offset += CHUNK) {
          if (cancelRequested) { await poll(unit, await send("cancel", { sessionId: unit.sessionId })); return; }
          const bytes = new Uint8Array(await file.slice(offset, offset + CHUNK).arrayBuffer());
          let binary = ""; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
          await send("chunk", { sessionId: unit.sessionId, fileIndex, offset, data: btoa(binary) });
          progress.textContent = `Sending ${file.name} · ${Math.min(offset + CHUNK, file.size)} of ${file.size} bytes`;
        }
      }
      await poll(unit, await send("commit", { sessionId: unit.sessionId }));
    }
    async function save() {
      if (busy || disabled || !state.entries.length) return;
      error.textContent = "";
      if (allImages() && state.entries.length > 1 && !state.imageMode && !state.entries.some(entry => entry.saved)) { error.textContent = "Choose One image item or Separate image items."; return; }
      busy = true; uncertain = false; retry.hidden = true; cancel.hidden = false; cancel.disabled = false; onBusy(true); updateDisabled();
      try {
        await freeze();
        for (const unit of state.units) {
          if (unit.saved) continue;
          if (cancelRequested && !unit.sessionId) break;
          activeUnit = unit;
          await transfer(unit);
          if (cancelRequested) break;
        }
        const saved = state.entries.filter(entry => entry.saved).length;
        const complete = saved === state.entries.length;
        progress.textContent = complete ? `${saved} ${saved === 1 ? "file" : "files"} saved to Keepall.` : `${saved} of ${state.entries.length} files saved. ${cancelRequested ? "Import cancelled." : "Some files could not be saved."}`;
        retry.textContent = cancelRequested ? "Continue import" : "Retry failed files"; retry.hidden = complete;
        if (complete) onComplete({ count: saved, actionIds: [...new Set(state.units.map(unit => unit.actionId).filter(Boolean))] });
      } catch (reason) {
        uncertain = !!activeUnit?.sessionId && !activeUnit.terminal;
        error.textContent = reason.message || "Could not finish importing. Continue to check saved results.";
        retry.textContent = uncertain ? "Continue import" : "Retry failed files"; retry.hidden = false;
      } finally {
        busy = false; cancelRequested = false; cancel.hidden = !uncertain; cancel.disabled = false;
        onBusy(uncertain); render();
      }
    }
    render();
    return {
      element, addFiles, paste, save,
      get hasFiles() { return state.entries.length > 0; },
      get locked() { return busy || uncertain; },
      draft: () => state,
      setDisabled(value) { disabled = value; updateDisabled(); },
      destroy() { disposed = true; releaseUrls(); for (const editor of editors) editor.destroy(); },
    };
  };
}
