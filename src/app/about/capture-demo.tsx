"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon, LinkIcon, LogoIcon, NoteIcon, SelectionCheckedIcon } from "../shell-icons";

const examples = [
  { id: "page", label: "Page", icon: LinkIcon, instruction: "Click the extension icon to keep the page you're reading.", result: "Page saved to Unsorted" },
  { id: "image", label: "Image", icon: ImageIcon, instruction: "Right-click an image and choose Save to Keepall.", result: "Image saved to Unsorted" },
  { id: "text", label: "Text", icon: NoteIcon, instruction: "Highlight a passage, then right-click to save it with its source.", result: "Passage saved with its source link" },
] as const;

export function CaptureDemo() {
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState(false);
  const example = examples[selected];

  return (
    <div className="ka-demo">
      <div className="ka-demo-topline">
        <div className="ka-demo-choices" role="group" aria-label="Choose a capture example">
          {examples.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setSaved(false); }}><item.icon />{item.label}</button>)}
        </div>
        <span className="ka-demo-label">Interactive demo</span>
      </div>
      <div className="ka-demo-browser" data-example={example.id} data-saved={saved}>
        <div className="ka-demo-chrome" aria-hidden="true"><span className="ka-window-dots"><i /><i /><i /></span><span>fieldnotes.example / spaces</span><LogoIcon className="size-5" /></div>
        <div className="ka-demo-document">
          <div className="ka-demo-editorial"><span>FIELDNOTES</span><span>Spaces, thoughtfully made.</span></div>
          <div className="ka-demo-story">
            <div className="ka-demo-story-copy"><p>THE SPACES WE RETURN TO</p><h3>A little room to think.</h3><p className="ka-demo-passage"><span>Make room for the things that make you look twice.</span> A quiet corner. Afternoon light. An idea for another day.</p></div>
            <div className="ka-demo-photo"><Image src="/marketing/reading-corner.webp" alt="Sunlit reading corner with a chair, books, and large windows" fill sizes="(max-width: 640px) 55vw, 320px" /></div>
          </div>
        </div>
        <div className="ka-demo-save" data-saved={saved}>
          {saved ? <div className="ka-demo-saved"><SelectionCheckedIcon /><span>Kept. Come back anytime.</span></div> : <button type="button" onClick={() => setSaved(true)}><LogoIcon className="size-7" /><span>Save to Keepall</span><span aria-hidden="true">↗</span></button>}
        </div>
      </div>
      <div className="ka-demo-bottom">
        <div role="status" aria-live="polite"><strong>{saved ? example.result : example.instruction}</strong><span>{saved ? "This is a preview. Your real library is unchanged." : "Try the save button in this example."}</span></div>
        {saved && <button type="button" className="ka-demo-reset" onClick={() => setSaved(false)}>Try again <span aria-hidden="true">↺</span></button>}
      </div>
    </div>
  );
}
