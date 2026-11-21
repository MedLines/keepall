#!/usr/bin/env node
import { appOrigin, configPath, deletePairing, loadPairing, relayUrl, savePairing } from "./config.ts";
import { LibraryClient } from "./library-client.ts";
import { startPairing } from "./pair.ts";
import { runServer } from "./server.ts";
import { INSTRUCTIONS, toolContent, TOOLS } from "./tools.ts";

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
  if (command === "tools") {
    // The same tools the MCP server offers, for agents that call a CLI instead of MCP.
    console.log(`${INSTRUCTIONS}\n`);
    for (const tool of TOOLS) console.log(`${tool.name}: ${tool.description}\n  arguments: ${JSON.stringify(tool.inputSchema.properties)}\n`);
    console.log("Call one with: keepall-mcp call <tool> '<JSON arguments>'");
    return;
  }
  if (command === "search" || command === "call") {
    const [tool, json = "{}"] = command === "search" ? ["search_items", JSON.stringify({ query: rest.join(" ") })] : rest;
    if (!tool || !TOOLS.some((entry) => entry.name === tool)) throw new Error(`Unknown tool: ${tool ?? "(none)"}. Run keepall-mcp tools to list them.`);
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new Error(`The arguments must be JSON, for example '{"query": "typography"}'.`);
    }
    const pairing = await loadPairing();
    if (!pairing) throw new Error("Not paired. Run `keepall-mcp pair` first.");
    const client = new LibraryClient(pairing);
    try {
      const content = toolContent(await client.call(tool, args));
      // Images can't print to a terminal; name them so the agent knows they exist.
      console.log(content.map((block) => (block.type === "text" ? block.text : `[image: ${block.mimeType}, ${Math.round(block.data.length * 0.75 / 1024)} KB]`)).join("\n"));
    } finally {
      client.close();
    }
    return;
  }
  throw new Error(`Unknown command: ${command}. Use pair, unpair, tools, call, or search, or no command to run the MCP server.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
