import type { MetadataRoute } from "next";
import { oklchToHex } from "@/color-format.mjs";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Keepall",
    short_name: "Keepall",
    description: "A local-first personal library for links and notes.",
    start_url: "/",
    display: "standalone",
    background_color: oklchToHex("oklch(0.985103652 0 0)"),
    theme_color: oklchToHex("oklch(0.210330931 0.005860382 285.885132689)"),
    icons: [
      {
        src: "/icons/icon-192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
