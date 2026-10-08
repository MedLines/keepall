if (!globalThis.__keepallCreateOrgPicker) {
  globalThis.__keepallCreateOrgPicker = function createOrgPicker(shadow, observeScrollEdges = () => () => {}) {
    const document = shadow.ownerDocument;
    const LIMIT = 6;
    const normalize = (name) => name.trim().replace(/\s+/g, " ");
    const matches = (name, query) => normalize(name).toLowerCase().includes(normalize(query).toLowerCase());
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
    let stopBrowserFades;

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = globalThis.__keepallDrawerUi?.className(className) ?? className;
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

    function icon(name) {
      const node = element("span", "org-icon");
      node.setAttribute("aria-hidden", "true");
      if (globalThis.__keepallDrawerUi) node.innerHTML = globalThis.__keepallDrawerUi.icon(name);
      return node;
    }

    const panel = element("div", "org-panel");
    const status = element("p", "org-status", "Loading collections and tags…");
    status.setAttribute("role", "status");

    function section(label, browseLabel, inputLabel) {
      const root = element("section", "org-section");
      const head = element("div", "org-head");
      const heading = element("label", "org-title");
      heading.append(icon(label === "Collection" ? "collection" : "tag"), element("span", "", label));
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
      const searchWrap = element("div", "org-search-wrap");
      searchWrap.append(icon("add"), input);
      const selected = element("div", "selected-tags");
      const choices = element("div", "choices");
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-label", label === "Collection" ? "Collections" : "Existing tags");
      const noMatches = element("p", "org-status");
      noMatches.hidden = true;
      const createButton = button("", "org-create", () => submitEntry(label === "Collection" ? "collection" : "tag"));
      createButton.hidden = true;
      root.append(head, searchWrap, selected, choices, noMatches, createButton);
      root.hidden = true;
      return { root, browse, selected, choices, noMatches, createButton, input };
    }

    const collection = section("Collection", "Browse all collections", "Filter or new collection");
    const tags = section("Tags", "Browse all tags", "Filter or create tag");
    collection.selected.hidden = true;
    collection.input.placeholder = "Collection name";
    tags.input.placeholder = "Tag name";
    panel.append(collection.root, tags.root, status);

    function chip(name, selected, onClick) {
      const node = button("", `choice ${selected ? "choice-selected" : "choice-idle"}`, onClick);
      if (selected && name !== "Unsorted") node.append(icon("check"));
      node.append(element("span", "choice-label", name));
      node.title = name;
      node.setAttribute("aria-pressed", String(selected));
      return node;
    }

    function limitToTwoRows(container) {
      let firstRow;
      let secondRow;
      let pastLimit = false;
      for (const choice of container.children) {
        choice.hidden = false;
        if (pastLimit) choice.hidden = true;
        else if (firstRow === undefined) firstRow = choice.offsetTop;
        else if (choice.offsetTop !== firstRow && secondRow === undefined) secondRow = choice.offsetTop;
        else if (secondRow !== undefined && choice.offsetTop !== firstRow && choice.offsetTop !== secondRow) {
          choice.hidden = true;
          pastLimit = true;
        }
      }
    }

    function compact(entries, query, selectedId) {
      const normalized = normalize(query).toLowerCase();
      if (normalized) return entries.filter((entry) => matches(entry.name, normalized)).slice(0, LIMIT);
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
      const query = normalize(collection.input.value);
      const visible = compact(state.collections, query, state.collectionId);
      const selected = state.collections.find((entry) => entry.id === state.collectionId);
      const choices = [];
      if (selected) {
        choices.push(chip(selected.name, true, () => focusChoice(collection.choices, selected.name)));
      } else if (state.collectionName) {
        choices.push(chip(state.collectionName, true, () => focusChoice(collection.choices, state.collectionName)));
      }
      choices.push(chip("Unsorted", !state.collectionId && !state.collectionName, () => {
        chooseCollection(null);
        focusChoice(collection.choices, "Unsorted");
      }));
      for (const entry of visible) {
        if (entry.id === selected?.id) continue;
        choices.push(chip(entry.name, state.collectionId === entry.id, () => {
          chooseCollection(entry);
          focusChoice(collection.choices, entry.name);
        }));
      }
      collection.choices.replaceChildren(...choices);
      limitToTwoRows(collection.choices);
      const matching = collectionEntries().some((entry) => matches(entry.name, query));
      collection.noMatches.hidden = !query || matching;
      collection.noMatches.textContent = "No matching collections.";
      collection.createButton.hidden = !query || matching;
      collection.createButton.replaceChildren(icon("add"), element("span", "", `Create collection “${query}”`));
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
        const wrapper = element("span", "selected-tag choice choice-selected pr-0.5");
        wrapper.title = entry.name;
        wrapper.append(icon("check"), element("span", "choice-label", entry.name));
        const remove = button("", "remove-tag", (event) => removeTag(entry.name, entry.id, event.detail === 0));
        remove.append(icon("close"));
        remove.setAttribute("aria-label", `Remove tag ${entry.name}`);
        wrapper.append(remove);
        return wrapper;
      }));
      const query = normalize(tags.input.value);
      const unused = state.tags.filter((entry) => !state.tagIds.has(entry.id));
      const visible = compact(unused, query);
      tags.choices.replaceChildren(...visible.map((entry) => chip(entry.name, false, (event) => addTag(entry, event.detail === 0))));
      limitToTwoRows(tags.choices);
      const matching = tagEntries().some((entry) => matches(entry.name, query));
      tags.noMatches.hidden = !query || matching;
      tags.noMatches.textContent = "No matching tags.";
      tags.createButton.hidden = !query || matching;
      tags.createButton.replaceChildren(icon("add"), element("span", "", `Create tag “${query}”`));
    }

    function collectionEntries() {
      return [{ id: null, name: "Unsorted" }, ...state.collections,
        ...(state.collectionName ? [{ name: state.collectionName }] : [])];
    }

    function tagEntries() {
      return [...state.tags, ...state.tagNames.map((name) => ({ name }))];
    }

    function submitEntry(kind) {
      const input = kind === "collection" ? collection.input : tags.input;
      const query = normalize(input.value);
      if (!query || state.disabled) return;
      const entries = kind === "collection" ? collectionEntries() : tagEntries();
      const existing = entries.find((entry) => normalize(entry.name).toLowerCase() === query.toLowerCase())
        ?? entries.find((entry) => matches(entry.name, query));
      if (kind === "collection") chooseCollection(existing?.id === null ? null : existing ?? { name: query });
      else addTag(existing ?? { name: query });
      input.focus();
    }

    function onEntry(event, kind) {
      if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.isComposing) return;
      event.preventDefault();
      submitEntry(kind);
    }

    collection.input.addEventListener("input", renderCollections);
    tags.input.addEventListener("input", renderTags);
    let observedWidth = 0;
    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (!state.loaded || width === observedWidth) return;
      observedWidth = width;
      renderCollections();
      renderTags();
    });
    resizeObserver.observe(panel);
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
      browser = element("dialog", "browse ui-native-dialog");
      const header = element("header", "browse-header");
      const heading = element("div", "browse-heading");
      const title = element("h2", "browse-title", isCollection ? "Choose a collection" : "Choose a tag");
      const description = element("p", "browse-description", "Search the complete list.");
      heading.append(title, description);
      const close = button("", "browse-close", dismissBrowser);
      close.append(icon("close"));
      close.setAttribute("aria-label", "Close");
      header.append(heading, close);
      const searchWrap = element("div", "browse-search-wrap");
      const search = element("input", "browse-search");
      search.type = "search";
      search.setAttribute("aria-label", isCollection ? "Search collections" : "Search tags");
      searchWrap.append(icon("search"), search);
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
          const row = button(entry.name, `browse-option ${selected ? "ui-selected" : ""}`, () => {
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
      search.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        dismissBrowser();
      });
      browser.append(header, searchWrap, results);
      browser.addEventListener("close", () => {
        clearTimeout(browserCloseTimer);
        stopBrowserFades?.();
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
      stopBrowserFades = observeScrollEdges(results);
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
          tagNames: [...state.tagNames],
        };
      },
      restore(selection) {
        state.collectionId = state.collections.some((entry) => entry.id === selection.collectionId) ? selection.collectionId : null;
        state.collectionName = selection.collectionName ?? null;
        state.tagIds = new Set(selection.tagIds.filter((id) => state.tags.some((entry) => entry.id === id)));
        state.tagNames = [...selection.tagNames];
        renderCollections();
        renderTags();
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
        collection.browse.hidden = state.collections.length === 0;
        tags.browse.hidden = state.tags.length === 0;
        collection.input.placeholder = state.collections.length ? "Find or create a collection…" : "Collection name";
        tags.input.placeholder = state.tags.length ? "Find or create a tag…" : "Tag name";
        status.textContent = "";
        status.hidden = true;
        renderCollections();
        renderTags();
      },
      destroy() {
        clearTimeout(browserCloseTimer);
        resizeObserver.disconnect();
        stopBrowserFades?.();
        browser?.close();
      },
    };
  };
}
