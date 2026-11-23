import {
  createdItemId, createdItemIds, DIRECT_CHANGE_LIMIT, effectKeys, itemFingerprint, parseChangeRequest, planChanges, planUndo, withCreatedItemId, type AgentWriteTool, type ChangeRequest, type LibraryState,
  type PlannedStep, type RecordChange, type SeenItems,
} from "@/domain/agent-changes";
import type { Item } from "@/domain/item";
import { decisionRequests, type ItemDecision } from "@/domain/agent-review";
import type { ChangePlan } from "@/domain/agent-changes";
import { nameIndex } from "@/domain/agent-tools";
import { AgentToolError } from "@/domain/agent-tools";
import { normalizeCollection } from "@/domain/collection";
import { normalizeItem } from "@/domain/item";
import { pairingAccess, type AgentPairing } from "./agent-pairings";
import { getBackupFolderSettings, saveFolderBackup, backupFailureMessage } from "./backup-settings";
import { getDb } from "./db";
import { deletePendingFiles, parseFileArgs, pendingBytes, requestFileIds, saveFileItems, storePendingFiles } from "./agent-files";

/** Same-origin contexts announce agent changes here: settings refreshes, and open libraries reload. */
export const AGENT_CHANGES_CHANNEL = "keepall-agent-changes";
const JOURNAL_LIMIT = 200;

export type AgentProposalRequest = {
  id: string; tool: AgentWriteTool | "save_file"; request: ChangeRequest; text: string; seen: SeenItems; addedAt: number;
  /** The agent's one-line reason, shown to the reviewer. */
  reason?: string;
};
export type AgentProposalResult = { applied: string[]; skipped: Array<{ text: string; reason: string }>; changeId?: string; backup: BackupOutcome; effects?: number };
export type AgentProposal = {
  id: string;
  pairingId: string;
  agentName: string;
  status: "open" | "applied" | "rejected";
  requests: AgentProposalRequest[];
  createdAt: number;
  updatedAt: number;
  decidedAt?: number;
  result?: AgentProposalResult;
  /** Items the reviewer already settled one at a time. Their suggestions no longer apply or show. */
  decidedItems?: string[];
};

/** One applied batch. `records` holds the before-copy of every row it touched, so it can always be reversed. */
export type AgentChangeEntry = {
  id: string;
  pairingId: string;
  agentName: string;
  requestId?: string;
  proposalId?: string;
  createdAt: number;
  steps: string[];
  records: RecordChange[];
  undoneAt?: number;
  undoKept?: string[];
};

export type BackupOutcome = { status: "saved" | "off" } | { status: "failed"; message: string };

export type SubmitResult =
  | { status: "applied"; changeId: string; steps: string[]; notes: string[]; itemId?: string; itemIds?: string[] }
  | { status: "waiting_for_review"; proposalId: string; step: string; notes: string[]; pending: number; itemId?: string; itemIds?: string[] }
  | { status: "nothing_to_do"; step: string; notes: string[] };

function announce(detail: Record<string, unknown>) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(AGENT_CHANGES_CHANNEL);
  channel.postMessage(detail);
  channel.close();
}

function agentTables() {
  const db = getDb();
  return [db.items, db.collections, db.tags, db.agentChanges, db.agentProposals, db.agentFiles];
}

/** A proposal's waiting files, deleted once the proposal is closed: applied, declined, or decided item by item. */
function proposalFileIds(proposal: AgentProposal) {
  return proposal.requests.flatMap((entry) => requestFileIds(entry.request));
}

/**
 * Saves planned file items after their plan's records are written, and adds what they created to the change.
 * Runs outside a transaction: saving a file hashes it and makes thumbnails, as Add files does.
 */
async function saveFilesInto(changeId: string | undefined, files: ChangePlan["files"], base: Omit<AgentChangeEntry, "id" | "records" | "steps">, steps: string[], bytesFor: (fileId: string) => Promise<Uint8Array | undefined>) {
  if (!files.length) return { changeId, failed: [] as Array<{ name: string; reason: string }> };
  const saved = await saveFileItems(files, bytesFor);
  if (!saved.records.length) return { changeId, failed: saved.failed };
  const db = getDb();
  const id = changeId ?? crypto.randomUUID();
  await db.transaction("rw", db.agentChanges, async () => {
    const existing = await db.agentChanges.get(id);
    if (existing) await db.agentChanges.put({ ...existing, records: [...existing.records, ...saved.records] });
    else await db.agentChanges.add({ ...base, id, steps, records: saved.records });
  });
  await pruneJournal();
  return { changeId: id, failed: saved.failed };
}

