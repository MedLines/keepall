import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";

const source = readFileSync("extension/toast-collections.js", "utf8");
let dispose: () => void;
afterEach(() => { dispose?.(); document.body.replaceChildren(); });

async function setup(failInitialLoad = false) {
  const request = vi.fn(async (operation: string, payload?: Record<string, unknown>) => {
    if (operation === "collections") return {
      collections: [{ id: "c1", name: "Reading" }], collectionIds: [] as string[],
      tags: [{ id: "t1", name: "Design" }], tagIds: [] as string[],
    };
    if (operation === "move") return { collectionName: payload?.collectionName ?? "Reading", changed: true };
    return { tag: { id: "t1", name: "Design" }, tagIds: payload?.assigned ? ["t1"] : [], assigned: payload?.assigned, changed: true };
  });
  if (failInitialLoad) request.mockRejectedValueOnce(new Error("Library unavailable."));
  const onMoved = vi.fn();
  const onTagged = vi.fn();
  const onClose = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const context = { document };
  runInNewContext(source, context);
  const factory = (context as typeof context & { __keepallCreateToastCollections: (input: object) => { element: HTMLElement; destroy: () => void } }).__keepallCreateToastCollections;
  const picker = factory({ request, onMoved, onTagged, onClose, host });
  host.append(picker.element);
  dispose = picker.destroy;
  if (failInitialLoad) await screen.findByRole("alert");
  else await screen.findByRole("button", { name: "Reading" });
  return { request, onMoved, onTagged, onClose, panel: within(picker.element) };
}

test("offers normalized collection creation without duplicating an exact match", async () => {
  const { request, onMoved, panel } = await setup();
  const search = panel.getByRole("searchbox");
  fireEvent.input(search, { target: { value: "  READING  " } });
  expect(panel.queryByRole("button", { name: /Create/ })).toBeNull();
  fireEvent.input(search, { target: { value: "  Side   projects " } });
  fireEvent.click(panel.getByRole("button", { name: "Create “Side projects”" }));
  await waitFor(() => expect(onMoved).toHaveBeenCalledWith({ collectionName: "Side projects", changed: true }));
  expect(request).toHaveBeenCalledWith("move", { collectionId: null, collectionName: "Side projects", expectedCollectionIds: [] });
});

