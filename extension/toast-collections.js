if (!globalThis.__keepallCreateToastCollections) {
  globalThis.__keepallCreateToastCollections = function ({ request, onClose, onMoved, host }) {
    const panel = document.createElement("section");
    panel.className = "toast-collections";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Move to collection");
    panel.innerHTML = `<div class="toast-collections-header"><span>Move to collection</span><button type="button" class="toast-close" aria-label="Close collections">×</button></div>
      <input class="toast-collections-search" type="search" placeholder="Find a collection…" aria-label="Find a collection" autocomplete="off" maxlength="120">
      <p class="toast-collections-status" role="status">Loading collections…</p>
      <div class="toast-collections-list" role="group" aria-label="Collections"></div>`;
    const search = panel.querySelector("input");
    const status = panel.querySelector("p");
    const list = panel.querySelector(".toast-collections-list");
    const close = panel.querySelector("button");
    let options;
    let saving = false;
    let disposed = false;
    close.addEventListener("click", () => { if (!saving) onClose(true); });
    search.addEventListener("input", render);
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }
      if (event.key === "ArrowDown" && event.target === search) {
        event.preventDefault();
        list.querySelector("button")?.focus();
      }
    });
    const outside = (event) => {
      if (!saving && !event.composedPath().includes(host)) onClose(false);
    };
    document.addEventListener("pointerdown", outside);

    function render() {
      if (!options) return;
      const query = search.value.trim().toLocaleLowerCase();
      const selected = options.collectionIds[0] ?? null;
      const choices = [{ id: null, name: "Unsorted" }, ...options.collections];
      const current = choices.findIndex(({ id }) => id === selected);
      if (current > 0) choices.unshift(...choices.splice(current, 1));
      list.replaceChildren();
      for (const collection of choices.filter(({ name }) => name.toLocaleLowerCase().includes(query))) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "toast-collection";
        button.disabled = saving;
        button.setAttribute("aria-pressed", String(collection.id === selected));
        const name = document.createElement("span");
        name.textContent = collection.name;
        const check = document.createElement("span");
        check.className = "toast-collection-check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = collection.id === selected ? "✓" : "";
        button.append(name, check);
        button.addEventListener("click", () => void move(collection));
        list.append(button);
      }
      status.textContent = list.children.length ? "" : "No collections found";
      status.hidden = Boolean(list.children.length);
    }

    async function move(collection) {
      if (saving) return;
      saving = true;
      search.disabled = true;
      close.disabled = true;
      for (const button of list.children) button.disabled = true;
      status.hidden = false;
      status.setAttribute("role", "status");
      status.textContent = "Moving…";
      try {
        const result = await request("move", { collectionId: collection.id, expectedCollectionIds: options.collectionIds });
        if (!disposed) onMoved(result);
      } catch (error) {
        if (disposed) return;
        status.setAttribute("role", "alert");
        status.textContent = error.message || "Could not move this item. Try again.";
      } finally {
        saving = false;
        search.disabled = false;
        close.disabled = false;
        for (const button of list.children) button.disabled = false;
      }
    }

    void request("collections").then((result) => {
      if (disposed) return;
      options = result;
      render();
    }).catch((error) => {
      if (disposed) return;
      status.setAttribute("role", "alert");
      status.textContent = error.message || "Could not load collections. Close and try again.";
    });
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