async function readState(): Promise<LibraryState> {
  const db = getDb();
  const [items, collections, tags] = await Promise.all([db.items.toArray(), db.collections.toArray(), db.tags.toArray()]);
  return { items: items.map((item) => normalizeItem(item)), collections: collections.map((collection) => normalizeCollection(collection)), tags };
}

async function writeRecords(records: readonly RecordChange[]) {
  const db = getDb();
  for (const record of records) {
    const table = record.table === "items" ? db.items : record.table === "collections" ? db.collections : db.tags;
    if (record.after) await (table as typeof db.items).put(record.after as never);
    else await table.delete(record.id);
  }
}

async function pruneJournal() {
  const db = getDb();
  const count = await db.agentChanges.count();
  if (count <= JOURNAL_LIMIT) return;
  const oldest = await db.agentChanges.orderBy("createdAt").limit(count - JOURNAL_LIMIT).primaryKeys();
  await db.agentChanges.bulkDelete(oldest);
}

function summarize(steps: readonly PlannedStep[]) {
  return {
    applied: steps.filter((step) => step.status === "planned").map((step) => step.text),
    notes: steps.flatMap((step) => step.notes),
  };
}

function targetIds(request: ChangeRequest): string[] {
  if ("itemIds" in request) return request.itemIds;
  if (request.kind === "note") return [request.itemId];
  return [];
}

/**
 * Takes one write from an agent. Under "change", a small change applies at once with its before-copy; anything
 * larger, or anything from a "suggest" agent, joins that agent's open proposal for review. Request IDs make retries safe.
 */
export async function submitAgentChange(pairing: AgentPairing, requestId: string, tool: AgentWriteTool, args: Record<string, unknown>, reason?: string): Promise<SubmitResult> {
  const access = pairingAccess(pairing);
  if (access === "read") {
    throw new AgentToolError("This agent has read-only access to Keepall. Ask the user to allow changes in Keepall: Settings, Agents, then try again.");
  }
  const request = withCreatedItemId(parseChangeRequest(tool, args), () => crypto.randomUUID());
  const db = getDb();
  const result = await db.transaction("rw", agentTables(), async (): Promise<SubmitResult> => {
    const previous = await db.agentChanges.where("requestId").equals(requestId).first();
    if (previous) return { status: "applied", changeId: previous.id, steps: previous.steps, notes: [] };
    const open = await db.agentProposals.where("pairingId").equals(pairing.id).filter((proposal) => proposal.status === "open").first();
    const queued = open?.requests.find((entry) => entry.id === requestId);
    if (open && queued) return { status: "waiting_for_review", proposalId: open.id, step: queued.text, notes: [], pending: open.requests.length };

    const state = await readState();
    const now = Date.now();
    const plan = planChanges(state, [{ id: requestId, request }], { now, newId: () => crypto.randomUUID() });
    const [step] = plan.steps;
    if (step.status !== "planned") return { status: "nothing_to_do", step: step.text, notes: step.notes };
    // A save that found the link already saved organizes that one instead; report the item it touches.
    const itemId = createdItemId(request) && plan.created.items.length ? createdItemId(request) : step.itemIds[0];
    const created = createdItemId(request) ? { itemId } : {};

    if (access === "change" && !open && plan.itemsAffected <= DIRECT_CHANGE_LIMIT) {
      await writeRecords(plan.records);
      const changeId = crypto.randomUUID();
      await db.agentChanges.add({ id: changeId, pairingId: pairing.id, agentName: pairing.agentName, requestId, createdAt: now, steps: [step.text], records: plan.records });
      await pruneJournal();
      return { status: "applied", changeId, steps: [step.text], notes: step.notes, ...created };
    }

    const items = new Map(state.items.map((item) => [item.id, item]));
    const seen = Object.fromEntries(targetIds(request).flatMap((id) => (items.has(id) ? [[id, itemFingerprint(items.get(id)!)]] : [])));
    const entry: AgentProposalRequest = { id: requestId, tool, request, text: step.text, seen, addedAt: now, ...(reason ? { reason } : {}) };
    const proposal: AgentProposal = open
      ? { ...open, requests: [...open.requests, entry], updatedAt: now }
      : { id: crypto.randomUUID(), pairingId: pairing.id, agentName: pairing.agentName, status: "open", requests: [entry], createdAt: now, updatedAt: now };
    await db.agentProposals.put(proposal);
    return { status: "waiting_for_review", proposalId: proposal.id, step: step.text, notes: step.notes, pending: proposal.requests.length, ...created };
  });
  announce({ type: result.status === "applied" ? "applied" : "proposal", pairingId: pairing.id });
  return result;
}

