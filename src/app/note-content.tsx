"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
  format: "plain" | "markdown";
  className?: string;
  headingStart?: 2 | 3;
};

export function NoteContent({ content, format, className = "", headingStart = 3 }: Props) {
  if (format === "plain") {
    return <p className={`whitespace-pre-wrap break-words text-base leading-relaxed ${className}`}>{content}</p>;
  }

  return (
    <div className={`note-markdown min-w-0 break-words ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (!href || !/^(https?:|mailto:)/i.test(href)) return <span>{children}</span>;
            return <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text-primary">{children}</a>;
          },
          img({ alt }) {
            return <span className="text-text-secondary">Image: {alt || "no description"}</span>;
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
