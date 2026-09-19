import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { applyItemOrg } from "@/persistence/apply-item-org";
import { listCollections } from "@/persistence/collections";
import { createOrReuseImage, createOrReuseLink, createNote, findImageByAssetPayloads, findLinkByNormalizedUrl, clearCollectionOnItem, listItems, replaceItemTagsByNames } from "@/persistence/items";
import { listTags } from "@/persistence/tags";
import { getLibraryPreferences } from "@/persistence/library-preferences";
import { CaptureHost, isCaptureOpenShortcut } from "./capture-host";
import { enrichLinkPreview } from "./enrich-link-preview";
import { readClipboardImageAndText } from "./read-clipboard-capture";

vi.mock("@/persistence/items", () => ({
  createNote: vi.fn(),
  createLink: vi.fn(),
  createImage: vi.fn(),
  createOrReuseLink: vi.fn(),
  createOrReuseImage: vi.fn(),
  findLinkByNormalizedUrl: vi.fn(),
  findImageByAssetPayloads: vi.fn(),
  clearCollectionOnItem: vi.fn(),
  listItems: vi.fn(),
  replaceItemTagsByNames: vi.fn(),
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

vi.mock("@/persistence/library-preferences", () => ({
  getLibraryPreferences: vi.fn(),
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
    vi.mocked(createOrReuseLink).mockReset();
    vi.mocked(createOrReuseImage).mockReset();
    vi.mocked(findLinkByNormalizedUrl).mockReset();
    vi.mocked(findLinkByNormalizedUrl).mockResolvedValue(null);
    vi.mocked(findImageByAssetPayloads).mockReset();
    vi.mocked(findImageByAssetPayloads).mockResolvedValue(null);
    vi.mocked(clearCollectionOnItem).mockReset();
    vi.mocked(listItems).mockReset();
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(replaceItemTagsByNames).mockReset();
    vi.mocked(applyItemOrg).mockReset();
    vi.mocked(applyItemOrg).mockResolvedValue(undefined);
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(getLibraryPreferences).mockReset();
    vi.mocked(getLibraryPreferences).mockResolvedValue({
      id: "library",
      pinnedCollectionIds: [],
    });
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

  test("blocks drawer dismissal while saving", async () => {
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
    expect(screen.getByRole("button", { name: "Close drawer" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("dialog", { name: "Save to Keepall" })).toBeVisible();
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
    vi.mocked(createOrReuseLink).mockResolvedValue({ link, created: true });

    const input = await openDraft("https://example.com/article");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(createOrReuseLink).toHaveBeenCalledWith({
        url: "https://example.com/article",
      });
    });
    expect(enrichLinkPreview).toHaveBeenCalledWith(
      "l1",
      "https://example.com/article",
    );
  });

  test("reuses an existing link instead of creating a second card", async () => {
    const existing = buildLink(
      { url: "https://example.com/article" },
      { id: "l1", now: 1 },
    );
    vi.mocked(findLinkByNormalizedUrl).mockResolvedValue(existing);
    vi.mocked(createOrReuseLink).mockResolvedValue({
      link: existing,
      created: false,
    });

    const input = await openDraft("https://www.example.com/article/");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(createOrReuseLink).toHaveBeenCalledTimes(1);
    });
    expect(enrichLinkPreview).not.toHaveBeenCalled();
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  test("reuses an existing image and asks when collection differs", async () => {
    const existing = {
      ...buildImageFromAssetIds(
        { assetIds: ["a1"] },
        { id: "img1", now: 1 },
      ),
      collectionIds: ["c-reading"],
    };
    vi.mocked(findImageByAssetPayloads).mockResolvedValue(existing);
    vi.mocked(listCollections).mockResolvedValue([
      {
        id: "c-reading",
        name: "Reading",
        createdAt: 1,
        pinnedItemIds: [],
      },
    ]);
    vi.mocked(createOrReuseImage).mockResolvedValue({
      image: existing,
      created: false,
    });

    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() =>
      expect(screen.getByLabelText("Link, note, or image")).not.toBeDisabled(),
    );

    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", {
      type: "image/png",
    });
    const fileInput = screen.getByRole("dialog").querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByLabelText("1 image attached")).toBeInTheDocument();

    fireEvent.change(
      await screen.findByPlaceholderText("Filter or new collection…"),
      { target: { value: "Work" } },
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Filter or new collection…"), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("heading", { name: "Already saved" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Move to “Work”/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(createOrReuseImage).toHaveBeenCalledTimes(1);
      expect(applyItemOrg).toHaveBeenCalledWith("img1", {
        tagNames: [],
        collectionName: "Work",
      });
    });
  });

  test("asks keep or move in a separate modal when the collection differs", async () => {
    const existing = {
      ...buildLink(
        { url: "https://example.com/article" },
        { id: "l1", now: 1 },
      ),
      collectionIds: ["c-reading"],
    };
    vi.mocked(findLinkByNormalizedUrl).mockResolvedValue(existing);
    vi.mocked(listCollections).mockResolvedValue([
      {
        id: "c-reading",
        name: "Reading",
        createdAt: 1,
        pinnedItemIds: [],
      },
    ]);
    vi.mocked(createOrReuseLink).mockResolvedValue({
      link: existing,
      created: false,
    });

    const input = await openDraft("https://example.com/article");
    fireEvent.change(
      await screen.findByPlaceholderText("Filter or new collection…"),
      { target: { value: "Work" } },
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Filter or new collection…"), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.submit(input.closest("form")!);

    expect(
      await screen.findByRole("heading", { name: "Already saved" }),
    ).toBeInTheDocument();
    expect(createOrReuseLink).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Move to “Work”/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(createOrReuseLink).toHaveBeenCalledTimes(1);
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: [],
        collectionName: "Work",
      });
    });
  });

  test("tag conflict offers keep, replace, and merge in the conflict modal", async () => {
    const existing = {
      ...buildLink(
        { url: "https://example.com/article" },
        { id: "l1", now: 1 },
      ),
      tagIds: ["t-old"],
    };
    vi.mocked(findLinkByNormalizedUrl).mockResolvedValue(existing);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t-old", name: "old", createdAt: 1 },
    ]);
    vi.mocked(createOrReuseLink).mockResolvedValue({
      link: existing,
      created: false,
    });
    vi.mocked(replaceItemTagsByNames).mockResolvedValue(existing);

    const input = await openDraft("https://example.com/article");
    fireEvent.change(
      await screen.findByPlaceholderText("Filter or create tag…"),
      { target: { value: "new" } },
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Filter or create tag…"), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.submit(input.closest("form")!);

    expect(
      await screen.findByRole("heading", { name: "Already saved" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Keep existing/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Use new only/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Merge both/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Use new only/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(replaceItemTagsByNames).toHaveBeenCalledWith("l1", ["new"]);
    });
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

    vi.mocked(createOrReuseImage).mockResolvedValue({
      image: buildImageFromAssetIds(
        { assetIds: ["a1", "a2"] },
        { id: "img1", now: 1 },
      ),
      created: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createOrReuseImage).toHaveBeenCalledWith({
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

    vi.mocked(createOrReuseImage).mockResolvedValue({
      image: buildImageFromAssetIds(
        { assetIds: ["a1", "a2"] },
        { id: "img1", now: 1 },
      ),
      created: true,
    });

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
      expect(createOrReuseImage).toHaveBeenCalledWith({
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
    vi.mocked(createOrReuseLink).mockResolvedValue({ link, created: true });

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
      expect(createOrReuseLink).toHaveBeenCalledTimes(1);
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: ["work"],
        collectionName: null,
      });
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: [],
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
    vi.mocked(createOrReuseLink).mockResolvedValue({ link, created: true });

    const input = await openDraft("https://example.com/article");
    fireEvent.click(await screen.findByRole("button", { name: "colors" }));
    fireEvent.click(screen.getByRole("button", { name: "Reading" }));
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: ["colors"],
        collectionName: null,
      });
      expect(applyItemOrg).toHaveBeenCalledWith("l1", {
        tagNames: [],
        collectionName: "Reading",
      });
    });
  });

  test("shows six ranked organization choices while idle", async () => {
    vi.mocked(listTags).mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `t${index + 1}`,
        name: `Tag ${index + 1}`,
        createdAt: index + 1,
      })),
    );
    vi.mocked(listCollections).mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `c${index + 1}`,
        name: `Collection ${index + 1}`,
        createdAt: index + 1,
        pinnedItemIds: [],
      })),
    );
    vi.mocked(listItems).mockResolvedValue([
      {
        ...buildNote({ content: "First popular item" }, { id: "n1", now: 10 }),
        tagIds: ["t8"],
        collectionIds: ["c8"],
      },
      {
        ...buildNote({ content: "Second popular item" }, { id: "n2", now: 20 }),
        tagIds: ["t8"],
        collectionIds: ["c8"],
      },
      {
        ...buildNote({ content: "Recent item" }, { id: "n3", now: 100 }),
        tagIds: ["t7"],
        collectionIds: ["c7"],
      },
    ]);

    await openDraft("A compact capture drawer");

    const collections = await screen.findByRole("list", {
      name: "Collections",
    });
    expect(within(collections).getAllByRole("button")).toHaveLength(7);
    expect(within(collections).getByRole("button", { name: "Collection 8" })).toBeVisible();
    expect(within(collections).queryByRole("button", { name: "Collection 6" })).toBeNull();

    const tags = screen.getByRole("list", { name: "Existing tags" });
    expect(within(tags).getAllByRole("button")).toHaveLength(6);
    expect(within(tags).getByRole("button", { name: "Tag 8" })).toBeVisible();
    expect(within(tags).queryByRole("button", { name: "Tag 6" })).toBeNull();
    expect(screen.getByRole("button", { name: "Browse all collections" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Browse all tags" })).toBeVisible();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Collection" }),
      { target: { value: "Collection 6" } },
    );
    expect(
      within(collections).getByRole("button", { name: "Collection 6" }),
    ).toBeVisible();
  });

  test("shows pinned collections before automatically ranked collections", async () => {
    vi.mocked(listCollections).mockResolvedValue([
      { id: "popular", name: "Popular", createdAt: 1, pinnedItemIds: [] },
      { id: "pinned", name: "Pinned", createdAt: 2, pinnedItemIds: [] },
    ]);
    vi.mocked(listItems).mockResolvedValue([
      {
        ...buildNote({ content: "Popular item" }, { id: "n1", now: 100 }),
        collectionIds: ["popular"],
      },
    ]);
    vi.mocked(getLibraryPreferences).mockResolvedValue({
      id: "library",
      pinnedCollectionIds: ["pinned"],
    });

    await openDraft("Pinned capture choice");

    const buttons = within(
      await screen.findByRole("list", { name: "Collections" }),
    ).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Unsorted",
      "Pinned",
      "Popular",
    ]);
  });

  test("browse all can select an organization outside the compact choices", async () => {
    vi.mocked(listCollections).mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `c${index + 1}`,
        name: `Collection ${index + 1}`,
        createdAt: index + 1,
        pinnedItemIds: [],
      })),
    );

    await openDraft("Pick a less common collection");
    fireEvent.click(
      await screen.findByRole("button", { name: "Browse all collections" }),
    );

    const chooser = screen.getByRole("dialog", {
      name: "Choose a collection",
    });
    fireEvent.change(
      within(chooser).getByRole("searchbox", { name: "Search collections" }),
      { target: { value: "Collection 8" } },
    );
    fireEvent.click(
      within(chooser).getByRole("button", { name: "Collection 8" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "Choose a collection" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Collection 8" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("if filing fails, retry does not create a second item", async () => {
    const link = buildLink(
      { url: "https://example.com/article" },
      { id: "l1", now: 1 },
    );
    vi.mocked(createOrReuseLink).mockResolvedValue({ link, created: true });
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
    expect(createOrReuseLink).toHaveBeenCalledTimes(1);
    expect(applyItemOrg).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(applyItemOrg).toHaveBeenCalledTimes(2);
    });
    expect(createOrReuseLink).toHaveBeenCalledTimes(1);
    expect(applyItemOrg).toHaveBeenNthCalledWith(2, "l1", {
      tagNames: ["work"],
      collectionName: null,
    });
  });
});