/** Writes a full backup to the connected folder first, when the user has set one up. The before-copies are kept either way. */
async function backUpFirst(): Promise<BackupOutcome> {
  const settings = await getBackupFolderSettings().catch(() => null);
  if (!settings?.enabled) return { status: "off" };
  try {
    await saveFolderBackup();
    return { status: "saved" };
  } catch (error) {
    return { status: "failed", message: backupFailureMessage(error) };
  }
}

/** Plans a proposal, leaving out every effect on items the reviewer already decided one at a time. */
function planOpenProposal(state: LibraryState, proposal: AgentProposal, options: { now: number; excluded?: readonly string[] }) {
  const inputs = proposal.requests.map(({ id, request, seen }) => ({ id, request, seen }));
  const newId = () => crypto.randomUUID();
  const decided = new Set(proposal.decidedItems ?? []);
  const keys = decided.size
    ? planChanges(state, inputs, { now: options.now, newId }).steps.flatMap((step) => step.effects).filter((effect) => "itemId" in effect && decided.has(effect.itemId)).map((effect) => effect.key)
    : [];
  return planChanges(state, inputs, { now: options.now, newId, excluded: new Set([...keys, ...(options.excluded ?? [])]) });
}

export type ProposalPreview = {
  proposal: AgentProposal;
  steps: Array<PlannedStep & { reason?: string }>;
  /** Every item the proposal touches as it is now, plus items it would create, keyed by ID. */
  items: Record<string, Item>;
  /** Collection and tag names by ID, including ones the proposal would create, so new items show their organization. */
  names: { collections: Record<string, string>; tags: Record<string, string> };
};

/**
 * Takes files from an agent. Like submitAgentChange: a small batch from a "change" agent saves now, anything else
 * waits for review with its bytes kept in this browser. Retries with the same request ID are safe.
 */
export async function submitAgentFiles(pairing: AgentPairing, requestId: string, args: Record<string, unknown>, reason?: string): Promise<SubmitResult> {
  const access = pairingAccess(pairing);
  if (access === "read") {
    throw new AgentToolError("This agent has read-only access to Keepall. Ask the user to allow changes in Keepall: Settings, Agents, then try again.");
  }
  const { request, payloads } = parseFileArgs(args, () => crypto.randomUUID());
  const db = getDb();
  const now = Date.now();
  type Outcome = { result: SubmitResult } | { plan: ChangePlan; step: ChangePlan["steps"][number] };
  const outcome = await db.transaction("rw", agentTables(), async (): Promise<Outcome> => {
    const previous = await db.agentChanges.where("requestId").equals(requestId).first();
    if (previous) return { result: { status: "applied", changeId: previous.id, steps: previous.steps, notes: [] } as SubmitResult };
    const open = await db.agentProposals.where("pairingId").equals(pairing.id).filter((proposal) => proposal.status === "open").first();
    const queued = open?.requests.find((entry) => entry.id === requestId);
    if (open && queued) return { result: { status: "waiting_for_review", proposalId: open.id, step: queued.text, notes: [], pending: open.requests.length } as SubmitResult };
    const plan = planChanges(await readState(), [{ id: requestId, request }], { now, newId: () => crypto.randomUUID() });
    const [step] = plan.steps;
    if (access === "change" && !open && plan.itemsAffected <= DIRECT_CHANGE_LIMIT) {
      // New collections and tags first, so the files save into them.
      await writeRecords(plan.records);
      return { plan, step };
    }
    await storePendingFiles(requestId, request, payloads);
    const entry: AgentProposalRequest = { id: requestId, tool: "save_file", request, text: step.text, seen: {}, addedAt: now, ...(reason ? { reason } : {}) };
    const proposal: AgentProposal = open
      ? { ...open, requests: [...open.requests, entry], updatedAt: now }
      : { id: crypto.randomUUID(), pairingId: pairing.id, agentName: pairing.agentName, status: "open", requests: [entry], createdAt: now, updatedAt: now };
    await db.agentProposals.put(proposal);
    return { result: { status: "waiting_for_review", proposalId: proposal.id, step: step.text, notes: step.notes, pending: proposal.requests.length, itemIds: request.itemIds } as SubmitResult };
  });
  if ("result" in outcome) {
    announce({ type: outcome.result.status === "applied" ? "applied" : "proposal", pairingId: pairing.id });
    return outcome.result;
  }
  const bytes = new Map(payloads.map((payload) => [payload.fileId, payload.bytes]));
  const base = { pairingId: pairing.id, agentName: pairing.agentName, requestId, createdAt: now };
  // The plan's new collections and tags were written already; record them with the files so Undo removes them too.
  const collectionsAndTags = outcome.plan.records.length ? await (async () => {
    const id = crypto.randomUUID();
    await db.agentChanges.add({ ...base, id, steps: [outcome.step.text], records: outcome.plan.records });
    return id;
  })() : undefined;
  const saved = await saveFilesInto(collectionsAndTags, outcome.plan.files, base, [outcome.step.text], async (fileId) => bytes.get(fileId));
  announce({ type: "applied", pairingId: pairing.id });
  if (!saved.changeId || (saved.failed.length === outcome.plan.files.length)) {
    throw new AgentToolError(`Couldn't save ${saved.failed.map((entry) => `${entry.name} (${entry.reason})`).join("; ")}.`);
  }
  return {
    status: "applied", changeId: saved.changeId, steps: [outcome.step.text], itemIds: request.itemIds,
    notes: saved.failed.map((entry) => `Couldn't save ${entry.name}: ${entry.reason}`),
  };
}

