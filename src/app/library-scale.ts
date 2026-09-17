/** Keep small libraries mounted; window larger libraries for folder navigation. */
export const LIBRARY_VIRTUALIZE_MIN = 60;

export const LIBRARY_GRID_MIN_COL_PX = 320;
export const LIBRARY_GRID_GAP_PX = 20;
export const LIBRARY_LIST_ROW_ESTIMATE_PX = 64;
export const LIBRARY_GRID_ROW_ESTIMATE_PX = 320;

export function gridColumnCount(containerWidth: number): number {
  return Math.max(1, Math.floor(
    (containerWidth + LIBRARY_GRID_GAP_PX) /
    (LIBRARY_GRID_MIN_COL_PX + LIBRARY_GRID_GAP_PX),
  ));
}
