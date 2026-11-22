import { beforeEach, describe, expect, test } from "vitest";
import {
  agentChangeStatus, applyAgentItemDecision, applyAgentProposal, listAgentChanges, listOpenProposals, previewAgentProposal, rejectAgentProposal,
  reopenAgentItem, submitAgentChange, undoAgentChange,
} from "./agent-changes";
import type { AgentPairing } from "./agent-pairings";
import { createCollection, listCollections } from "./collections";
import { deleteKeepallDatabase, getDb } from "./db";
import { createNote, getItem, listItems, updateNote } from "./items";
import { listTags } from "./tags";

const pairing = (access: AgentPairing["access"]): AgentPairing => ({ id: `pairing-${access}`, relayUrl: "http://localhost:8787", agentName: "Claude Code", pairKey: new Uint8Array(32), createdAt: 1, access });

async function notes(count: number) {
  const created = [];
  for (let index = 0; index < count; index += 1) created.push(await createNote({ title: `Note ${index}`, content: `Body ${index}` }));
  return created;
}

describe("agent changes", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("a read-only agent is refused with a way forward", async () => {
    await expect(submitAgentChange(pairing("read"), "r1", "save_note", { text: "x" })).rejects.toThrow("read-only access");
    await expect(submitAgentChange({ ...pairing("read"), access: undefined }, "r1", "save_note", { text: "x" })).rejects.toThrow("read-only");
  });

  test("small changes apply at once, keep a before-copy, and retries don't apply twice", async () => {
    const [note] = await notes(1);
    const first = await submitAgentChange(pairing("change"), "req-1", "tag_items", { item_id: note.id, tags: "ideas" });
    expect(first).toMatchObject({ status: "applied", steps: ['Tags on "Note 0": add "ideas"'] });
    const retry = await submitAgentChange(pairing("change"), "req-1", "tag_items", { item_id: note.id, tags: "ideas" });
    expect(retry).toEqual({ ...first, notes: [] });
    expect(await listTags()).toHaveLength(1);
    const [entry] = await listAgentChanges();
    expect(entry.records.find((record) => record.id === note.id)?.before).toMatchObject({ tagIds: [] });
  });

  test("suggestions collect into one proposal, and the chosen ones apply as one change", async () => {
    const items = await notes(3);
    const agent = pairing("suggest");
    const first = await submitAgentChange(agent, "s1", "move_to_collection", { item_ids: [items[0].id, items[1].id], collection: "Ideas" });
    const second = await submitAgentChange(agent, "s2", "add_note", { item_id: items[2].id, text: "Follow up" });
    expect(first).toMatchObject({ status: "waiting_for_review", pending: 1 });
    expect(second).toMatchObject({ status: "waiting_for_review", pending: 2, proposalId: (first as { proposalId: string }).proposalId });
    expect(await listCollections()).toEqual([]);

    const [proposal] = await listOpenProposals();
    const preview = await previewAgentProposal(proposal.id);
    const noteKey = preview!.steps[1].effects[0].key;
    expect(Object.keys(preview!.items).sort()).toEqual([items[0].id, items[1].id, items[2].id].sort());
    const result = await applyAgentProposal(proposal.id, [noteKey, `${items[1].id}#collection`]);
    expect(result).toMatchObject({ applied: ['Move "Note 0" to "Ideas" (new collection)'], skipped: [{ reason: "Not chosen" }], backup: { status: "off" } });
    expect((await getItem(items[1].id))?.collectionIds).toEqual([]);
    expect((await listCollections()).map((collection) => collection.name)).toEqual(["Ideas"]);
    expect((await getItem(items[2].id))?.type === "note" && (await getItem(items[2].id))).toMatchObject({ content: "Body 2" });
    expect(await listOpenProposals()).toEqual([]);

    const status = await agentChangeStatus(agent.id);
    expect(status.open).toBeUndefined();
    expect(status.decided[0].result?.changeId).toBe(result.changeId);
  });

  test("a suggestion skips items the user changed after it was made", async () => {
    const [note] = await notes(1);
    await submitAgentChange(pairing("suggest"), "s1", "move_to_trash", { item_id: note.id });
    await updateNote(note.id, { content: "Edited by me" });
    const [proposal] = await listOpenProposals();
    const result = await applyAgentProposal(proposal.id);
    expect(result.applied).toEqual([]);
    expect(result.skipped[0].reason).toContain("changed in Keepall after this was suggested");
    expect(await getItem(note.id)).not.toBeNull();
  });

  test("large changes from a 'change' agent still wait for review", async () => {
    const items = await notes(11);
    const result = await submitAgentChange(pairing("change"), "big", "tag_items", { item_ids: items.map((item) => item.id), tags: "batch" });
    expect(result.status).toBe("waiting_for_review");
  });

  test("undo restores the library and keeps the user's later edits", async () => {
    const items = await notes(2);
    await createCollection({ name: "Keep" });
    const applied = await submitAgentChange(pairing("change"), "u1", "move_to_collection", { item_ids: items.map((item) => item.id), collection: "Agent picks" });
    if (applied.status !== "applied") throw new Error("expected applied");
    await updateNote(items[1].id, { content: "Changed after" });
    await getDb().items.update(items[1].id, { collectionIds: [(await listCollections()).find((collection) => collection.name === "Keep")!.id] });

    const undo = await undoAgentChange(applied.changeId);
    expect(undo.kept).toEqual(['"Note 1" was changed again after the agent\'s edit, so it was left as it is']);
    expect((await getItem(items[0].id))?.collectionIds).toEqual([]);
    expect((await listCollections()).map((collection) => collection.name)).toEqual(["Keep"]);
    expect(await undoAgentChange(applied.changeId)).toEqual({ restored: 0, kept: undo.kept });
  });

  test("declining a proposal changes nothing", async () => {
    await submitAgentChange(pairing("suggest"), "d1", "save_note", { text: "Agent idea" });
    const [proposal] = await listOpenProposals();
    await rejectAgentProposal(proposal.id);
    expect(await listItems()).toEqual([]);
    expect((await agentChangeStatus("pairing-suggest")).decided[0].status).toBe("rejected");
  });
});

