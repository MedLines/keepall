import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { ReadingDemo, PdfDemo, NotesDemo, ImageToolsDemo, VideoDemo, PreviewDemo, ImportDemo } from "./feature-demos";

const features = [
  { id: "reading", className: "ka-bento-reading", title: "Saved articles", description: "A clean reading view, available offline.", href: "/help/saved-articles", Demo: ReadingDemo },
  { id: "pdfs", className: "ka-bento-pdf", title: "PDFs, kept close", description: "Browse pages, zoom in, and pick up where you left off.", href: "/help/documents", Demo: PdfDemo },
  { id: "image-tools", className: "ka-bento-images", title: "Palettes & image text", description: "Copy image colors and recognized English text.", href: "/help/images-and-videos#palette", Demo: ImageToolsDemo },
  { id: "notes", className: "ka-bento-notes", title: "Markdown & text", description: "Write notes or edit Markdown and text files.", href: "/help/notes", Demo: NotesDemo },
  { id: "video", className: "ka-bento-video", title: "Local video", description: "Press play, even offline.", href: "/help/images-and-videos#videos", Demo: VideoDemo },
  { id: "preview", className: "ka-bento-preview", title: "Preview", description: "Browse saves without leaving your library.", href: "/help/preview", Demo: PreviewDemo },
  { id: "import", className: "ka-bento-import", title: "Import files & folders", description: "Import bookmarks, supported files, or a folder.", href: "/help/import", Demo: ImportDemo },
];

export function FeatureBento() {
  return <section className="ka-bento-section ka-wrap" aria-labelledby="features-title">
    <div className="ka-section-heading"><h2 id="features-title">More ways to use your saves.</h2></div>
    <div className="ka-bento">
      {features.map(({ id, className, title, description, href, Demo }) =>
        <article key={id} id={id} className={`ka-bento-card ${className}`} aria-labelledby={`${id}-title`}>
          <div className="ka-bento-copy"><h3 id={`${id}-title`}><Link href={href}>{title}<ArrowRightIcon /></Link></h3><p>{description}</p></div>
          <div className="ka-bento-visual"><Demo /></div>
        </article>
      )}
    </div>
    <p className="ka-bento-footnote">Once Keepall is cached, locally saved content works offline. Original websites and fetching new content need a connection. <Link href="/help/offline">Offline guide</Link>. Previews, article fetching, and website icons use network requests. Visits use Vercel Web Analytics. <Link href="/privacy">Privacy details</Link>.</p>
  </section>;
}
