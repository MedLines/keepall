"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { RadioCard } from "@/components/ui/radio-card";
import { TextField } from "@/components/ui/text-field";
import { contextPackSlug, type ContextPack, type ContextPackSource } from "@/domain/context-pack";
import type { Item } from "@/domain/item";
import { formatFileSize } from "@/lib/format-file-size";
import {
  contextPackFileName,
  contextPackFromSnapshot,
  readContextPackSnapshot,
  writeContextPackArchive,
  type ContextPackProgress,
  type ContextPackSnapshot,
} from "@/persistence/context-pack-archive";

export type ContextPackRequest = {
  itemIds: string[];
  defaultName: string;
  source: ContextPackSource;
  pinnedItemIds?: string[];
};

const TYPE_NAMES: Record<Item["type"], [string, string]> = {
  link: ["link", "links"], note: ["note", "notes"], image: ["image", "images"], video: ["video", "videos"], document: ["document", "documents"],
};

function describeCounts(pack: ContextPack): string {
  const counts = new Map<Item["type"], number>();
  for (const item of pack.manifest.items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${count} ${TYPE_NAMES[type][count === 1 ? 0 : 1]}`).join(", ");
}

function textBytes(pack: ContextPack): number {
  return pack.files.reduce((total, file) => total + ("text" in file ? new TextEncoder().encode(file.text).byteLength : 0), 0);
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function progressLabel(progress: ContextPackProgress | null): string {
  if (progress?.phase === "extracting-text") return `Reading document text… ${progress.completed ?? 0} of ${progress.total ?? 0}`;
  if (progress?.phase === "writing") return `Writing files… ${progress.completed ?? 0} of ${progress.total ?? 0}`;
  return "Reading items…";
}

function PackSummary({ pack, includeFiles }: { pack: ContextPack; includeFiles: boolean }) {
  const items = pack.manifest.items;
  const gaps = items.filter((item) => item.missing.includes("visuals")).length;
  const largest = includeFiles
    ? items.flatMap((item) => item.files.map((file) => ({ title: item.title, bytes: file.bytes })))
      .filter((file) => file.bytes >= 10 * 1024 * 1024).sort((a, b) => b.bytes - a.bytes).slice(0, 2)
    : [];
  return <>
    <p><span className="font-medium text-text-primary">{items.length === 1 ? "1 item" : `${items.length} items`}</span>{items.length ? `: ${describeCounts(pack)}` : ""}</p>
    <p>About {pack.manifest.totals.estimatedTokens.toLocaleString()} tokens of text</p>
    {gaps ? <p>{gaps === 1 ? "1 link has" : `${gaps} links have`} no saved text or image. Agents will only see the URL.</p> : null}
    {largest.length ? <p>Largest: {largest.map((file) => `${file.title} (${formatFileSize(file.bytes)})`).join(", ")}</p> : null}
  </>;
}

function ExportDone({ snippet, copied, onCopy }: { snippet: string; copied: boolean; onCopy: () => void }) {
  return <>
    <p className="text-sm leading-relaxed text-text-secondary">
      Unzip it into your project, for example under <code>references/</code>. The pack has no AGENTS.md of its own,
      so your project&apos;s instructions stay in charge. To point agents at it, add this line to your AGENTS.md:
    </p>
    <div className="flex flex-col gap-2">
      <code className="block rounded-control-xs bg-bg-raised p-3 text-xs leading-relaxed [overflow-wrap:anywhere]">{snippet}</code>
      <Button className="self-start" onClick={onCopy}>{copied ? "Copied" : "Copy line"}</Button>
    </div>
  </>;
}

/** Exports a set of items as an agent-ready Context Pack ZIP. Mount with a `key` per request. */
export function ContextPackDialog({ request, onClose }: { request: ContextPackRequest; onClose: () => void }) {
  const filesId = useId();
  const [snapshot, setSnapshot] = useState<ContextPackSnapshot | null>(null);
  const [exportedAt] = useState(() => Date.now());
  const [name, setName] = useState(request.defaultName);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [phase, setPhase] = useState<"reading" | "ready" | "exporting" | "done" | "error">("reading");
  const [progress, setProgress] = useState<ContextPackProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState("");
  const abort = useRef<AbortController | null>(null);
  const deferredName = useDeferredValue(name);

  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    readContextPackSnapshot(request.itemIds, { pinnedItemIds: request.pinnedItemIds, signal: controller.signal, onProgress: setProgress })
      .then((result) => { setSnapshot(result); setPhase("ready"); })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Couldn't read these items. Close this dialog and try again.");
        setPhase("error");
      });
    return () => controller.abort();
  }, [request]);

  const packName = deferredName.trim() || request.defaultName;
  const packs = useMemo(() => {
    if (!snapshot) return null;
    const options = { name: packName, source: request.source, exportedAt };
    return {
      withFiles: contextPackFromSnapshot(snapshot, { ...options, includeFiles: true }),
      textOnly: contextPackFromSnapshot(snapshot, { ...options, includeFiles: false }),
    };
  }, [snapshot, packName, request.source, exportedAt]);
  const pack = packs ? (includeFiles ? packs.withFiles : packs.textOnly) : null;
  const sizes = useMemo(() => packs ? {
    withFiles: packs.withFiles.manifest.totals.bytes + textBytes(packs.withFiles),
    textOnly: textBytes(packs.textOnly),
  } : null, [packs]);
  const busy = phase === "exporting";
  const slug = contextPackSlug(name.trim() || request.defaultName, "keepall-context-pack");
  const snippet = `Reference material exported from Keepall is in references/${slug}/. Start with its README.md.`;

  async function exportPack() {
    if (!pack || !snapshot || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setPhase("exporting");
    setError(null);
    try {
      const blob = await writeContextPackArchive(pack, snapshot, { signal: controller.signal, onProgress: setProgress });
      const name = contextPackFileName(pack);
      download(blob, name);
      setFileName(name);
      setPhase("done");
    } catch {
      if (controller.signal.aborted) { setPhase("ready"); return; }
      setError("Couldn't create the pack. Try again.");
      setPhase("ready");
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const footer = phase === "done"
    ? <Button variant="primary" onClick={onClose}>Done</Button>
    : <>
      <Button onClick={() => (busy ? abort.current?.abort() : onClose())}>{busy ? "Cancel export" : "Cancel"}</Button>
      <Button variant="primary" disabled={phase !== "ready" || !pack?.manifest.items.length} onClick={() => void exportPack()}>
        {busy ? "Exporting…" : "Export pack"}
      </Button>
    </>;

  return <ModalDialog
    open
    onOpenChange={(open) => { if (!open) onClose(); }}
    busy={busy}
    title={phase === "done" ? "Context Pack ready" : "Export for an AI agent"}
    description={phase === "done"
      ? `Downloaded ${fileName}.`
      : "A folder of Markdown cards, a manifest, and the original files, ready to drop into a project for an agent to read."}
    footer={footer}
  >
    {phase === "done" ? <ExportDone snippet={snippet} copied={copied} onCopy={() => void copySnippet()} /> : <>
      <TextField label="Pack name" value={name} disabled={busy} onChange={(event) => setName(event.target.value)}
        hint={`Downloads as ${slug}.zip`} maxLength={120} />
      <fieldset className="flex flex-col gap-2 border-0 p-0" disabled={busy || !packs} aria-describedby={`${filesId}-summary`}>
        <legend className="mb-2 text-sm font-medium text-text-primary">Files</legend>
        <RadioCard name={filesId} checked={includeFiles} onChange={() => setIncludeFiles(true)}>
          <span>
            <span className="font-medium">Include files</span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              Screenshots, images, documents, and videos{sizes ? ` · ${formatFileSize(sizes.withFiles)}` : ""}
            </span>
          </span>
        </RadioCard>
        <RadioCard name={filesId} checked={!includeFiles} onChange={() => setIncludeFiles(false)}>
          <span>
            <span className="font-medium">Text only</span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              Cards, notes, and extracted text{sizes ? ` · ${formatFileSize(sizes.textOnly)}` : ""}
            </span>
          </span>
        </RadioCard>
      </fieldset>
      <div id={`${filesId}-summary`} className="flex flex-col gap-1 text-sm text-text-secondary" role="status" aria-live="polite">
        {pack ? <PackSummary pack={pack} includeFiles={includeFiles} /> : <p>{phase === "error" ? "" : progressLabel(progress)}</p>}
        {busy ? <p>{progressLabel(progress)}</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-text-danger">{error}</p> : null}
    </>}
  </ModalDialog>;
}
