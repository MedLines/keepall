"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, ImagesIcon, SearchIcon } from "../shell-icons";
import "./agent-demo.css";

type Suggestion = { id: string; title: string; kind: string; src: string; alt: string };

const suggestions: Suggestion[] = [
  { id: "article", title: "A little room to think", kind: "Saved article", src: "/marketing/reading-corner.webp", alt: "Sunlight falling across a chair and books by the window" },
  { id: "notes", title: "Reading notes", kind: "Image", src: "/marketing/demos/reading-notes.svg", alt: "Handwritten reading notes" },
  { id: "pdf", title: "field-notes.pdf", kind: "PDF", src: "/marketing/demos/field-notes.svg", alt: "First page of a field notes PDF" },
];

/**
 * A sample agent session and the review it leads to. Nothing here touches the visitor's library: the conversation
 * is fixed, and the review only changes this component's state.
 */
export function AgentDemo() {
  const reducedMotion = useReducedMotion();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const accepted = suggestions.filter(({ id }) => !skipped.includes(id));
  const toggle = (id: string) => setSkipped(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const fade = { initial: reducedMotion ? false : { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: reducedMotion ? undefined : { opacity: 0 }, transition: { duration: reducedMotion ? 0 : .16 } } as const;

  return <section className="ka-agent-demo" aria-label="A sample agent session and its review" data-feature-demo="agent">
    <ol className="ka-agent-demo-log" aria-label="Sample conversation">
      <li className="ka-agent-demo-you"><span className="sr-only">You: </span>Find my calm reading references and gather them.</li>
      <li className="ka-agent-demo-tool"><SearchIcon /><span><code>search_items</code> calm reading</span><span className="ka-agent-demo-meta">3 results</span></li>
      <li className="ka-agent-demo-tool"><ImagesIcon /><span><code>view_images</code></span><span className="ka-agent-demo-meta">3 images</span></li>
      <li className="ka-agent-demo-agent"><span className="sr-only">Agent: </span>All three share warm light and quiet type. I suggested a new collection, <strong>Reading room</strong>. Review it in Keepall.</li>
    </ol>

    <div className="ka-agent-demo-review" role="region" aria-label="Sample review in Keepall">
      <div className="ka-agent-demo-review-top"><span>Agent review</span><span>Sample library</span></div>
      <AnimatePresence mode="wait" initial={false}>
        {applied ? <motion.div key="applied" className="ka-agent-demo-done" {...fade}>
          <div className="ka-agent-demo-collection">
            <span className="ka-agent-demo-stack">{accepted.map(item => <Image key={item.id} className="ka-agent-demo-thumb" src={item.src} width={96} height={96} alt="" unoptimized={item.src.endsWith(".svg")} />)}</span>
            <span className="ka-agent-demo-copy"><span className="ka-agent-demo-title">Reading room</span><span className="ka-agent-demo-change">New collection · {accepted.length} {accepted.length === 1 ? "item" : "items"}</span></span>
          </div>
          <p role="status"><CheckIcon />Applied. Keepall kept a copy of what changed.</p>
          <button type="button" className="ka-agent-demo-action" onClick={() => setApplied(false)}>Undo</button>
        </motion.div> : <motion.div key="review" {...fade}>
          <ul className="ka-agent-demo-items">{suggestions.map(item => {
            const isAccepted = !skipped.includes(item.id);
            return <li key={item.id} data-skipped={!isAccepted || undefined}>
              <Image className="ka-agent-demo-thumb" src={item.src} width={96} height={96} alt={item.alt} unoptimized={item.src.endsWith(".svg")} />
              <span className="ka-agent-demo-copy"><span className="ka-agent-demo-title">{item.title}</span><span className="ka-agent-demo-change">{isAccepted ? "Move to Reading room" : "Skipped"} · {item.kind}</span></span>
              <button type="button" className="ka-agent-demo-toggle" aria-pressed={isAccepted} aria-label={`${isAccepted ? "Skip" : "Accept"} ${item.title}`} onClick={() => toggle(item.id)}>{isAccepted ? "Skip" : "Accept"}</button>
            </li>;
          })}</ul>
          <button type="button" className="ka-agent-demo-action ka-agent-demo-apply" disabled={!accepted.length} onClick={() => setApplied(true)}>
            {accepted.length ? `Apply ${accepted.length} ${accepted.length === 1 ? "change" : "changes"}` : "Nothing to apply"}
          </button>
        </motion.div>}
      </AnimatePresence>
    </div>
  </section>;
}
