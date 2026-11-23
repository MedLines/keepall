// ==text== in Markdown notes, rendered as <mark class="note-highlight">. GitHub doesn't define it; Obsidian and
// many editors do, so notes written elsewhere keep their highlights. Code spans and code blocks are left alone.
type Node = { type: string; value?: string; children?: Node[]; data?: { hName?: string; hProperties?: Record<string, unknown> } };

// Not glued to a word on the outside (x==y stays as typed), and no space just inside the marks.
const HIGHLIGHT = /(?<![\p{L}\p{N}=])==(?=[^\s=])([^=\n]*?[^\s=])==(?![\p{L}\p{N}=])/gu;

function split(value: string): Node[] | null {
  const parts: Node[] = [];
  let last = 0;
  for (const match of value.matchAll(HIGHLIGHT)) {
    if (match.index > last) parts.push({ type: "text", value: value.slice(last, match.index) });
    parts.push({ type: "highlight", data: { hName: "mark", hProperties: { className: ["note-highlight"] } }, children: [{ type: "text", value: match[1] }] });
    last = match.index + match[0].length;
  }
  if (!parts.length) return null;
  if (last < value.length) parts.push({ type: "text", value: value.slice(last) });
  return parts;
}

function visit(node: Node) {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value?.includes("==")) return split(child.value) ?? [child];
    visit(child);
    return [child];
  });
}

/** Remark plugin for ==highlights==. */
export function remarkHighlight() {
  return (tree: Node) => visit(tree);
}
