import { describe, expect, test } from "vitest";
import type { ArticleNode } from "./article";
import { articleToMarkdown, embedMarkdown, embedPlainText } from "./article-markdown";

const el = (tag: string, children: ArticleNode[] = [], extra: Record<string, unknown> = {}) => ({ tag, children, ...extra }) as ArticleNode;
const t = (text: string): ArticleNode => ({ text });
const render = (content: ArticleNode[], resolve = () => null as string | null) => articleToMarkdown({ content, text: "" }, resolve);

describe("articleToMarkdown", () => {
  test("renders blocks with headings demoted below the card's own sections", () => {
    expect(render([
      el("h1", [t("Title")]),
      el("p", [t("Some "), el("strong", [t("bold")]), t(" and "), el("em", [t("soft")]), t(" text.")]),
      el("h2", [t("Part")]),
      el("hr"),
    ])).toBe("### Title\n\nSome **bold** and *soft* text.\n\n#### Part\n\n***");
  });

  test("renders ordered, unordered and nested lists", () => {
    expect(render([
      el("ol", [el("li", [t("First")]), el("li", [t("Second"), el("ul", [el("li", [t("Inner")])])])], { start: 3 }),
    ])).toBe("3. First\n4. Second\n\n   - Inner");
  });

  test("keeps code exact and fences it safely", () => {
    expect(render([el("pre", [t("const a = `x`;\n```\nend")])])).toBe("````\nconst a = `x`;\n```\nend\n````");
    expect(render([el("p", [t("Use "), el("code", [t("a`b")]), t(".")])])).toBe("Use ``a`b``.");
  });

  test("renders links, quotes, tables and captions", () => {
    expect(render([el("p", [el("a", [t("docs")], { href: "https://example.com/a b" })])])).toBe("[docs](https://example.com/a%20b)");
    expect(render([el("blockquote", [el("p", [t("One")]), el("p", [t("Two")])])])).toBe("> One\n>\n> Two");
    expect(render([el("table", [
      el("thead", [el("tr", [el("th", [t("Name")]), el("th", [t("Size")])])]),
      el("tbody", [el("tr", [el("td", [t("A|B")]), el("td", [t("2")])])]),
    ])])).toBe("| Name | Size |\n| --- | --- |\n| A\\|B | 2 |");
  });

  test("resolves images to pack files, remote URLs, or a placeholder", () => {
    const figure = [el("figure", [el("img", [], { assetId: "a1", src: "https://cdn.example/x.png", alt: "Hero" }), el("figcaption", [t("Caption")])])];
    expect(render(figure, () => "../files/001-x-article-image-1.webp")).toBe("![Hero](../files/001-x-article-image-1.webp)\n\n*Caption*");
    expect(render(figure)).toBe("[Image not included: Hero]\n\n*Caption*");
  });

  test("escapes text that would read as markup or emphasis", () => {
    expect(render([el("p", [t("Run <script>alert(1)</script> *now* [x]")])])).toBe("Run \\<script>alert(1)\\</script> \\*now\\* \\[x\\]");
  });

  test("falls back to plain text paragraphs when no structured content was saved", () => {
    expect(articleToMarkdown({ text: "# Not a heading\n\nSecond paragraph" }, () => null)).toBe("\\# Not a heading\n\nSecond paragraph");
  });
});

describe("embedMarkdown", () => {
  test("demotes headings, defuses front matter fences and setext underlines, and escapes tags", () => {
    expect(embedMarkdown("# Mine\n## Source\n---\nTitle\n===\n<div>x</div>")).toBe("### Mine\n#### Source\n***\nTitle\n\\===\n\\<div>x\\</div>");
  });

  test("leaves fenced code untouched", () => {
    expect(embedMarkdown("```\n# comment\n---\n```\n# Heading")).toBe("```\n# comment\n---\n```\n### Heading");
  });

  test("caps headings at level six", () => {
    expect(embedMarkdown("##### Deep")).toBe("###### Deep");
  });
});

describe("embedPlainText", () => {
  test("keeps line breaks but stops plain text from becoming Markdown structure", () => {
    expect(embedPlainText("# tag\n- dash\n1. one\n> quote\n---\nplain")).toBe("\\# tag\n\\- dash\n\\1. one\n\\> quote\n\\---\nplain");
  });
});
