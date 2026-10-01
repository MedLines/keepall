if (!globalThis.__keepallCreateToastCollections) {
  globalThis.__keepallCreateToastCollections = function ({ request, onClose, onMoved, onTagged, host }) {
    const panel = document.createElement("section");
    panel.className = "toast-collections";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Organize item");
    panel.innerHTML = `<div class="toast-collections-header"><span>Organize</span><button type="button" class="toast-close" aria-label="Close organizer">×</button></div>
      <div class="toast-collections-controls"><div class="toast-organize-types" role="group" aria-label="Organization type">
        <button type="button" data-kind="collection" aria-pressed="true">Collection</button>
        <button type="button" data-kind="tag" aria-pressed="false">Tags</button>
      </div>
      <input class="toast-collections-search" type="search" placeholder="Find or create a collection…" aria-label="Find a collection" autocomplete="off" maxlength="120" disabled></div>
      <div class="toast-collections-list" role="group" aria-label="Collections"></div>
      <div class="toast-collections-footer"><p class="toast-collections-status" role="status">Loading collections and tags…</p><button type="button" class="toast-collections-retry" hidden>Retry</button></div>`;
    const search = panel.querySelector("input");
    const status = panel.querySelector("p");
    const list = panel.querySelector(".toast-collections-list");
    const close = panel.querySelector(".toast-close");
    const retry = panel.querySelector(".toast-collections-retry");
    const switches = [...panel.querySelectorAll("[data-kind]")];
    let options;
    let kind = "collection";
    const queries = { collection: "", tag: "" };
    let saving = false;
    let loading = false;
    let disposed = false;
    const normalize = (name) => name.trim().replace(/\s+/g, " ");
    close.addEventListener("click", () => { if (!saving) onClose(true); });
    for (const control of switches) {
      control.addEventListener("click", () => {
        if (saving) return;
        queries[kind] = search.value;
        kind = control.dataset.kind;
        search.value = queries[kind];
        search.setAttribute("aria-label", kind === "tag" ? "Find a tag" : "Find a collection");
        search.placeholder = kind === "tag" ? "Find or create a tag…" : "Find or create a collection…";
        list.setAttribute("aria-label", kind === "tag" ? "Tags" : "Collections");
        for (const tab of switches) tab.setAttribute("aria-pressed", String(tab === control));
        render();
        if (options) search.focus();
      });
    }
    search.addEventListener("input", render);
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }
      if (saving || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key) || event.isComposing) return;
      const choices = [...list.querySelectorAll("button:not(:disabled)")];
      if (event.target === search) {
        event.preventDefault();
        const target = event.key === "ArrowUp" ? choices.at(-1) : choices[0];
        if (event.key === "Enter") target?.click();
        else target?.focus();
      } else if (event.key !== "Enter" && choices.includes(event.target)) {
        event.preventDefault();
        const index = choices.indexOf(event.target) + (event.key === "ArrowDown" ? 1 : -1);
        if (index < 0) search.focus();
        else choices[index % choices.length]?.focus();
      }
    });
    const outside = (event) => {
      if (!saving && !event.composedPath().includes(host)) onClose(false);
    };
    document.addEventListener("pointerdown", outside);

    function choice(label, selected, action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-collection";
      button.disabled = saving;
      if (selected !== undefined) button.setAttribute("aria-pressed", String(selected));
      const name = document.createElement("span");
      name.className = "toast-collection-name";
      name.textContent = label;
      if (selected === undefined) {
        button.classList.add("toast-create");
        const plus = document.createElement("span");
        plus.className = "toast-create-icon";
        plus.setAttribute("aria-hidden", "true");
        plus.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
        button.append(plus, name);
      } else {
        const check = document.createElement("span");
        check.className = "toast-collection-check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = selected ? "✓" : "";
        button.append(name, check);
      }
      button.addEventListener("click", () => void action());
      return button;
    }

    function render() {
      if (!options) return;
      const name = normalize(search.value);
      const query = name.toLowerCase();
      const isTag = kind === "tag";
      const entries = isTag ? options.tags : [{ id: null, name: "Unsorted" }, ...options.collections];
      const selected = (id) => isTag ? options.tagIds.includes(id) : id === (options.collectionIds[0] ?? null);
      const choices = entries.filter((entry) => entry.name.toLowerCase().includes(query))
        .sort((left, right) => Number(selected(right.id)) - Number(selected(left.id)));
      list.replaceChildren();
      for (const entry of choices) {
        list.append(choice(entry.name, selected(entry.id), () => save(entry, false)));
      }
      if (name && !entries.some((entry) => entry.name.toLowerCase() === query)) {
        list.append(choice(`Create “${name}”`, undefined, () => save({ name }, true)));
      }
      status.setAttribute("role", "status");
      status.textContent = list.children.length ? "" : isTag ? "Type a name to create your first tag." : "No collections found";
    }

    function setDisabled(value) {
      search.disabled = value;
      close.disabled = value;
      for (const control of [...switches, ...list.children]) control.disabled = value;
    }

    async function save(entry, creating) {
      if (saving) return;
      saving = true;
      setDisabled(true);
      status.setAttribute("role", "status");
      status.textContent = creating ? "Creating…" : kind === "tag" ? "Updating tags…" : "Moving…";
      let focusName;
      try {
        if (kind === "tag") {
          const result = await request("tag", {
            ...(creating ? { tagName: entry.name } : { tagId: entry.id }),
            assigned: creating || !options.tagIds.includes(entry.id),
            expectedTagIds: options.tagIds,
          });
          if (disposed) return;
          options.tagIds = result.tagIds;
          if (!options.tags.some((tag) => tag.id === result.tag.id)) options.tags.push(result.tag);
          render();
          focusName = result.tag.name;
          onTagged(result);
        } else {
          const result = await request("move", {
            collectionId: creating ? null : entry.id,
            ...(creating ? { collectionName: entry.name } : {}),
            expectedCollectionIds: options.collectionIds,
          });
          if (!disposed) onMoved(result);
        }
      } catch (error) {
        if (disposed) return;
        status.setAttribute("role", "alert");
        status.textContent = error.message || "Could not organize this item. Try again.";
      } finally {
        saving = false;
        if (!disposed) {
          setDisabled(false);
          if (focusName) [...list.children].find((button) => button.firstChild.textContent === focusName)?.focus();
        }
      }
    }

    async function loadOptions() {
      if (loading || disposed) return;
      loading = true;
      search.disabled = true;
      retry.hidden = true;
      retry.disabled = true;
      status.setAttribute("role", "status");
      status.textContent = "Loading collections and tags…";
      try {
        const result = await request("collections");
        if (disposed) return;
        options = result;
        search.disabled = false;
        render();
        search.focus();
      } catch (error) {
        if (disposed) return;
        status.setAttribute("role", "alert");
        status.textContent = error.message || "Could not load collections and tags. Try again.";
        retry.hidden = false;
        retry.disabled = false;
      } finally {
        loading = false;
      }
    }
    retry.addEventListener("click", () => void loadOptions());
    void loadOptions();
    return {
      element: panel,
      focus: () => search.focus(),
      destroy: () => {
        disposed = true;
        document.removeEventListener("pointerdown", outside);
        panel.remove();
      },
    };
  };
}
