import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, LogoIcon } from "../shell-icons";

export const metadata: Metadata = {
  title: "Keepall Capture privacy · Keepall",
  description: "How the Keepall Capture Chrome extension handles saved links, notes, and images.",
};

export default function ExtensionPrivacyPage() {
  return (
    <main className="ui-scrollbar h-dvh overflow-y-auto bg-bg-shell p-2.5">
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
          <p className="mt-3 text-sm text-text-secondary">Last updated September 26, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-text-secondary">
            <section>
              <h2 className="text-lg font-semibold text-text-primary">What the extension handles</h2>
              <p className="mt-2">When you click the toolbar button or use Alt/Option+K, Keepall Capture reads the current page URL and title. If you use the capture drawer, it also handles the title, note, Markdown choice, collection, and tags you enter or select. When you choose Save to Keepall from a link&apos;s right-click menu, it reads and saves that link&apos;s destination URL. When you choose Save to Keepall from an image&apos;s right-click menu, it reads that image&apos;s URL and bytes and the source page URL or containing tweet link. It does not read the full page text, your browsing history, cookies, or passwords.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Where your library lives</h2>
              <p className="mt-2">The extension passes the capture to the Keepall web app running in your browser. Keepall saves your library in that browser profile&apos;s local IndexedDB. You do not need a Keepall account, and the extension does not sync your library to a cloud account. For link saves, the extension temporarily holds a pending capture in Chrome extension storage so a failed save can be retried. Pending link captures expire after ten minutes and are removed at the next cleanup; confirmed captures are removed immediately. Image bytes are passed to the local library without being stored in extension storage. Your selected Keepall address remains in extension storage until you change it or remove the extension.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Network requests</h2>
              <p className="mt-2">The extension loads a Keepall page over HTTPS to write to the same local library without opening a visible tab. This request does not include your captured URL, note, or image bytes in its URL. For a selected image, the extension requests its bytes directly from the image host; Chrome may ask you to allow access to that host. You can optionally grant access to all websites once in the extension&apos;s Options page to avoid repeated image-host prompts, and remove it there later. Keepall downloads an image only when you choose the right-click save action. The image host receives the request, and the bytes pass to the Keepall page in your browser for local storage. When you view saved links in Keepall, the app may send a saved link URL to Keepall&apos;s preview service to fetch a title, description, or image from the linked website. The preview service and linked website may receive that URL. Notes, collections, and tags are not sent with preview requests.</p>
              <p className="mt-2">Keepall is hosted on Vercel. Normal visits to Keepall may produce hosting logs, and Vercel Web Analytics records aggregate page-view information. The extension does not use saved library content for analytics or advertising.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Use, sharing, and control</h2>
              <p className="mt-2">Information received through Chrome permissions is used to save the page or image you choose. We do not sell your saved data or use it for advertising. You can edit or delete saved items in Keepall, clear the site&apos;s browser storage to remove the local library, and remove the extension to clear its local settings and pending captures. Because the library is local, make a backup in Keepall Settings before clearing browser data.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-text-primary">Contact</h2>
              <p className="mt-2">For questions or a privacy request, open an issue on <a className="font-medium text-text-primary underline underline-offset-2" href="https://github.com/MedLines/keepall/issues" target="_blank" rel="noreferrer">Keepall&apos;s GitHub repository</a>.</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
