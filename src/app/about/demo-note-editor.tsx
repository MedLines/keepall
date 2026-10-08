"use client";

import { useCallback, useRef } from "react";
import { ScrollPanel } from "@/components/ui/scroll-panel";

export function DemoNoteEditor({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  const initialContent = useRef(content);
  const attachEditor = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    node.textContent = initialContent.current;
    node.focus();
  }, []);

  return <ScrollPanel className="kd-note-editor" viewportProps={{ tabIndex: -1 }}>
    <div ref={attachEditor} className="kd-note-editable" contentEditable="plaintext-only" role="textbox" aria-multiline="true" aria-label="Edit sample note" spellCheck={false}
      onInput={event => onChange(event.currentTarget.innerText)} />
  </ScrollPanel>;
}
