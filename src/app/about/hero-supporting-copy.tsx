import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";

export function HeroSupportingCopy() {
  return <>
    <p className="ka-lede ka-hero-description">
      Save links, notes, media, and documents.<br className="ka-desktop-break" />{" "}
      Keep them in a personal library on your device.
    </p>
    <div className="ka-hero-actions">
      <Link href="/" className="ka-button">Start your library <ArrowRightIcon /></Link>
      <p className="ka-fine-print">Free to use. No account needed.</p>
    </div>
  </>;
}
