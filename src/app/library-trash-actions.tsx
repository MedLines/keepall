"use client";

import { useRef, useState, type RefObject } from "react";
import { itemActionLabel } from "@/domain/item-label";
import type { Item } from "@/domain/item";
import { emptyTrash, permanentlyDeleteItem, restoreItem } from "@/persistence/items";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ITEMS_CHANGED_EVENT } from "./items-events";

type Confirmation = { kind: "item"; item: Item } | { kind: "all" | "selected"; ids: string[] };

export function useLibraryTrashActions(heading: RefObject<HTMLHeadingElement | null>, onItemsRemoved?: (ids: string[]) => void) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  async function run(action: () => Promise<void>, message: string, ids: string[]) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      onItemsRemoved?.(ids);
      setConfirmation(null);
      setNotice(message);
      heading.current?.focus();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setError("Couldn't complete this action. Your items are still available. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function request(next: Confirmation) {
    setError(null);
    setConfirmation(next);
  }

  const all = confirmation?.kind === "all";
  return {
    busy,
    confirming: confirmation !== null,
    error: confirmation ? null : error,
    notice,
    restore: (item: Item) => void run(() => restoreItem(item.id), `${itemActionLabel(item)} restored to your library.`, [item.id]),
    requestDelete: (item: Item) => request({ kind: "item", item }),
    requestEmpty: (items: Item[]) => request({ kind: "all", ids: items.map((item) => item.id) }),
    requestDeleteSelected: (ids: string[]) => { if (ids.length) request({ kind: "selected", ids: [...new Set(ids)] }); },
    dialog: <ConfirmDialog
      open={confirmation !== null}
      title={all ? "Empty Trash?" : confirmation?.kind === "selected" ? "Permanently delete selected items?" : "Permanently delete this item?"}
      description={confirmation?.kind === "all"
        ? `Permanently delete all ${confirmation.ids.length} items in Trash, including items hidden by search or filters? This cannot be undone.`
        : confirmation?.kind === "selected" ? `Permanently delete ${confirmation.ids.length} selected item${confirmation.ids.length === 1 ? "" : "s"}? Other items in Trash will remain. This cannot be undone.`
        : confirmation?.kind === "item" ? `Delete “${itemActionLabel(confirmation.item)}” and its unshared media? This cannot be undone.` : ""}
      confirmLabel={all ? "Empty Trash" : "Delete permanently"}
      pendingLabel="Deleting…" busy={busy} error={error}
      onConfirm={() => {
        if (confirmation?.kind === "item") void run(() => permanentlyDeleteItem(confirmation.item.id), "Item permanently deleted.", [confirmation.item.id]);
        else if (confirmation) void run(() => emptyTrash(confirmation.ids), all ? "Trash emptied." : "Selected items permanently deleted.", confirmation.ids);
      }}
      onOpenChange={(open) => { if (!open) { setConfirmation(null); setError(null); } }}
    />,
  };
}
