import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { guideGroups, getGuide, guides } from "./guides";
import { InstallVisual } from "./guide-visual";
import capturePoster from "../../../public/marketing/capture-text-poster.webp";
import tagsScreenshot from "../../../public/marketing/app-tags.webp";
import importScreenshot from "../../../public/help/import-settings.webp";
import backupScreenshot from "../../../public/help/backup-settings.webp";
import saveScreenshot from "../../../public/help/save-panel.webp";
import articleScreenshot from "../../../public/marketing/app-article-reader.webp";
import pdfScreenshot from "../../../public/marketing/app-pdf-reader.webp";
import previewScreenshot from "../../../public/marketing/app-preview-document.webp";
import noteScreenshot from "../../../public/help/note-editor.webp";
import searchScreenshot from "../../../public/marketing/app-search-files.webp";
import imageToolsScreenshot from "../../../public/marketing/app-image-tools.webp";

export const metadata: Metadata = {
  title: "Help · Keepall",
  description: "Guides to saving, reading documents and articles, writing notes, searching, and backing up your Keepall library.",
};

const thumbnails: Record<string, StaticImageData> = {
  "getting-started": saveScreenshot,
  "saved-articles": articleScreenshot,
  "chrome-capture": capturePoster,
  "collections-and-tags": tagsScreenshot,
  "images-and-videos": imageToolsScreenshot,
  import: importScreenshot,
  "storage-and-backups": backupScreenshot,
  offline: articleScreenshot,
  search: searchScreenshot,
  documents: pdfScreenshot,
  preview: previewScreenshot,
  notes: noteScreenshot,
};

export default function HelpPage() {
  return <>
    <section className="kh-intro"><p className="ka-pill">Keepall help</p><h1>Save, read,<br /><span>and find your items.</span></h1><p>Choose a guide for files, search, notes, or backups.</p></section>
    <nav className="kh-start" aria-label="Quick start">
      <Link href="/help/install-keepall#computer" className="kh-start-card"><InstallVisual compact /><div className="kh-start-copy"><span className="kh-eyebrow">On your computer or phone</span><h2>Install Keepall</h2><p>Open your library from its own app icon.</p><span className="kh-card-action">Read the install guide <ArrowRightIcon /></span></div></Link>
      <Link href="/help/chrome-capture#install" className="kh-start-card"><div className="kh-extension-preview"><Image src={capturePoster} alt="A real Keepall Capture demo showing selected text on a website" width={1080} height={1040} sizes="(max-width: 650px) 90vw, 520px" /></div><div className="kh-start-copy"><span className="kh-eyebrow">For Chrome on your computer</span><h2>Save from Chrome</h2><p>Save pages, images, and selected text with Keepall Capture.</p><span className="kh-card-action">Set up Keepall Capture <ArrowRightIcon /></span></div></Link>
    </nav>
    <section className="kh-guides" aria-labelledby="guides-title">
      <div className="kh-list-heading"><h2 id="guides-title">Help guides</h2><span>{guides.length} guides · Step-by-step instructions</span></div>
      <nav className="kh-group-nav" aria-label="Guide topics">{guideGroups.map(group => <a key={group.id} href={`#${group.id}`}>{group.title}</a>)}</nav>
      {guideGroups.map(group => <section className="kh-guide-group" key={group.id} id={group.id} aria-labelledby={`${group.id}-title`}>
        <h3 id={`${group.id}-title`} className="kh-group-title">{group.title}</h3>
        {group.slugs.map((slug, index) => {
          const guide = getGuide(slug)!;
          return <Link key={guide.slug} href={`/help/${guide.slug}`} className="kh-guide-row"><span className="kh-guide-number">{String(index + 1).padStart(2, "0")}</span><div className="kh-guide-copy"><span className="kh-eyebrow">{guide.category} · {guide.minutes}</span><h4>{guide.title}</h4><p>{guide.summary}</p></div><div className="kh-guide-thumbnail">{slug === "install-keepall" ? <InstallVisual compact /> : <Image src={thumbnails[slug]} alt="" sizes="140px" />}</div><ArrowRightIcon /></Link>;
        })}
        {group.id === "read-and-explore" && <nav className="kh-topic-links" aria-label="Image and video topics"><span className="kh-eyebrow">Working with media</span><Link href="/help/images-and-videos#palette">Palette <ArrowRightIcon /></Link><Link href="/help/images-and-videos#image-text">Read text <ArrowRightIcon /></Link><Link href="/help/images-and-videos#videos">Videos <ArrowRightIcon /></Link></nav>}
      </section>)}
    </section>
    <aside className="kh-contact"><div><span className="ka-pill">Still need help?</span><h2>Report a problem.</h2><p>Include your browser, the steps you took, and what happened.</p></div><Link href="/contact" className="ka-button">Contact <ArrowRightIcon /></Link></aside>
  </>;
}
