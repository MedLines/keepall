import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { version as pdfVersion } from "pdfjs-dist/package.json";

const pdfAssetPath = join(process.cwd(), "public", "pdfjs", pdfVersion);
const pdfPrecacheEntries = readdirSync(pdfAssetPath, { recursive: true, encoding: "utf8" })
  .filter(file => /\.(mjs|js|bcmap|pfb|ttf|wasm)$/.test(file) && !file.includes("quickjs"))
  .map(file => ({
    url: `/pdfjs/${pdfVersion}/${file.replaceAll("\\", "/")}`,
    revision: createHash("sha256").update(readFileSync(join(pdfAssetPath, file))).digest("hex"),
  }));

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Registration is owned by SerwistProvider; keep inject from auto-reloading on "online".
  register: false,
  reloadOnOnline: false,
  additionalPrecacheEntries: [{ url: "/~offline", revision: "keepall-offline-1" }, ...pdfPrecacheEntries],
});

const nextConfig: NextConfig = {
  // Serwist adds webpack config; Next 16 Turbopack needs an explicit turbopack key
  // (even empty) so `next dev` does not abort.
  turbopack: {},
  experimental: {
    useOffline: true,
    optimizePackageImports: ["@hugeicons/core-free-icons"],
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...config.resolve.alias,
        agentation: false,
        "interface-kit/react": false,
        "interface-kit": false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path((?!extension-bridge).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/extension-bridge",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Content-Security-Policy", value: "frame-ancestors chrome-extension://flmcadkppebdjebeiiellmeldfbckppo chrome-extension://ehloefgfecmfjbncknaoleakbnjhkpea" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self' https:",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
