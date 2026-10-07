import type { Metadata } from "next";
import Link from "next/link";
import { WebsitePage } from "../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../website-metadata";

export const metadata: Metadata = {
  title: "Privacy · Keepall",
  description: "How Keepall stores your local library, uses network services, and handles backups and browser storage.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy · Keepall",
    description: "How Keepall stores your local library, uses network services, and handles backups and browser storage.",
    url: "/privacy",
    type: "website",
    images: [websiteOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [websiteTwitterImage],
    title: "Privacy · Keepall",
    description: "How Keepall stores your local library, uses network services, and handles backups and browser storage.",
  },
};

export default function PrivacyPage() {
  return (
    <WebsitePage
      title="Privacy"
      eyebrow="Your data"
      description="Your library lives in your browser. Here is what stays on this device, what uses the internet, and how to keep a recovery copy."
    >
      <time className="kw-date" dateTime="2026-10-07">Last updated October 7, 2026</time>

      <section id="local-library" aria-labelledby="local-library-title">
        <h2 id="local-library-title">Where your library lives</h2>
        <p>Keepall stores your links, notes, saved articles, images, videos, documents, collections, and tags in IndexedDB, your browser&apos;s local database. Search, file imports, and edits run on this device. Some appearance and interface preferences also use local browser storage.</p>
        <p>You do not need a Keepall account. Keepall does not upload your library to a cloud account or automatically sync it between devices.</p>
        <p>Each browser profile and device has its own library. Browser storage also belongs to a specific site address, including its protocol, hostname, and port. A different Keepall address can open a separate library. On iPhone and iPad, the Home Screen app has separate storage from Safari. Use a backup to transfer saves between them.</p>
      </section>

      <section id="network" aria-labelledby="network-title">
        <h2 id="network-title">Link previews and article capture</h2>
        <p>While online, Keepall may send a saved link&apos;s URL to its preview service to fetch a title, description, and cover image. The service requests the linked website and may request an image from its host. Downloaded preview images are stored in your local library.</p>
        <p>Choosing Save for offline or Update saved article sends that link&apos;s URL to Keepall&apos;s server. The server requests the public page and supported article images, then returns a readable copy for local storage. It does not sign in to the website or use your browser&apos;s cookies.</p>
        <p>These requests share the URL, including any information in its path or query, with Keepall&apos;s service and the requested hosts. Your personal notes, collections, tags, and other library items are not included. A link still saves when its preview is unavailable. Reading a saved article uses the local copy.</p>
      </section>

      <section id="remote-media" aria-labelledby="remote-media-title">
        <h2 id="remote-media-title">Website icons and other remote requests</h2>
        <p>When a link has no locally saved preview image, Keepall may load its website icon from Google&apos;s favicon service. That request includes the saved link&apos;s hostname. If the icon cannot load, Keepall may request the website&apos;s own favicon. Those hosts receive normal browser requests.</p>
        <p>Opening a source link visits the original website under that website&apos;s privacy practices. Saving a web image with Keepall Capture requests the image&apos;s bytes from its host. Imported files, locally saved media, and saved article images open from browser storage. Markdown images pointing to remote websites do not load inside notes or imported documents.</p>
        <p>The Chrome extension has its own permissions and temporary capture storage. Read the <Link href="/extension-privacy">Keepall Capture privacy details</Link> for those actions.</p>
      </section>

      <section id="hosting" aria-labelledby="hosting-title">
        <h2 id="hosting-title">Hosting and analytics</h2>
        <p>Keepall is hosted on Vercel. Loading the website and using its preview or article services makes network requests that may produce hosting logs. The app includes Vercel Web Analytics for aggregate visit and page-view information.</p>
        <p>Keepall does not send your notes, saved files, or library database to analytics, and does not use saved library content for advertising. Network services still receive the requests described above.</p>
      </section>

      <section id="deletion" aria-labelledby="deletion-title">
        <h2 id="deletion-title">Deletion and browser storage limits</h2>
        <p>Deleting an item moves it to Trash. Permanently delete it from Trash or empty Trash to remove it from the current library. Copies in existing backups remain until you remove those backup files.</p>
        <p>Clearing Keepall&apos;s site data removes the local library and its settings. Browsers can also remove storage under their cleanup policies or when device space runs low. Keepall requests persistent storage protection, but your browser decides whether to grant it. Protection does not prevent you from clearing site data.</p>
        <p>Keepall has no server copy of your library to restore for you. Avoid private browsing for saves you want to keep, and <Link href="/help/storage-and-backups">keep a separate backup</Link>.</p>
      </section>

      <section id="backups" aria-labelledby="backups-title">
        <h2 id="backups-title">Backups you control</h2>
        <p>Export backup in <Link href="/settings#backup-heading">Settings</Link> downloads a .keepall.zip containing library data and saved files, including saved articles and items in Trash. Importing it in another browser or device transfers a copy. It does not connect or sync the two libraries.</p>
        <p>Folder backups are optional and require a browser that supports folder access and your permission to write to a chosen folder. While Keepall is open, changed library data is backed up about every 30 minutes. Inactive tabs, lost permission, or a sleeping device can delay a backup. Keepall retains the latest three verified backups for this library. Turning folder backups off leaves completed files in place.</p>
        <p>Backups are not password protected or encrypted by Keepall. Anyone with access to a backup file can read its contents. If you choose a folder managed by another storage or sync service, that service may copy the files under its own settings and privacy practices. Keep a copy elsewhere if you need protection against losing this device.</p>
      </section>

      <section id="offline" aria-labelledby="offline-title">
        <h2 id="offline-title">Offline access has limits</h2>
        <p>Open Keepall online first so the browser can cache the app. When those files and your library remain available, you can browse, search, edit, and read locally saved content offline. A first visit or uncached page needs a connection.</p>
        <p>Original websites, new previews, article capture and updates, and web image downloads need the internet. Read the <Link href="/help/offline">offline guide</Link> for preparation and recovery steps.</p>
      </section>

      <section id="contact" aria-labelledby="contact-title">
        <h2 id="contact-title">Contact messages</h2>
        <p>The <Link href="/contact">Contact form</Link> lets you write a support request, report a bug, or suggest an improvement. When email delivery is available and you choose Send message, your name, reply email, topic, message, and any bug details you enter go to Keepall&apos;s server, Resend, and the support inbox so we can respond.</p>
        <p>The form does not attach your library, saved files, or browser data. Keepall does not store contact messages in an app database. Delivered messages remain with the email provider and support inbox. Leave out sensitive library content and never include a backup file.</p>
        <p>If email delivery is unavailable, the form tells you before submission. Copy report puts the text on your clipboard. Opening the GitHub fallback sends the report details to GitHub to prepare an issue and leaves out your name and email. You decide whether to post it publicly. GitHub issues are public.</p>
      </section>
    </WebsitePage>
  );
}
