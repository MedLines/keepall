import type { ReactNode } from "react";
import { MarketingFooter, MarketingHeader } from "./marketing-navigation";
import "./about/landing.css";
import "./help/help.css";
import "./website.css";

export function WebsitePage({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ka-page kh-page kw-page">
      <a href="#website-content" className="ka-skip">Skip to content</a>
      <MarketingHeader floating />
      <main id="website-content" className="ka-wrap kh-main">
        <article className="kh-article kw-article">
          <header className="kh-article-heading">
            <span className="ka-pill">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          <div className="kh-article-body kw-body">{children}</div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
