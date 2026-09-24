import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "../../public-site";
import { getGuide, guides } from "../guides";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  return guide ? { title: `${guide.title} · Keepall Help`, description: guide.summary } : {};
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  return (
    <main className="public-page help-page">
      <div className="public-wrap">
        <PublicHeader />
        <article className="help-article">
          <Link href="/help" className="help-back">← All guides</Link>
          <p className="public-eyebrow">{guide.category} · {guide.minutes}</p>
          <h1>{guide.title}</h1>
          <p className="help-article-summary">{guide.summary}</p>
          <div className="help-article-body">
            {guide.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}</section>)}
          </div>
          {guide.action && <Link href={guide.action.href} className="public-button public-button-primary">{guide.action.label} <span aria-hidden="true">↗</span></Link>}
          <div className="help-article-end"><Link href="/help">Browse all guides <span aria-hidden="true">→</span></Link></div>
        </article>
        <PublicFooter />
      </div>
    </main>
  );
}
