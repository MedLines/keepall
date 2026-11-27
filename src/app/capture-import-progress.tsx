"use client";

import { ModalDialog } from "@/components/ui/modal-dialog";
import type { FileImportStage } from "@/domain/capture-file";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/use-translations";

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
  const t = useTranslations("CaptureProgress");
  const label = progress ? t(`stage.${progress.stage}`) : t("importing");
  const gallery = progress?.stage === "saving-gallery";
  const preparing = progress?.stage === "preparing-images";
  return <ModalDialog open={progress !== null} busy title={t("title")}
    description={gallery ? t("galleryDescription") : preparing ? t("preparingDescription") : t("separateDescription")}
    onOpenChange={() => {}}
    footer={<Button onClick={onCancel} disabled={cancelling}>{cancelling ? t("cancelling") : t("cancelImport")}</Button>}>
    {progress ? <div className="space-y-3">
      <div role="status" aria-live="polite" aria-atomic="true" className="space-y-2 text-sm text-text-primary">
        <p className="flex items-center gap-2 font-medium">
          <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-border-control border-t-text-primary motion-safe:animate-spin" />
          {cancelling ? t("cancellingImport") : label}
        </p>
        <p className="tabular-nums">{gallery ? t("galleryCount", { count: progress.total }) : t("filesProcessed", { done: progress.done, total: progress.total })}</p>
        {progress.fileName ? <p className="wrap-anywhere text-text-secondary"><bdi>{progress.fileName}</bdi></p> : null}
        {!gallery && !preparing ? <p className="tabular-nums text-text-secondary">{t("savedFailed", { saved: progress.saved, failed: progress.failed })}</p> : null}
      </div>
      <progress aria-label={label} value={gallery ? undefined : progress.done} max={progress.total}
        className="h-2 w-full accent-action-primary" />
      <p className="text-sm leading-6 text-text-secondary">{t("keepOpen")}</p>
      <p className="text-sm leading-6 text-text-secondary">{gallery ? t("cancelGallery") : preparing ? t("cancelPreparing") : t("cancelSeparate")}</p>
    </div> : null}
  </ModalDialog>;
}
