import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { applyItemOrg } from "@/persistence/apply-item-org";
import { listCollections } from "@/persistence/collections";
import { createImage, createLink, createNote } from "@/persistence/items";
import { listTags } from "@/persistence/tags";
import { CaptureHost, isCaptureOpenShortcut } from "./capture-host";
import { enrichLinkPreview } from "./enrich-link-preview";
import { readClipboardImageAndText } from "./read-clipboard-capture";

vi.mock("@/persistence/items", () => ({
  createNote: vi.fn(),
  createLink: vi.fn(),
  createImage: vi.fn(),
}));

vi.mock("@/persistence/apply-item-org", () => ({
  applyItemOrg: vi.fn(),
}));

vi.mock("@/persistence/tags", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
}));

vi.mock("@/persistence/collections", () => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
}));

vi.mock("./enrich-link-preview", () => ({
  enrichLinkPreview: vi.fn(),
}));

vi.mock("./read-clipboard-capture", () => ({
  readClipboardImageAndText: vi.fn(),
}));

async function openDraft(text: string) {
  render(<CaptureHost />);
  fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
  const input = await screen.findByLabelText("Link, note, or image");
  await waitFor(() => expect(input).not.toBeDisabled());
  fireEvent.change(input, { target: { value: text } });
  return input;
}

describe("isCaptureOpenShortcut", () => {
  test("matches Alt/Option+K and rejects Ctrl+K or Cmd+K", () => {
    expect(
      isCaptureOpenShortcut(
        new KeyboardEvent("keydown", { altKey: true, code: "KeyK" }),
      ),
    ).toBe(true);
    expect(
      isCaptureOpenShortcut(
        new KeyboardEvent("keydown", { ctrlKey: true, code: "KeyK" }),
      ),
    ).toBe(false);
    expect(
      isCaptureOpenShortcut(
        new KeyboardEvent("keydown", { metaKey: true, code: "KeyK" }),
      ),
    ).toBe(false);
  });
});

