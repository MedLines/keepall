"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Item } from "@/domain/item";
import { findSearchExcerpt, matchesSearchQuery } from "@/domain/search";
import { ItemTypeBadge } from "../item-type-icon";
import { NoteContent } from "../note-content";
import { SearchHighlight, SearchResult } from "../search-highlight";
import { ArrowLeftIcon, CloseIcon, SearchIcon } from "../shell-icons";
import "./search-demo.css";

const base = { tagIds: [], collectionIds: [], createdAt: 0, updatedAt: 0 };
const samples: { item: Item; text: string }[] = [
  { item: { ...base, id: "demo-project", type: "note", title: "Website project", format: "markdown", content: "Collect layout references. Compare colors and type. Keep notes beside each reference." }, text: "" },
  { item: { ...base, id: "demo-layout", type: "document", format: "pdf", title: "Layout reference", sourceFileName: "layout-reference.pdf", assetId: "demo-layout", noteContent: "A reference for the website project." }, text: "Use a clear reading order. Give images space, and keep text inside the layout margins." },
  { item: { ...base, id: "demo-colors", type: "document", format: "text", title: "Colors to try", sourceFileName: "project-colors.txt", assetId: "demo-colors", noteContent: "Colors for the website project." }, text: "Warm paper, charcoal, and a quiet rose accent. Check text colors on the background where they appear." },
];

export function SearchDemo() {
  const id = useId();
  const [query, setQuery] = useState("project");
  const [opened, setOpened] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const results = samples.filter(({ item, text }) => matchesSearchQuery(item, query, [], text));
  const selected = samples.find(({ item }) => item.id === opened);

  return <section className="ka-search-demo" aria-label="Search a sample library">
    <div className="ka-search-demo-top"><span>Try a search</span><span>Sample library</span></div>
    <div className="ka-search-demo-field">
      <SearchIcon />
      <label className="sr-only" htmlFor={id}>Search the sample library</label>
      <input id={id} type="search" value={query} maxLength={120} placeholder="Search words inside your saves" onChange={event => { setQuery(event.target.value); setOpened(null); }} />
      {query && <button type="button" aria-label="Clear sample search" onClick={() => { setQuery(""); setOpened(null); }}><CloseIcon /></button>}
    </div>
    <div className="ka-search-demo-suggestions" aria-label="Example searches">{["layout", "colors", "notes"].map(term => <button type="button" key={term} aria-pressed={query === term} onClick={() => { setQuery(term); setOpened(null); }}>{term}</button>)}</div>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={opened ?? "results"} className="ka-search-demo-body" role="region" aria-label={selected ? "Sample item preview" : "Sample search results"} tabIndex={0} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .16 }}>
        {selected ? <div className="ka-search-demo-preview">
          <button type="button" className="ka-search-demo-back" onClick={() => setOpened(null)}><ArrowLeftIcon />Back to results</button>
          <h4>{selected.item.title}</h4>
          <NoteContent content={selected.item.type === "note" ? selected.item.content : selected.text} format={selected.item.type === "note" ? "markdown" : "plain"} allowLocalImages={false} />
        </div> : <>
          <p className="ka-search-demo-count" role="status">{results.length} {results.length === 1 ? "result" : "results"}</p>
          <ul className="ka-search-demo-results">{results.map(({ item, text }) => <li key={item.id}>
            <SearchResult item={item} query={query} excerpt={findSearchExcerpt(item, query, [], text)}>
              <button type="button" className="ka-search-demo-open" onClick={() => setOpened(item.id)} aria-label={`Preview ${item.title}`}><ItemTypeBadge item={item} variant="list" /><span><SearchHighlight text={item.title} query={query} /></span></button>
            </SearchResult>
          </li>)}</ul>
          {!results.length && <p className="ka-search-demo-empty">No matches. Try layout or colors.</p>}
        </>}
      </motion.div>
    </AnimatePresence>
  </section>;
}
