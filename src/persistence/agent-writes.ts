import { isAgentWriteTool, type AgentAccess } from "@/domain/agent-changes";
import { AgentToolError } from "@/domain/agent-tools";
import { agentChangeStatus, submitAgentChange, undoAgentChange, type SubmitResult } from "./agent-changes";
import { getAgentPairing, pairingAccess } from "./agent-pairings";
import { getDb } from "./db";

export type AgentCallContext = { appOrigin: string; pairingId: string; requestId: string };

/** The review page: every suggestion at a glance, and each item reviewable in place like Unsorted review. */
function reviewUrl(appOrigin: string) {
  return new URL("/review", appOrigin).href;
}

function reason(args: Record<string, unknown>) {
  if (typeof args.reason !== "string" || !args.reason.trim()) return undefined;
  return args.reason.trim().slice(0, 300);
}

const ACCESS_WORDS: Record<AgentAccess, string> = {
  read: "read only: you can search and read, but not change anything",
  suggest: "suggest: your changes wait for the user to review them in Keepall",
  change: "change: small changes apply right away and can be undone; changes to more than 10 items wait for review",
};

/** Every write result ends with one plain instruction, so an agent never has to guess the next step. */
function describe(result: SubmitResult, appOrigin: string) {
  const notes = result.notes.length ? { notes: result.notes } : {};
  switch (result.status) {
    case "applied":
      return {
        status: "done", change_id: result.changeId, changed: result.steps, ...notes,
        what_to_do_next: `Done. Tell the user what you changed. If it was a mistake, call undo_change with change_id "${result.changeId}". The user can also undo it in Keepall under Settings, Agents.`,
      };
    case "waiting_for_review": {
      const url = reviewUrl(appOrigin);
      return {
        status: "waiting_for_review", suggested: result.step, suggestions_waiting: result.pending, review_url: url, ...notes,
        what_to_do_next: `Nothing has changed yet. If you have more changes, keep calling the tools; they all join the same review. When you're finished, tell the user exactly this: "I've suggested ${result.pending === 1 ? "a change" : `${result.pending} changes`} to your Keepall library. Review them here: ${url}". After they say they've reviewed them, call check_changes.`,
      };
    }
    case "nothing_to_do":
      return {
        status: "nothing_to_do", request: result.step, ...notes,
        what_to_do_next: result.notes.length ? "Nothing changed. Read the notes, fix the item IDs or names (search_items gives current IDs), and try again." : "Nothing changed because the library already looks like that. Move on.",
      };
  }
}

async function requirePairing(pairingId: string) {
  const pairing = await getAgentPairing(pairingId);
  if (!pairing) throw new AgentToolError("This agent was disconnected in Keepall. Ask the user to pair it again.");
  return pairing;
}

async function checkChanges(context: AgentCallContext) {
  const pairing = await requirePairing(context.pairingId);
  const { open, decided, recent } = await agentChangeStatus(pairing.id);
  const access = pairingAccess(pairing);
  const url = reviewUrl(context.appOrigin);
  let next = "Nothing is waiting. Carry on.";
  if (open) next = `${open.requests.length} suggestion${open.requests.length === 1 ? " is" : "s are"} still waiting for the user. Remind them to review at ${url}, then call check_changes again after they say they're done.`;
  else if (decided[0]?.status === "applied") next = "The user reviewed your suggestions. Tell them what was applied and what was skipped, and why.";
  else if (decided[0]?.status === "rejected") next = "The user declined your last suggestions. Ask what they'd like instead.";
  return {
    access: ACCESS_WORDS[access],
    waiting_for_review: open ? { suggestions: open.requests.map((entry) => entry.text), review_url: url } : null,
    recently_reviewed: decided.map((proposal) => ({
      decision: proposal.status === "applied" ? "applied" : "declined",
      reviewed_at: new Date(proposal.decidedAt ?? proposal.updatedAt).toISOString(),
      applied: proposal.result?.applied ?? [],
      skipped: proposal.result?.skipped ?? [],
      ...(proposal.result?.changeId ? { change_id: proposal.result.changeId } : {}),
    })),
    recent_changes: recent.map((entry) => ({ change_id: entry.id, at: new Date(entry.createdAt).toISOString(), changed: entry.steps, undone: !!entry.undoneAt })),
    what_to_do_next: next,
  };
}

async function undoChange(args: Record<string, unknown>, context: AgentCallContext) {
  const changeId = typeof args.change_id === "string" ? args.change_id.trim() : "";
  if (!changeId) throw new AgentToolError("change_id is required. check_changes lists your recent change IDs.");
  const entry = await getDb().agentChanges.get(changeId);
  if (!entry || entry.pairingId !== context.pairingId) throw new AgentToolError(`You have no change with the ID ${changeId}. check_changes lists your recent change IDs.`);
  const result = await undoAgentChange(changeId);
  return {
    status: "undone", restored: result.restored, ...(result.kept.length ? { left_as_is: result.kept } : {}),
    what_to_do_next: result.kept.length ? "Undone, except the parts listed in left_as_is, which the user changed afterwards. Tell the user." : "Undone. Tell the user.",
  };
}

/** Handles the tools that change the library or report on changes. Returns undefined for any other tool. */
export async function runAgentWriteTool(tool: string, args: Record<string, unknown>, context: AgentCallContext): Promise<unknown | undefined> {
  if (tool === "check_changes") return checkChanges(context);
  if (tool === "undo_change") return undoChange(args, context);
  if (!isAgentWriteTool(tool)) return undefined;
  const pairing = await requirePairing(context.pairingId);
  return describe(await submitAgentChange(pairing, context.requestId, tool, args, reason(args)), context.appOrigin);
}
