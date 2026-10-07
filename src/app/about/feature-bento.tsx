import Image from "next/image";
import Link from "next/link";
import readingDetail from "./details/reading.webp";
import notesDetail from "./details/notes.webp";
import paletteDetail from "./details/palette.webp";
import imageTextDetail from "./details/image-text.webp";
import videoDetail from "./details/video.webp";
import previewDetail from "./details/preview.webp";
import articleCover from "../../../public/marketing/reading-corner.webp";
import { ArrowRightIcon } from "../shell-icons";

export function FeatureBento() {
  return <section className="ka-bento-section ka-wrap" aria-labelledby="features-title">
    <div className="ka-section-heading"><h2 id="features-title">More ways to use your saves.</h2></div>
    <div className="ka-bento">
      <article id="reading" className="ka-bento-card" aria-labelledby="reading-title">
        <div className="ka-bento-visual ka-reading-details"><div className="ka-file-cover"><Image src={articleCover} alt="A sunlit reading corner" sizes="90px" /><span>Article</span></div><div className="ka-reading-snippet"><Image src={readingDetail} alt="A complete heading and opening paragraph from Keepall's PDF reader" sizes="220px" /><span>PDF</span></div></div>
        <div className="ka-bento-copy"><h3 id="reading-title">Read articles and PDFs.</h3><p>Read saved articles offline, and open PDFs with zoom and text search.</p><Link href="/help/saved-articles" className="ka-text-link">Reading guide <ArrowRightIcon /></Link></div>
      </article>
      <article className="ka-bento-card" aria-labelledby="notes-title">
        <div className="ka-bento-visual ka-notes-detail"><Image src={notesDetail} alt="A rendered Markdown heading and complete list in Keepall" sizes="(max-width: 700px) 85vw, 300px" /><span className="ka-file-types" aria-hidden="true">MD / TXT</span></div>
        <div className="ka-bento-copy"><h3 id="notes-title">Write a note.</h3><p>Write Markdown with local images, or edit imported MD and TXT files.</p><Link href="/help/notes" className="ka-text-link">Notes guide <ArrowRightIcon /></Link></div>
      </article>
      <article id="image-tools" className="ka-bento-card" aria-labelledby="image-tools-title">
        <div className="ka-bento-visual ka-image-details"><Image src={paletteDetail} alt="Keepall's complete extracted palette with six colors" sizes="(max-width: 700px) 85vw, 300px" /><Image src={imageTextDetail} alt="Complete English text recognized from a saved screenshot" sizes="220px" /></div>
        <div className="ka-bento-copy"><h3 id="image-tools-title">Look inside an image.</h3><p>Extract colors and recognize English screenshot text to search later.</p><Link href="/help/images-and-videos#palette" className="ka-text-link">Image tools guide <ArrowRightIcon /></Link></div>
      </article>
      <article className="ka-bento-card" aria-labelledby="video-title">
        <div className="ka-bento-visual"><Image src={videoDetail} alt="Keepall's complete local video player with playback controls" sizes="(max-width: 700px) 85vw, 300px" /></div>
        <div className="ka-bento-copy"><h3 id="video-title">Keep a video.</h3><p>Play local MP4 and WebM videos offline once Keepall is cached.</p><Link href="/help/images-and-videos#videos" className="ka-text-link">Video guide <ArrowRightIcon /></Link></div>
      </article>
      <article className="ka-bento-card" aria-labelledby="preview-title">
        <div className="ka-bento-visual ka-preview-detail"><Image src={previewDetail} alt="A complete document Preview in Keepall with Back, Next, and Open full item controls" sizes="180px" /></div>
        <div className="ka-bento-copy"><h3 id="preview-title">Take a quick look.</h3><p>Browse saves in Preview without leaving your place in the library.</p><Link href="/help/preview" className="ka-text-link">Preview guide <ArrowRightIcon /></Link></div>
      </article>
      <article className="ka-bento-card" aria-labelledby="import-title">
        <div className="ka-bento-visual ka-import-illustration" aria-hidden="true"><div className="ka-import-folder"><span className="ka-import-file">PDF</span><span className="ka-import-file">MD</span><span className="ka-import-file">TXT</span><svg viewBox="0 0 220 112"><path d="M15 17Q15 10 23 10H79L94 25H198Q207 25 207 34V95Q207 103 199 103H23Q15 103 15 95Z" /></svg></div></div>
        <div className="ka-bento-copy"><h3 id="import-title">Bring your files.</h3><p>Import bookmarks, supported files, or a whole folder at once.</p><Link href="/help/import" className="ka-text-link">Import guide <ArrowRightIcon /></Link></div>
      </article>
    </div>
    <p className="ka-bento-footnote">Once Keepall is cached, locally saved content works offline. Original websites and fetching new content need a connection. <Link href="/help/offline">Offline guide</Link>. Previews, article fetching, and website icons use network requests. Visits use Vercel Web Analytics. <Link href="/privacy">Privacy details</Link>.</p>
  </section>;
}
