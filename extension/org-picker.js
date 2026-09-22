if (!globalThis.__keepallCreateOrgPicker) {
  globalThis.__keepallCreateOrgPicker = function createOrgPicker(shadow) {
    const LIMIT = 6;
    const state = {
      loaded: false,
      disabled: false,
      collections: [],
      tags: [],
      collectionId: null,
      collectionName: null,
      tagIds: new Set(),
      tagNames: [],
    };
    let browser;
    let browserCloseTimer;

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function button(name, className, onClick) {
      const node = element("button", className, name);
      node.type = "button";
      node.disabled = state.disabled;
      node.addEventListener("click", onClick);
      return node;
    }

    const panel = element("div", "org-panel");
    const status = element("p", "org-status", "Loading collections and tags…");
    status.setAttribute("role", "status");

    function section(label, browseLabel, inputLabel) {
      const root = element("section", "org-section");
      const head = element("div", "org-head");
      const heading = element("label", "org-title", label);
      const input = element("input", "org-search");
      input.type = "text";
      input.autocomplete = "off";
      input.maxLength = 120;
      input.setAttribute("aria-label", inputLabel);
      heading.htmlFor = `${label.toLowerCase()}-capture-input`;
      input.id = heading.htmlFor;
      const browse = button(browseLabel, "browse-trigger", () => openBrowser(label, browse));
      browse.hidden = true;
      head.append(heading, browse);
      const selected = element("div", "selected-tags");
      const choices = element("div", "choices");
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-label", label === "Collection" ? "Collections" : "Existing tags");
      const noMatches = element("p", "org-status");
      noMatches.hidden = true;
      const createHint = element("p", "org-status");
      createHint.hidden = true;
      root.append(head, selected, choices, noMatches, input, createHint);
      root.hidden = true;
      return { root, browse, selected, choices, noMatches, createHint, input };
    }

    const collection = section("Collection", "Browse all collections", "Filter or new collection");
    const tags = section("Tags", "Browse all tags", "Filter or create tag");
    collection.selected.hidden = true;
    collection.input.placeholder = "Collection name";
    tags.input.placeholder = "Tag name";
    panel.append(collection.root, tags.root, status);

    function chip(name, selected, onClick) {
      const node = button(name, "choice", onClick);
      node.setAttribute("aria-pressed", String(selected));
      return node;
    }

    function compact(entries, query, selectedId) {
      const normalized = query.trim().toLowerCase();
      if (normalized) return entries.filter((entry) => entry.name.toLowerCase().includes(normalized)).slice(0, LIMIT);
      const selected = entries.find((entry) => entry.id === selectedId);
      return (selected ? [selected, ...entries.filter((entry) => entry.id !== selectedId)] : entries).slice(0, LIMIT);
    }

    function focusChoice(container, name) {
      [...container.querySelectorAll("button")].find((entry) => entry.textContent === name)?.focus();
    }

    function chooseCollection(entry) {
      state.collectionId = entry?.id ?? null;
      state.collectionName = entry?.name && !entry.id ? entry.name : null;
      collection.input.value = "";
      renderCollections();
    }

    function renderCollections() {
      const query = collection.input.value.trim();
      const visible = compact(state.collections, query, state.collectionId);
      const choices = [chip("Unsorted", !state.collectionId && !state.collectionName, () => {
        chooseCollection(null);
        focusChoice(collection.choices, "Unsorted");
      })];
      if (state.collectionName) {
        choices.push(chip(state.collectionName, true, () => focusChoice(collection.choices, state.collectionName)));
      }
      for (const entry of visible) {
        choices.push(chip(entry.name, state.collectionId === entry.id, () => {
          chooseCollection(entry);
          focusChoice(collection.choices, entry.name);
        }));
      }
      collection.choices.replaceChildren(...choices);
      const exact = state.collections.some((entry) => entry.name.toLowerCase() === query.toLowerCase());
      collection.noMatches.hidden = !query || state.collections.length === 0 || visible.length > 0;
      collection.noMatches.textContent = "No matching collections — Enter creates one.";
      collection.createHint.hidden = !query || exact;
      collection.createHint.textContent = `Enter to create “${query}”`;
    }

    function selectedTagName(id) {
      return state.tags.find((entry) => entry.id === id)?.name ?? "";
    }

    function removeTag(name, id, restoreFocus = false) {
      if (id) state.tagIds.delete(id);
      else state.tagNames = state.tagNames.filter((entry) => entry !== name);
      renderTags();
      if (restoreFocus) tags.input.focus();
    }

    function addTag(entry, restoreFocus = false) {
      if (entry.id) state.tagIds.add(entry.id);
      else if (!state.tagNames.includes(entry.name)) state.tagNames.push(entry.name);
      tags.input.value = "";
      renderTags();
      if (restoreFocus) tags.input.focus();
    }

    function renderTags() {
      const selected = [
        ...[...state.tagIds].map((id) => ({ id, name: selectedTagName(id) })).filter((entry) => entry.name),
        ...state.tagNames.map((name) => ({ id: null, name })),
      ];
      tags.selected.hidden = selected.length === 0;
      tags.selected.replaceChildren(...selected.map((entry) => {
        const wrapper = element("span", "selected-tag", entry.name);
        const remove = button("", "remove-tag", (event) => removeTag(entry.name, entry.id, event.detail === 0));
        remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
        remove.setAttribute("aria-label", `Remove tag ${entry.name}`);
        wrapper.append(remove);
        return wrapper;
      }));
      const query = tags.input.value.trim();
      const unused = state.tags.filter((entry) => !state.tagIds.has(entry.id));
      const visible = compact(unused, query);
      tags.choices.replaceChildren(...visible.map((entry) => chip(entry.name, false, (event) => addTag(entry, event.detail === 0))));
      const exact = state.tags.some((entry) => entry.name.toLowerCase() === query.toLowerCase());
      tags.noMatches.hidden = !query || state.tags.length === 0 || visible.length > 0;
      tags.noMatches.textContent = "No matching tags — Enter creates one.";
      tags.createHint.hidden = !query || exact;
      tags.createHint.textContent = `Enter to create “${query}”`;
    }

    function onEntry(event, kind) {
      if (event.key !== "Enter" || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      const query = event.currentTarget.value.trim().replace(/\s+/g, " ");
      if (!query || state.disabled) return;
      const entries = kind === "collection" ? state.collections : state.tags;
      const existing = entries.find((entry) => entry.name.toLowerCase() === query.toLowerCase());
      if (kind === "collection") chooseCollection(existing ?? { name: query });
      else addTag(existing ?? { name: query });
    }

    collection.input.addEventListener("input", renderCollections);
    tags.input.addEventListener("input", renderTags);
    collection.input.addEventListener("keydown", (event) => onEntry(event, "collection"));
    tags.input.addEventListener("keydown", (event) => onEntry(event, "tag"));

    function dismissBrowser() {
      if (!browser || browser.classList.contains("is-closing")) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        browser.close();
        return;
      }
      browser.classList.add("is-closing");
      browserCloseTimer = setTimeout(() => browser?.close(), 140);
    }

    function openBrowser(label, trigger) {
      if (state.disabled || browser) return;
      const isCollection = label === "Collection";
      const entries = isCollection
        ? state.collections
        : state.tags.filter((entry) => !state.tagIds.has(entry.id));
      browser = element("dialog", "browse");
      const header = element("header", "browse-header");
      const heading = element("div", "browse-heading");
      const title = element("h2", "", isCollection ? "Choose a collection" : "Choose a tag");
      const description = element("p", "", "Search the complete list.");
      heading.append(title, description);
      const close = button("×", "close", dismissBrowser);
      close.setAttribute("aria-label", "Close");
      header.append(heading, close);
      const searchWrap = element("div", "browse-search-wrap");
      const search = element("input", "browse-search");
      search.type = "search";
      search.setAttribute("aria-label", isCollection ? "Search collections" : "Search tags");
      searchWrap.append(search);
      const results = element("div", "browse-results");
      function renderResults() {
        const query = search.value.trim().toLowerCase();
        const filtered = entries.filter((entry) => entry.name.toLowerCase().includes(query));
        filtered.sort((left, right) => Number(right.name.toLowerCase().startsWith(query)) - Number(left.name.toLowerCase().startsWith(query)));
        if (filtered.length === 0) {
          results.replaceChildren(element("p", "browse-empty", "No matches."));
          return;
        }
        results.replaceChildren(...filtered.map((entry) => {
          const selected = isCollection && state.collectionId === entry.id;
          const row = button(entry.name, "browse-option", () => {
            if (isCollection) chooseCollection(entry);
            else addTag(entry);
            dismissBrowser();
          });
          row.setAttribute("aria-pressed", String(selected));
          if (selected) row.append(element("span", "browse-selected", "Selected"));
          return row;
        }));
      }
      search.addEventListener("input", renderResults);
      browser.append(header, searchWrap, results);
      browser.addEventListener("close", () => {
        clearTimeout(browserCloseTimer);
        browser.remove();
        browser = null;
        trigger.focus();
      }, { once: true });
      browser.addEventListener("cancel", (event) => {
        event.preventDefault();
        dismissBrowser();
      });
      shadow.append(browser);
      renderResults();
      browser.showModal();
      search.focus();
    }

    return {
      element: panel,
      get loaded() { return state.loaded; },
      selection() {
        if (!state.loaded) return {};
        return {
          collectionId: state.collectionId,
          ...(state.collectionName ? { collectionName: state.collectionName } : {}),
          tagIds: [...state.tagIds],
          tagNames: state.tagNames,
        };
      },
      setDisabled(disabled) {
        state.disabled = disabled;
        for (const control of panel.querySelectorAll("button, input")) control.disabled = disabled;
      },
      load(message) {
        if (message.type === "organization-error") {
          status.textContent = "Could not load collections and tags. You can still save without changing organization.";
          return;
        }
        state.loaded = true;
        state.collections = message.collections.filter((entry) => typeof entry?.id === "string" && typeof entry?.name === "string");
        state.tags = message.tags.filter((entry) => typeof entry?.id === "string" && typeof entry?.name === "string");
        state.collectionId = message.collectionId ?? null;
        state.tagIds = new Set(message.tagIds ?? []);
        collection.root.hidden = false;
        tags.root.hidden = false;
        collection.browse.hidden = state.collections.length <= LIMIT;
        tags.browse.hidden = state.tags.length <= LIMIT;
        collection.input.placeholder = state.collections.length ? "Filter or new collection…" : "Collection name";
        tags.input.placeholder = state.tags.length ? "Filter or create tag…" : "Tag name";
        status.textContent = "";
        status.hidden = true;
        renderCollections();
        renderTags();
      },
      destroy() {
        clearTimeout(browserCloseTimer);
        browser?.close();
      },
    };
  };
}
