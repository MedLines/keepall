"use client";

import Image from "next/image";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { useState } from "react";
import type { NoteItem } from "@/domain/note";
import type { ImageItem } from "@/domain/image";
import { LibraryCardContent } from "../library-card-content";
import { ItemMediaFrame } from "../item-media-frame";
import { ItemTypeBadge } from "../item-type-icon";
import { NoteContent } from "../note-content";
import { ArrowLeftIcon, ArrowRightIcon } from "../shell-icons";

const previewNote: NoteItem = { id: "demo-preview-note", type: "note", title: "a-little-pause.md", content: "# A little pause\n\nA book by the window.\n\nLeave the afternoon open.", format: "markdown", tagIds: [], collectionIds: [], createdAt: 1791453600000, updatedAt: 1791453600000 };
const previewImage: ImageItem = { id: "demo-preview-image", type: "image", title: "Coastal evening", sourceFileName: "keepall-coast.webp", assetIds: [], sourceUrl: "", caption: "", tagIds: [], collectionIds: [], createdAt: 0, updatedAt: 0 };

function PreviewImage() {
  return <ItemMediaFrame className="kd-preview-media"><Image src="/marketing/keepall-coast.webp" width={480} height={320} alt="A quiet coastline at dusk" sizes="(max-width: 700px) 80vw, 300px" /></ItemMediaFrame>;
}

function SampleCard({ image, onOpen }: { image: boolean; onOpen: () => void }) {
  return <div className="library-card squircle-panel relative flex flex-col rounded-card p-[8px]">
    {image && <div className="library-card-media"><PreviewImage /><ItemTypeBadge item={previewImage} /></div>}
    <div className={`library-card-footer ${image ? "library-card-footer-with-media" : "kd-preview-note-card"}`}><LibraryCardContent item={image ? previewImage : previewNote} onOpen={onOpen} /></div>
  </div>;
}

export function PreviewDemo() {
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState(false);
  function move() { setIndex(value => (value + 1) % 2); setOpened(false); }
  return <div className="kd-demo kd-preview" data-feature-demo="preview">
    <ScrollPanel className="kd-preview-stage" viewportClassName="kd-preview-viewport" viewportProps={{ tabIndex: 0, "aria-label": "Sample Preview cards" }}>
      {opened ? <div className="kd-preview-open">
        <ScrollPanel className={index === 0 ? "kd-preview-open-image" : "kd-preview-note"} viewportProps={{ tabIndex: 0, "aria-label": "Opened sample preview" }}>{index === 0 ? <PreviewImage /> : <NoteContent content={previewNote.content} format="markdown" allowLocalImages={false} />}</ScrollPanel>
        <button type="button" className="ka-button ka-button-small kd-button" onClick={() => setOpened(false)}>Back to card</button>
      </div> : <div className="kd-preview-deck">
        <div className="kd-preview-rear" inert aria-hidden="true"><SampleCard image={index !== 0} onOpen={() => setOpened(true)} /></div>
        <div className="kd-preview-content" key={index}><SampleCard image={index === 0} onOpen={() => setOpened(true)} /></div>
      </div>}
    </ScrollPanel>
    <div className="kd-preview-controls"><button type="button" className="ka-button ka-button-small kd-button" aria-label="Previous sample preview" onClick={move}><ArrowLeftIcon /></button><span className="kd-caption" role="status">{index === 0 ? "keepall-coast.webp" : "a-little-pause.md"}</span><button type="button" className="ka-button ka-button-small kd-button" aria-label="Next sample preview" onClick={move}><ArrowRightIcon /></button></div>
  </div>;
}
