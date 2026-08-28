/** Dev-only Performance marks for folder scope changes — open Chrome Performance to correlate. */

const MARK_START = "keepall:nav-scope:start";
const MARK_COMMIT = "keepall:nav-scope:react-commit";

let pendingScopeLabel: string | null = null;

export function markLibraryNavScopeChange(scopeLabel: string): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  pendingScopeLabel = scopeLabel;
  performance.mark(MARK_START);
}

/** Call from useLayoutEffect after browse scope commits — logs handler→paint timing. */
export function measureLibraryNavScopeCommit(scopeLabel: string): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  if (pendingScopeLabel !== scopeLabel) {
    return;
  }
  pendingScopeLabel = null;
  performance.mark(MARK_COMMIT);
  try {
    performance.measure(
      "keepall:nav-scope (click handler → layout effect)",
      MARK_START,
      MARK_COMMIT,
    );
    const [entry] = performance.getEntriesByName(
      "keepall:nav-scope (click handler → layout effect)",
    );
    if (entry) {
      console.info(
        `[keepall nav] scope "${scopeLabel}" handler→commit ${entry.duration.toFixed(1)}ms — open Performance panel for unmount/detail`,
      );
    }
  } catch {
    // Marks missing if hot reload cleared them.
  } finally {
    performance.clearMarks(MARK_START);
    performance.clearMarks(MARK_COMMIT);
    performance.clearMeasures(
      "keepall:nav-scope (click handler → layout effect)",
    );
  }
}
