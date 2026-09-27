import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
          <nav className="help-contents" aria-label="On this page">
            <p className="public-eyebrow">On this page</p>
            <ol>{guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
          </nav>
          <div className="help-article-body">
            {guide.sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.steps && <ol className="help-steps">{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
                {section.note && <p className="help-note">{section.note}</p>}
                {section.images && <div className="help-figures">{section.images.map((image) => <figure key={image.src}><Image src={image.src} width={image.width} height={image.height} alt={image.alt} sizes="(max-width: 640px) calc(100vw - 32px), 520px" /><figcaption>{image.caption}</figcaption></figure>)}</div>}
                {section.links && <div className="help-section-links">{section.links.map((link) => <Link key={link.href} href={link.href}>{link.label}<span aria-hidden="true"> →</span></Link>)}</div>}
              </section>
            ))}
          </div>
          {guide.action && <Link href={guide.action.href} className="public-button public-button-primary">{guide.action.label} <span aria-hidden="true">↗</span></Link>}
          <div className="help-article-end"><Link href="/help">Browse all guides <span aria-hidden="true">→</span></Link></div>
        </article>
        <PublicFooter />
      </div>
    </main>
  );
}
