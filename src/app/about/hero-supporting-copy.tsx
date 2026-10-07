import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";

export function HeroSupportingCopy() {
  return <>
    <p className="ka-lede ka-hero-description">
      Save from the web with the Chrome extension.<br className="ka-desktop-break" />{" "}
      Bring your files, too. Find saved words with search.
    </p>
    <div className="ka-hero-actions">
      <Link href="/" className="ka-button">Start your library <ArrowRightIcon /></Link>
      <p className="ka-fine-print">Free to use. No account needed.</p>
    </div>
  </>;
}
