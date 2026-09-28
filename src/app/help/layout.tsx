import type { ReactNode } from "react";
import { MarketingFooter, MarketingHeader } from "../marketing-navigation";
import "../about/landing.css";
import "./help.css";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <div className="ka-page kh-page">
    <a href="#help-content" className="ka-skip">Skip to content</a>
    <MarketingHeader help floating />
    <main id="help-content" className="ka-wrap kh-main">{children}</main>
    <MarketingFooter />
  </div>;
}
