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

    function icon(name) {
      const paths = {
        collection: '<path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7"/>',
        tag: '<circle cx="17.5" cy="6.5" r="1.5"/><path d="M2.77423 11.1439C1.77108 12.2643 1.7495 13.9546 2.67016 15.1437C4.49711 17.5033 6.49674 19.5029 8.85633 21.3298C10.0454 22.2505 11.7357 22.2289 12.8561 21.2258C15.8979 18.5022 18.6835 15.6559 21.3719 12.5279C21.6377 12.2187 21.8039 11.8397 21.8412 11.4336C22.0062 9.63798 22.3452 4.46467 20.9403 3.05974C19.5353 1.65481 14.362 1.99377 12.5664 2.15876C12.1603 2.19608 11.7813 2.36233 11.472 2.62811C8.34412 5.31646 5.49781 8.10211 2.77423 11.1439Z"/><path d="M7 14L10 17"/>',
        add: '<path d="M12.001 5V19.002M19.002 12.002H5"/>',
        check: '<path d="M5 14L8.5 17.5L19 6.5"/>',
      };
      const node = element("span", "org-icon");
      node.setAttribute("aria-hidden", "true");
      node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
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
      const createHint = element("p", "org-status");
      createHint.hidden = true;
      root.append(head, searchWrap, selected, choices, noMatches, createHint);
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
      const node = button("", "choice", onClick);
      if (selected) node.append(icon("check"));
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
      limitToTwoRows(tags.choices);
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
        browser?.close();
      },
    };
  };
}
