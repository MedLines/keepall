import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ItemContextMenu } from "./item-context-menu";

function setup(overrides: Partial<React.ComponentProps<typeof ItemContextMenu>> = {}) {
  const actions = { onAddTag: vi.fn(), onRemoveTag: vi.fn(), onEdit: vi.fn(), onOrganize: vi.fn(), onDelete: vi.fn() };
  const props = {
    title: "Reference", trigger: null, tags: [{ id: "t1", name: "Design" }, { id: "t2", name: "Reading" }],
    assignedTagIds: ["t1"], collections: [{ id: "c1", name: "Work" }], assignedCollectionIds: [], collectionError: null, onMoveToCollection: vi.fn(), onClearCollection: vi.fn(), triggerRef: { current: null }, busy: false, disabled: false, tagError: null,
    ...actions, ...overrides,
  };
  const result = render(<ItemContextMenu {...props}>{() => <div>Saved item</div>}</ItemContextMenu>);
  return { ...result, actions, props };
}

async function openTags() {
  fireEvent.contextMenu(screen.getByText("Saved item"), { clientX: 100, clientY: 100 });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Tags" }));
  return screen.findByRole("textbox", { name: "Search tags" });
}

describe("ItemContextMenu", () => {
  test("keeps selected tags first and preserves row focus when toggling", async () => {
    setup({ tags: [{ id: "t2", name: "Reading" }, { id: "t1", name: "Design" }, { id: "t3", name: "Work" }] });
    await openTags();
    const order = () => screen.getAllByRole("menuitemcheckbox").map(row => row.textContent);
    expect(order()).toEqual(["Design", "Reading", "Work"]);
    const reading = screen.getByRole("menuitemcheckbox", { name: "Reading" });
    reading.focus();
    fireEvent.click(reading);
    expect(order()).toEqual(["Reading", "Design", "Work"]);
    expect(reading).toHaveFocus();
    fireEvent.click(reading);
    expect(order()).toEqual(["Design", "Reading", "Work"]);
  });

  test("updates the check immediately and rolls it back when saving fails", async () => {
    const { rerender, props } = setup();
    await openTags();
    const row = screen.getByRole("menuitemcheckbox", { name: "Reading" });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-checked", "true");
    rerender(<ItemContextMenu {...props} busy>{() => <div>Saved item</div>}</ItemContextMenu>);
    expect(row).toHaveAttribute("aria-checked", "true");
    rerender(<ItemContextMenu {...props} tagError="Couldn't add tag.">{() => <div>Saved item</div>}</ItemContextMenu>);
    await waitFor(() => expect(row).toHaveAttribute("aria-checked", "false"));
  });

  test("keeps tag rows visually stable and blocks duplicate writes while pending", async () => {
    const { rerender, props, actions } = setup();
    await openTags();
    const row = screen.getByRole("menuitemcheckbox", { name: "Reading" });
    fireEvent.click(row);
    rerender(<ItemContextMenu {...props} busy>{() => <div>Saved item</div>}</ItemContextMenu>);
    expect(screen.getByRole("menuitemcheckbox", { name: "Reading" })).toBe(row);
    expect(row).not.toHaveAttribute("data-disabled");
    expect(row).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(row);
    expect(actions.onAddTag).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "Search tags" })).toBeVisible();
  });

  test("searches existing tags and toggles their assignment without closing", async () => {
    const { actions } = setup();
    const search = await openTags();
    fireEvent.change(search, { target: { value: "read" } });
    expect(screen.queryByRole("menuitemcheckbox", { name: "Design" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Reading" }));
    expect(actions.onAddTag).toHaveBeenCalledWith("Reading");
    expect(search).toBeVisible();
    fireEvent.change(search, { target: { value: "Design" } });
    const applied = screen.getByRole("menuitemcheckbox", { name: "Design" });
    expect(applied).toHaveAttribute("aria-checked", "true");
    fireEvent.click(applied);
    expect(actions.onRemoveTag).toHaveBeenCalledWith("t1");
  });

  test("offers inline creation for a new normalized name", async () => {
    const { actions } = setup();
    const search = await openTags();
    fireEvent.change(search, { target: { value: "  New   topic  " } });
    fireEvent.click(screen.getByRole("menuitem", { name: 'Create “New topic”' }));
    expect(actions.onAddTag).toHaveBeenCalledWith("New topic");
    expect(search).toBeVisible();
  });

  test("does not offer duplicate creation for existing or already applied tags", async () => {
    setup();
    const search = await openTags();
    fireEvent.change(search, { target: { value: " design " } });
    expect(screen.getByRole("menuitemcheckbox", { name: "Design" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: /Create/ })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "  " } });
    expect(screen.queryByRole("menuitem", { name: /Create/ })).not.toBeInTheDocument();
  });

  test("disables writes while pending and keeps a failed query available for retry", async () => {
    const { rerender, props, actions } = setup();
    const search = await openTags();
    fireEvent.change(search, { target: { value: "New tag" } });
    rerender(<ItemContextMenu {...props} busy>{() => <div>Saved item</div>}</ItemContextMenu>);
    fireEvent.click(screen.getByRole("menuitem", { name: 'Create “New tag”' }));
    expect(actions.onAddTag).not.toHaveBeenCalled();
    rerender(<ItemContextMenu {...props} tagError="Couldn't add tag.">{() => <div>Saved item</div>}</ItemContextMenu>);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't add tag.");
    expect(search).toHaveValue("New tag");
    fireEvent.click(screen.getByRole("menuitem", { name: 'Create “New tag”' }));
    expect(actions.onAddTag).toHaveBeenCalledWith("New tag");
  });

  test("keeps Move to Trash last and delegates to the existing confirmation flow", async () => {
    const { actions } = setup();
    fireEvent.contextMenu(screen.getByText("Saved item"));
    await screen.findByRole("menuitem", { name: "Move to Trash" });
    expect(screen.getAllByRole("menuitem").at(-1)).toHaveTextContent("Move to Trash");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to Trash" }));
    expect(actions.onDelete).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  test("searches collections, selects an existing destination, and clears to Unsorted", async () => {
    const { props } = setup({ assignedCollectionIds: ["c1"] });
    fireEvent.contextMenu(screen.getByText("Saved item"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Collections" }));
    const search = await screen.findByRole("textbox", { name: "Search collections" });
    expect(screen.getByRole("menuitemradio", { name: "Work" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Unsorted" }));
    expect(props.onClearCollection).toHaveBeenCalledOnce();
    fireEvent.change(search, { target: { value: " WORK " } });
    expect(screen.queryByRole("menuitemradio", { name: "Unsorted" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Create/ })).not.toBeInTheDocument();
    expect(search).toBeVisible();
  });

  test("assigns existing collections and creates normalized names in place", async () => {
    const { props } = setup();
    fireEvent.contextMenu(screen.getByText("Saved item"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Collections" }));
    const search = await screen.findByRole("textbox", { name: "Search collections" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Work" }));
    expect(props.onMoveToCollection).toHaveBeenCalledWith("Work");
    fireEvent.change(search, { target: { value: "  Side   projects " } });
    fireEvent.click(screen.getByRole("menuitem", { name: "Create “Side projects”" }));
    expect(props.onMoveToCollection).toHaveBeenCalledWith("Side projects");
    expect(search).toBeVisible();
  });

  test("blocks collection writes while pending and shows a retryable error", async () => {
    const { props, rerender } = setup({ busy: true });
    fireEvent.contextMenu(screen.getByText("Saved item"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Collections" }));
    const search = await screen.findByRole("textbox", { name: "Search collections" });
    fireEvent.change(search, { target: { value: "Projects" } });
    fireEvent.click(screen.getByRole("menuitem", { name: "Create “Projects”" }));
    expect(props.onMoveToCollection).not.toHaveBeenCalled();
    rerender(<ItemContextMenu {...props} busy={false} collectionError="Couldn't add collection.">{() => <div>Saved item</div>}</ItemContextMenu>);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't add collection.");
    expect(search).toHaveValue("Projects");
    fireEvent.click(screen.getByRole("menuitem", { name: "Create “Projects”" }));
    expect(props.onMoveToCollection).toHaveBeenCalledWith("Projects");
  });
});

test("saves a link for offline reading from its right-click menu", async () => {
  const onSaveArticle = vi.fn();
  setup({ onSaveArticle });
  fireEvent.contextMenu(screen.getByText("Saved item"), { clientX: 100, clientY: 100 });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Save article for offline reading" }));
  expect(onSaveArticle).toHaveBeenCalledOnce();
});

test("shows an update action for saved articles and disables captures in progress", async () => {
  const onSaveArticle = vi.fn();
  const { rerender, props } = setup({ onSaveArticle, hasArticle: true });
  fireEvent.contextMenu(screen.getByText("Saved item"), { clientX: 100, clientY: 100 });
  expect(await screen.findByRole("menuitem", { name: "Update saved article" })).toBeVisible();
  rerender(<ItemContextMenu {...props} savingArticle>{() => <div>Saved item</div>}</ItemContextMenu>);
  const saving = screen.getByRole("menuitem", { name: "Saving article…" });
  expect(saving).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(saving);
  expect(onSaveArticle).not.toHaveBeenCalled();
});
