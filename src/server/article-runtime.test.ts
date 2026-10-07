import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("the article parser loads when CommonJS cannot require ES modules", () => {
  const script = `
    const assert = require("node:assert/strict");
    const { JSDOM } = require("jsdom-reader");
    const { Readability } = require("@mozilla/readability");
    const paragraph = "A public article can be captured for offline reading. Its text and headings remain available without requesting the website again. ";
    const dom = new JSDOM("<html><title>Offline report</title><body><article><h1>Offline report</h1><p>" + paragraph.repeat(8) + "</p></article></body></html>", { url: "https://example.com/report" });
    try {
      const article = new Readability(dom.window.document).parse();
      assert.equal(article.title, "Offline report");
      assert.ok(article.textContent.includes(paragraph.trim()));
      process.stdout.write("captured");
    } finally { dom.window.close(); }
  `;
  const result = execFileSync(process.execPath, ["--no-experimental-require-module", "-e", script], {
    encoding: "utf8", timeout: 10_000,
  });
  expect(result).toBe("captured");
});
