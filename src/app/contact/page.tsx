import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { WebsitePage } from "../website-page";

export const metadata: Metadata = {
  title: "Contact · Keepall",
  description: "Get help with Keepall, report a bug, or suggest an improvement through GitHub.",
};

export default function ContactPage() {
  return (
    <WebsitePage
      title="Tell us what went wrong."
      eyebrow="Contact Keepall"
      description="Need help, found a bug, or have an idea for Keepall? Open an issue on GitHub so we can follow up."
    >
      <section aria-labelledby="support-title">
        <h2 id="support-title">Get help or share an idea</h2>
        <p>
          Check the <Link href="/help">Help guides</Link> for walkthroughs of saving, importing,
          organizing, and backing up your library. If you still need help, search the existing
          issues or open a new one. You’ll need a GitHub account to post.
        </p>
        <a href="https://github.com/MedLines/keepall/issues" target="_blank" rel="noreferrer" className="ka-button">
          Open GitHub issues <ArrowRightIcon />
        </a>
      </section>
      <section aria-labelledby="bug-report-title">
        <h2 id="bug-report-title">What to include in a bug report</h2>
        <p>A few details help us reproduce the problem:</p>
        <ul>
          <li>Your browser name and version, and whether you’re using a computer or phone.</li>
          <li>The steps you took, starting from opening Keepall.</li>
          <li>What you expected to happen.</li>
          <li>What actually happened, including any error message.</li>
          <li>A screenshot if it helps explain the problem.</li>
        </ul>
        <p>
          GitHub issues are public. Remove personal links, notes, and other private details from
          screenshots and reports. Don’t upload your library backup.
        </p>
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
