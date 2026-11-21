#!/usr/bin/env node
import { appOrigin, configPath, deletePairing, loadPairing, relayUrl, savePairing } from "./config.ts";
import { LibraryClient } from "./library-client.ts";
import { startPairing } from "./pair.ts";
import { runServer } from "./server.ts";

const [command, ...rest] = process.argv.slice(2);

async function main() {
  if (!command) {
    runServer();
    return;
  }
  if (command === "pair") {
    const attempt = await startPairing({ relayUrl: relayUrl(), appOrigin: appOrigin(), agentName: "Keepall CLI" });
    console.log(`Open this link in the Chrome profile that has your Keepall library:\n\n${attempt.link}\n`);
    await savePairing(await attempt.done);
    console.log(`Paired. Saved to ${configPath()}`);
    return;
  }
  if (command === "unpair") {
    await deletePairing();
    console.log("Removed this computer's Keepall pairing. Remove the agent in Keepall Settings too.");
    return;
  }
  if (command === "search") {
    const pairing = await loadPairing();
    if (!pairing) throw new Error("Not paired. Run `keepall-mcp pair` first.");
    const client = new LibraryClient(pairing);
    try {
      console.log(JSON.stringify(await client.call("search_items", { query: rest.join(" ") }), null, 2));
    } finally {
      client.close();
    }
    return;
  }
  throw new Error(`Unknown command: ${command}. Use pair, unpair, or search, or no command to run the MCP server.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
