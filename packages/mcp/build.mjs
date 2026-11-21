// Bundles @keepall/mcp into one dependency-free file for npm. The shared protocol from the app's src/domain is
// inlined, so the published package runs on plain Node with no TypeScript, no type stripping, and no warnings.
import { build } from "esbuild";
import { chmod, readFile } from "node:fs/promises";

const relay = process.env.KEEPALL_PUBLIC_RELAY_URL;
if (!relay || !/^https:\/\//.test(relay)) {
  throw new Error("Set KEEPALL_PUBLIC_RELAY_URL to the deployed relay (https://…) before building the package.");
}

await build({
  entryPoints: ["src/cli.ts"],
  outfile: "dist/keepall-mcp.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // src/cli.ts starts with the shebang; esbuild keeps it.
  // Defaults for the agent-started link flow. Setup codes carry their own relay and app addresses.
  define: {
    "process.env.KEEPALL_PACKAGE_VERSION": JSON.stringify(JSON.parse(await readFile("package.json", "utf8")).version),
    "process.env.KEEPALL_DEFAULT_RELAY_URL": JSON.stringify(relay),
    "process.env.KEEPALL_DEFAULT_APP_ORIGIN": JSON.stringify(process.env.KEEPALL_PUBLIC_APP_ORIGIN ?? "https://www.keepall.app"),
  },
  legalComments: "none",
});
await chmod("dist/keepall-mcp.js", 0o755);
console.log(`Built dist/keepall-mcp.js for relay ${relay}`);
