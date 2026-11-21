import type { Metadata } from "next";
import { ConnectAgent } from "./connect-agent";

export const metadata: Metadata = {
  title: "Connect an agent · Keepall",
  robots: { index: false, follow: false },
};

export default function ConnectPage() {
  return <ConnectAgent />;
}
