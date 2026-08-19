import { linkListTitle, type LinkItem } from "./link";
import { noteListTitle, type NoteItem } from "./note";

export type Item = NoteItem | LinkItem;

export function itemListTitle(item: Item): string {
  if (item.type === "note") {
    return noteListTitle(item);
  }

  return linkListTitle(item);
}