describe("one item at a time", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("an adjusted decision applies for one item, the rest stay open, and undo reopens it", async () => {
    const items = await notes(2);
    const agent = pairing("suggest");
    await submitAgentChange(agent, "s1", "move_to_collection", { item_ids: items.map((item) => item.id), collection: "Ideas" });
    await submitAgentChange(agent, "s2", "tag_items", { item_ids: items.map((item) => item.id), tags: "agent tag" });
    const [proposal] = await listOpenProposals();

    // The reviewer keeps the collection but swaps the agent's tag for their own.
    const first = await applyAgentItemDecision(proposal.id, items[0].id, { collection: "Ideas", tags: ["mine"], note: null, trash: false });
    expect(first.remaining).toBe(2);
    expect((await getItem(items[0].id))?.collectionIds).toHaveLength(1);
    expect((await listTags()).map((tag) => tag.name)).toEqual(["mine"]);
    const preview = await previewAgentProposal(proposal.id);
    expect(Object.keys(preview!.items)).toEqual([items[1].id]);

    await reopenAgentItem(proposal.id, items[0].id, first.changeId);
    expect((await getItem(items[0].id))?.collectionIds).toEqual([]);
    expect(Object.keys((await previewAgentProposal(proposal.id))!.items).sort()).toEqual(items.map((item) => item.id).sort());

    await applyAgentItemDecision(proposal.id, items[0].id, { collection: "Ideas", tags: [], note: null, trash: false });
    const last = await applyAgentItemDecision(proposal.id, items[1].id, { collection: null, tags: [], note: null, trash: false });
    expect(last.remaining).toBe(0);
    expect(await listOpenProposals()).toEqual([]);
  });
});

describe("suggestions and background updates", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("a fetched link preview doesn't invalidate a suggestion", async () => {
    const link = { id: "site", type: "link", title: "Studio", url: "https://studio.example/", noteContent: "", previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null, previewStatus: "idle", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
    await getDb().items.put(link as never);
    await submitAgentChange(pairing("suggest"), "s1", "move_to_collection", { item_id: "site", collection: "Sites" });
    await getDb().items.update("site", { previewTitle: "Studio home", previewStatus: "ready", updatedAt: 50 } as never);
    const [proposal] = await listOpenProposals();
    expect((await previewAgentProposal(proposal.id))!.steps[0]).toMatchObject({ status: "planned", notes: [] });
  });
});
