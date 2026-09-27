import type { Metadata } from "next";
import { Trash } from "./trash";

export const metadata: Metadata = { title: "Trash · Keepall" };

export default function TrashPage() {
  return <Trash />;
}
