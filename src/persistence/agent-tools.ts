import {
  AgentToolError, describeItemForAgent, itemImageRefs, listCollectionsForAgent, listTagsForAgent, MAX_TEXT_CHARACTERS, nameIndex,
  parseGetItemArgs, parseNoArgs, parseSearchItemsArgs, parseViewImagesArgs, searchItemsForAgent,
} from "@/domain/agent-tools";
import { itemListTitle, type Item } from "@/domain/item";
import { loadAgentImage, OVERVIEW_LONG_SIDE, type AgentImage } from "./agent-images";
import { listCollections } from "./collections";
import { getDb } from "./db";
import { getItem, listItems } from "./items";
import { listTags } from "./tags";
import { runAgentWriteTool, type AgentCallContext } from "./agent-writes";

/** Attached images ride beside the result; the MCP server turns them into image content for the model. */
export type AttachedImage = AgentImage & { itemId: string };

async function documentText(item: Item) {
  if (item.type !== "document") return undefined;
  const original = await getDb().documentAssets.get(item.assetId);
  if (!original) return undefined;
  if (item.format === "pdf") return original.pdfText;
  return new TextDecoder("utf-8").decode(original.bytes.subarray(0, MAX_TEXT_CHARACTERS * 4));
}

async function requireItem(id: string) {
  const item = await getItem(id);
  if (!item) throw new AgentToolError(`No item has the ID ${id}. It may be in Trash. Search again for current IDs.`);
  return item;
}

async function getItemForAgent(args: Record<string, unknown>, appOrigin: string) {
  const { id, imageOffset, maxImages } = parseGetItemArgs(args);
  const item = await requireItem(id);
  const [tags, collections, text] = await Promise.all([listTags(), listCollections(), documentText(item)]);
  const refs = itemImageRefs(item);
  const wanted = refs.slice(imageOffset, imageOffset + maxImages);
  const attachedImages: AttachedImage[] = [];
  const unreadable: string[] = [];
  // One at a time, so a gallery of large originals never sits decoded in memory all at once.
  for (const ref of wanted) {
    const image = await loadAgentImage(ref);
    if (image) attachedImages.push({ ...image, itemId: item.id });
    else unreadable.push(ref.label);
  }
  const shownTo = imageOffset + wanted.length;
  return {
    item: describeItemForAgent(item, nameIndex(tags, collections), appOrigin, text),
    imagesShown: refs.length ? { from: wanted.length ? imageOffset + 1 : 0, to: shownTo, of: refs.length, ...(shownTo < refs.length ? { next: `Call get_item with image_offset ${shownTo} for more.` } : {}) } : undefined,
    ...(unreadable.length ? { unreadableImages: unreadable } : {}),
    attachedImages,
  };
}

async function viewImagesForAgent(args: Record<string, unknown>) {
  const { ids } = parseViewImagesArgs(args);
  const attachedImages: AttachedImage[] = [];
  const notFound: string[] = [];
  const withoutImages: string[] = [];
  for (const id of ids) {
    const item = await getItem(id);
    if (!item) {
      notFound.push(id);
      continue;
    }
    const [ref] = itemImageRefs(item);
    const image = ref ? await loadAgentImage({ ...ref, label: itemListTitle(item) }, OVERVIEW_LONG_SIDE) : null;
    if (image) attachedImages.push({ ...image, itemId: item.id });
    else withoutImages.push(id);
  }
  return { shown: attachedImages.length, ...(notFound.length ? { notFound } : {}), ...(withoutImages.length ? { withoutImages } : {}), attachedImages };
}

/** Runs one decrypted agent request against the local library. */
export async function runAgentTool(tool: string, args: Record<string, unknown>, context: AgentCallContext): Promise<unknown> {
  const { appOrigin } = context;
  switch (tool) {
    case "search_items": {
      const parsed = parseSearchItemsArgs(args);
      const [items, tags, collections] = await Promise.all([listItems(), listTags(), listCollections()]);
      return searchItemsForAgent(items, tags, collections, parsed, appOrigin);
    }
    case "get_item":
      return getItemForAgent(args, appOrigin);
    case "view_images":
      return viewImagesForAgent(args);
    case "list_collections": {
      parseNoArgs(args);
      const [items, collections] = await Promise.all([listItems(), listCollections()]);
      return listCollectionsForAgent(items, collections);
    }
    case "list_tags": {
      parseNoArgs(args);
      const [items, tags] = await Promise.all([listItems(), listTags()]);
      return listTagsForAgent(items, tags);
    }
    default: {
      const result = await runAgentWriteTool(tool, args, context);
      if (result === undefined) throw new AgentToolError(`Keepall doesn't support ${tool}. Reload Keepall if it was just updated, or update @keepall/mcp.`);
      return result;
    }
  }
}
