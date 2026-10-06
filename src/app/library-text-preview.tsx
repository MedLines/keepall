import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findQueryTextMatches } from "@/domain/search";
import { SearchHighlight } from "./search-highlight";

type PreviewNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: PreviewNode[] };

function highlightPreview({ query }: { query: string }) {
  return (tree: PreviewNode) => {
    function visit(parent: PreviewNode) {
      if (!parent.children) return;
      parent.children = parent.children.flatMap(node => {
        if (node.type !== "text" || !node.value) { visit(node); return [node]; }
        const text = node.value;
        const matches = findQueryTextMatches(text, query);
        if (!matches.length) return [node];
        const parts: PreviewNode[] = [];
        let end = 0;
        for (const match of matches) {
          if (match.start > end) parts.push({ type: "text", value: text.slice(end, match.start) });
          parts.push({ type: "element", tagName: "mark", properties: { className: "search-highlight" }, children: [{ type: "text", value: text.slice(match.start, match.end) }] });
          end = match.end;
        }
        if (end < text.length) parts.push({ type: "text", value: text.slice(end) });
        return parts;
      });
    }
    visit(tree);
  };
}

/** A small reading sample. Card links own navigation; file content adds no controls or requests. */
export function LibraryTextPreview({ text, markdown = false, query = "" }: { text: string; markdown?: boolean; query?: string }) {
  const sample = text.slice(0, 1400);
  const frontmatter = markdown ? sample.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/) : null;
  return <div className="library-text-preview" aria-hidden="true">
    {frontmatter ? <p className="library-preview-frontmatter"><SearchHighlight text={frontmatter[1]} query={query} /></p> : null}
    {markdown ? <Markdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={query.trim() ? [[highlightPreview, { query }]] : []} urlTransform={() => ""}
      components={{
        a: ({ children }) => <span>{children}</span>,
        img: () => null,
        input: ({ checked }) => <span className="library-preview-check" data-checked={checked || undefined} />,
        h1: ({ children }) => <p className="library-preview-heading">{children}</p>,
        h2: ({ children }) => <p className="library-preview-heading">{children}</p>,
        h3: ({ children }) => <p className="library-preview-heading">{children}</p>,
        h4: ({ children }) => <p className="library-preview-heading">{children}</p>,
        h5: ({ children }) => <p className="library-preview-heading">{children}</p>,
        h6: ({ children }) => <p className="library-preview-heading">{children}</p>,
      }}>
      {frontmatter ? sample.slice(frontmatter[0].length) : sample}
    </Markdown> : <p className="whitespace-pre-wrap"><SearchHighlight text={sample} query={query} /></p>}
  </div>;
}
