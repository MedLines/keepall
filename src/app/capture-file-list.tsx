"use client";

import { useEffect, useState } from "react";
import { classifyCaptureFile } from "@/domain/capture-file";
import type { FileImportResult } from "@/persistence/file-import";
import { ImageIcon, NoteIcon, PdfIcon, VideoIcon, UploadIcon, CloseIcon } from "./shell-icons";

type Props = { files: File[]; results: FileImportResult[]; disabled: boolean; onRemove: (index: number) => void };

function fileStatus(file: File, result: FileImportResult | undefined) {
  if (result?.status === "saved") return "Saved";
  if (result?.status === "failed") return result.error;
  const { kind } = classifyCaptureFile(file);
  if (kind === "document") return /\.pdf$/i.test(file.name) ? "PDF document" : /\.md$/i.test(file.name) ? "Markdown note" : "Text note";
  return { image: "Image", video: "Video", unsupported: "Unsupported file" }[kind];
}

export function CaptureFileList({ files, results, disabled, onRemove }: Props) {
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  useEffect(() => {
    let active = true;
    const next = new Map(files.filter((file) => classifyCaptureFile(file).kind === "image").map((file) => [file, URL.createObjectURL(file)]));
    void Promise.resolve().then(() => { if (active) setPreviews(next); });
    return () => { active = false; for (const url of next.values()) URL.revokeObjectURL(url); };
  }, [files]);
  const icons = { image: ImageIcon, document: NoteIcon, video: VideoIcon, unsupported: UploadIcon };
  return <section aria-label="Selected files" className="flex flex-col gap-2">
    <p className="text-sm text-text-secondary">{files.length} {files.length === 1 ? "file" : "files"} · Separate items</p>
    <ul className="divide-y divide-border-control">
      {files.map((file, index) => {
        const { kind } = classifyCaptureFile(file);
        const Icon = /\.pdf$/i.test(file.name) ? PdfIcon : icons[kind];
        const result = results[index];
        const url = previews.get(file);
        return <li key={index} className="flex items-center gap-3 py-2">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-raised">
            {/* eslint-disable-next-line @next/next/no-img-element -- local file preview */}
            {url ? <img alt="" src={url} className="media-outline size-full object-cover" /> : <Icon className="text-text-secondary" />}
          </div>
          <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{file.name}</p>
            <p className={`mt-1 text-xs ${result?.status === "failed" ? "text-text-danger" : "text-text-secondary"}`}>
              {fileStatus(file, result)}
            </p>
          </div>
          <button type="button" className="ui-control flex size-8 shrink-0 items-center justify-center" aria-label={`Remove file ${file.name}`} disabled={disabled} onClick={() => onRemove(index)}><CloseIcon className="size-4" /></button>
        </li>;
      })}
    </ul>
  </section>;
}
