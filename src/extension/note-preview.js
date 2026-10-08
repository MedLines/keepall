import React from "react";
import { createRoot } from "react-dom/client";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

const h = React.createElement;
const components = {
  a({ href, children }) {
    return href && /^(https?:|mailto:)/i.test(href)
      ? h("a", { href, target: "_blank", rel: "noopener noreferrer" }, children)
      : h("span", null, children);
  },
  img({ alt }) { return h("span", null, `Image: ${alt || "no description"}`); },
  input({ checked }) {
    return h("input", { type: "checkbox", checked, disabled: true, readOnly: true,
      "aria-label": checked ? "Completed checklist item" : "Incomplete checklist item" });
  },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map(level => [
    `h${level}`, ({ children }) => h(`h${Math.min(6, level + 2)}`, null, children),
  ])),
};

export function NotePreview({ content, format }) {
  return format === "markdown"
    ? h("div", { className: "note-markdown" }, h(Markdown, { remarkPlugins: [remarkGfm], urlTransform: defaultUrlTransform, components }, content))
    : h("p", { className: "note-plain" }, content);
}

globalThis.__keepallNotePreview = {
  mount(element, value) {
    const root = createRoot(element);
    const update = (next) => root.render(h(NotePreview, next));
    update(value);
    return { update, destroy: () => root.unmount() };
  },
};
