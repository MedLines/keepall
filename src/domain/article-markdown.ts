import type { ArticleElement, ArticleNode, SavedArticle } from "./article";

/**
 * Markdown that sits inside a Context Pack card. Card structure uses `#` and `##`,
 * so embedded headings start at `###`, and nothing embedded may look like front
 * matter or raw HTML.
 */
export const EMBEDDED_HEADING_OFFSET = 2;

export type ArticleImageResolver = (image: { assetId?: string; src?: string; alt: string }) => string | null;

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

function demoteHeading(line: string, offset: number): string {
  return line.replace(/^(\s{0,3})(#{1,6})(?=\s|$)/, (_match, indent: string, hashes: string) =>
    `${indent}${"#".repeat(Math.min(6, hashes.length + offset))}`);
}

/** Neutralizes tag-like `<…` so an agent never reads raw markup as structure. */
function escapeTags(text: string): string {
  return text.replace(/<(?=[A-Za-z/!?])/g, "\\<");
}

/**
 * Makes user or third-party Markdown safe to embed under a card section:
 * headings shift down, front matter fences and setext underlines are defused,
 * and tag-like text is escaped. Fenced code blocks are left untouched.
 */
export function embedMarkdown(markdown: string, offset = EMBEDDED_HEADING_OFFSET): string {
  let fence: string | null = null;
  return markdown.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const opener = line.match(FENCE)?.[1];
    if (fence) {
      if (opener && opener[0] === fence[0] && opener.length >= fence.length) fence = null;
      return line;
    }
    if (opener) {
      fence = opener;
      return line;
    }
    if (/^\s{0,3}(-{3,}|={3,})\s*$/.test(line)) return line.trim()[0] === "-" ? "***" : `\\${line.trim()}`;
    return escapeTags(demoteHeading(line, offset));
  }).join("\n").trim();
}

