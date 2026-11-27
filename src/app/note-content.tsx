"use client";

import { createContext, useContext, type InputHTMLAttributes } from "react";
import Markdown, { defaultUrlTransform, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { rehypeTaskList } from "./rehype-task-list";
import { remarkHighlight } from "./remark-highlight";
import { parseNoteImageLine, toggleNoteTaskAt } from "@/domain/note";
import { LocalAssetImage as LocalNoteImage } from "./local-asset-image";

type Props = {
  content: string;
  format: "plain" | "markdown";
  className?: string;
  headingStart?: 2 | 3;
  pendingImageUrls?: ReadonlyMap<string, string>;
  allowLocalImages?: boolean;
  /** Makes Markdown checklist boxes clickable; receives the note's content with that one box flipped. */
  onTaskToggle?: (content: string) => void;
};

const TaskToggleContext = createContext<{ content: string; onTaskToggle: (content: string) => void } | null>(null);

// Module-level so a re-render after a save keeps the same <input>, and with it keyboard focus.
function TaskCheckbox({ node, checked }: InputHTMLAttributes<HTMLInputElement> & ExtraProps) {
  const toggle = useContext(TaskToggleContext);
  const offset = node?.properties.dataTaskOffset;
  const label = String(node?.properties.ariaLabel ?? "Checklist item");
  if (!toggle || typeof offset !== "number") return <input type="checkbox" checked={checked} disabled readOnly aria-label={label} />;
  return <input type="checkbox" checked={Boolean(checked)} aria-label={label} onChange={() => {
    const next = toggleNoteTaskAt(toggle.content, offset);
    if (next !== toggle.content) toggle.onTaskToggle(next);
  }} />;
}


function PlainNoteContent({ content, className, pendingImageUrls }: {
  content: string;
  className: string;
  pendingImageUrls?: ReadonlyMap<string, string>;
}) {
  const lines = content.split(/\r?\n/);
  const segments: { text?: string; image?: { alt: string; assetId: string } }[] = [];
  let textLines: string[] = [];
  for (const line of lines) {
    const image = parseNoteImageLine(line);
    if (!image) {
      textLines.push(line);
      continue;
    }
    if (textLines.length) segments.push({ text: textLines.join("\n").trimEnd() });
    segments.push({ image });
    textLines = [];
  }
  if (textLines.length) segments.push({ text: textLines.join("\n").trimStart() });
  if (!segments.some((segment) => segment.image)) {
    return <p className={`whitespace-pre-wrap break-words text-base leading-relaxed ${className}`}>{content}</p>;
  }
  return <div className={className}>{segments.map((segment, index) => segment.image
    ? <LocalNoteImage key={index} {...segment.image} pendingImageUrls={pendingImageUrls} />
    : <p key={index} className="whitespace-pre-wrap break-words text-base leading-relaxed">{segment.text}</p>)}</div>;
}

export function NoteContent({ content, format, className = "", headingStart = 3, pendingImageUrls, allowLocalImages = true, onTaskToggle }: Props) {
  if (format === "plain") {
    if (!allowLocalImages) return <p className={`whitespace-pre-wrap break-words text-base leading-relaxed ${className}`}>{content}</p>;
    return <PlainNoteContent content={content} className={className} pendingImageUrls={pendingImageUrls} />;
  }

  return (
    <div className={`note-markdown min-w-0 break-words ${className}`}>
      <TaskToggleContext.Provider value={onTaskToggle ? { content, onTaskToggle } : null}>
        <Markdown
          skipHtml={!allowLocalImages}
          remarkPlugins={[remarkGfm, remarkHighlight]}
          rehypePlugins={[rehypeTaskList]}
          urlTransform={(url, key, node) => key === "src" && node.tagName === "img" && /^keepall-image:[A-Za-z0-9_-]+$/.test(url)
            ? url : defaultUrlTransform(url)}
          components={{
            a({ href, children }) {
              if (!href || !/^(https?:|mailto:)/i.test(href)) return <span>{children}</span>;
              return <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text-primary">{children}</a>;
            },
            img({ alt, src }) {
              const localId = typeof src === "string"
                ? src.match(/^keepall-image:([A-Za-z0-9_-]+)$/)?.[1]
                : undefined;
              return localId && allowLocalImages
                ? <LocalNoteImage assetId={localId} alt={alt ?? ""} pendingImageUrls={pendingImageUrls} />
                : <span className="text-text-secondary">Image: {alt || "no description"}</span>;
            },
            input: TaskCheckbox,
            h1({ children }) { return headingStart === 2 ? <h2>{children}</h2> : <h3>{children}</h3>; },
            h2({ children }) { return headingStart === 2 ? <h3>{children}</h3> : <h4>{children}</h4>; },
            h3({ children }) { return headingStart === 2 ? <h4>{children}</h4> : <h5>{children}</h5>; },
            h4({ children }) { return headingStart === 2 ? <h5>{children}</h5> : <h6>{children}</h6>; },
            h5({ children }) { return <h6>{children}</h6>; },
            h6({ children }) { return <h6>{children}</h6>; },
          }}
        >
          {content}
        </Markdown>
      </TaskToggleContext.Provider>
    </div>
  );
}
