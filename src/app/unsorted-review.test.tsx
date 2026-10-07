import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { createNote } from "@/persistence/items";
import { createCollection } from "@/persistence/collections";
import { createTag } from "@/persistence/tags";
import { getDb } from "@/persistence/db";
import { UnsortedReview } from "./unsorted-review";

async function reviewProps() {
  const items = [await createNote({ title: "First note", content: "First saved note." }), await createNote({ title: "Second note", content: "Second saved note." })];
  const collections = [await createCollection({ name: "Reading" }), await createCollection({ name: "Writing" })];
  const tags = [await createTag({ name: "Reference" }), await createTag({ name: "Ideas" })];
  return { items, collections, tags, onClose: vi.fn(), onOpenItem: vi.fn(), returnFocus: () => null };
}

test("uses the shared collection choices and stages filing until File and next", async () => {
  const props = await reviewProps();
  render(<UnsortedReview {...props} />);
  expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "File and next" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reading" }));
  expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
  expect(await getDb().items.get(props.items[0].id)).toMatchObject({ collectionIds: [] });
  fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
  expect(screen.getByRole("button", { name: "File and next" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Browse all collections" }));
  const browser = screen.getByRole("dialog", { name: "Choose a collection" });
  fireEvent.change(within(browser).getByRole("searchbox", { name: "Search collections" }), { target: { value: "Writ" } });
  fireEvent.click(within(browser).getByRole("button", { name: "Writing" }));
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "File and next" }));
  await screen.findByRole("heading", { name: "Second note" });
  expect(await getDb().items.get(props.items[0].id)).toMatchObject({ collectionIds: [props.collections[1].id] });
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await screen.findByRole("heading", { name: "First note" });
  expect(await getDb().items.get(props.items[0].id)).toMatchObject({ collectionIds: [] });
});

test("creates a staged collection with Enter and files it only on confirmation", async () => {
  const props = await reviewProps();
  render(<UnsortedReview {...props} />);
  const input = screen.getByRole("textbox", { name: "Move to collection" });
  fireEvent.change(input, { target: { value: "New collection" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("button", { name: "New collection" })).toHaveAttribute("aria-pressed", "true");
  expect(await getDb().collections.where("name").equals("New collection").count()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "File and next" }));
  await screen.findByRole("heading", { name: "Second note" });
  expect(await getDb().collections.where("name").equals("New collection").count()).toBe(1);
});

test("adds multiple tags through shared choices, removes a chip, and undoes removal", async () => {
  const props = await reviewProps();
  const view = render(<UnsortedReview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Reference" }));
  await waitFor(async () => expect(await getDb().items.get(props.items[0].id)).toMatchObject({ tagIds: [props.tags[0].id], collectionIds: [] }));
  let item = (await getDb().items.get(props.items[0].id))!;
  view.rerender(<UnsortedReview {...props} items={[item, props.items[1]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Ideas" }));
  await waitFor(async () => expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: props.tags.map(tag => tag.id) }));
  item = (await getDb().items.get(item.id))!;
  view.rerender(<UnsortedReview {...props} items={[item, props.items[1]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove tag Reference" }));
  await waitFor(async () => expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: [props.tags[1].id] }));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(async () => expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: props.tags.map(tag => tag.id) }));
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
});
