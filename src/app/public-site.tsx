import Link from "next/link";
import { LogoIcon } from "./shell-icons";

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link href="/about" className="public-brand" aria-label="Keepall about">
        <LogoIcon className="size-9" />
        <span>keepall</span>
      </Link>
      <nav aria-label="Main navigation" className="public-nav">
        <Link href="/about">About</Link>
        <Link href="/help">Help</Link>
        <Link href="/" className="public-nav-cta"><span className="public-nav-label-full">Open library</span><span className="public-nav-label-short">Library</span><span aria-hidden="true">↗</span></Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Link href="/about" className="public-brand" aria-label="Keepall about">
        <LogoIcon className="size-8" />
        <span>keepall</span>
      </Link>
      <nav aria-label="Footer navigation">
        <Link href="/">Library</Link>
        <Link href="/help">Help</Link>
        <Link href="/extension-privacy">Extension privacy</Link>
      </nav>
      <p>Your library, your browser.</p>
    </footer>
  );
}
