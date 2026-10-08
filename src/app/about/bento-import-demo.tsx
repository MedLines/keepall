"use client";

import { useRef, type CSSProperties } from "react";
import { useInView } from "motion/react";
import { PdfIcon, NoteIcon, ImageIcon } from "../shell-icons";

const files = [
  { name: "Field notes", extension: "PDF", Icon: PdfIcon },
  { name: "Reading list", extension: "MD", Icon: NoteIcon },
  { name: "Coast", extension: "JPG", Icon: ImageIcon },
];

export function ImportDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.4 });
  return <div ref={ref} className="kd-demo kd-import" data-feature-demo="import" data-visible={visible}>
    <div className="kd-import-animation" tabIndex={0} role="img" aria-label="A folder opens into a PDF, a Markdown note, and an image. Focus to pause the animation.">
      <div className="kd-import-folder-art" aria-hidden="true">
        <svg viewBox="0 0 160 130" fill="none"><path className="kd-folder-back" d="M8 22Q8 10 20 10H62L78 22H140Q152 22 152 34V114Q152 126 140 126H20Q8 126 8 114Z" /></svg>
      </div>
      {files.map(({ name, extension, Icon }, index) => <div key={extension} className="kd-import-file" aria-hidden="true" style={{ "--file-x": `${(index - 1) * 82}px`, "--file-angle": `${(index - 1) * 12}deg`, "--file-delay": `${index * 0.12}s` } as CSSProperties}>
        <div className="kd-import-file-paper"><Icon /><span>{extension}</span></div><span className="kd-import-file-name">{name}</span>
      </div>)}
      <div className="kd-import-folder-art kd-import-folder-front" aria-hidden="true">
        <svg viewBox="0 0 160 130" fill="none"><path className="kd-folder-front" d="M6 53Q6 41 18 41H58Q64 41 70 46L81 53H142Q154 53 154 65V114Q154 126 142 126H18Q6 126 6 114Z" /></svg>
      </div>
    </div>
    <p className="kd-caption kd-import-caption">One folder. Everything inside.</p>
  </div>;
}
