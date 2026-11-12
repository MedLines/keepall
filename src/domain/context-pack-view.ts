import type { ContextPackSource } from "./context-pack";
import { libraryTypeSelectionLabel, type LibraryViewState } from "./library-view";

const SORT_LABELS: Record<LibraryViewState["sort"], string> = {
  newest: "newest first",
  oldest: "oldest first",
  relevance: "best match first",
};

/** Describes a library view for a Context Pack README, e.g. "Collection *Inspo*, tag “type”, links, newest first". */
export function contextPackSourceForView(
  view: Pick<LibraryViewState, "q" | "collection" | "unsorted" | "tag" | "type" | "sort">,
  names: { collection?: string | null; tag?: string | null },
): ContextPackSource {
  const query = view.q.trim();
  const kind: ContextPackSource["kind"] = view.collection ? "collection" : view.tag ? "tag" : view.unsorted ? "unsorted" : query ? "search" : "library";
  const scope = view.collection ? `Collection *${names.collection ?? "Untitled"}*` : view.unsorted ? "Unsorted" : view.tag ? null : "All items";
  const types = libraryTypeSelectionLabel(view.type);
  const parts = [
    scope,
    view.tag ? `${scope ? "tag" : "Tag"} “${names.tag ?? "Untitled"}”` : null,
    types ? types.toLowerCase() : null,
    query ? `search “${query}”` : null,
    SORT_LABELS[view.sort],
  ].filter(Boolean);
  return {
    kind,
    description: parts.join(", "),
    view: {
      ...(view.collection ? { collection: view.collection } : {}),
      ...(view.tag ? { tag: view.tag } : {}),
      ...(view.unsorted ? { unsorted: true } : {}),
      ...(view.type ? { type: view.type } : {}),
      ...(query ? { q: query } : {}),
      sort: view.sort,
    },
  };
}

export function contextPackSourceForSelection(count: number, scope: string): ContextPackSource {
  return { kind: "selection", description: `${count === 1 ? "1 selected item" : `${count} selected items`} from ${scope}` };
}
