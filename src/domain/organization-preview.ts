import type { Item } from "./item";
import { normalizeSearchQuery } from "./search";

export type OrganizationPreview<T = { id: string; name: string }> = {
  organization: T;
  count: number;
  previews: Item[];
};

export function buildOrganizationPreviews<T extends { id: string; name: string }>(
  organizations: T[], items: Item[], query: string, kind: "collections" | "tags",
): OrganizationPreview<T>[] {
  const byId = new Map<string, OrganizationPreview<T>>(
    organizations.map(organization => [organization.id, { organization, count: 0, previews: [] }]),
  );
  const previewTime = (item: Item) => kind === "collections" ? item.collectionAddedAt ?? item.createdAt : item.createdAt;
  for (const item of items) {
    if (item.deletedAt !== undefined) continue;
    for (const id of kind === "collections" ? item.collectionIds : item.tagIds) {
      const entry = byId.get(id);
      if (!entry) continue;
      entry.count += 1;
      entry.previews.push(item);
      entry.previews.sort((a, b) => previewTime(b) - previewTime(a) || b.createdAt - a.createdAt);
      entry.previews = entry.previews.slice(0, 3);
    }
  }
  const needle = normalizeSearchQuery(query);
  return [...byId.values()].filter(({ organization }) => organization.name.toLowerCase().includes(needle));
}
