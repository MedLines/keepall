import {
  DIRECT_CHANGE_LIMIT, parseChangeRequest, planChanges, planUndo, type AgentWriteTool, type ChangeRequest, type LibraryState, type PlannedStep,
  type RecordChange,
} from "@/domain/agent-changes";
import { AgentToolError } from "@/domain/agent-tools";
import { normalizeCollection } from "@/domain/collection";
import { normalizeItem } from "@/domain/item";
import { pairingAccess, type AgentPairing } from "./agent-pairings";
import { getBackupFolderSettings, saveFolderBackup, backupFailureMessage } from "./backup-settings";
import { getDb } from "./db";

/** Same-origin contexts announce agent changes here: settings refreshes, and open libraries reload. */
export const AGENT_CHANGES_CHANNEL = "keepall-agent-changes";
const JOURNAL_LIMIT = 200;

export type AgentProposalRequest = { id: string; tool: AgentWriteTool; request: ChangeRequest; text: string; seen: Record<string, number>; addedAt: number };
export type AgentProposalResult = { applied: string[]; skipped: Array<{ text: string; reason: string }>; changeId?: string; backup: BackupOutcome };
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
  | { status: "applied"; changeId: string; steps: string[]; notes: string[] }
  | { status: "waiting_for_review"; proposalId: string; step: string; notes: string[]; pending: number }
  | { status: "nothing_to_do"; step: string; notes: string[] };

function announce(detail: Record<string, unknown>) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(AGENT_CHANGES_CHANNEL);
  channel.postMessage(detail);
  channel.close();
}

function agentTables() {
  const db = getDb();
  return [db.items, db.collections, db.tags, db.agentChanges, db.agentProposals];
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
export async function submitAgentChange(pairing: AgentPairing, requestId: string, tool: AgentWriteTool, args: Record<string, unknown>): Promise<SubmitResult> {
  const access = pairingAccess(pairing);
  if (access === "read") {
    throw new AgentToolError("This agent has read-only access to Keepall. Ask the user to allow changes in Keepall: Settings, Agents, then try again.");
  }
  const request = parseChangeRequest(tool, args);
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

    if (access === "change" && !open && plan.itemsAffected <= DIRECT_CHANGE_LIMIT) {
      await writeRecords(plan.records);
      const changeId = crypto.randomUUID();
      await db.agentChanges.add({ id: changeId, pairingId: pairing.id, agentName: pairing.agentName, requestId, createdAt: now, steps: [step.text], records: plan.records });
      await pruneJournal();
      return { status: "applied", changeId, steps: [step.text], notes: step.notes };
    }

    const items = new Map(state.items.map((item) => [item.id, item]));
    const seen = Object.fromEntries(targetIds(request).flatMap((id) => (items.has(id) ? [[id, items.get(id)!.updatedAt]] : [])));
    const entry: AgentProposalRequest = { id: requestId, tool, request, text: step.text, seen, addedAt: now };
    const proposal: AgentProposal = open
      ? { ...open, requests: [...open.requests, entry], updatedAt: now }
      : { id: crypto.randomUUID(), pairingId: pairing.id, agentName: pairing.agentName, status: "open", requests: [entry], createdAt: now, updatedAt: now };
    await db.agentProposals.put(proposal);
    return { status: "waiting_for_review", proposalId: proposal.id, step: step.text, notes: step.notes, pending: proposal.requests.length };
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

/** Applies the chosen suggestions as one change, re-planned against the library as it is now. */
export async function applyAgentProposal(proposalId: string, chosenIds: readonly string[]): Promise<AgentProposalResult> {
  const backup = await backUpFirst();
  const db = getDb();
  const result = await db.transaction("rw", agentTables(), async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal || proposal.status !== "open") throw new Error("These suggestions were already reviewed.");
    const chosen = new Set(chosenIds);
    const now = Date.now();
    const plan = planChanges(await readState(), proposal.requests.filter((entry) => chosen.has(entry.id)).map(({ id, request, seen }) => ({ id, request, seen })), {
      now, newId: () => crypto.randomUUID(),
    });
    const { applied } = summarize(plan.steps);
    const skipped = [
      ...proposal.requests.filter((entry) => !chosen.has(entry.id)).map((entry) => ({ text: entry.text, reason: "Not chosen" })),
      ...plan.steps.filter((step) => step.status !== "planned" || step.notes.length).map((step) => ({
        text: step.text, reason: step.notes.join("; ") || (step.status === "unchanged" ? "Already done" : "Skipped"),
      })),
    ];
    let changeId: string | undefined;
    if (plan.records.length) {
      changeId = crypto.randomUUID();
      await writeRecords(plan.records);
      await db.agentChanges.add({ id: changeId, pairingId: proposal.pairingId, agentName: proposal.agentName, proposalId, createdAt: now, steps: applied, records: plan.records });
      await pruneJournal();
    }
    const outcome: AgentProposalResult = { applied, skipped, changeId, backup };
    await db.agentProposals.put({ ...proposal, status: "applied", decidedAt: now, updatedAt: now, result: outcome });
    return outcome;
  });
  announce({ type: "applied", proposalId });
  return result;
}

export async function rejectAgentProposal(proposalId: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.agentProposals, async () => {
    const proposal = await db.agentProposals.get(proposalId);
    if (!proposal || proposal.status !== "open") return;
    const now = Date.now();
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
