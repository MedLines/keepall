import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { Metadata } from "next";
import { AgentReview } from "./agent-review";

export const metadata: Metadata = {
  title: "Review agent changes · Keepall",
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return (
    <ScrollPanel role="main" className="h-full min-h-0 bg-bg-shell" viewportClassName="p-2.5" contentClassName="!grid min-h-full">
      <div className="library-panel min-h-full bg-bg-canvas px-4 py-4 pb-24 sm:px-7 sm:pt-6 md:pb-6">
        <div className="mx-auto w-full max-w-5xl">
          <AgentReview />
        </div>
      </div>
    </ScrollPanel>
  );
}