/** Plans a proposal against the library as it is now, without writing, so the reviewer sees exactly what applies. */
export async function previewAgentProposal(proposalId: string): Promise<ProposalPreview | null> {
  const db = getDb();
  return db.transaction("r", [db.items, db.collections, db.tags, db.agentProposals], async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal) return null;
    const state = await readState();
    const plan = planOpenProposal(state, proposal, { now: Date.now() });
    const current = new Map(state.items.map((item) => [item.id, item]));
    const items: Record<string, Item> = {};
    for (const step of plan.steps) {
      for (const effect of step.effects) {
        if (!("itemId" in effect)) continue;
        const created = plan.records.find((record) => record.table === "items" && record.id === effect.itemId && !record.before);
        const item = created?.after ?? current.get(effect.itemId);
        if (item) items[effect.itemId] = item as Item;
      }
    }
    for (const file of plan.files) items[file.item.id] = file.item;
    const reasons = new Map(proposal.requests.map((entry) => [entry.id, entry.reason]));
    const names = {
      collections: Object.fromEntries(state.collections.map((row) => [row.id, row.name])),
      tags: Object.fromEntries(state.tags.map((row) => [row.id, row.name])),
    };
    for (const record of plan.records) {
      if (record.table !== "items" && record.after) names[record.table][record.id] = record.after.name;
    }
    return { proposal, steps: plan.steps.map((step) => ({ ...step, reason: reasons.get(step.id) })), items, names };
  });
}

