import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { createNote } from "@/persistence/items";
import { createCollection } from "@/persistence/collections";
import { createTag } from "@/persistence/tags";
import { getDb } from "@/persistence/db";
import { UnsortedReview } from "./unsorted-review";

async function closePicker() {
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape", code: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
}

async function reviewProps() {
  const items = [await createNote({ title: "First note", content: "First saved note." }), await createNote({ title: "Second note", content: "Second saved note." })];
  const collections = [await createCollection({ name: "Reading" }), await createCollection({ name: "Writing" })];
  const tags = [await createTag({ name: "Reference" }), await createTag({ name: "Ideas" })];
  return { items, collections, tags, onClose: vi.fn(), onOpenItem: vi.fn(), returnFocus: () => null };
}

test("uses the shared collection choices and stages filing until Apply changes", async () => {
  const props = await reviewProps();
  render(<UnsortedReview {...props} />);
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Browse all folders" }));
  expect(screen.getByRole("menuitemradio", { name: "Unsorted" })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Reading" }));
  await closePicker();
  expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
  expect(await getDb().items.get(props.items[0].id)).toMatchObject({ collectionIds: [] });
  fireEvent.click(screen.getByRole("button", { name: "Browse all folders" }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "Unsorted" }));
  await closePicker();
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Browse all folders" }));
  const browser = await screen.findByRole("menu", { name: "Browse all folders" });
  fireEvent.change(within(browser).getByRole("textbox", { name: "Search collections" }), { target: { value: "Writ" } });
  fireEvent.click(within(browser).getByRole("menuitemradio", { name: "Writing" }));
  await closePicker();
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  await screen.findByRole("heading", { name: "Second note" });
  expect(await getDb().items.get(props.items[0].id)).toMatchObject({ collectionIds: [props.collections[1].id] });
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await screen.findByRole("heading", { name: "First note" });
  expect(await getDb().items.get(props.items[0].id)).toMatchObject({ collectionIds: [] });
});

test("creates a staged collection with Enter and files it only on confirmation", async () => {
  const props = await reviewProps();
  render(<UnsortedReview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Browse all folders" }));
  const input = screen.getByRole("textbox", { name: "Search collections" });
  fireEvent.change(input, { target: { value: "New collection" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await closePicker();
  expect(screen.getByRole("button", { name: "New collection" })).toHaveAttribute("aria-pressed", "true");
  expect(await getDb().collections.where("name").equals("New collection").count()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  await screen.findByRole("heading", { name: "Second note" });
  expect(await getDb().collections.where("name").equals("New collection").count()).toBe(1);
});

test("adds multiple tags through shared choices, removes a chip, and undoes removal", async () => {
  const props = await reviewProps();
  const view = render(<UnsortedReview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Browse all tags" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Reference" }));
  await closePicker();
  await waitFor(async () => expect(await getDb().items.get(props.items[0].id)).toMatchObject({ tagIds: [props.tags[0].id], collectionIds: [] }));
  let item = (await getDb().items.get(props.items[0].id))!;
  view.rerender(<UnsortedReview {...props} items={[item, props.items[1]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Browse all tags" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Ideas" }));
  await closePicker();
  await waitFor(async () => expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: props.tags.map(tag => tag.id) }));
  item = (await getDb().items.get(item.id))!;
  view.rerender(<UnsortedReview {...props} items={[item, props.items[1]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove tag Reference" }));
  await waitFor(async () => expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: [props.tags[1].id] }));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(async () => expect(await getDb().items.get(item.id)).toMatchObject({ tagIds: props.tags.map(tag => tag.id) }));
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
});

test("Previous, Next and arrow keys browse without changing items or adding Undo history", async () => {
  const props = await reviewProps();
  render(<UnsortedReview {...props} />);
  expect(screen.getByRole("button", { name: "Previous item" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next item" }));
  expect(screen.getByRole("heading", { name: "Second note" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Next item" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
  expect(screen.getByRole("heading", { name: "First note" })).toBeVisible();
  for (const original of props.items) expect(await getDb().items.get(original.id)).toEqual(original);
  fireEvent.click(screen.getByRole("button", { name: "Browse all folders" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Reading" }));
  await closePicker();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
  expect(screen.getByRole("heading", { name: "Second note" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
});

test("navigation skips filed items without changing the item or creating an Undo entry", async () => {
  const props = await reviewProps();
  const view = render(<UnsortedReview {...props} />);
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next item" }));
  expect(screen.getByRole("heading", { name: "Second note" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Next item" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  view.rerender(<UnsortedReview {...props} items={[{ ...props.items[0], collectionIds: [props.collections[0].id] }, props.items[1]]} />);
  expect(screen.getByRole("button", { name: "Previous item" })).toBeDisabled();
  expect(screen.getByRole("heading", { name: "Second note" })).toBeVisible();
  expect(screen.getAllByRole("status")[0]).toHaveTextContent("0 reviewed");
});
