/** Pure helpers for `.keepall` merge (identity vs recency vs tag union). */

/** True when the incoming row should overwrite conflicting fields. */
export function isIncomingNewer(
  localUpdatedAt: number,
  incomingUpdatedAt: number,
): boolean {
  return incomingUpdatedAt > localUpdatedAt;
}

/** Stable unique concat of id lists (first occurrence wins). */
export function unionIds(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