/** Applies a proposal as one change, re-planned against the library as it is now, leaving out unticked effects. */
export async function applyAgentProposal(proposalId: string, excludedKeys: readonly string[] = []): Promise<AgentProposalResult> {
  const backup = await backUpFirst();
  const db = getDb();
  const result = await db.transaction("rw", agentTables(), async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal || proposal.status !== "open") throw new Error("These suggestions were already reviewed.");
    const now = Date.now();
    const plan = planOpenProposal(await readState(), proposal, { now, excluded: excludedKeys });
    const { applied } = summarize(plan.steps);
    const skipped = plan.steps.filter((step) => step.status !== "planned" || step.notes.length).map((step) => ({
      text: step.text,
      reason: step.status === "excluded" ? "Not chosen" : step.notes.join("; ") || (step.status === "unchanged" ? "Already done" : "Skipped"),
    }));
    let changeId: string | undefined;
    if (plan.records.length) {
      changeId = crypto.randomUUID();
      await writeRecords(plan.records);
      await db.agentChanges.add({ id: changeId, pairingId: proposal.pairingId, agentName: proposal.agentName, proposalId, createdAt: now, steps: applied, records: plan.records });
      await pruneJournal();
    }
    const outcome: AgentProposalResult = { applied, skipped, changeId, backup, effects: plan.steps.reduce((total, step) => total + step.effects.length, 0) };
    await db.agentProposals.put({ ...proposal, status: "applied", decidedAt: now, updatedAt: now, result: outcome });
    return { outcome, plan, proposal, now };
  });
  // Files save after the rest is written, through Add files' functions, then join the same change.
  const { plan, proposal, now } = result;
  let outcome = result.outcome;
  if (plan.files.length) {
    const saved = await saveFilesInto(outcome.changeId, plan.files, { pairingId: proposal.pairingId, agentName: proposal.agentName, proposalId, createdAt: now }, outcome.applied, pendingBytes);
    outcome = { ...outcome, changeId: saved.changeId, skipped: [...outcome.skipped, ...saved.failed.map((entry) => ({ text: `Save ${entry.name}`, reason: entry.reason }))] };
    await db.agentProposals.update(proposalId, { result: outcome });
  }
  await deletePendingFiles(proposalFileIds(proposal));
  announce({ type: "applied", proposalId });
  return outcome;
}

/**
 * Applies the reviewer's decision for one item as its own change, with a before-copy like any agent change, and
 * marks the item decided. The proposal closes once nothing in it is left to decide.
 */
export async function applyAgentItemDecision(proposalId: string, itemId: string, decision: ItemDecision): Promise<{ changeId?: string; remaining: number }> {
  const db = getDb();
  const result = await db.transaction("rw", agentTables(), async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal || proposal.status !== "open") throw new Error("These suggestions were already reviewed.");
    const state = await readState();
    const item = state.items.find((entry) => entry.id === itemId && entry.deletedAt === undefined);
    const creating = item ? undefined : proposal.requests.find((entry) => createdItemIds(entry.request).includes(itemId));
    if (!item && !creating) throw new Error("This item is no longer in your library.");
    const now = Date.now();
    // A new item is saved with the reviewer's collection and tags; "Move to Trash" on it means don't save it.
    const requests = item ? decisionRequests(item, decision, nameIndex(state.tags, state.collections).tags)
      : decision.trash ? [] : [savingRequest(creating!.request, decision)];
    // A file request can make several items; this decision saves only this one.
    const others = creating?.request.kind === "save_file" ? creating.request.itemIds.filter((id) => id !== itemId) : [];
    const excluded = new Set(others.map((id) => effectKeys.create(`${itemId}:0`, id)));
    const plan = planChanges(state, requests.map((request, index) => ({ id: `${itemId}:${index}`, request })), { now, newId: () => crypto.randomUUID(), excluded });
    let changeId: string | undefined;
    if (plan.records.length) {
      changeId = crypto.randomUUID();
      await writeRecords(plan.records);
      await db.agentChanges.add({ id: changeId, pairingId: proposal.pairingId, agentName: proposal.agentName, proposalId, createdAt: now, steps: summarize(plan.steps).applied, records: plan.records });
      await pruneJournal();
    }
    const decided = { ...proposal, decidedItems: [...new Set([...(proposal.decidedItems ?? []), itemId])], updatedAt: now };
    const remaining = planOpenProposal(await readState(), decided, { now }).steps.reduce((total, step) => total + step.effects.length, 0);
    await db.agentProposals.put(remaining ? decided : {
      ...decided, status: "applied", decidedAt: now, result: { applied: [], skipped: [], backup: { status: "off" }, effects: 0 },
    });
    return { changeId, remaining, plan, proposal, now, steps: summarize(plan.steps).applied };
  });
  let { changeId } = result;
  if (result.plan.files.length) {
    const saved = await saveFilesInto(changeId, result.plan.files, { pairingId: result.proposal.pairingId, agentName: result.proposal.agentName, proposalId, createdAt: result.now }, result.steps, pendingBytes);
    if (saved.failed.length) throw new Error(`Couldn't save ${saved.failed.map((entry) => `${entry.name}: ${entry.reason}`).join("; ")}`);
    changeId = saved.changeId;
  }
  // Keep waiting files while the review is open, so Undo and saving again still work; forget them once it closes.
  if (!result.remaining) await deletePendingFiles(proposalFileIds(result.proposal));
  announce({ type: "applied", proposalId });
  return { changeId, remaining: result.remaining };
}

