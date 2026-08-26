/** MIME type for library item drag payloads (JSON string[] of item ids). */
export const LIBRARY_ITEM_DRAG_MIME = "application/x-keepall-item-ids";

export function encodeLibraryDragIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export function decodeLibraryDragIds(raw: string): string[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((id) => typeof id === "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveLibraryDragIds(
  draggedItemId: string,
  selectedIds: ReadonlySet<string>,
): string[] {
  if (selectedIds.has(draggedItemId) && selectedIds.size > 0) {
    return [...selectedIds];
  }
  return [draggedItemId];
}
