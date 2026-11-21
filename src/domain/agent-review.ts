// Shapes a planned proposal for people: changes grouped by what they do, with each item's effects, so a review
// shows "Add tag dark ui to these 21 images" once, however many agent calls suggested it.
import type { PlannedStep, StepEffect } from "./agent-changes";

export type ReviewGroup = {
  id: string;
  kind: StepEffect["kind"];
  title: string;
  /** Why the agent suggested it, when it said. */
  reasons: string[];
  effects: StepEffect[];
  itemIds: string[];
  /** Trash and replaced notes deserve a second look. */
  caution: boolean;
};

const KNOWN_AGENTS: Record<string, string> = {
  "claude-code": "Claude Code", claude: "Claude", "claude-ai": "Claude", codex: "Codex", "codex-mcp-client": "Codex",
  opencode: "OpenCode", cursor: "Cursor", "keepall cli": "Keepall CLI",
};

/** "claude-code" → "Claude Code". MCP clients report machine names; people read product names. */
export function agentDisplayName(name: string): string {
  const trimmed = name.trim();
  const known = KNOWN_AGENTS[trimmed.toLowerCase()];
  if (known) return known;
  if (trimmed === trimmed.toLowerCase() && /[-_]/.test(trimmed)) {
    return trimmed.split(/[-_\s]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  }
  return trimmed || "An agent";
}

const ORDER: Record<StepEffect["kind"], number> = { create: 0, collection: 1, tag: 2, note: 3, rename: 4, trash: 5 };

function groupOf(effect: StepEffect): { id: string; title: string } {
  switch (effect.kind) {
    case "collection":
      return effect.to
        ? { id: `collection:${effect.to.toLowerCase()}`, title: `Move to “${effect.to}”${effect.isNew ? " (new collection)" : ""}` }
        : { id: "collection:", title: "Take out of their collection" };
    case "tag":
      return { id: `tag:${effect.op}:${effect.tag.toLowerCase()}`, title: `${effect.op === "add" ? "Add" : "Remove"} tag “${effect.tag}”` };
    case "note":
      return { id: "note", title: "Add notes" };
    case "trash":
      return { id: "trash", title: "Move to Trash" };
    case "rename":
      return { id: effect.key, title: `Rename “${effect.from}” to “${effect.to}”` };
    case "create":
      return { id: "create", title: "Save new items" };
  }
}

function isCaution(effect: StepEffect) {
  return effect.kind === "trash" || (effect.kind === "note" && !!effect.before.trim() && !effect.after.startsWith(effect.before.trim()));
}

function addEffect(group: ReviewGroup, effect: StepEffect, seen: Set<string>) {
  if (seen.has(effect.key)) return;
  seen.add(effect.key);
  group.effects.push(effect);
  if ("itemId" in effect && !group.itemIds.includes(effect.itemId)) group.itemIds.push(effect.itemId);
  if (isCaution(effect)) group.caution = true;
}

export function groupEffects(steps: ReadonlyArray<Pick<PlannedStep, "effects"> & { reason?: string }>): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  const seen = new Map<string, Set<string>>();
  for (const step of steps) {
    for (const effect of step.effects) {
      const { id, title } = groupOf(effect);
      let group = groups.get(id);
      if (!group) {
        group = { id, kind: effect.kind, title, reasons: [], effects: [], itemIds: [], caution: false };
        groups.set(id, group);
        seen.set(id, new Set());
      }
      if (step.reason && !group.reasons.includes(step.reason)) group.reasons.push(step.reason);
      addEffect(group, effect, seen.get(id)!);
    }
  }
  return [...groups.values()].sort((left, right) => ORDER[left.kind] - ORDER[right.kind] || right.itemIds.length - left.itemIds.length);
}

/** Each item's effects across all groups, for reviewing one item at a time. */
export function effectsByItem(groups: readonly ReviewGroup[]): Map<string, StepEffect[]> {
  const byItem = new Map<string, StepEffect[]>();
  for (const group of groups) {
    for (const effect of group.effects) {
      if (!("itemId" in effect)) continue;
      byItem.set(effect.itemId, [...(byItem.get(effect.itemId) ?? []), effect]);
    }
  }
  return byItem;
}

/** A short label for one effect on one item, for chips. */
export function effectLabel(effect: StepEffect): string {
  switch (effect.kind) {
    case "collection": return effect.to ? `→ ${effect.to}` : "→ Unsorted";
    case "tag": return `${effect.op === "add" ? "+" : "−"} ${effect.tag}`;
    case "note": return "Note";
    case "trash": return "Trash";
    case "rename": return `${effect.from} → ${effect.to}`;
    case "create": return "New";
  }
}

export function reviewSummary(groups: readonly ReviewGroup[]) {
  const items = new Set(groups.flatMap((group) => group.itemIds));
  const count = (kind: StepEffect["kind"]) => groups.filter((group) => group.kind === kind).length;
  return {
    items: items.size,
    effects: groups.reduce((total, group) => total + group.effects.length, 0),
    collections: count("collection"),
    tags: count("tag"),
    notes: groups.find((group) => group.kind === "note")?.effects.length ?? 0,
    trash: groups.find((group) => group.kind === "trash")?.effects.length ?? 0,
  };
}
