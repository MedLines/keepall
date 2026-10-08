import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingFooter, MarketingHeader } from "../marketing-navigation";
import "../about/landing.css";
import "../help/help.css";
import "../website.css";

type ArticleContents = { href: string; label: string }[];

function ContentsLinks({ contents }: { contents: ArticleContents }) {
  return (
    <ul className="kb-contents-links">
      {contents.map(({ href, label }) => (
        <li key={href}><a href={href}>{label}</a></li>
      ))}
    </ul>
  );
}

export function BlogArticle({
  title,
  eyebrow,
  description,
  readTime,
  contents,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  readTime: string;
  contents: ArticleContents;
  children: ReactNode;
}) {
  return (
    <div className="ka-page kh-page kw-page kb-article-page">
      <a href="#website-content" className="ka-skip">Skip to content</a>
      <MarketingHeader floating />
      <main className="ka-wrap kh-main">
        <div className="kb-article-grid">
          <aside className="kb-sidebar" aria-label="Article navigation">
            <div className="kb-sidebar-meta">
              <Link href="/blog" className="kb-all-articles">← All articles</Link>
              <span className="kb-read-time">{readTime}</span>
            </div>
            <nav className="kb-desktop-contents" aria-label="In this article">
              <p className="kb-contents-label">In this article</p>
              <ContentsLinks contents={contents} />
            </nav>
            <details className="kb-mobile-contents">
              <summary>In this article</summary>
              <nav aria-label="In this article">
                <ContentsLinks contents={contents} />
              </nav>
            </details>
          </aside>
          <article id="website-content" className="kh-article kb-editorial-article">
            <header className="kh-article-heading kb-editorial-heading">
              <span className="kb-category">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </header>
            <div className="kh-article-body kw-body kb-editorial-body">{children}</div>
          </article>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
