import React from "react";
import { createRoot } from "react-dom/client";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkHighlight } from "../app/remark-highlight";
import { rehypeTaskList } from "../app/rehype-task-list";

const h = React.createElement;
const components = {
  a({ href, children }) {
    return href && /^(https?:|mailto:)/i.test(href)
      ? h("a", { href, target: "_blank", rel: "noopener noreferrer", className: "underline underline-offset-2" }, children)
      : h("span", null, children);
  },
  img({ alt }) { return h("span", { className: "text-text-secondary" }, `Image: ${alt || "no description"}`); },
  input({ checked, "aria-label": label }) {
    return h("input", { type: "checkbox", checked, disabled: true, readOnly: true, "aria-label": label || "Checklist item" });
  },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map(level => [
    `h${level}`, ({ children }) => h(`h${Math.min(6, level + 2)}`, null, children),
  ])),
};

export function NotePreview({ content, format }) {
  return format === "markdown"
    ? h("div", { className: "note-markdown min-w-0 break-words" }, h(Markdown, { remarkPlugins: [remarkGfm, remarkHighlight], rehypePlugins: [rehypeTaskList], urlTransform: defaultUrlTransform, components }, content))
    : h("p", { className: "note-plain whitespace-pre-wrap break-words text-base leading-relaxed" }, content);
}

globalThis.__keepallNotePreview = {
  mount(element, value) {
    const root = createRoot(element);
    const update = (next) => root.render(h(NotePreview, next));
    update(value);
    return { update, destroy: () => root.unmount() };
  },
};
