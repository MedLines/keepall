import { describe, expect, it } from "vitest";
import { planChanges, type LibraryState } from "./agent-changes";
import { describeAgentFile, fileGroups, pendingFileId, type AgentFile } from "./agent-files";
import { AGENT_FILE_TYPES, agentFileProblem, extensionForMime } from "./agent-file-limits";

const empty: LibraryState = { items: [], collections: [], tags: [] };
const file = (fileId: string, name: string, kind: AgentFile["kind"], extra: Partial<AgentFile> = {}): AgentFile => ({ fileId, name, mimeType: "image/png", kind, size: 10, ...extra });

describe("describeAgentFile", () => {
  it("accepts what Add files accepts and says what each file becomes", () => {
    expect(describeAgentFile({ name: "photo.PNG", size: 5 })).toMatchObject({ kind: "image", mimeType: "image/png" });
    expect(describeAgentFile({ name: "clip.webm", size: 5 })).toMatchObject({ kind: "video", mimeType: "video/webm" });
    expect(describeAgentFile({ name: "plan.md", size: 5 })).toMatchObject({ kind: "document", format: "markdown" });
    expect(describeAgentFile({ name: "paper.pdf", size: 5 })).toMatchObject({ kind: "document", format: "pdf" });
    expect(describeAgentFile({ name: "folder/notes.txt", size: 5 }).name).toBe("folder_notes.txt");
  });

  it("explains unsupported, empty, and oversized files", () => {
    expect(() => describeAgentFile({ name: "page.html", size: 5 })).toThrow("save_link");
    expect(() => describeAgentFile({ name: "big.png", size: 21 * 1024 * 1024 })).toThrow("up to 20 MB");
    expect(() => describeAgentFile({ name: "huge.pdf", size: 51 * 1024 * 1024 })).toThrow("50 MiB");
    expect(() => describeAgentFile({ name: "empty.png", size: 0 })).toThrow("empty");
  });
});

describe("file items", () => {
  it("makes one item per file, or one gallery of images", () => {
    const images = [file("a", "a.png", "image"), file("b", "b.png", "image")];
    expect(fileGroups(images, false)).toHaveLength(2);
    expect(fileGroups(images, true)).toEqual([images]);
    expect(() => fileGroups([...images, file("c", "c.md", "document", { format: "markdown" })], true)).toThrow("Only images");
  });

  it("plans waiting files as items with pending assets, organized like other saves", () => {
    const plan = planChanges(empty, [{ id: "r", request: {
      kind: "save_file", files: [file("f1", "plan.md", "document", { format: "markdown", mimeType: "text/markdown" }), file("f2", "shot.png", "image")],
      gallery: false, itemIds: ["i1", "i2"], note: "- from the agent", collection: "Job search", tags: ["todo"],
    } }], { now: 5, newId: () => "new" });
    expect(plan.files.map((entry) => entry.item.id)).toEqual(["i1", "i2"]);
    expect(plan.files[0].item).toMatchObject({ type: "document", format: "markdown", title: "plan", assetId: "pending:f1", noteFormat: "markdown" });
    expect(plan.files[1].item).toMatchObject({ type: "image", assetIds: ["pending:f2"], captionFormat: "markdown" });
    expect(plan.files[0].item.collectionIds).toHaveLength(1);
    expect(plan.records.filter((record) => record.table !== "items").length).toBe(2);
    expect(plan.records.some((record) => record.table === "items")).toBe(false);
    expect(plan.steps[0]).toMatchObject({ status: "planned", itemIds: ["i1", "i2"] });
    expect(pendingFileId("pending:f1")).toBe("f1");
  });

  it("leaves out unticked items and saves nothing when all are unticked", () => {
    const request = { kind: "save_file" as const, files: [file("f1", "a.png", "image"), file("f2", "b.png", "image")], gallery: false, itemIds: ["i1", "i2"], tags: [] };
    const some = planChanges(empty, [{ id: "r", request }], { now: 5, newId: () => "x", excluded: new Set(["create:r:i1"]) });
    expect(some.files.map((entry) => entry.item.id)).toEqual(["i2"]);
    const none = planChanges(empty, [{ id: "r", request }], { now: 5, newId: () => "x", excluded: new Set(["create:r:i1", "create:r:i2"]) });
    expect(none.steps[0].status).toBe("excluded");
  });
});

describe("agent file limits", () => {
  it("agree with Add files' own classification and limits", () => {
    for (const [extension, type] of Object.entries(AGENT_FILE_TYPES)) {
      expect(describeAgentFile({ name: `file.${extension}`, size: type.maxBytes }).kind).toBe(type.kind);
      expect(() => describeAgentFile({ name: `file.${extension}`, size: type.maxBytes + 1 })).toThrow();
      expect(agentFileProblem(`file.${extension}`, type.maxBytes)).toBeNull();
      expect(agentFileProblem(`file.${extension}`, type.maxBytes + 1)).toContain("too large");
    }
    expect(agentFileProblem("page.html", 10)).toContain("save_link");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("text/x-markdown; charset=utf-8")).toBe("md");
  });
});
