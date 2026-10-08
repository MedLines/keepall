import { classifyCaptureFile } from "@/domain/capture-file";
import { validateFileManifest, type ExtensionFileManifest, type ExtensionFileResult } from "@/domain/extension-file-capture";
import { abortable } from "@/lib/abortable";
import { createDocument } from "./documents";
import { createImage } from "./items";
import { createVideo } from "./videos";

export type ExtensionCaptureOptions = {
  prepareVideo: (file: File) => Promise<Blob>;
  signal?: AbortSignal;
  onResult?: (result: ExtensionFileResult) => void;
  onStage?: (stage: "reading" | "preparing-video" | "saving", fileIndex: number) => void;
};
export async function captureExtensionFiles(input: ExtensionFileManifest, bytes: Uint8Array[], options: ExtensionCaptureOptions): Promise<ExtensionFileResult[]> {
  const manifest = validateFileManifest(input);
  if (bytes.length !== manifest.files.length || bytes.some((value, index) => value.byteLength !== manifest.files[index].size)) throw new Error("File sizes do not match the manifest.");
  const { organization: org, metadata: meta } = manifest;
  const organization = { collectionIds: org.collectionId ? [org.collectionId] : [], collectionName: org.collectionId ? undefined : org.collectionName, tagIds: org.tagIds, tagNames: org.tagNames, signal: options.signal };
  const results: ExtensionFileResult[] = [];
  const record = (fileIndex: number, result: { status: "saved"; itemId: string } | { status: "failed"; error: string } | { status: "cancelled" }) => {
    const full = { fileIndex, fileName: manifest.files[fileIndex].name, ...result } as ExtensionFileResult;
    results.push(full); options.onResult?.(full);
  };
  const failure = (error: unknown) => options.signal?.aborted ? { status: "cancelled" as const } : {
    status: "failed" as const,
    error: error instanceof Error && error.name === "QuotaExceededError" ? "Browser storage is full. Free some space and retry." : error instanceof Error ? error.message : "Could not save this file.",
  };
  if (manifest.imageMode === "gallery") {
    try {
      options.signal?.throwIfAborted();
      options.onStage?.("saving", 0);
      const item = await createImage({ ...organization, id: manifest.itemIds[0], assets: bytes.map((value, index) => ({ bytes: value, mimeType: classifyCaptureFile(manifest.files[index]).mimeType })), title: meta?.title, caption: meta?.noteContent, captionFormat: meta?.noteFormat, sourceUrl: meta?.sourceUrl });
      manifest.files.forEach((_, index) => record(index, { status: "saved", itemId: item.id }));
    } catch (error) { manifest.files.forEach((_, index) => record(index, failure(error))); }
    return results;
  }
  for (const [index, description] of manifest.files.entries()) {
    if (options.signal?.aborted) { record(index, { status: "cancelled" }); continue; }
    try {
      const { kind, mimeType } = classifyCaptureFile(description);
      options.onStage?.(kind === "video" ? "preparing-video" : "reading", index);
      const id = manifest.itemIds[index];
      let item;
      if (kind === "video") {
        const file = new File([bytes[index] as Uint8Array<ArrayBuffer>], description.name, { type: mimeType });
        const poster = await abortable(options.prepareVideo(file), options.signal);
        options.onStage?.("saving", index);
        item = await createVideo(file, poster, meta?.title, { content: meta?.noteContent ?? "", format: meta?.noteFormat ?? "plain" }, organization.collectionIds, { ...organization, id });
      } else {
        options.onStage?.("saving", index);
        item = kind === "document"
          ? await createDocument({ ...organization, id, fileName: description.name, bytes: bytes[index], title: meta?.title, noteContent: meta?.noteContent, noteFormat: meta?.noteFormat })
          : await createImage({ ...organization, id, assets: [{ bytes: bytes[index], mimeType }], sourceFileName: description.name, title: meta?.title, caption: meta?.noteContent, captionFormat: meta?.noteFormat, sourceUrl: meta?.sourceUrl });
      }
      record(index, { status: "saved", itemId: item.id });
    } catch (error) { record(index, failure(error)); }
  }
  return results;
}
