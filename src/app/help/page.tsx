import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { guides } from "./guides";
import { InstallVisual } from "./guide-visual";

export const metadata: Metadata = {
  title: "Help · Keepall",
  description: "Visual guides to installing Keepall, saving from the web, organizing your library, and making backups.",
};

const thumbnails: Record<string, string> = {
  "getting-started": "/marketing/app-library.webp",
  "chrome-capture": "/marketing/capture-text-poster.webp",
  "install-keepall": "/marketing/app-library.webp",
  "collections-and-tags": "/marketing/app-tags.webp",
  "images-and-videos": "/marketing/app-collection.webp",
  import: "/help/import-settings.webp",
  "storage-and-backups": "/help/backup-settings.webp",
  offline: "/marketing/app-search.webp",
};

export default function HelpPage() {
  return <>
    <section className="kh-intro"><p className="ka-pill">Keepall help</p><h1>A guide for every<br /><span>part of your library.</span></h1><p>See how to save, organize, and find your items.<br />Start with a walkthrough or choose a guide below.</p></section>
    <nav className="kh-start" aria-label="Quick start">
      <Link href="/help/install-keepall#computer" className="kh-start-card"><InstallVisual compact /><div className="kh-start-copy"><span className="kh-eyebrow">On your computer or phone</span><h2>Install Keepall</h2><p>Open your library from its own app icon.</p><span className="kh-card-action">See the steps <ArrowRightIcon /></span></div></Link>
      <Link href="/help/chrome-capture#install" className="kh-start-card"><div className="kh-extension-preview"><Image src="/marketing/capture-text-poster.webp" alt="A real Keepall Capture demo showing selected text on a website" width={1080} height={1040} sizes="(max-width: 650px) 90vw, 520px" /></div><div className="kh-start-copy"><span className="kh-eyebrow">For Chrome on your computer</span><h2>Save from any tab</h2><p>Set up the extension and make your first save.</p><span className="kh-card-action">Set up Keepall Capture <ArrowRightIcon /></span></div></Link>
    </nav>
    <section className="kh-guides" aria-labelledby="guides-title"><div className="kh-list-heading"><h2 id="guides-title">Explore the guides</h2><span>{guides.length} guides · Step-by-step instructions</span></div>
      {guides.map((guide, index) => <Link key={guide.slug} href={`/help/${guide.slug}`} className="kh-guide-row"><span className="kh-guide-number">{String(index + 1).padStart(2, "0")}</span><div className="kh-guide-copy"><span className="kh-eyebrow">{guide.category} · {guide.minutes}</span><h3>{guide.title}</h3><p>{guide.summary}</p></div><div className="kh-guide-thumbnail"><Image src={thumbnails[guide.slug]} alt="" width={240} height={144} sizes="140px" /></div><ArrowRightIcon /></Link>)}
    </section>
    <aside className="kh-contact"><div><span className="ka-pill">Still need help?</span><h2>Tell us what went wrong.</h2><p>Include your browser and what you expected to happen.<br />You’ll need a GitHub account to report an issue.</p></div><a href="https://github.com/MedLines/keepall/issues" target="_blank" rel="noreferrer" className="ka-button">Report a problem <ArrowRightIcon /></a></aside>
  </>;
}
