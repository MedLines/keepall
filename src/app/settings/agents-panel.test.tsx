import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AgentsPanel, type AgentsPanelProps } from "./agents-panel";

const now = Date.UTC(2026, 10, 27, 12);
const base: AgentsPanelProps = { proposals: [], activities: [], pairings: [], busy: null, status: null, now, onUndo: vi.fn(), onAccess: vi.fn(), onDisconnect: vi.fn() };
const requests = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `r${index}`, text: `Request ${index}` }));
const note = (id: string) => ({ id, type: "note", title: `Note ${id}`, content: "", format: "plain", createdAt: now, updatedAt: now, collectionIds: [], tagIds: [] }) as never;

test("counts what a proposal holds beyond the first three requests", () => {
  render(<AgentsPanel {...base} proposals={[{ id: "p", agentName: "codex", createdAt: now, requests: requests(5) }]} />);
  expect(screen.getByRole("heading", { name: "Codex suggests 5 changes" })).toBeInTheDocument();
  expect(screen.getByText("and 2 more")).toBeInTheDocument();
});

test("names a single changed item in the singular", () => {
  render(<AgentsPanel {...base} activities={[{
    id: "a", agentName: "codex", createdAt: now, summary: ["Tagged 1 item"], undoable: ["e"],
    items: [{ item: note("n"), changes: ["+ tag"], entryId: "e", undone: false, alone: true }],
  }]} />);
  expect(screen.getByText("Show the item")).toBeInTheDocument();
});
