"use client";

import Image from "next/image";
import { useState } from "react";
import type { NoteItem } from "@/domain/note";
import type { ImageItem } from "@/domain/image";
import { EMPTY_LINK_PREVIEW, type LinkItem } from "@/domain/link";
import { LibraryCardContent } from "../library-card-content";
import { ItemTypeBadge } from "../item-type-icon";
import { NoteContent } from "../note-content";
import { ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon } from "../shell-icons";

const common = { tagIds: [], collectionIds: [], createdAt: 1791453600000, updatedAt: 1791453600000 };
const previewNote: NoteItem = { ...common, id: "demo-preview-note", type: "note", title: "a-little-pause.md", content: "# A little pause\n\nA book by the window.\n\nLeave the afternoon open.", format: "markdown" };
const previewImage: ImageItem = { ...common, id: "demo-preview-image", type: "image", title: "Coastal evening", sourceFileName: "keepall-coast.webp", assetIds: [], sourceUrl: "", caption: "" };
const books: LinkItem = { ...common, ...EMPTY_LINK_PREVIEW, id: "demo-preview-books", type: "link", title: "Project Gutenberg", url: "https://www.gutenberg.org/", previewStatus: "ready", previewDescription: "A shelf of free ebooks for your next quiet afternoon.", previewAssetId: "demo-books" };
const ideas: LinkItem = { ...common, ...EMPTY_LINK_PREVIEW, id: "demo-preview-ideas", type: "link", title: "Are.na", url: "https://www.are.na/", previewStatus: "ready", previewDescription: "Collect references and follow a thread of ideas.", previewAssetId: "demo-ideas" };
const samples: { item: ImageItem | NoteItem | LinkItem; image?: string; alt?: string }[] = [
  { item: previewImage, image: "keepall-coast.webp", alt: "A quiet coastline at dusk" },
  { item: previewNote },
  { item: books, image: "reading-corner.webp", alt: "Books and a chair beside a sunlit window" },
  { item: { ...previewImage, id: "demo-preview-architecture", title: "Lines & light", sourceFileName: "architecture.webp" }, image: "architecture.webp", alt: "An architectural study in light and shadow" },
  { item: ideas, image: "workflow-canvas.svg", alt: "A canvas of connected ideas" },
];
type Sample = typeof samples[number];

function PreviewImage({ sample }: { sample: Sample }) {
  return <Image className="kd-preview-photo" src={`/marketing/${sample.image}`} width={480} height={320} alt={sample.alt!} sizes="(max-width: 700px) 80vw, 300px" unoptimized={sample.image?.endsWith(".svg")} />;
}

function SampleCard({ sample, onOpen }: { sample: Sample; onOpen: () => void }) {
  return <div className="library-card squircle-panel kd-sample-card">
    {sample.image && <div className="library-card-media"><button type="button" className="kd-preview-media-open" aria-label={`Preview ${sample.item.title}`} onClick={onOpen}><PreviewImage sample={sample} /></button><ItemTypeBadge item={sample.item} /></div>}
    <div className={`library-card-footer ${sample.image ? "library-card-footer-with-media" : "kd-preview-note-card"}`}><LibraryCardContent item={sample.item} onOpen={onOpen} /></div>
  </div>;
}

export function PreviewDemo() {
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState(false);
  const sample = samples[index];
  function move(direction: number) { setIndex(value => (value + direction + samples.length) % samples.length); }
  return <div className="kd-demo kd-preview" data-feature-demo="preview">
    <div className="kd-preview-stage">
      {opened ? sample.item.type === "note" ? <div className="kd-preview-note"><NoteContent content={sample.item.content} format="markdown" allowLocalImages={false} /></div>
        : sample.item.type === "link" ? <div className="kd-preview-link"><PreviewImage sample={sample} /><div><h4>{sample.item.title}</h4><p>{sample.item.previewDescription}</p><a href={sample.item.url} target="_blank" rel="noreferrer">Visit website<ExternalLinkIcon /></a></div></div>
          : <div className="kd-preview-open-image"><PreviewImage sample={sample} /></div>
        : <SampleCard sample={sample} onOpen={() => setOpened(true)} />}
    </div>
    <div className="kd-preview-controls">
      <button type="button" className="ui-control kd-button" aria-label="Previous sample preview" onClick={() => move(-1)}><ArrowLeftIcon /></button>
      {opened ? <button type="button" className="ui-control kd-button" onClick={() => setOpened(false)}>Back to card</button> : <span className="kd-caption" aria-hidden="true">{sample.item.type === "link" ? "Link" : sample.item.type === "note" ? "Note" : "Image"} · {index + 1} / {samples.length}</span>}
      <span className="kd-live" role="status">{index + 1} of {samples.length}: {sample.item.type === "image" ? sample.item.sourceFileName : sample.item.title}</span>
      <button type="button" className="ui-control kd-button" aria-label="Next sample preview" onClick={() => move(1)}><ArrowRightIcon /></button>
    </div>
  </div>;
}
