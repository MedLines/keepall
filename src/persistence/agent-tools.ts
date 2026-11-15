import { AgentToolError, parseSearchItemsArgs, searchItemsForAgent } from "@/domain/agent-tools";
import { listCollections } from "./collections";
import { listItems } from "./items";
import { listTags } from "./tags";

/** Runs one decrypted agent request against the local library. Spike scope: read-only search. */
export async function runAgentTool(tool: string, args: Record<string, unknown>, appOrigin: string): Promise<unknown> {
  if (tool === "search_items") {
    const parsed = parseSearchItemsArgs(args);
    const [items, tags, collections] = await Promise.all([listItems(), listTags(), listCollections()]);
    return searchItemsForAgent(items, tags, collections, parsed, appOrigin);
  }
  throw new AgentToolError(`Keepall doesn't support ${tool} yet.`);
}
