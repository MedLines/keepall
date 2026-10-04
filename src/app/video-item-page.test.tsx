import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildVideo } from "@/domain/video";
import { createCollection, listCollections } from "@/persistence/collections";
import { clearCollectionOnItem, assignCollectionToItem, getItem } from "@/persistence/items";
import { listTags } from "@/persistence/tags";
import { getVideoBlob } from "@/persistence/videos";
import { VideoItemPage } from "./video-item-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/persistence/items", () => ({ clearCollectionOnItem: vi.fn(), getItem: vi.fn(), deleteItem: vi.fn(), assignTagToItem: vi.fn(), unassignTagFromItem: vi.fn(), assignCollectionToItem: vi.fn() }));
vi.mock("@/persistence/tags", () => ({ createTag: vi.fn(), listTags: vi.fn() }));
vi.mock("@/persistence/collections", () => ({ createCollection: vi.fn(), listCollections: vi.fn() }));
vi.mock("@/persistence/videos", () => ({ getVideoBlob: vi.fn(), updateVideoDetails: vi.fn() }));
vi.mock("./use-thumbnail-object-url", () => ({ useThumbnailObjectUrl: () => null }));

const video = buildVideo({ assetId: "asset-1", fileName: "tiny.mp4", title: "A video", noteContent: "Keep these notes" }, { id: "video-1", now: 1 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(getItem).mockReset().mockResolvedValue(video);
  vi.mocked(getVideoBlob).mockReset().mockResolvedValue(new Blob(["video"], { type: "video/mp4" }));
  vi.mocked(listTags).mockReset().mockResolvedValue([]);
  vi.mocked(listCollections).mockReset().mockResolvedValue([]);
  vi.mocked(createCollection).mockReset();
  vi.mocked(assignCollectionToItem).mockReset();
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:video-1"), revokeObjectURL: vi.fn() });
});