/** Plain text keeps its line breaks but cannot form Markdown structure. */
export function embedPlainText(text: string): string {
  return text.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const escaped = escapeTags(line).replace(/^(\s*)([#>]|[-*+](?=\s)|\d+[.)](?=\s)|-{3,}\s*$|={3,}\s*$)/, "$1\\$2");
    return escaped;
  }).join("\n").trim();
}

function inlineText(text: string): string {
  return escapeTags(text.replace(/\s+/g, " ")).replace(/([*_`[\]])/g, "\\$1");
}

function textContent(nodes: ArticleNode[]): string {
  return nodes.map((node) => "text" in node ? node.text : node.tag === "br" ? "\n" : textContent(node.children)).join("");
}

function codeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const ticks = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const padded = text.startsWith("`") || text.endsWith("`") ? ` ${text} ` : text;
  return `${ticks}${padded}${ticks}`;
}

function codeBlock(text: string): string {
  const runs = text.match(/`{3,}/g) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}\n${text.replace(/\n+$/, "")}\n${fence}`;
}

type Context = { resolve: ArticleImageResolver; offset: number };

function image(node: ArticleElement, context: Context): string {
  const alt = (node.alt ?? "").replace(/[[\]\n]/g, " ").trim();
  const target = context.resolve({ assetId: node.assetId, src: node.src, alt });
  if (!target) return alt ? `[Image not included: ${alt}]` : "[Image not included]";
  return `![${alt}](${target.replace(/[()\s]/g, encodeURIComponent)})`;
}

function inline(nodes: ArticleNode[], context: Context): string {
  return nodes.map((node) => {
    if ("text" in node) return inlineText(node.text);
    const inner = () => inline(node.children, context);
    switch (node.tag) {
      case "strong": return wrap("**", inner());
      case "em": return wrap("*", inner());
      case "s": return wrap("~~", inner());
      case "code": return codeSpan(textContent(node.children));
      case "br": return "  \n";
      case "a": {
        const text = inner().trim() || node.href || "";
        return node.href ? `[${text}](${node.href.replace(/[()\s]/g, encodeURIComponent)})` : text;
      }
      case "img": return image(node, context);
      default: return inner();
    }
  }).join("");
}

function wrap(marker: string, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const lead = text.slice(0, text.length - text.trimStart().length);
  const tail = text.slice(text.trimEnd().length);
  return `${lead}${marker}${trimmed}${marker}${tail}`;
}

function prefixLines(text: string, prefix: string, rest = prefix): string {
  return text.split("\n").map((line, index) => `${index === 0 ? prefix : rest}${line}`.replace(/\s+$/, "")).join("\n");
}

function list(node: ArticleElement, context: Context): string {
  let number = node.start ?? 1;
  return node.children.flatMap((child) => {
    if ("text" in child) return child.text.trim() ? [`- ${inlineText(child.text).trim()}`] : [];
    if (child.tag !== "li") return [blocks([child], context)].filter(Boolean);
    const marker = node.tag === "ol" ? `${number++}. ` : "- ";
    const body = blocks(child.children, context) || "";
    return [prefixLines(body, marker, " ".repeat(marker.length))];
  }).join("\n");
}

function table(node: ArticleElement, context: Context): string {
  const rows: string[][] = [];
  const collect = (nodes: ArticleNode[]) => {
    for (const child of nodes) {
      if ("text" in child) continue;
      if (child.tag === "tr") {
        rows.push(child.children.flatMap((cell) => "text" in cell || !["th", "td"].includes(cell.tag) ? [] :
          [inline(cell.children, context).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim()]));
      } else if (["thead", "tbody", "tfoot"].includes(child.tag)) collect(child.children);
    }
  };
  collect(node.children);
  const caption = node.children.find((child): child is ArticleElement => !("text" in child) && child.tag === "caption");
  if (!rows.length) return caption ? inline(caption.children, context).trim() : "";
  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]) => `| ${Array.from({ length: width }, (_, index) => row[index] ?? "").join(" | ")} |`;
  const body = [line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
  return caption ? `${inline(caption.children, context).trim()}\n\n${body}` : body;
}

function block(node: ArticleNode, context: Context): string {
  if ("text" in node) return inlineText(node.text).trim();
  switch (node.tag) {
    case "p": return inline(node.children, context).trim();
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
      const level = Math.min(6, Number(node.tag[1]) + context.offset);
      const text = inline(node.children, context).replace(/\s*\n\s*/g, " ").trim();
      return text ? `${"#".repeat(level)} ${text}` : "";
    }
    case "ul": case "ol": return list(node, context);
    case "blockquote": {
      const body = blocks(node.children, context);
      return body ? prefixLines(body, "> ") : "";
    }
    case "pre": return codeBlock(textContent(node.children));
    case "hr": return "***";
    case "table": return table(node, context);
    case "figcaption": {
      const text = inline(node.children, context).trim();
      return text ? `*${text}*` : "";
    }
    case "section": case "figure": case "li": case "thead": case "tbody": case "tfoot": case "tr":
      return blocks(node.children, context);
    case "img": return image(node, context);
    default: return inline([node], context).trim();
  }
}

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "hr", "section", "table", "figure", "figcaption", "thead", "tbody", "tfoot", "tr"]);

function blocks(nodes: ArticleNode[], context: Context): string {
  const out: string[] = [];
  let run: ArticleNode[] = [];
  const flush = () => {
    const text = inline(run, context).trim();
    if (text) out.push(text);
    run = [];
  };
  for (const node of nodes) {
    if (!("text" in node) && BLOCK_TAGS.has(node.tag)) {
      flush();
      const text = block(node, context);
      if (text) out.push(text);
    } else run.push(node);
  }
  flush();
  return out.join("\n\n");
}

/** Renders a saved article as Markdown for a Context Pack card. */
export function articleToMarkdown(
  article: Pick<SavedArticle, "content" | "text">,
  resolve: ArticleImageResolver,
  offset = EMBEDDED_HEADING_OFFSET,
): string {
  if (article.content?.length) {
    const markdown = blocks(article.content, { resolve, offset });
    if (markdown.trim()) return markdown;
  }
  return article.text.split(/\n{2,}/).map((paragraph) => embedPlainText(paragraph)).filter(Boolean).join("\n\n");
}
