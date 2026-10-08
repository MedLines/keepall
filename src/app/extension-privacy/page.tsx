import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, LogoIcon } from "../shell-icons";

export const metadata: Metadata = {
  title: "Keepall Capture privacy · Keepall",
  description: "How the Keepall Capture Chrome extension handles saved links, notes, images, and local files.",
};

export default function ExtensionPrivacyPage() {
  return (
    <ScrollPanel role="main" className="h-dvh bg-bg-shell" viewportClassName="p-2.5" contentClassName="!grid min-h-full">
      <div className="library-panel min-h-full bg-bg-canvas px-5 py-5 sm:px-8 sm:py-7">
        <header className="mx-auto flex w-full max-w-4xl items-center">
          <Link href="/" aria-label="Keepall home" className="keepall-logo-link flex min-h-11 items-center rounded-control-lg px-2 text-text-primary">
            <LogoIcon className="size-8" />
            <span className="text-lg font-medium">keepall</span>
          </Link>
        </header>

        <article className="mx-auto mt-12 w-full max-w-3xl pb-16 sm:mt-16">
          <Link href="/" className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm font-medium">
            <ArrowLeftIcon className="size-4" />
            Back to library
          </Link>
          <p className="mt-7 text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">Keepall Capture</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Privacy</h1>
          <p className="mt-3 text-sm text-text-secondary">Last updated October 8, 2026</p>
          <p className="mt-3 text-sm text-text-secondary">This page covers the Chrome extension. Read <Link className="font-medium text-text-primary underline underline-offset-2" href="/privacy">Keepall&apos;s app-wide privacy page</Link> for browser storage, network requests, and backups.</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-text-secondary">
            <section>
              <h2 className="text-lg font-semibold text-text-primary">What the extension handles</h2>
              <p className="mt-2">When you click the toolbar button or use Alt/Option+K, Keepall Capture reads the current page URL and title. If you use the capture drawer, it also handles the title, note, Markdown choice, collection, and tags you enter or select. When you choose Save to Keepall from a link&apos;s right-click menu, it reads and saves that link&apos;s destination URL. When you choose Save to Keepall from an image&apos;s right-click menu, it reads that image&apos;s URL and bytes and the source page URL or containing tweet link. When you highlight text and choose Save to Keepall, it reads that selected text and its source page or frame URL and saves the text as a note on the source link. It does not read the full page text, your browsing history, cookies, or passwords.</p>
              <p className="mt-2">When you choose Add files, the extension reads only the files you select, including their names, types, sizes, and contents. Supported files include PNG, JPEG, GIF, WebP, and AVIF images; MP4 and WebM videos; and TXT, Markdown, and PDF documents. An explicit image paste into the drawer reads the pasted image; the extension does not automatically read your clipboard. It also handles captions, video titles and notes, text-file edits, the current page&apos;s source URL, and the collections or tags you choose. Local files become independent library items. Multiple images can be saved as one gallery or separate items.</p>
              <p className="mt-2">Plain-text and Markdown preview run locally using code packaged with the extension. Preview does not execute embedded HTML or load remote images. Bulk import opens the app&apos;s import dialog. Open Keepall library in the extension icon&apos;s menu opens or focuses your library without capturing the current page.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Where your library lives</h2>
              <p className="mt-2">Save notifications temporarily keep the library address and saved item ID in browser-session storage for Open in Keepall, Organize, and Undo. Undo uses a short-lived local receipt and is available only for newly saved items. These records are stored locally.</p>
              <p className="mt-2">The extension passes the capture to the Keepall web app running in your browser. Keepall saves your library in that browser profile&apos;s local IndexedDB. You do not need a Keepall account, and the extension does not sync your library to a cloud account. For link saves, the extension temporarily holds a pending capture in Chrome extension storage so a failed save can be retried. This can include the link URL, title, entered note and format, and selected collection or tags. Pending link captures expire after ten minutes and are removed at the next cleanup; confirmed captures are removed immediately. Image bytes are passed to the local library without being stored in extension storage. The selected-text save action passes the passage directly to the local library without keeping it in extension storage. Your selected Keepall address and extension appearance preference remain in extension storage until you change them or remove the extension.</p>
              <p className="mt-2">Selected files, pasted images, and entered file notes remain in the drawer&apos;s tab memory while you prepare or retry a save. Closing the drawer keeps unfinished drafts; discarding them or reloading or closing the tab removes them from that memory. File contents pass through extension messages to the hidden Keepall bridge within your browser, then into the app origin&apos;s local IndexedDB. They are not uploaded to cloud storage or written to Chrome extension storage.</p>
              <p className="mt-2">The bridge temporarily holds filenames, file metadata, transfer progress, and results in memory. Its file-byte buffers are released when processing settles, a receiving transfer is cancelled, or the session expires. Inactive transfer sessions expire after ten minutes and are removed by periodic cleanup. Separate editor records in browser-session storage contain tab and editor identifiers, source and library addresses, saved item IDs, and action tokens, but no file bytes or file-note contents. These editor records expire after ten minutes of inactivity and are removed during cleanup or when the source tab closes. Saved-file action tokens also expire after ten minutes.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Network requests</h2>
              <p className="mt-2">The extension loads a Keepall page over HTTPS, or a configured localhost address over HTTP, to write to the same local library without opening a visible tab. This page request does not include your captured URL, note, or file bytes in its URL. Selecting local files or pasting an image transfers their contents within your browser rather than uploading them to a server. For a selected image, the extension requests its bytes directly from the image host; Chrome may ask you to allow access to that host. You can optionally grant access to all websites once in the extension&apos;s Options page to avoid repeated image-host prompts, and use the link there to manage or remove website access in Chrome. Keepall downloads an image only when you choose the right-click save action. The image host receives the request, and the bytes pass to the Keepall page in your browser for local storage. When you view saved links in Keepall, the app may send a saved link URL to Keepall&apos;s preview service to fetch a title, description, or image from the linked website. The preview service and linked website may receive that URL. Notes, collections, and tags are not sent with preview requests.</p>
              <p className="mt-2">Keepall is hosted on Vercel. Normal visits to Keepall may produce hosting logs, and Vercel Web Analytics records aggregate page-view information. The extension does not use saved library content for analytics or advertising.</p>
              <p className="mt-2">The app may load website icons from Google&apos;s favicon service, sending the saved link&apos;s hostname, or from the original website. Choosing to save or update an article in Keepall sends that link&apos;s URL to the server to request the public page and supported images. Your personal notes, collections, and tags are not included.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Use, sharing, and control</h2>
              <p className="mt-2">Information received through Chrome permissions is used to save and organize the content you choose and open your library. We do not sell your saved data or use it for advertising. You can edit saved items, move them to Trash, and permanently delete them from Trash. Clearing the site&apos;s browser storage removes the local library. Removing the extension clears its local settings and pending captures, but leaves the library in Keepall&apos;s browser storage. Copies in existing backup files remain until you remove them. Because the library is local, make a backup in Keepall Settings before clearing browser data.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Contact</h2>
              <p className="mt-2">For questions or a privacy concern, use the <Link className="font-medium text-text-primary underline underline-offset-2" href="/contact">Contact page</Link>. GitHub issues are public, so leave out private library content and backup files.</p>
            </section>
          </div>
        </article>
      </div>
    </ScrollPanel>
  );
}