describe("VideoItemPage", () => {
  test("shows loading until a delayed file read finishes and revokes its URL on unmount", async () => {
    const read = deferred<Blob | null>();
    vi.mocked(getVideoBlob).mockReturnValue(read.promise);
    const view = render(<VideoItemPage itemId="video-1" returnHref="/" />);
    await screen.findByRole("heading", { name: "A video" });
    expect(screen.getByText("Loading video…")).toBeVisible();
    expect(document.querySelector("video[controls]")).toBeNull();
    read.resolve(new Blob(["video"]));
    await waitFor(() => expect(document.querySelector("video[controls]")).toHaveAttribute("src", "blob:video-1"));
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:video-1");
  });

  test.each([
    ["missing", null, /video file is missing/i],
    ["read error", new Error("read failed"), /couldn't load video/i],
  ])("shows a terminal %s state with retry", async (_name, result, message) => {
    if (result instanceof Error) vi.mocked(getVideoBlob).mockRejectedValueOnce(result);
    else vi.mocked(getVideoBlob).mockResolvedValueOnce(result);
    render(<VideoItemPage itemId="video-1" returnHref="/" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Loading video…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry video" })).toBeVisible();
    if (_name === "missing") expect(screen.getByRole("link", { name: "Check backups in Settings" })).toHaveAttribute("href", "/settings#backup-heading");
    expect(screen.getByText("Keep these notes")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry video" }));
    await waitFor(() => expect(document.querySelector("video[controls]")).toHaveAttribute("src", "blob:video-1"));
  });

  test("shows playback guidance while preserving notes", async () => {
    render(<VideoItemPage itemId="video-1" returnHref="/" />);
    await waitFor(() => expect(document.querySelector("video[controls]")).toBeTruthy());
    fireEvent.error(document.querySelector("video[controls]")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/browser couldn't play/i);
    expect(screen.queryByText("Loading video…")).not.toBeInTheDocument();
    expect(screen.getByText("Keep these notes")).toBeVisible();
  });

  test("retries playback with a fresh URL and revokes each created URL once", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const view = render(<VideoItemPage itemId="video-1" returnHref="/" />);
    await waitFor(() => expect(document.querySelector("video[controls]")).toHaveAttribute("src", "blob:first"));
    fireEvent.error(document.querySelector("video[controls]")!);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry video" }));
    await waitFor(() => expect(document.querySelector("video[controls]")).toHaveAttribute("src", "blob:second"));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:first");
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:second");
  });

  test("does not let organization errors replace the ready player", async () => {
    vi.mocked(createCollection).mockRejectedValueOnce(new Error("write failed"));
    render(<VideoItemPage itemId="video-1" returnHref="/" />);
    await waitFor(() => expect(document.querySelector("video[controls]")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Organize" }));
    const drawer = screen.getByRole("dialog", { name: /organize/i });
    fireEvent.change(within(drawer).getByRole("textbox", { name: "Move to collection" }), { target: { value: "Test" } });
    fireEvent.keyDown(within(drawer).getByRole("textbox", { name: "Move to collection" }), { key: "Enter" });
    await waitFor(() => expect(drawer).toHaveTextContent("Couldn't update video organization."));
    expect(document.querySelector("video[controls]")).toBeTruthy();
    expect(screen.queryByText("Loading video…")).not.toBeInTheDocument();
  });

  test("ignores a stale item and file read after switching items", async () => {
    const oldRead = deferred<Blob | null>();
    const nextRead = deferred<Blob | null>();
    const nextItemRead = deferred<ReturnType<typeof buildVideo>>();
    vi.mocked(getVideoBlob).mockImplementation((id) => id === "asset-1" ? oldRead.promise : nextRead.promise);
    const next = buildVideo({ assetId: "asset-2", fileName: "next.mp4", title: "Next video" }, { id: "video-2", now: 2 });
    vi.mocked(getItem).mockImplementation((id) => id === "video-1" ? Promise.resolve(video) : nextItemRead.promise);
    const view = render(<VideoItemPage itemId="video-1" returnHref="/" />);
    await waitFor(() => expect(getVideoBlob).toHaveBeenCalledWith("asset-1"));
    view.rerender(<VideoItemPage itemId="video-2" returnHref="/" />);
    expect(screen.queryByRole("heading", { name: "A video" })).not.toBeInTheDocument();
    oldRead.resolve(new Blob(["old"]));
    expect(screen.getByText("Loading video…")).toBeVisible();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    nextItemRead.resolve(next);
    await screen.findByRole("heading", { name: "Next video" });
    nextRead.resolve(new Blob(["next"]));
    await waitFor(() => expect(document.querySelector("video[controls]")).toHaveAttribute("src", "blob:video-1"));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});


test("moves video to Unsorted with busy protection, error retry, immediate state and retained tags", async () => {
  const original = { ...buildVideo({ assetId: "a", fileName: "clip.mp4", noteContent: "Keep" }, { id: "unsorted-test", now: 1 }), tagIds: ["t"], collectionIds: ["c"] };
  let stored = original;
  vi.mocked(getItem).mockImplementation(async () => stored);
  vi.mocked(listTags).mockResolvedValue([{ id: "t", name: "Reference", createdAt: 1 }]);
  vi.mocked(listCollections).mockResolvedValue([{ id: "c", name: "Reading", createdAt: 1, pinnedItemIds: [] }]);
  let reject!: (reason: Error) => void;
  vi.mocked(clearCollectionOnItem).mockReset().mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; })).mockImplementationOnce(async () => {
    stored = { ...original, collectionIds: [], updatedAt: 2 };
    return stored;
  });
  const changed = vi.fn();
  window.addEventListener("keepall:items-changed", changed);
  render(<VideoItemPage itemId="unsorted-test" returnHref="/" />);
  fireEvent.click(await screen.findByRole("button", { name: "Organize" }));
  fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
  expect(screen.getByRole("button", { name: "Unsorted" })).toBeDisabled();
  reject(new Error("failed"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Unsorted" })).toBeEnabled());
  expect(screen.getByRole("dialog")).toHaveTextContent("Couldn't");
  fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByRole("dialog")).toHaveTextContent("Reference");
  expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true");
  expect(clearCollectionOnItem).toHaveBeenCalledTimes(2);
  expect(createCollection).not.toHaveBeenCalled();
  expect(stored).toEqual({ ...original, collectionIds: [], updatedAt: 2 });
  expect(changed).toHaveBeenCalledOnce();
  window.removeEventListener("keepall:items-changed", changed);
});
