import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { ReadingDemo, NotesDemo, ImageToolsDemo, VideoDemo, PreviewDemo, ImportDemo } from "./feature-demos";

const features = [
  { id: "reading", className: "ka-bento-reading", title: "Read articles and PDFs.", description: "Read offline articles, or search and zoom through PDFs.", href: "/help/saved-articles", link: "Reading guide", Demo: ReadingDemo, visualFirst: true },
  { id: "notes", className: "ka-bento-notes", title: "Write a note.", description: "Write Markdown, add images, or edit imported text files.", href: "/help/notes", link: "Notes guide", Demo: NotesDemo, visualFirst: false },
  { id: "image-tools", className: "ka-bento-images", title: "Look inside an image.", description: "Find extracted colors and recognized English screenshot text.", href: "/help/images-and-videos#palette", link: "Image tools guide", Demo: ImageToolsDemo, visualFirst: false },
  { id: "video", className: "ka-bento-video", title: "Keep a video.", description: "Play local MP4 and WebM files offline.", href: "/help/images-and-videos#videos", link: "Video guide", Demo: VideoDemo, visualFirst: true },
  { id: "preview", className: "ka-bento-preview", title: "Take a quick look.", description: "Move between saves in Preview.", href: "/help/preview", link: "Preview guide", Demo: PreviewDemo, visualFirst: false },
  { id: "import", className: "ka-bento-import", title: "Bring your files.", description: "Import bookmarks, supported files, or a whole folder.", href: "/help/import", link: "Import guide", Demo: ImportDemo, visualFirst: true },
];

export function FeatureBento() {
  return <section className="ka-bento-section ka-wrap" aria-labelledby="features-title">
    <div className="ka-section-heading"><h2 id="features-title">More ways to use your saves.</h2></div>
    <div className="ka-bento">
      {features.map(({ id, className, title, description, href, link, Demo, visualFirst }) => {
        const copy = <div className="ka-bento-copy"><h3 id={`${id}-title`}>{title}</h3><p>{description}</p><Link href={href} className="ka-text-link" aria-label={link}>Guide <ArrowRightIcon /></Link></div>;
        const visual = <div className="ka-bento-visual"><Demo /></div>;
        return <article key={id} id={id} className={`ka-bento-card ${className}`} aria-labelledby={`${id}-title`}>{visualFirst ? <>{visual}{copy}</> : <>{copy}{visual}</>}</article>;
      })}
    </div>
    <p className="ka-bento-footnote">Once Keepall is cached, locally saved content works offline. Original websites and fetching new content need a connection. <Link href="/help/offline">Offline guide</Link>. Previews, article fetching, and website icons use network requests. Visits use Vercel Web Analytics. <Link href="/privacy">Privacy details</Link>.</p>
  </section>;
}