test("retries a failed organization load in the same panel and focuses the selected search", async () => {
  const { request, onClose, panel } = await setup(true);
  expect(panel.getByRole("alert")).toHaveTextContent("Library unavailable.");
  expect(panel.getByRole("searchbox")).toBeDisabled();
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  let complete!: (value: Awaited<ReturnType<typeof request>>) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  const retry = panel.getByRole("button", { name: "Retry" });
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(request).toHaveBeenCalledTimes(2);
  expect(panel.getByRole("status")).toHaveTextContent("Loading collections and tags");
  complete({ collections: [], collectionIds: [], tags: [{ id: "t1", name: "Design" }], tagIds: [] });
  await panel.findByRole("button", { name: "Design" });
  expect(panel.getByRole("searchbox", { name: "Find a tag" })).not.toBeDisabled();
  expect(panel.getByRole("searchbox", { name: "Find a tag" })).toHaveFocus();
  expect(panel.queryByRole("button", { name: "Retry" })).toBeNull();
  expect(panel.queryByRole("alert")).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

test("can retry repeated loading failures and ignores a response after closing", async () => {
  const { request, panel } = await setup(true);
  request.mockRejectedValueOnce(new Error("Still unavailable."));
  fireEvent.click(panel.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(panel.getByRole("alert")).toHaveTextContent("Still unavailable."));
  let complete!: (value: Awaited<ReturnType<typeof request>>) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  fireEvent.click(panel.getByRole("button", { name: "Retry" }));
  dispose();
  complete({ collections: [], collectionIds: [], tags: [], tagIds: [] });
  await Promise.resolve();
  expect(screen.queryByRole("dialog", { name: "Organize item" })).toBeNull();
  expect(document.activeElement).toBe(document.body);
});

test("adds and removes tags in place and keeps the updated selection for the next request", async () => {
  const { request, onTagged, onClose, panel } = await setup();
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  fireEvent.click(panel.getByRole("button", { name: "Design" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Design" })).toHaveAttribute("aria-pressed", "true"));
  expect(onTagged).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(panel.getByRole("button", { name: "Design" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Design" })).toHaveAttribute("aria-pressed", "false"));
  expect(request).toHaveBeenLastCalledWith("tag", { tagId: "t1", assigned: false, expectedTagIds: ["t1"] });
});

test("offers tag creation and retains each search when switching organization types", async () => {
  const { request, panel } = await setup();
  fireEvent.input(panel.getByRole("searchbox"), { target: { value: "Reading" } });
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  const search = panel.getByRole("searchbox", { name: "Find a tag" });
  expect(search).toHaveFocus();
  fireEvent.input(search, { target: { value: "New topic" } });
  fireEvent.click(panel.getByRole("button", { name: "Create “New topic”" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("tag", { tagName: "New topic", assigned: true, expectedTagIds: [] }));
  fireEvent.click(panel.getByRole("button", { name: "Collection" }));
  expect(panel.getByRole("searchbox")).toHaveValue("Reading");
});

test("keeps a failed creation available for retry and renders names as text", async () => {
  const { request, onMoved, panel } = await setup();
  request.mockRejectedValueOnce(new Error("Try again."));
  const search = panel.getByRole("searchbox");
  fireEvent.input(search, { target: { value: "<img src=x>" } });
  fireEvent.click(panel.getByRole("button", { name: "Create “<img src=x>”" }));
  await expect(screen.findByRole("alert")).resolves.toHaveTextContent("Try again.");
  expect(search).not.toBeDisabled();
  expect(panel.getByRole("button", { name: "Create “<img src=x>”" })).not.toBeDisabled();
  expect(document.querySelector("img")).toBeNull();
  expect(onMoved).not.toHaveBeenCalled();
});

test.each(["", "  rea  ", "  UNS  "])("only offers Create with zero collection matches: %s", async (value) => {
  const { panel } = await setup();
  fireEvent.input(panel.getByRole("searchbox"), { target: { value } });
  expect(panel.queryByRole("button", { name: /Create/ })).toBeNull();
});

test("counts assigned tag substring matches", async () => {
  const { panel } = await setup();
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  fireEvent.click(panel.getByRole("button", { name: "Design" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Design" })).toHaveAttribute("aria-pressed", "true"));
  fireEvent.input(panel.getByRole("searchbox"), { target: { value: "  SIG  " } });
  expect(panel.queryByRole("button", { name: /Create/ })).toBeNull();
});

const refreshed = {
  collections: [{ id: "c1", name: "Reading" }, { id: "c2", name: "Side projects" }], collectionIds: ["c2"],
  tags: [{ id: "t1", name: "Design" }], tagIds: [] as string[],
};

test("refreshes authoritative IDs after creation, repeated moves, and moving to Unsorted", async () => {
  const { panel, request, onMoved, onClose } = await setup();
  request.mockResolvedValueOnce({ collectionName: "Side projects", changed: true }).mockResolvedValueOnce(refreshed);
  fireEvent.input(panel.getByRole("searchbox"), { target: { value: "Side projects" } });
  fireEvent.click(panel.getByRole("button", { name: "Create “Side projects”" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Side projects" })).toHaveFocus());
  expect(onMoved).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.input(panel.getByRole("searchbox"), { target: { value: "" } });
  request.mockResolvedValueOnce({ collectionName: "Reading", changed: true }).mockResolvedValueOnce({ ...refreshed, collectionIds: ["c1"] });
  fireEvent.click(panel.getByRole("button", { name: "Reading" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true"));
  expect(request).toHaveBeenCalledWith("move", { collectionId: "c1", expectedCollectionIds: ["c2"] });
  request.mockResolvedValueOnce({ collectionName: "Unsorted", changed: true }).mockResolvedValueOnce({ ...refreshed, collectionIds: [] });
  fireEvent.click(panel.getByRole("button", { name: "Unsorted" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true"));
  expect(request).toHaveBeenCalledWith("move", { collectionId: null, expectedCollectionIds: ["c1"] });
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  fireEvent.click(panel.getByRole("button", { name: "Design" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("tag", { tagId: "t1", assigned: true, expectedTagIds: [] }));
});

test("notifies a no-op move and preserves independent queries", async () => {
  const { panel, request, onMoved } = await setup();
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  fireEvent.input(panel.getByRole("searchbox"), { target: { value: "Des" } });
  fireEvent.click(panel.getByRole("button", { name: "Collection" }));
  fireEvent.input(panel.getByRole("searchbox"), { target: { value: "Uns" } });
  request.mockResolvedValueOnce({ collectionName: "Unsorted", changed: false }).mockResolvedValueOnce({ ...refreshed, collectionIds: [] });
  fireEvent.click(panel.getByRole("button", { name: "Unsorted" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(onMoved).toHaveBeenCalledExactlyOnceWith({ collectionName: "Unsorted", changed: false });
  expect(panel.getByRole("searchbox")).toHaveValue("Uns");
  fireEvent.click(panel.getByRole("button", { name: "Tags" }));
  expect(panel.getByRole("searchbox")).toHaveValue("Des");
});

test("separates a successful move from refresh failure and retries only the read", async () => {
  const { panel, request, onMoved, onClose } = await setup();
  request.mockResolvedValueOnce({ collectionName: "Reading", changed: true }).mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(panel.getByRole("button", { name: "Reading" }));
  await waitFor(() => expect(panel.getByRole("alert")).toHaveTextContent(/Saved.*refresh/i));
  expect(onMoved).toHaveBeenCalledOnce();
  expect(panel.getByRole("button", { name: "Reading" })).toBeDisabled();
  expect(panel.getByRole("searchbox")).toBeDisabled();
  expect(panel.getByRole("button", { name: "Close organizer" })).not.toBeDisabled();
  request.mockResolvedValueOnce({ ...refreshed, collectionIds: ["c1"] });
  fireEvent.click(panel.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Reading" })).not.toBeDisabled());
  expect(request.mock.calls.filter(([operation]) => operation === "move")).toHaveLength(1);
  expect(onMoved).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
});

test("retains Close and Escape after refresh fails and ignores a disposed move", async () => {
  const { panel, request, onMoved, onClose } = await setup();
  request.mockResolvedValueOnce({ collectionName: "Reading", changed: true }).mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(panel.getByRole("button", { name: "Reading" }));
  await panel.findByRole("alert");
  fireEvent.keyDown(panel.getByRole("button", { name: "Close organizer" }), { key: "Escape" });
  expect(onClose).toHaveBeenCalledWith(true);
  request.mockResolvedValueOnce(refreshed);
  fireEvent.click(panel.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Reading" })).not.toBeDisabled());
  let complete!: (value: Awaited<ReturnType<typeof request>>) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  fireEvent.click(panel.getByRole("button", { name: "Reading" }));
  dispose();
  complete({ collectionName: "Reading", changed: true });
  await Promise.resolve();
  expect(onMoved).toHaveBeenCalledOnce();
});
