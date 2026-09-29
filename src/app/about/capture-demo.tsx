"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { CollectionIcon, ImageIcon, KeyboardIcon, LinkIcon, NoteIcon } from "../shell-icons";
import { RecordedDemo } from "./recorded-demo";

const examples = [
  { id: "page", label: "Page", icon: LinkIcon, instruction: "One click on the Keepall icon saves the page.", detail: "A confirmation appears right where you’re browsing." },
  { id: "image", label: "Image", icon: ImageIcon, instruction: "Right-click an image. Choose Save to Keepall.", detail: "Keep the image itself, together with its source." },
  { id: "text", label: "Text", icon: NoteIcon, instruction: "Highlight a passage. Right-click to save it.", detail: "Your selection stays attached to the original page." },
  { id: "organize", label: "Organize", icon: CollectionIcon, instruction: "Save it. Choose Organize. Pick a collection.", detail: "Put it where it belongs without leaving the page." },
  { id: "notes", label: "Alt+K", icon: KeyboardIcon, instruction: "Press Alt+K to add a note before saving.", detail: "Plain text or Markdown. Option+K on Mac. Works on most websites." },
] as const;

export function CaptureDemo() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];

  return <div className="ka-demo">
    <div className="ka-demo-intro"><span>See it in action</span><p>Choose a walkthrough</p></div>
    <div className="ka-demo-topline">
      <div className="ka-demo-choices" role="group" aria-label="Choose a capture video">
        {examples.map((item, index) => <button key={item.id} type="button" className="control-shape-none" aria-pressed={selected === index} onClick={() => setSelected(index)}><item.icon />{item.label}</button>)}
      </div>
    </div>
    <div className="ka-capture-videos" role="region" aria-label={`${example.label} capture video`}>
      {examples.map((item, index) => <div key={item.id} className="ka-capture-video" inert={selected !== index} aria-hidden={selected !== index} style={{ "--demo-offset": `${index < selected ? -105 : 105}%` } as CSSProperties}>
        <RecordedDemo active={selected === index} name={`${item.label} capture`} src={`/marketing/capture-${item.id}-demo`} onComplete={() => setSelected(current => current === index ? (index + 1) % examples.length : current)} poster={<Image className="ka-capture-poster" src={`/marketing/capture-${item.id}-poster.webp`} alt={`${item.label} capture in the Keepall browser extension`} width={1000} height={800} sizes="(max-width: 800px) 90vw, 480px" />} />
      </div>)}
    </div>
    <div className="ka-demo-bottom"><div role="status"><strong>{example.instruction}</strong><span>{example.detail}</span></div></div>
  </div>;
}
