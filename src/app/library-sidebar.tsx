"use client";

import { memo, type ComponentProps } from "react";
import { LibraryShell } from "./library-shell";

export type LibrarySidebarProps = ComponentProps<typeof LibraryShell>;

/**
 * Memo boundary — skip sidebar reconcile when browse highlight and counts are
 * unchanged (e.g. selection/edit state updates in the main grid).
 */
export const LibrarySidebar = memo(
  function LibrarySidebar(props: LibrarySidebarProps) {
    return <LibraryShell {...props} />;
  },
  (prev, next) =>
    prev.panelOpen === next.panelOpen &&
    prev.backupOpen === next.backupOpen &&
    prev.browseCollectionId === next.browseCollectionId &&
    prev.browseUnsorted === next.browseUnsorted &&
    prev.browseType === next.browseType &&
    prev.browseTagId === next.browseTagId &&
    prev.sidebarCounts === next.sidebarCounts &&
    prev.collections === next.collections &&
    prev.tags === next.tags &&
    prev.dropTargetCollectionId === next.dropTargetCollectionId &&
    prev.newCollectionDraft === next.newCollectionDraft &&
    prev.collectionManageError === next.collectionManageError &&
    prev.dragError === next.dragError &&
    prev.mutationBusy === next.mutationBusy &&
    prev.libraryLoading === next.libraryLoading,
);
