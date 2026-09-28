import Link from "next/link";
import { ArrowRightIcon, LogoIcon } from "./shell-icons";

export function MarketingHeader({ help = false, floating = false }: { help?: boolean; floating?: boolean }) {
  return <header className={`ka-header${floating ? " ka-header-floating" : ""}`}><div className="ka-wrap ka-header-inner">
    <Link href="/about" className="ka-brand keepall-logo-link" aria-label="Keepall home"><LogoIcon className="size-8" /><span>keepall</span></Link>
    <nav aria-label="Main navigation"><Link href="/about#collection">Features</Link><Link href="/about#extension">Extension</Link><Link href="/about#install">Install</Link><Link href="/help" aria-current={help ? "page" : undefined}>Help</Link></nav>
    <Link href="/" className="ka-header-open">Open Keepall <ArrowRightIcon /></Link>
  </div></header>;
}

export function MarketingFooter() {
  return <footer className="ka-wrap ka-footer-top kh-footer">
    <Link href="/about" className="ka-brand keepall-logo-link"><LogoIcon className="size-8" /><span>keepall</span></Link>
    <nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/help">Help</Link><Link href="/extension-privacy">Extension privacy</Link></nav>
    <span>Your library stays on your device.</span>
  </footer>;
}
