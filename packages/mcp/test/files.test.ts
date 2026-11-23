// save_file reads the files an agent names before anything reaches the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { prepareToolArgs, resolvePath } from "../src/files.ts";

test("reads paths into named, typed files and keeps the other arguments", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "keepall-files-"));
  await writeFile(path.join(folder, "plan.md"), "# Plan");
  const args = await prepareToolArgs("save_file", { path: path.join(folder, "plan.md"), collection: "Ideas", reason: "why" });
  assert.deepEqual(args, { collection: "Ideas", reason: "why", files: [{ name: "plan.md", type: "text/markdown", data: Buffer.from("# Plan").toString("base64") }] });
  assert.deepEqual(await prepareToolArgs("save_note", { text: "x" }), { text: "x" });
});

test("explains missing files, folders, unsupported types, and calls without a file", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "keepall-files-"));
  await mkdir(path.join(folder, "inner"));
  await writeFile(path.join(folder, "page.html"), "<p>");
  await assert.rejects(prepareToolArgs("save_file", { path: path.join(folder, "nope.png") }), /There's no file at/);
  await assert.rejects(prepareToolArgs("save_file", { path: path.join(folder, "inner") }), /is a folder/);
  await assert.rejects(prepareToolArgs("save_file", { path: path.join(folder, "page.html") }), /save_link/);
  await assert.rejects(prepareToolArgs("save_file", {}), /Give path/);
});

test("resolves ~ and relative paths like a shell", () => {
  assert.equal(resolvePath("~/a.png"), path.join(homedir(), "a.png"));
  assert.equal(resolvePath("docs/a.md", "/work"), path.resolve("/work", "docs/a.md"));
  assert.equal(resolvePath("file:///tmp/a.pdf"), path.resolve("/tmp/a.pdf"));
});

test("downloads files from URLs, names them from the response, and refuses web pages", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/photo") response.writeHead(200, { "Content-Type": "image/png" }).end(Buffer.from([137, 80, 78, 71]));
    else response.writeHead(200, { "Content-Type": "text/html" }).end("<html></html>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as { port: number };
  try {
    const args = await prepareToolArgs("save_file", { url: `http://127.0.0.1:${port}/photo` });
    assert.deepEqual((args.files as Array<{ name: string; type: string }>).map(({ name, type }) => ({ name, type })), [{ name: "photo.png", type: "image/png" }]);
    await assert.rejects(prepareToolArgs("save_file", { url: `http://127.0.0.1:${port}/article` }), /web page/);
  } finally {
    server.close();
  }
});
