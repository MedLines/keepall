import type { Metadata } from "next";
import Link from "next/link";
import { WebsitePage } from "../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../website-metadata";
import { ContactForm } from "./contact-form";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact · Keepall",
  description: "Contact Keepall support, report a bug, or suggest an improvement.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact · Keepall",
    description: "Contact Keepall support, report a bug, or suggest an improvement.",
    url: "/contact",
    type: "website",
    images: [websiteOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [websiteTwitterImage],
    title: "Contact · Keepall",
    description: "Contact Keepall support, report a bug, or suggest an improvement.",
  },
};

export default function ContactPage() {
  return (
    <WebsitePage
      title="Let's hear from you."
      eyebrow="Contact Keepall"
      description="Need help, found a bug, or have an idea for Keepall? Write to us below."
    >
      <section aria-labelledby="support-title">
        <h2 id="support-title">Send us a message</h2>
        <p>
          Check the <Link href="/help">Help guides</Link> for walkthroughs of saving, importing,
          organizing, and backing up your library. If you still need a hand, tell us what&apos;s happening.
        </p>
        <ContactForm />
      </section>
      <section aria-labelledby="storage-help-title">
        <h2 id="storage-help-title">If your library is missing</h2>
        <p>
          Your library belongs to the browser profile and device where you saved it. Try the
          same browser, profile, and Keepall address first. Before clearing browser data to
          troubleshoot, <Link href="/help/storage-and-backups">make a backup in Settings</Link>.
        </p>
        <p>
          Support can help you investigate, but cannot restore a local library after its browser
          data has been deleted. If you have a backup, the Help guide explains how to restore it.
        </p>
      </section>
    </WebsitePage>
  );
}