/** A saving request with the reviewer's organization in place of the agent's. */
function savingRequest(request: ChangeRequest, decision: ItemDecision): ChangeRequest {
  const organization = { collection: decision.collection ?? undefined, tags: decision.tags };
  if (request.kind === "save_note") return { ...request, ...organization, ...(decision.note !== null ? { text: decision.note } : {}) };
  if (request.kind === "save_link" || request.kind === "save_file") return { ...request, ...organization, ...(decision.note !== null ? { note: decision.note } : {}) };
  return request;
}

/** Undoes one item's decision and puts the item back up for review. */
export async function reopenAgentItem(proposalId: string, itemId: string, changeId?: string): Promise<{ kept: string[] }> {
  const undo = changeId ? await undoAgentChange(changeId) : { restored: 0, kept: [] };
  const db = getDb();
  await db.transaction("rw", db.agentProposals, db.items, async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal) return;
    // Undo restored the item, so the suggestions hold again; record what they now see.
    const row = await db.items.get(itemId);
    const fingerprint = row ? itemFingerprint(normalizeItem(row)) : undefined;
    const requests = proposal.requests.map((entry) => (fingerprint !== undefined && entry.seen[itemId] !== undefined ? { ...entry, seen: { ...entry.seen, [itemId]: fingerprint } } : entry));
    await db.agentProposals.put({ ...proposal, requests, status: "open", decidedAt: undefined, decidedItems: (proposal.decidedItems ?? []).filter((id) => id !== itemId), updatedAt: Date.now() });
  });
  announce({ type: "reopened", proposalId });
  return { kept: undo.kept };
}

export async function rejectAgentProposal(proposalId: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.agentProposals, db.agentFiles, async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal || proposal.status !== "open") return;
    const now = Date.now();
    await db.agentFiles.bulkDelete(proposalFileIds(proposal));
    await db.agentProposals.put({ ...proposal, status: "rejected", decidedAt: now, updatedAt: now, result: { applied: [], skipped: proposal.requests.map((entry) => ({ text: entry.text, reason: "Declined" })), backup: { status: "off" } } });
  });
  announce({ type: "rejected", proposalId });
}

/** Reverses one applied change using its before-copies. Rows edited since are left alone and reported. */
export async function undoAgentChange(changeId: string): Promise<{ restored: number; kept: string[] }> {
  const db = getDb();
  const result = await db.transaction("rw", agentTables(), async () => {
    const entry = await db.agentChanges.get(changeId);
    if (!entry) throw new AgentToolError(`No change has the ID ${changeId}. Call check_changes for recent change IDs.`);
    if (entry.undoneAt) return { restored: 0, kept: entry.undoKept ?? [] };
    const now = Date.now();
    const undo = planUndo(entry.records, await readState(), now);
    await writeRecords(undo.records);
    await db.agentChanges.put({ ...entry, undoneAt: now, undoKept: undo.kept });
    return { restored: undo.restored, kept: undo.kept };
  });
  announce({ type: "undone", changeId });
  return result;
}

export async function listOpenProposals(): Promise<AgentProposal[]> {
  return (await getDb().agentProposals.where("status").equals("open").toArray()).sort((left, right) => left.createdAt - right.createdAt);
}

export async function listAgentChanges(limit = 30): Promise<AgentChangeEntry[]> {
  return getDb().agentChanges.orderBy("createdAt").reverse().limit(limit).toArray();
}

/** What an agent should know about its own changes: what waits for review, what was decided, and what it can undo. */
export async function agentChangeStatus(pairingId: string) {
  const db = getDb();
  const [proposals, changes] = await Promise.all([
    db.agentProposals.where("pairingId").equals(pairingId).toArray(),
    db.agentChanges.where("pairingId").equals(pairingId).toArray(),
  ]);
  const open = proposals.find((proposal) => proposal.status === "open");
  const decided = proposals.filter((proposal) => proposal.status !== "open").sort((left, right) => (right.decidedAt ?? 0) - (left.decidedAt ?? 0)).slice(0, 3);
  const recent = changes.sort((left, right) => right.createdAt - left.createdAt).slice(0, 10);
  return { open, decided, recent };
}
