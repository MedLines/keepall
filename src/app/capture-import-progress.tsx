"use client";

import { ModalDialog } from "@/components/ui/modal-dialog";
import type { FileImportStage } from "@/domain/capture-file";

export type CaptureImportProgress = {
  stage: FileImportStage | "preparing-images" | "saving-gallery";
  done: number;
  total: number;
  fileName?: string;
  saved: number;
  failed: number;
};

export function CaptureImportProgressDialog({ progress, onCancel, cancelling }: {
  progress: CaptureImportProgress | null; onCancel: () => void; cancelling: boolean;
}) {
  const label = progress ? {
    reading: "Reading file…",
    "preparing-video": "Preparing video…",
    saving: "Saving files…",
    "preparing-images": "Preparing images…",
    "saving-gallery": "Saving gallery…",
  }[progress.stage] : "Importing files…";
  const gallery = progress?.stage === "saving-gallery";
  const preparing = progress?.stage === "preparing-images";
  return <ModalDialog open={progress !== null} busy title="Importing files"
    description={gallery ? "Saving these images together as one library item." : preparing ? "Reading images before you choose how to save them." : "Saving each file as a separate library item."}
    onOpenChange={() => {}}
    footer={<button type="button" onClick={onCancel} disabled={cancelling} className="ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60">{cancelling ? "Canceling…" : "Cancel import"}</button>}>
    {progress ? <div className="space-y-3">
      <div role="status" aria-live="polite" aria-atomic="true" className="space-y-2 text-sm text-text-primary">
        <p className="flex items-center gap-2 font-medium">
          <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-border-control border-t-text-primary motion-safe:animate-spin" />
          {cancelling ? "Canceling import…" : label}
        </p>
        <p className="tabular-nums">{gallery ? `${progress.total} images in this gallery` : `${progress.done} of ${progress.total} files processed`}</p>
        {progress.fileName ? <p className="[overflow-wrap:anywhere] text-text-secondary"><bdi>{progress.fileName}</bdi></p> : null}
        {!gallery && !preparing ? <p className="tabular-nums text-text-secondary">{progress.saved} saved · {progress.failed} failed</p> : null}
      </div>
      <progress aria-label={label} value={gallery ? undefined : progress.done} max={progress.total}
        className="h-2 w-full accent-action-primary" />
      <p className="text-sm leading-6 text-text-secondary">Keep this tab open until the import finishes. Large files can take a while.</p>
      <p className="text-sm leading-6 text-text-secondary">{gallery ? "Canceling leaves this gallery unsaved." : preparing ? "Cancel to stop adding images from this selection." : "Cancel stops this import. Files already saved stay in your library."}</p>
    </div> : null}
  </ModalDialog>;
}
