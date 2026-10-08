import Link from "next/link";
import { ArrowRightIcon, LogoIcon } from "./shell-icons";
import { CHROME_EXTENSION_URL } from "./help/guides";
import "./marketing-footer.css";
import "./marketing-controls.css";

export function MarketingHeader({ help = false, floating = false }: { help?: boolean; floating?: boolean }) {
  return <header className={`ka-header${floating ? " ka-header-floating" : ""}`}><div className="ka-wrap ka-header-inner">
    <Link href="/about" className="ka-brand keepall-logo-link" aria-label="Keepall home"><LogoIcon className="size-8" /><span className="ka-header-brand-name">keepall</span></Link>
    <nav aria-label="Main navigation"><Link href="/about#collection">Features</Link><Link href="/about#extension">Extension</Link><Link href="/about#install">Install</Link><Link href="/help" aria-current={help ? "page" : undefined}>Help</Link><Link href="/blog">Blog</Link><Link href="/contact">Contact</Link></nav>
    <div className="ka-header-actions"><Link href="/" className="ka-header-open" aria-label="Open Keepall">Open <span className="ka-header-app-name">Keepall</span> <ArrowRightIcon /></Link></div>
  </div></header>;
}

export function MarketingFooterLinks() {
  return <nav aria-label="Footer navigation">
    <Link href="/about">About</Link><Link href="/help">Help</Link><Link href="/blog">Blog</Link><Link href="/changelog">Changelog</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link><Link href="/help/storage-and-backups">Storage &amp; backups</Link><Link href="/extension-privacy">Extension privacy</Link><a href={CHROME_EXTENSION_URL}>Chrome extension ↗</a>
  </nav>;
}

export function MarketingFooter() {
  return <footer className="ka-wrap km-footer">
    <div className="km-footer-brand">
      <Link href="/about" className="ka-brand keepall-logo-link"><LogoIcon className="size-8" /><span>keepall</span></Link>
      <p>Your library stays on your device.</p>
    </div>
    <MarketingFooterLinks />
  </footer>;
}
