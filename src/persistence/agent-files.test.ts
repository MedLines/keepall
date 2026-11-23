import { beforeEach, describe, expect, test } from "vitest";
import { applyAgentItemDecision, applyAgentProposal, listAgentChanges, listOpenProposals, previewAgentProposal, rejectAgentProposal, submitAgentChange, submitAgentFiles, undoAgentChange } from "./agent-changes";
import type { AgentPairing } from "./agent-pairings";
import { getPendingFile } from "./agent-files";
import { listCollections } from "./collections";
import { deleteKeepallDatabase, getDb } from "./db";
import { getItem } from "./items";

const pairing = (access: AgentPairing["access"]): AgentPairing => ({ id: `pairing-${access}`, relayUrl: "http://localhost:8787", agentName: "Claude Code", pairKey: new Uint8Array(32), createdAt: 1, access });
const base64 = (text: string) => Buffer.from(text).toString("base64");
const markdown = { name: "job-search.md", type: "text/markdown", data: base64("# Job search\n\n- [ ] Send the form\n- ==Video interview== on Monday\n") };
const text = { name: "notes.txt", type: "text/plain", data: base64("Plain notes") };

describe("agent files", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("a suggesting agent's files wait in this browser, show in the review, and save as documents when applied", async () => {
    const result = await submitAgentFiles(pairing("suggest"), "f1", { files: [markdown, text], collection: "Job search", tags: ["todo"], note: "From the **agent**" });
    expect(result).toMatchObject({ status: "waiting_for_review", step: 'Save 2 files to "Job search" (new collection), tagged "todo"' });
    const itemIds = (result as { itemIds: string[] }).itemIds;
    expect(itemIds).toHaveLength(2);
    expect(await getItem(itemIds[0])).toBeFalsy();
    expect(await listCollections()).toEqual([]);

    const [proposal] = await listOpenProposals();
    const preview = (await previewAgentProposal(proposal.id))!;
    expect(preview.items[itemIds[0]]).toMatchObject({ type: "document", format: "markdown", title: "job-search", noteFormat: "markdown" });
    const fileId = (preview.items[itemIds[0]] as { assetId: string }).assetId.slice("pending:".length);
    expect((await getPendingFile(fileId))?.name).toBe("job-search.md");

    const applied = await applyAgentProposal(proposal.id);
    expect(applied.changeId).toBeDefined();
    const saved = await getItem(itemIds[0]);
    expect(saved).toMatchObject({ type: "document", format: "markdown", sourceFileName: "job-search.md", noteContent: "From the **agent**", noteFormat: "markdown" });
    expect(saved?.collectionIds).toHaveLength(1);
    expect(await getItem(itemIds[1])).toMatchObject({ type: "document", format: "text" });
    expect(await getPendingFile(fileId)).toBeUndefined();

    // Undo puts the saved files in Trash. Their new collection stays, since items in Trash still belong to it.
    const undone = await undoAgentChange(applied.changeId!);
    expect(undone.restored).toBe(2);
    expect((await getDb().items.get(itemIds[0]))?.deletedAt).toBeDefined();
    expect(undone.kept).toContain('Kept the new collection "Job search" because items are in it');
  });

  test("a changing agent's small batch saves at once, and a retry doesn't save twice", async () => {
    const first = await submitAgentFiles(pairing("change"), "f2", { files: [markdown] });
    expect(first).toMatchObject({ status: "applied" });
    const [id] = (first as { itemIds: string[] }).itemIds;
    expect(await getItem(id)).toMatchObject({ type: "document", title: "job-search" });
    const retry = await submitAgentFiles(pairing("change"), "f2", { files: [markdown] });
    expect(retry).toMatchObject({ status: "applied", changeId: (first as { changeId: string }).changeId });
    expect(await getDb().items.count()).toBe(1);
    expect((await listAgentChanges())[0].records.some((record) => record.id === id && record.before === null)).toBe(true);
  });

  test("declining forgets the files, and one file can be saved on its own with the reviewer's organization", async () => {
    const declined = await submitAgentFiles(pairing("suggest"), "f3", { files: [markdown] });
    const [proposal] = await listOpenProposals();
    const fileId = ((await previewAgentProposal(proposal.id))!.items[(declined as { itemIds: string[] }).itemIds[0]] as { assetId: string }).assetId.slice(8);
    await rejectAgentProposal(proposal.id);
    expect(await getPendingFile(fileId)).toBeUndefined();

    const waiting = await submitAgentFiles(pairing("suggest"), "f4", { files: [markdown, text] });
    const [, second] = (waiting as { itemIds: string[] }).itemIds;
    const [open] = await listOpenProposals();
    const decided = await applyAgentItemDecision(open.id, second, { collection: "Reading", tags: ["later"], note: null, trash: false });
    expect(decided.remaining).toBeGreaterThan(0);
    const saved = await getItem(second);
    expect(saved).toMatchObject({ type: "document", format: "text" });
    expect((await listCollections()).map((collection) => collection.name)).toEqual(["Reading"]);
    expect(await getItem((waiting as { itemIds: string[] }).itemIds[0])).toBeFalsy();
  });

  test("new notes keep the ID the agent was told, and can be reviewed and saved one at a time", async () => {
    const result = await submitAgentChange(pairing("suggest"), "n1", "save_note", { text: "# To do\n\n- Tests", title: "Job search to-do" });
    const itemId = (result as { itemId: string }).itemId;
    const [proposal] = await listOpenProposals();
    expect((await previewAgentProposal(proposal.id))!.items[itemId]).toMatchObject({ format: "markdown", title: "Job search to-do" });
    expect(Object.keys((await previewAgentProposal(proposal.id))!.items)).toEqual([itemId]);
    await applyAgentItemDecision(proposal.id, itemId, { collection: "Job search", tags: [], note: null, trash: false });
    expect(await getItem(itemId)).toMatchObject({ type: "note", format: "markdown", content: "# To do\n\n- Tests" });
    expect(await listOpenProposals()).toEqual([]);
  });

  test("files that aren't what they say are refused before anything is stored", async () => {
    await expect(submitAgentFiles(pairing("suggest"), "bad", { files: [{ name: "fake.pdf", type: "application/pdf", data: base64("not a pdf") }] })).rejects.toThrow("not a complete PDF");
    await expect(submitAgentFiles(pairing("suggest"), "bad2", { files: [{ name: "page.html", data: base64("<p>") }] })).rejects.toThrow("save_link");
    await expect(submitAgentFiles(pairing("read"), "bad3", { files: [markdown] })).rejects.toThrow("read-only");
    expect(await getDb().agentFiles.count()).toBe(0);
  });
});
