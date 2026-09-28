import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "../../shell-icons";
import { getGuide, guides } from "../guides";
import { GuideFigure } from "../guide-visual";

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
  const next = guides[(guides.indexOf(guide) + 1) % guides.length];
  return <>
    <div className="kh-guide-layout">
      <aside className="kh-sidebar"><Link href="/help" className="kh-back"><ArrowLeftIcon />All guides</Link><nav aria-label="On this page"><p className="kh-eyebrow">In this guide</p><ol>{guide.sections.map((section, index) => <li key={section.id}><a href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a></li>)}</ol></nav><Link href="/help" className="kh-all-guides">Browse all guides <ArrowRightIcon /></Link></aside>
      <article className="kh-article">
        <header className="kh-article-heading"><span className="ka-pill">{guide.category}</span><span className="kh-read-time">{guide.minutes}</span><h1>{guide.title}</h1><p>{guide.summary}</p></header>
        <div className="kh-article-body">{guide.sections.map((section, index) => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
          <div className="kh-section-heading"><span>{String(index + 1).padStart(2, "0")}</span><h2 id={`${section.id}-title`}>{section.title}</h2></div>
          {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          {section.steps && <ol className="kh-steps">{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}
          {section.visual && <GuideFigure visual={section.visual} />}
          {section.note && <p className="kh-note">{section.note}</p>}
          {section.images && <div className="kh-permissions">{section.images.map(image => <figure className="kh-figure" key={image.src}><Image src={image.src} width={image.width} height={image.height} alt={image.alt} sizes="(max-width: 800px) 90vw, 740px" /><figcaption>{image.caption}</figcaption></figure>)}</div>}
          {section.links && <div className="kh-section-links">{section.links.map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowRightIcon /></Link>)}</div>}
        </section>)}</div>
        {guide.action && <Link href={guide.action.href} className="ka-button kh-article-action">{guide.action.label}<ArrowRightIcon /></Link>}
        <Link href={`/help/${next.slug}`} className="kh-next-guide"><div><span className="kh-eyebrow">Next guide</span><strong>{next.title}</strong></div><ArrowRightIcon /></Link>
      </article>
    </div>
  </>;
}
