"use client";

import { captureStyles } from "./capture-styles";

import { useEffect, useState } from "react";
import { classifyCaptureFile } from "@/domain/capture-file";
import type { FileImportResult } from "@/persistence/file-import";
import { ImageIcon, NoteIcon, PdfIcon, VideoIcon, UploadIcon, CloseIcon } from "./shell-icons";
import { useTranslations, type Translations } from "@/i18n/use-translations";

type Props = { files: File[]; results: FileImportResult[]; disabled: boolean; onRemove: (index: number) => void };

function fileStatus(t: Translations<"Capture">, file: File, result: FileImportResult | undefined) {
  if (result?.status === "saved") return t("fileSaved");
  if (result?.status === "failed") return result.error;
  if (result?.status === "cancelled") return t("notImported");
  const { kind } = classifyCaptureFile(file);
  if (kind === "document") return /\.pdf$/i.test(file.name) ? t("pdfDocument") : /\.md$/i.test(file.name) ? t("markdownNote") : t("textNote");
  return t(kind === "unsupported" ? "unsupportedFile" : kind);
}

export function CaptureFileList({ files, results, disabled, onRemove }: Props) {
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  const t = useTranslations("Capture");
  useEffect(() => {
    let active = true;
    const next = new Map(files.filter((file) => classifyCaptureFile(file).kind === "image").map((file) => [file, URL.createObjectURL(file)]));
    void Promise.resolve().then(() => { if (active) setPreviews(next); });
    return () => { active = false; for (const url of next.values()) URL.revokeObjectURL(url); };
  }, [files]);
  const icons = { image: ImageIcon, document: NoteIcon, video: VideoIcon, unsupported: UploadIcon };
  return <section aria-label={t("selectedFiles")} className={captureStyles["field"]}>
    <p className={captureStyles["file-progress"]}>{t("fileCount", { count: files.length })}</p>
    <ul className={captureStyles["file-list"]}>
      {files.map((file, index) => {
        const { kind } = classifyCaptureFile(file);
        const Icon = /\.pdf$/i.test(file.name) ? PdfIcon : icons[kind];
        const result = results[index];
        const url = previews.get(file);
        return <li key={index} className={captureStyles["file-row"]}>
          <div className={captureStyles["file-icon"]}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local file preview */}
            {url ? <img alt="" src={url} className={captureStyles["file-thumbnail"]} /> : <Icon className="text-text-secondary" />}
          </div>
          <div className={captureStyles["heading"]}><p className={captureStyles["file-title"]}>{file.name}</p>
            <p className={`mt-1 text-xs ${result?.status === "failed" ? "text-text-danger" : "text-text-secondary"}`}>
              {fileStatus(t, file, result)}
            </p>
          </div>
          <button type="button" className={captureStyles["file-remove"]} aria-label={t("removeFile", { name: file.name })} disabled={disabled} onClick={() => onRemove(index)}><CloseIcon className="size-4" /></button>
        </li>;
      })}
    </ul>
  </section>;
}
