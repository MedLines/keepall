// GitHub task items (`- [ ] item`) in Markdown notes. Each checkbox gets its item's text as an accessible name
// and the source offset where its list item starts, so a click can flip exactly that box in the note.
type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
  position?: { start: { offset?: number } };
};

const isElement = (node: Node | undefined, tagName: string) => node?.type === "element" && node.tagName === tagName;
const isCheckbox = (node: Node) => isElement(node, "input") && node.properties?.type === "checkbox";

// Text of the item itself, without the items of a nested list.
function itemText(node: Node): string {
  if (node.type === "text") return node.value ?? "";
  if (isElement(node, "ul") || isElement(node, "ol")) return "";
  return (node.children ?? []).map(itemText).join("");
}

function markTask(item: Node) {
  const children = item.children ?? [];
  // Tight lists put the checkbox straight in the item; loose lists put it in the first paragraph.
  const host = children.some(isCheckbox) ? item : children.find((child) => child.type === "element");
  if (!host || (host !== item && !isElement(host, "p"))) return;
  const siblings = host.children ?? [];
  const index = siblings.findIndex(isCheckbox);
  if (index < 0) return;
  const checkbox = siblings[index];
  checkbox.properties = {
    ...checkbox.properties,
    ariaLabel: itemText(item).replace(/\s+/g, " ").trim() || "Checklist item",
    dataTaskOffset: item.position?.start.offset,
  };
  // The checkbox sits in the list's indent; dropping the space after it starts the text on the indent's edge,
  // where wrapped lines start too.
  const next = siblings[index + 1];
  if (next?.type === "text" && next.value === " ") siblings.splice(index + 1, 1);
}

function visit(node: Node) {
  for (const child of node.children ?? []) {
    const className = child.properties?.className;
    if (isElement(child, "li") && Array.isArray(className) && className.includes("task-list-item")) markTask(child);
    visit(child);
  }
}

/** Rehype plugin that labels task-list checkboxes and records where each task's source starts. */
export function rehypeTaskList() {
  return (tree: Node) => visit(tree);
}