describe("CaptureHost", () => {
  beforeEach(() => {
    vi.mocked(createNote).mockReset();
    vi.mocked(createLink).mockReset();
    vi.mocked(createImage).mockReset();
    vi.mocked(applyItemOrg).mockReset();
    vi.mocked(applyItemOrg).mockResolvedValue(undefined);
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(enrichLinkPreview).mockReset();
    vi.mocked(readClipboardImageAndText).mockReset();
    vi.mocked(readClipboardImageAndText).mockResolvedValue({
      image: null,
      text: "",
    });
  });

  test("opens on Alt+K and ignores Ctrl+K", async () => {
    render(<CaptureHost />);

    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  test("blocks the dialog cancel event while saving", async () => {
    vi.mocked(createNote).mockImplementation(
      () =>
        new Promise(() => {
          /* hang until unmount */
        }),
    );

    const input = await openDraft("hello from capture");
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    const cancelEvent = new Event("cancel", { bubbles: true, cancelable: true });
    dialog.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);

    // Regression: Escape/native close can still attempt to close the dialog while
    // the reducer is in `saving`. We should re-open to keep UI+reducer consistent.
    //
    // jsdom's dialog.close() doesn't reliably trigger the same event sequence
    // as a real browser Escape, so we dispatch the DOM "close" event directly.
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
    await waitFor(() => expect(dialog.open).toBe(true));
  });

  test("ignores a second submit while a write is in flight", async () => {
    vi.mocked(createNote).mockImplementation(
      () =>
        new Promise((resolve) => {
          window.setTimeout(() => {
            resolve(
              buildNote({ content: "hello from capture" }, { id: "n1", now: 1 }),
            );
          }, 50);
        }),
    );

    const input = await openDraft("hello from capture");
    const form = input.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createNote).toHaveBeenCalledTimes(1);
    });
  });

  test("after saving a link, starts preview enrichment", async () => {
    const link = buildLink(
      { url: "https://example.com/article" },
      { id: "l1", now: 1 },
    );
    vi.mocked(createLink).mockResolvedValue(link);

    const input = await openDraft("https://example.com/article");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(createLink).toHaveBeenCalledWith({
        url: "https://example.com/article",
      });
    });
    expect(enrichLinkPreview).toHaveBeenCalledWith(
      "l1",
      "https://example.com/article",
    );
  });

  test("paste while open picks up an image copied after the dialog opened", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const file = new File([pngBytes], "shot.png", { type: "image/png" });

    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() =>
      expect(screen.getByLabelText("Link, note, or image")).not.toBeDisabled(),
    );

    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({
      image: file,
      text: "",
    });
    fireEvent.click(screen.getByRole("button", { name: "Paste image" }));

    await waitFor(() => {
      const preview = screen.getByRole("dialog").querySelector("img");
      expect(preview).not.toBeNull();
      expect(preview).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    });
  });

  test("second paste adds another image instead of replacing the first", async () => {
    const first = new File([new Uint8Array([1])], "one.png", {
      type: "image/png",
    });
    const second = new File([new Uint8Array([2])], "two.png", {
      type: "image/png",
    });

    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() =>
      expect(screen.getByLabelText("Link, note, or image")).not.toBeDisabled(),
    );

    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({
      image: first,
      text: "",
    });
    fireEvent.click(screen.getByRole("button", { name: "Paste image" }));
    expect(await screen.findByLabelText("1 image attached")).toBeInTheDocument();

    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({
      image: second,
      text: "",
    });
    fireEvent.click(screen.getByRole("button", { name: "Paste image" }));

    expect(await screen.findByLabelText("2 images attached")).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelectorAll("img")).toHaveLength(2);

    vi.mocked(createImage).mockResolvedValue(
      buildImageFromAssetIds(
        { assetIds: ["a1", "a2"] },
        { id: "img1", now: 1 },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createImage).toHaveBeenCalledWith({
        assets: [
          { bytes: expect.any(Uint8Array), mimeType: "image/png" },
          { bytes: expect.any(Uint8Array), mimeType: "image/png" },
        ],
        sourceUrl: undefined,
        caption: undefined,
      });
    });
  });

  test("choose images saves one gallery item with multiple assets", async () => {
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() =>
      expect(screen.getByLabelText("Link, note, or image")).not.toBeDisabled(),
    );

    vi.mocked(createImage).mockResolvedValue(
      buildImageFromAssetIds(
        { assetIds: ["a1", "a2"] },
        { id: "img1", now: 1 },
      ),
    );

    const fileInput = screen.getByRole("dialog").querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File([new Uint8Array([1])], "one.png", { type: "image/png" }),
          new File([new Uint8Array([2, 3])], "two.png", { type: "image/png" }),
        ],
      },
    });

    expect(await screen.findByLabelText("2 images attached")).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelectorAll("img")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createImage).toHaveBeenCalledWith({
        assets: [
          { bytes: expect.any(Uint8Array), mimeType: "image/png" },
          { bytes: expect.any(Uint8Array), mimeType: "image/png" },
        ],
        sourceUrl: undefined,
        caption: undefined,
      });
    });
    expect(applyItemOrg).not.toHaveBeenCalled();
  });

  test("save applies draft tags and collection after the item exists", async () => {
    const link = buildLink(
      { url: "https://example.com/article" },
      { id: "l1", now: 1 },
    );
    vi.mocked(createLink).mockResolvedValue(link);

    const input = await openDraft("https://example.com/article");
    fireEvent.change(screen.getByPlaceholderText("Tag name"), {
      target: { value: "work" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Tag name"), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.change(screen.getByPlaceholderText("Collection name"), {
      target: { value: "Reading" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Collection name"), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(createLink).toHaveBeenCalledTimes(1);
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: ["work"],
        collectionName: "Reading",
      });
    });
  });

  test("chip picks assign existing tag and collection without typing", async () => {
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "work", createdAt: 1 },
      { id: "t2", name: "colors", createdAt: 1 },
    ]);
    vi.mocked(listCollections).mockResolvedValue([
      {
        id: "c1",
        name: "Reading",
        createdAt: 1,
        pinnedItemIds: [],
      },
    ]);

    const link = buildLink(
      { url: "https://example.com/article" },
      { id: "l1", now: 1 },
    );
    vi.mocked(createLink).mockResolvedValue(link);

    const input = await openDraft("https://example.com/article");
    fireEvent.click(await screen.findByRole("button", { name: "colors" }));
    fireEvent.click(screen.getByRole("button", { name: "Reading" }));
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: ["colors"],
        collectionName: "Reading",
      });
    });
  });

  test("if filing fails, retry does not create a second item", async () => {
    const link = buildLink(
      { url: "https://example.com/article" },
      { id: "l1", now: 1 },
    );
    vi.mocked(createLink).mockResolvedValue(link);
    vi.mocked(applyItemOrg)
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(undefined);

    const input = await openDraft("https://example.com/article");
    fireEvent.change(screen.getByPlaceholderText("Tag name"), {
      target: { value: "work" },
    });
    fireEvent.submit(input.closest("form")!);

    expect(
      await screen.findByText(
        "Saved, but couldn't add tags or collection. Try again.",
      ),
    ).toBeInTheDocument();
    expect(createLink).toHaveBeenCalledTimes(1);
    expect(applyItemOrg).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(applyItemOrg).toHaveBeenCalledTimes(2);
    });
    expect(createLink).toHaveBeenCalledTimes(1);
    expect(applyItemOrg).toHaveBeenNthCalledWith(2, "l1", {
      tagNames: ["work"],
      collectionName: null,
    });
  });
});
