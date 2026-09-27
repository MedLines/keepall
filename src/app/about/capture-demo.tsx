"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { ImageIcon, LinkIcon, LogoIcon, NoteIcon, SelectionCheckedIcon } from "../shell-icons";

const examples = [
  { id: "page", label: "Page", icon: LinkIcon, instruction: "Click the Keepall icon in the toolbar.", result: "Page saved to Unsorted" },
  { id: "image", label: "Image", icon: ImageIcon, instruction: "Right-click an image. Choose Save to Keepall.", result: "Image saved to Unsorted" },
  { id: "text", label: "Text", icon: NoteIcon, instruction: "Select a passage. Right-click to keep it with its source.", result: "Passage saved with its source link" },
] as const;

type Step = "ready" | "menu" | "saved";

type Example = (typeof examples)[number];

function useDemoFocus(step: Step, exampleId: Example["id"]) {
  const toolbar = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const replay = useRef<HTMLButtonElement>(null);
  const replayingRef = useRef(false);

  useEffect(() => {
    if (step === "menu") action.current?.focus({ preventScroll: true });
    if (step === "saved") replay.current?.focus({ preventScroll: true });
    if (step === "ready" && replayingRef.current) {
      (exampleId === "page" ? toolbar : action).current?.focus({ preventScroll: true });
      replayingRef.current = false;
    }
  }, [step, exampleId]);

  return { toolbar, action, replay, replayingRef };
}

function CaptureDocument({ example, openMenu }: { example: Example; openMenu: () => void }) {
  return (
    <div className="ka-demo-document">
      <div className="ka-demo-editorial"><span>FIELDNOTES</span><span>Spaces, thoughtfully made.</span></div>
      <div className="ka-demo-story">
        <div className="ka-demo-story-copy">
          <p>THE SPACES WE RETURN TO</p><h3>A little room to think.</h3>
          <p className="ka-demo-passage" onContextMenu={example.id === "text" ? (event) => { event.preventDefault(); openMenu(); } : undefined}><span>Make room for the things that make you look twice.</span> A quiet corner. Afternoon light. An idea for another day.</p>
        </div>
        <div className="ka-demo-photo" onContextMenu={example.id === "image" ? (event) => { event.preventDefault(); openMenu(); } : undefined}><Image src="/marketing/reading-corner.webp" alt="Sunlit reading corner with a chair, books, and large windows" fill sizes="(max-width: 640px) 55vw, 320px" /></div>
      </div>
    </div>
  );
}

function CaptureAction({ example, step, action, onSave, openMenu, onDismiss }: {
  example: Example;
  step: Step;
  action: RefObject<HTMLButtonElement | null>;
  onSave: () => void;
  openMenu: () => void;
  onDismiss: () => void;
}) {
  if (step === "saved") return <div className="ka-demo-result">
    <span className="ka-demo-result-icon">{example.id === "image" ? <Image src="/marketing/reading-corner.webp" alt="" width={36} height={40} /> : <example.icon />}</span>
    <div><strong>{example.id === "image" ? "A corner worth keeping." : "A little room to think."}</strong><span>{example.id === "text" ? "Selected passage attached to the source link" : example.id === "image" ? "Image file · Unsorted" : "fieldnotes.example · Unsorted"}</span></div>
    <SelectionCheckedIcon />
  </div>;
  if (step === "menu") return <div className="ka-demo-context" role="group" aria-label="Example browser context menu" onKeyDown={(event) => { if (event.key === "Escape") onDismiss(); }}>
    <span aria-hidden="true">{example.id === "image" ? "Open image in new tab" : "Copy selected text"}</span>
    <button ref={action} type="button" onClick={onSave}><LogoIcon className="size-5" />Save to Keepall<span aria-hidden="true">↵</span></button>
  </div>;
  if (example.id === "page") return <p className="ka-demo-toolbar-hint"><span aria-hidden="true">↑</span> One click on the Keepall icon. That&apos;s it.</p>;
  return <button ref={action} type="button" className="ka-demo-context-trigger" onClick={openMenu}>Right-click {example.id === "image" ? "the image" : "the selection"}<span aria-hidden="true">↗</span></button>;
}

export function CaptureDemo() {
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState<Step>("ready");
  const { toolbar, action, replay, replayingRef } = useDemoFocus(step, examples[selected].id);
  const example = examples[selected];
  const saved = step === "saved";

  function openMenu() {
    setStep("menu");
  }

  return (
    <div className="ka-demo">
      <div className="ka-demo-topline">
        <div className="ka-demo-choices" role="group" aria-label="Choose a capture example">
          {examples.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setStep("ready"); }}><item.icon />{item.label}</button>)}
        </div>
        <span className="ka-demo-label">Try it here</span>
      </div>
      <div className="ka-demo-browser" data-example={example.id} data-saved={saved}>
        <div className="ka-demo-chrome">
          <span className="ka-window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="ka-demo-address">fieldnotes.example / spaces</span>
          {example.id === "page" ? <button ref={toolbar} type="button" className="ka-demo-toolbar-save" aria-label="Save this page with Keepall" aria-disabled={saved} onClick={() => { if (!saved) setStep("saved"); }}><LogoIcon className="size-6" /></button> : <LogoIcon className="size-6" />}
        </div>
        <CaptureDocument example={example} openMenu={openMenu} />
        <div className="ka-demo-action-area">
          <CaptureAction example={example} step={step} action={action} onSave={() => setStep("saved")} openMenu={openMenu} onDismiss={() => { replayingRef.current = true; setStep("ready"); }} />
        </div>
      </div>
      <div className="ka-demo-bottom">
        <div role="status" aria-live="polite"><strong>{saved ? example.result : step === "menu" ? "Choose Save to Keepall from the menu." : example.instruction}</strong><span>{saved ? "Demo only. Nothing was added to your library." : example.id === "page" ? "Try the highlighted icon above." : "Use the button to try a right-click, even on your phone."}</span></div>
        {saved && <button ref={replay} type="button" className="ka-demo-reset" onClick={() => { replayingRef.current = true; setStep("ready"); }}>Try again <span aria-hidden="true">↺</span></button>}
      </div>
    </div>
  );
}
