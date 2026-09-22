"use client";

import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseNoteImageLine } from "@/domain/note";
import { useAssetObjectUrl } from "./use-asset-object-url";

type Props = {
  content: string;
  format: "plain" | "markdown";
  className?: string;
  headingStart?: 2 | 3;
  pendingImageUrls?: ReadonlyMap<string, string>;
};

function LocalNoteImage({ assetId, alt, pendingImageUrls }: {
  assetId: string;
  alt: string;
  pendingImageUrls?: ReadonlyMap<string, string>;
}) {
  const pendingUrl = pendingImageUrls?.get(assetId);
  const savedUrl = useAssetObjectUrl(pendingUrl ? null : assetId);
  const url = pendingUrl ?? savedUrl;

  if (!url) {
    return <span role="img" aria-label={alt || "Image"} className="text-sm text-text-secondary">Loading image…</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- local IndexedDB object URL
  return <img src={url} alt={alt || "Image"} className="media-outline my-5 block h-auto max-h-[48rem] max-w-full rounded-input object-contain" />;
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

export function NoteContent({ content, format, className = "", headingStart = 3, pendingImageUrls }: Props) {
  if (format === "plain") {
    return <PlainNoteContent content={content} className={className} pendingImageUrls={pendingImageUrls} />;
  }

  return (
    <div className={`note-markdown min-w-0 break-words ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
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
            return localId
              ? <LocalNoteImage assetId={localId} alt={alt ?? ""} pendingImageUrls={pendingImageUrls} />
              : <span className="text-text-secondary">Image: {alt || "no description"}</span>;
          },
          input({ checked }) {
            return <input type="checkbox" checked={checked} disabled readOnly aria-label={checked ? "Completed checklist item" : "Incomplete checklist item"} />;
          },
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
    </div>
  );
}
