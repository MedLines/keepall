import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { applyItemOrg } from "@/persistence/apply-item-org";
import { listCollections } from "@/persistence/collections";
import { createOrReuseImage, createOrReuseLink, createNote, createImage, findImageByAssetPayloads, findLinkByNormalizedUrl, clearCollectionOnItem, listItems, replaceItemTagsByNames, updateLink } from "@/persistence/items";
import { listTags } from "@/persistence/tags";
import { getLibraryPreferences } from "@/persistence/library-preferences";
import { importFiles } from "@/persistence/file-import";
import { createDocument } from "@/persistence/documents";
import { CaptureHost, isCaptureOpenShortcut } from "./capture-host";
import { enrichLinkPreview } from "./enrich-link-preview";
import { readClipboardImageAndText } from "./read-clipboard-capture";
import { prepareLocalVideo } from "./prepare-local-video";
import { openCaptureDialog, setCaptureCollectionName } from "./capture-events";

vi.mock("@/persistence/items", () => ({
  createNote: vi.fn(),
  createLink: vi.fn(),
  createImage: vi.fn(),
  createOrReuseLink: vi.fn(),
  createOrReuseImage: vi.fn(),
  updateLink: vi.fn(),
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

vi.mock("@/persistence/file-import", () => ({ importFiles: vi.fn() }));
vi.mock("@/persistence/documents", () => ({ createDocument: vi.fn() }));

vi.mock("./enrich-link-preview", () => ({
  enrichLinkPreview: vi.fn(),
}));

vi.mock("./read-clipboard-capture", () => ({
  readClipboardImageAndText: vi.fn(),
}));

vi.mock("./prepare-local-video", () => ({
  prepareLocalVideo: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function pickVideo(file: File) {
  const input = screen.getByRole("dialog").querySelector(
    'input[data-capture-files]',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

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
    vi.mocked(createDocument).mockReset();
    vi.mocked(createImage).mockReset();
    setCaptureCollectionName(null);
    vi.mocked(createNote).mockReset();
    vi.mocked(createOrReuseLink).mockReset();
    vi.mocked(createOrReuseImage).mockReset();
    vi.mocked(updateLink).mockReset();
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
    vi.mocked(prepareLocalVideo).mockReset();
    vi.mocked(importFiles).mockReset();
  });

  for (const opener of ["shortcut", "button"] as const) {
    test(`defaults ${opener} capture to the active folder and allows overriding it`, async () => {
      vi.mocked(listCollections).mockResolvedValue([
        { id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] },
      ]);
      vi.mocked(createNote).mockResolvedValue(buildNote({ content: "In this folder" }, { id: "new", now: 1 }));
      setCaptureCollectionName("Reading");
      render(<CaptureHost />);
      if (opener === "shortcut") fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
      else openCaptureDialog();
      const input = await screen.findByLabelText("Link, note, or image");
      await waitFor(() => expect(input).not.toBeDisabled());
      await waitFor(() => expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true"));
      fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
      expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(screen.getByRole("button", { name: "Reading" }));
      fireEvent.change(input, { target: { value: "In this folder" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(applyItemOrg).toHaveBeenCalledWith("new", { tagNames: [], collectionName: "Reading" }));
    });
  }

  test("clipboard prefill and the initial folder are pristine, and text reversion clears dirty state", async () => {
    setCaptureCollectionName("Reading");
    vi.mocked(readClipboardImageAndText).mockResolvedValue({ image: null, text: "Clipboard note" });
    const input = await openDraft("Changed");
    fireEvent.change(input, { target: { value: "Clipboard note" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
  });

  test("organization changes on a note guard dismissal and footer Cancel still discards immediately", async () => {
    const input = await openDraft("Unfinished note");
    fireEvent.change(screen.getByRole("textbox", { name: "Tags" }), { target: { value: "Unsubmitted tag" } });
    fireEvent.keyDown(input, { key: "Escape" });
    const confirmation = await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tags" })).toHaveValue("Unsubmitted tag"));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull());
    expect(createNote).not.toHaveBeenCalled();
  });

  test("an empty drawer has no type controls and closes without confirmation despite organization changes", async () => {
    const input = await openDraft("");
    expect(screen.getByRole("button", { name: "Add files" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add video" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Note" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change type" })).toBeNull();
    expect(screen.queryByText(/Saving as (note|link)/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Tags" }), { target: { value: "Unsubmitted tag" } });
    fireEvent.change(input, { target: { value: "  \n " } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
  });

  test("clearing a note leaves no content to discard", async () => {
    const input = await openDraft("Temporary note");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
  });

  test("the saving type follows the text and exposes an override only for a URL", async () => {
    const input = await openDraft("My note");
    expect(screen.getByText("Saving as note")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Change type" })).toBeNull();
    fireEvent.change(input, { target: { value: "https://example.com/reference" } });
    expect(screen.getByText("Saving as link")).toBeVisible();
    expect(screen.getByRole("button", { name: "Change type" })).toBeEnabled();
    expect(screen.getByLabelText("Your note (optional)")).toBeVisible();
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.queryByText(/Saving as (link|note)/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Change type" })).toBeNull();
  });

  test.each(["", "Keep this context"])("Change type saves a URL as note text with its context '%s' without creating a link", async (context) => {
    const url = "https://example.com/reference";
    await openDraft(url);
    if (context) fireEvent.change(screen.getByLabelText("Your note (optional)"), { target: { value: context } });
    vi.mocked(createNote).mockResolvedValue(buildNote({ content: url }, { id: "url-note", now: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Change type" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Save as note" }));
    expect(screen.getByText("Saving as note")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createNote).toHaveBeenCalledWith({ content: context ? `${url}\n\n${context}` : url }));
    expect(createOrReuseLink).not.toHaveBeenCalled();
  });

  test("changing a URL back to link keeps its personal note and saves both together", async () => {
    const url = "https://example.com/reference";
    await openDraft(url);
    fireEvent.change(screen.getByLabelText("Your note (optional)"), { target: { value: "Keep this context" } });
    fireEvent.click(screen.getByRole("button", { name: "Change type" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Save as note" }));
    fireEvent.click(screen.getByRole("button", { name: "Change type" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Save as link" }));
    expect(screen.getByLabelText("Your note (optional)")).toHaveValue("Keep this context");
    vi.mocked(createOrReuseLink).mockResolvedValue({ link: buildLink({ url }, { id: "link", now: 1 }), created: true });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createOrReuseLink).toHaveBeenCalledWith({ url, noteContent: "Keep this context" }));
  });

  test("loads one text file into the editor, saves its edited text, and closes the drawer", async () => {
    await openDraft("");
    vi.mocked(createDocument).mockResolvedValue({ id: "doc" } as Awaited<ReturnType<typeof createDocument>>);
    pickVideo(new File(["Original text"], "note.txt"));
    const content = await screen.findByLabelText("Text content");
    expect(content).toHaveValue("Original text");
    expect(screen.queryByRole("dialog", { name: "Add files" })).toBeNull();
    fireEvent.change(content, { target: { value: "Edited text" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(createDocument).toHaveBeenCalledWith({ fileName: "note.txt", bytes: new TextEncoder().encode("Edited text") }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull(), { timeout: 2000 });
  });

  test.each(["txt", "md"])("importing a %s file replaces untouched clipboard text and saves only the file", async (extension) => {
    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({ image: null, text: "Old clipboard text" });
    vi.mocked(createDocument).mockResolvedValue({ id: "doc" } as Awaited<ReturnType<typeof createDocument>>);
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() => expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Old clipboard text"));
    pickVideo(new File(["File content"], `note.${extension}`));
    expect(await screen.findByLabelText(extension === "md" ? "Markdown content" : "Text content")).toHaveValue("File content");
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(createDocument).toHaveBeenCalledOnce());
    expect(new TextDecoder().decode(vi.mocked(createDocument).mock.calls[0][0].bytes)).toBe("File content");
  });

  test("importing a file preserves text the user edited, even if it matches the original clipboard", async () => {
    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({ image: null, text: "Keep this text" });
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    const input = await screen.findByLabelText("Link, note, or image");
    await waitFor(() => expect(input).toHaveValue("Keep this text"));
    fireEvent.change(input, { target: { value: "My edit" } });
    fireEvent.change(input, { target: { value: "Keep this text" } });
    pickVideo(new File(["File content"], "note.md"));
    expect(await screen.findByLabelText("Markdown content")).toHaveValue("Keep this text\n\nFile content");
  });

  test("importing text replaces untouched clipboard text while keeping attached images", async () => {
    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({ image: null, text: "https://old-clipboard.example" });
    vi.mocked(createImage).mockResolvedValue(buildImageFromAssetIds({ assetIds: ["asset"] }, { id: "combined", now: 1 }));
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() => expect(screen.getByLabelText("Link, note, or image")).toHaveValue("https://old-clipboard.example"));
    pickVideo(new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" }));
    await screen.findByLabelText("1 image attached");
    pickVideo(new File(["# File text"], "note.md"));
    expect(await screen.findByLabelText("Text beneath images")).toHaveValue("# File text");
    expect(screen.getByLabelText("1 image attached")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(createImage).toHaveBeenCalledWith(expect.objectContaining({ caption: "# File text", sourceUrl: undefined })));
  });

  test("importing a file preserves a personal note written beside an untouched clipboard URL", async () => {
    vi.mocked(readClipboardImageAndText).mockResolvedValueOnce({ image: null, text: "https://old-clipboard.example" });
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() => expect(screen.getByLabelText("Link, note, or image")).toHaveValue("https://old-clipboard.example"));
    fireEvent.change(screen.getByLabelText("Your note (optional)"), { target: { value: "My own note" } });
    pickVideo(new File(["# File text"], "note.md"));
    expect(await screen.findByLabelText("Markdown content")).toHaveValue("My own note\n\n# File text");
  });

  test.each(["images first", "text first"])("saves images and Markdown as one item when added %s", async (order) => {
    await openDraft("");
    vi.mocked(createImage).mockResolvedValue(buildImageFromAssetIds({ assetIds: ["asset"] }, { id: "combined", now: 1 }));
    const image = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" });
    const text = new File(["# My text"], "note.md");
    if (order === "images first") {
      pickVideo(image);
      await screen.findByLabelText("1 image attached");
      pickVideo(text);
    } else {
      pickVideo(text);
      await screen.findByLabelText("Markdown content");
      pickVideo(image);
    }
    await screen.findByLabelText("1 image attached");
    const content = await screen.findByLabelText("Text beneath images");
    expect(content).toHaveValue("# My text");
    fireEvent.change(content, { target: { value: "# Edited caption" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(createImage).toHaveBeenCalledWith(expect.objectContaining({ caption: "# Edited caption", captionFormat: "markdown", sourceUrl: undefined })));
    expect(createDocument).not.toHaveBeenCalled();
    expect(createNote).not.toHaveBeenCalled();
  });

  test("a text file keeps its exact bytes when unchanged, including BOM and line endings", async () => {
    await openDraft("");
    vi.mocked(createDocument).mockResolvedValue({ id: "doc" } as Awaited<ReturnType<typeof createDocument>>);
    const bytes = new TextEncoder().encode("\uFEFFLine one\r\nLine two\r\n");
    pickVideo(new File([bytes], "exact.txt"));
    expect(await screen.findByLabelText("Text content")).toHaveValue("Line one\nLine two\n");
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(createDocument).toHaveBeenCalledOnce());
    const saved = vi.mocked(createDocument).mock.calls[0][0];
    expect(saved.fileName).toBe("exact.txt");
    expect(Array.from(saved.bytes)).toEqual(Array.from(bytes));
  });

  test("canceling a mixed selection preserves the draft without creating any items", async () => {
    await openDraft("Keep this text");
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [
      new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" }),
      new File(["# Note"], "note.md"),
    ] } });
    const review = await screen.findByRole("region", { name: "Selected files" });
    expect(within(review).queryByRole("radio")).toBeNull();
    fireEvent.click(within(review).getByRole("button", { name: "Remove file photo.png" }));
    fireEvent.click(within(review).getByRole("button", { name: "Remove file note.md" }));
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Keep this text");
    expect(screen.queryByLabelText("1 image attached")).toBeNull();
    expect(importFiles).not.toHaveBeenCalled();
    expect(createImage).not.toHaveBeenCalled();
    expect(createDocument).not.toHaveBeenCalled();
  });

  test("canceling during a file read prevents a late draft from appearing in the next drawer", async () => {
    await openDraft("");
    const pending = deferred<ArrayBuffer>();
    const file = new File(["Late text"], "late.txt");
    vi.spyOn(file, "arrayBuffer").mockReturnValue(pending.promise);
    pickVideo(file);
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull());
    await act(async () => pending.resolve(new TextEncoder().encode("Late text").buffer));
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    expect(await screen.findByLabelText("Link, note, or image")).toHaveValue("");
    expect(screen.queryByLabelText("Text content")).toBeNull();
  });

  test("the unified picker detects multiple text files without changing an existing capture", async () => {
    await openDraft("Keep this draft");
    const fileInput = screen.getByLabelText("Choose files");
    fireEvent.change(fileInput, { target: { files: [new File(["# Plan"], "plan.MD", { type: "application/octet-stream" }), new File(["Text"], "note.txt")] } });
    const review = await screen.findByRole("region", { name: "Selected files" });
    expect(review).toHaveTextContent("Markdown note");
    expect(review).toHaveTextContent("Text note");
    fireEvent.click(screen.getByRole("button", { name: "Bulk import" }));
    const bulk = await screen.findByRole("dialog", { name: "Bulk import" });
    expect(within(bulk).getByRole("button", { name: "Done" })).toBeEnabled();
    fireEvent.click(within(bulk).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Bulk import" })).toBeNull());
    fireEvent.click(within(review).getByRole("button", { name: "Remove file plan.MD" }));
    fireEvent.click(within(review).getByRole("button", { name: "Remove file note.txt" }));
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Keep this draft");
  });

  test("image preview survives Keep editing and is revoked once after confirmed discard", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockClear();
    const input = await openDraft("");
    const fileInput = input.closest("form")!.querySelector('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([137, 80, 78, 71])], "draft.png", { type: "image/png" })] } });
    await screen.findByLabelText("1 image attached");
    const preview = screen.getByLabelText("1 image attached").querySelector("img")!.src;
    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.getByLabelText("1 image attached")).toBeVisible());
    expect(revoke).not.toHaveBeenCalled();
    expect(screen.getByLabelText("1 image attached").querySelector("img")!.src).toBe(preview);
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save to Keepall" })).toBeNull());
    expect(revoke).toHaveBeenCalledExactlyOnceWith(preview);
    revoke.mockRestore();
  });

  test("opens on Alt+K and ignores Ctrl+K", async () => {
    render(<CaptureHost />);

    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  test("saves quick notes as plain and an opted-in note as Markdown", async () => {
    vi.mocked(createNote).mockResolvedValue(buildNote({ content: "# Card study" }, { id: "n1", now: 1 }));
    await openDraft("# Card study");
    const markdown = screen.getByRole("button", { name: "Markdown" });
    expect(markdown).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Plain text" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(markdown);
    expect(markdown).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Card study" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Plain text" }));
    expect(screen.getByLabelText("Note preview")).toHaveTextContent("# Card study");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(markdown);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createNote).toHaveBeenCalledWith({
      content: "# Card study",
      format: "markdown",
    }));
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

  test("a canceled video cannot replace a note in the next capture session", async () => {
    const preparation = deferred<Blob>();
    vi.mocked(prepareLocalVideo).mockReturnValue(preparation.promise);
    await openDraft("old draft");
    pickVideo(new File(["video A"], "A.mp4", { type: "video/mp4" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    const input = await screen.findByLabelText("Link, note, or image");
    fireEvent.change(input, { target: { value: "note B" } });
    await act(async () => {
      preparation.resolve(new Blob(["poster"]));
      await preparation.promise;
    });

    expect(screen.queryByPlaceholderText("Optional video title")).toBeNull();
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("note B");
    expect(screen.queryByText("Video: A.mp4")).toBeNull();
  });

  test("a current video preparation attaches its selected file", async () => {
    vi.mocked(prepareLocalVideo).mockResolvedValue(new Blob(["poster"]));
    await openDraft("video title");
    pickVideo(new File(["video"], "current.mp4", { type: "video/mp4" }));

    expect(await screen.findByText("Video: current.mp4")).toBeVisible();
    expect(screen.getByPlaceholderText("Optional video title")).toHaveValue("");
  });

  test("a canceled video rejection cannot show an error in the next session", async () => {
    const preparation = deferred<Blob>();
    vi.mocked(prepareLocalVideo).mockReturnValue(preparation.promise);
    await openDraft("old draft");
    pickVideo(new File(["video A"], "A.mp4", { type: "video/mp4" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    const input = await screen.findByLabelText("Link, note, or image");
    fireEvent.change(input, { target: { value: "note B" } });
    await act(async () => {
      preparation.reject(new Error("stale preparation failed"));
      await preparation.promise.catch(() => undefined);
    });

    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("note B");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("an old video cleanup cannot clear a newer video's preparing state", async () => {
    const first = deferred<Blob>();
    const second = deferred<Blob>();
    vi.mocked(prepareLocalVideo)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await openDraft("old draft");
    pickVideo(new File(["video A"], "A.mp4", { type: "video/mp4" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await screen.findByLabelText("Link, note, or image");
    pickVideo(new File(["video C"], "C.mp4", { type: "video/mp4" }));
    await act(async () => {
      first.resolve(new Blob(["poster A"]));
      await first.promise;
    });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByText("Video: A.mp4")).toBeNull();
    await act(async () => {
      second.resolve(new Blob(["poster C"]));
      await second.promise;
    });
    expect(await screen.findByText("Video: C.mp4")).toBeVisible();
  });

  test("settling a video preparation after unmount does not affect a fresh capture", async () => {
    const preparation = deferred<Blob>();
    vi.mocked(prepareLocalVideo).mockReturnValue(preparation.promise);
    const { unmount } = render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await screen.findByLabelText("Link, note, or image");
    pickVideo(new File(["video A"], "A.mp4", { type: "video/mp4" }));
    unmount();

    const input = await openDraft("note B");
    await act(async () => {
      preparation.resolve(new Blob(["poster A"]));
      await preparation.promise;
    });

    expect(input).toHaveValue("note B");
    expect(screen.queryByText("Video: A.mp4")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
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

  test("saves an optional Markdown personal note with a new link", async () => {
    const link = buildLink({ url: "https://example.com/article", noteContent: "## Useful", noteFormat: "markdown" }, { id: "l1", now: 1 });
    vi.mocked(createOrReuseLink).mockResolvedValue({ link, created: true });
    const input = await openDraft("https://example.com/article");
    expect(screen.getByLabelText("Your note (optional)")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your note (optional)"), { target: { value: "## Useful" } });
    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(createOrReuseLink).toHaveBeenCalledWith({
      url: "https://example.com/article", noteContent: "## Useful", noteFormat: "markdown",
    }));
  });

  test("keeps a link Markdown preview hidden until requested", async () => {
    await openDraft("https://example.com/article");
    fireEvent.change(screen.getByLabelText("Your note (optional)"), {
      target: { value: "## Useful" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));

    expect(screen.queryByLabelText("Personal note preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Useful" })).toBeVisible();
    expect(screen.queryByLabelText("Your note (optional)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByLabelText("Personal note preview")).toBeNull();
    expect(screen.getByLabelText("Your note (optional)")).toHaveValue("## Useful");
  });

  test("does not overwrite a different personal note on an existing link", async () => {
    vi.mocked(findLinkByNormalizedUrl).mockResolvedValue(buildLink({ url: "https://example.com/article", noteContent: "My existing note" }, { id: "l1", now: 1 }));
    const input = await openDraft("https://example.com/article");
    fireEvent.change(screen.getByLabelText("Your note (optional)"), { target: { value: "A different note" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/already has a personal note/)).toBeInTheDocument();
    expect(createOrReuseLink).not.toHaveBeenCalled();
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
      await screen.findByPlaceholderText("Find or create a collection…"),
      { target: { value: "Work" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Create collection “Work”" }));
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
      await screen.findByPlaceholderText("Find or create a collection…"),
      { target: { value: "Work" } },
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Find or create a collection…"), {
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
      await screen.findByPlaceholderText("Find or create a tag…"),
      { target: { value: "new" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Create tag “new”" }));
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

    fireEvent.paste(screen.getByLabelText("Link, note, or image"), {
      clipboardData: { items: [{ type: file.type, getAsFile: () => file }] },
    });

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

    fireEvent.paste(screen.getByLabelText("Link, note, or image"), {
      clipboardData: { items: [{ type: first.type, getAsFile: () => first }] },
    });
    expect(await screen.findByLabelText("1 image attached")).toBeInTheDocument();

    fireEvent.paste(screen.getByRole("dialog").querySelector("form")!, {
      clipboardData: { items: [{ type: second.type, getAsFile: () => second }] },
    });

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

  test("reviews mixed media without saving or replacing the existing text draft", async () => {
    await openDraft("An unrelated note draft");
    const fileInput = screen.getByRole("dialog").querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [
          new File([new Uint8Array([1])], "valid.png", { type: "image/png" }),
          new File([new Uint8Array([2])], "A very long video title.mp4", { type: "video/mp4" }),
        ],
      },
    });

    const review = await screen.findByRole("region", { name: "Selected files" });
    expect(review).toHaveTextContent("valid.png");
    expect(review).toHaveTextContent("A very long video title.mp4");
    expect(screen.queryByLabelText(/images? attached/)).toBeNull();
    expect(importFiles).not.toHaveBeenCalled();
    expect(findImageByAssetPayloads).not.toHaveBeenCalled();
    expect(createOrReuseImage).not.toHaveBeenCalled();
    expect(createNote).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "Remove file valid.png" }));
    fireEvent.click(within(review).getByRole("button", { name: "Remove file A very long video title.mp4" }));
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("An unrelated note draft");

    fireEvent.change(fileInput, {
      target: {
        files: [new File([new Uint8Array([3])], "valid.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByLabelText("1 image attached")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("choose images saves one gallery item with multiple assets", async () => {
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() =>
      expect(screen.getByLabelText("Link, note, or image")).not.toBeDisabled(),
    );

    vi.mocked(createImage).mockResolvedValue(buildImageFromAssetIds(
        { assetIds: ["a1", "a2"] },
        { id: "img1", now: 1 },
      ));

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

    fireEvent.click(await screen.findByRole("radio", { name: /One image item/ }));
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
        collectionName: undefined, tagNames: [],
      });
    });
    expect(applyItemOrg).not.toHaveBeenCalled();
  });

  test("removing one attachment preserves and saves the other image", async () => {
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first-image")
      .mockReturnValueOnce("blob:second-image");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    await openDraft("Keep this caption");
    const fileInput = screen.getByRole("dialog").querySelector('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [
      new File([new Uint8Array([1])], "one.png", { type: "image/png" }),
      new File([new Uint8Array([2, 3])], "two.png", { type: "image/png" }),
    ] } });
    fireEvent.click(await screen.findByRole("radio", { name: /One image item/ }));
    await screen.findByLabelText("2 images attached");
    fireEvent.click(screen.getByRole("button", { name: "Remove image 1" }));
    const images = screen.getByLabelText("1 image attached");
    expect(images.querySelector("img")).toHaveAttribute("src", "blob:second-image");
    expect(revoke).toHaveBeenCalledWith("blob:first-image");
    expect(revoke).not.toHaveBeenCalledWith("blob:second-image");
    expect(screen.getByLabelText("Optional source URL or caption")).toHaveValue("Keep this caption");
    vi.mocked(createOrReuseImage).mockResolvedValue({
      image: buildImageFromAssetIds({ assetIds: ["a2"] }, { id: "img1", now: 1 }), created: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createOrReuseImage).toHaveBeenCalledWith({
      assets: [{ bytes: new Uint8Array([2, 3]), mimeType: "image/png" }],
      caption: "Keep this caption", sourceUrl: undefined,
    }));
    revoke.mockRestore();
    vi.mocked(URL.createObjectURL).mockRestore();
  });

  test("Remove all images sits below attachments and returns to the text draft", async () => {
    await openDraft("Keep this note");
    const fileInput = screen.getByRole("dialog").querySelector('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [
      new File([new Uint8Array([1])], "one.png", { type: "image/png" }),
    ] } });
    const images = await screen.findByLabelText("1 image attached");
    const removeAll = screen.getByRole("button", { name: "Remove all images" });
    expect(images.nextElementSibling).toBe(removeAll);
    fireEvent.click(removeAll);
    expect(screen.queryByLabelText(/images? attached/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Keep this note");
    expect(screen.getByRole("button", { name: "Add files" })).toBeEnabled();
  });

  test("folder selection stays in the drawer with its collection, and removing it restores the draft", async () => {
    await openDraft("My unfinished note");
    fireEvent.click(screen.getByRole("button", { name: "Bulk import" }));
    const bulk = await screen.findByRole("dialog", { name: "Bulk import" });
    const file = new File([new Uint8Array([1])], "photo.png", { type: "image/png" });
    Object.defineProperty(file, "webkitRelativePath", { value: "Holiday/photo.png" });
    fireEvent.change(bulk.querySelector('input[webkitdirectory]')!, { target: { files: [file] } });
    await screen.findByLabelText("1 image attached");
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Holiday" })).toHaveAttribute("aria-pressed", "true");
    expect(importFiles).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove all images" }));
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("My unfinished note");
  });

  test("bookmark file import opens from Bulk import and cancel preserves the draft", async () => {
    await openDraft("Unfinished note");
    const drawer = screen.getByRole("dialog", { name: "Save to Keepall" });
    fireEvent.click(screen.getByRole("button", { name: "Bulk import" }));
    const bulk = await screen.findByRole("dialog", { name: "Bulk import" });
    expect(within(bulk).getByRole("button", { name: "Import bookmarks HTML" })).toBeEnabled();
    const file = new File(["<DL></DL>"], "bookmarks.html", { type: "text/html" });
    Object.defineProperty(file, "text", { value: async () => "<DL></DL>" });
    fireEvent.change(bulk.querySelector('input[accept*="text/html"]')!, { target: { files: [file] } });
    const review = await screen.findByRole("dialog", { name: "Import browser bookmarks" });
    expect(within(review).getByRole("radio", { name: /Browser folder → Unsorted only/ })).toBeChecked();
    fireEvent.click(within(review).getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    await waitFor(() => expect(within(drawer).getByRole("button", { name: "Save" })).toBeEnabled());
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Unfinished note");
  });

  test("folder import locks the drawer during writes and restores an existing draft afterward", async () => {
    const pending = deferred<Awaited<ReturnType<typeof importFiles>>>();
    vi.mocked(importFiles).mockImplementation((_files, options) => {
      options?.onProgress?.(1, { fileName: "photo.png", status: "saved", itemId: "photo" });
      options?.onProgress?.(2, { fileName: "readme.txt", status: "saved", itemId: "note" });
      return pending.promise;
    });
    await openDraft("Unfinished note");
    fireEvent.change(screen.getByPlaceholderText("Collection name"), { target: { value: "My photos" } });
    const drawer = screen.getByRole("dialog", { name: "Save to Keepall" });
    fireEvent.click(screen.getByRole("button", { name: "Bulk import" }));
    const bulk = await screen.findByRole("dialog", { name: "Bulk import" });
    fireEvent.change(bulk.querySelector('input[webkitdirectory]')!, { target: { files: [
      new File([new Uint8Array([1])], "photo.png", { type: "image/png" }),
      new File(["text"], "readme.txt", { type: "text/plain" }),
    ] } });
    await screen.findByRole("region", { name: "Selected files" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    expect(drawer.querySelector('button[aria-label="Close drawer"]')).toBeDisabled();
    expect(await screen.findByText("Saving files… 2 of 2")).toBeVisible();
    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(drawer).toBeVisible();
    expect(importFiles).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ collectionName: "My photos" }));
    await act(async () => pending.resolve({ results: [
      { fileName: "photo.png", status: "saved", itemId: "photo" },
      { fileName: "readme.txt", status: "saved", itemId: "note" },
    ] }));
    expect(await screen.findByText("2 files saved. Your draft is still here.")).toBeVisible();
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Unfinished note");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });

  test("opts an image caption into Markdown during capture", async () => {
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    const input = await screen.findByLabelText("Link, note, or image");
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "## Color study" } });
    const fileInput = screen.getByRole("dialog").querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([1])], "study.png", { type: "image/png" })] } });
    await screen.findByLabelText("1 image attached");
    const markdown = screen.getByRole("button", { name: "Markdown" });
    expect(markdown).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(markdown);
    expect(markdown).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Image note preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByLabelText("Image note preview")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByLabelText("Image note preview")).toBeNull();
    vi.mocked(createOrReuseImage).mockResolvedValue({
      image: buildImageFromAssetIds({ assetIds: ["a1"], caption: "## Color study", captionFormat: "markdown" }, { id: "img1", now: 1 }),
      created: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createOrReuseImage).toHaveBeenCalledWith({
      assets: [{ bytes: expect.any(Uint8Array), mimeType: "image/png" }],
      sourceUrl: undefined,
      caption: "## Color study",
      captionFormat: "markdown",
    }));
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
    await waitFor(() => expect(within(collections).getAllByRole("button")).toHaveLength(7));
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
    await waitFor(() => {
      expect(within(screen.getByRole("list", { name: "Collections" })).getAllByRole("button").map((button) => button.textContent)).toEqual([
        "Unsorted",
        "Pinned",
        "Popular",
      ]);
    });
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

  test("a rejected image selection does not leave an invisible layout choice blocking the note draft", async () => {
    await openDraft("Keep this note");
    const oversized = new File([new Uint8Array([1])], "large.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 21 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [oversized, new File([new Uint8Array([2])], "small.png", { type: "image/png" })] } });
    await screen.findByRole("alert");
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByLabelText("Link, note, or image")).toHaveValue("Keep this note");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("keeps thumbnails, image layout, searchable organization and Add files together in the drawer", async () => {
    vi.mocked(listCollections).mockResolvedValue([{ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] }]);
    vi.mocked(listTags).mockResolvedValue([{ id: "reference", name: "Reference", createdAt: 1 }]);
    render(<CaptureHost />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    const input = await screen.findByLabelText("Link, note, or image");
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [
      new File([new Uint8Array([1])], "one.png", { type: "image/png" }),
      new File([new Uint8Array([2])], "two.png", { type: "image/png" }),
    ] } });
    await screen.findByLabelText("2 images attached");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const separate = screen.getByRole("radio", { name: /Separate image items/ });
    fireEvent.click(separate);
    expect(separate).toBeChecked();
    expect(importFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add files" })).toBeEnabled();
    const collection = screen.getByRole("textbox", { name: "Collection" });
    fireEvent.change(collection, { target: { value: "Read" } });
    fireEvent.click(await screen.findByRole("button", { name: "Reading" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tags" }), { target: { value: "Ref" } });
    fireEvent.click(await screen.findByRole("button", { name: "Reference" }));
    fireEvent.click(screen.getByRole("radio", { name: /One image item/ }));
    expect(await screen.findByRole("textbox", { name: "Optional source URL or caption" })).toBeEnabled();
    expect(screen.queryByRole("radio", { name: /Separate image items/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change image layout" }));
    expect(screen.getByRole("radio", { name: /Separate image items/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove tag Reference" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add files" })).toBeEnabled();
    vi.mocked(createImage).mockResolvedValue(buildImageFromAssetIds({ assetIds: ["one", "two"] }, { id: "gallery", now: 1 }));
    fireEvent.click(screen.getByRole("radio", { name: /One image item/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createImage).toHaveBeenCalledWith(expect.objectContaining({ collectionName: "Reading", tagNames: ["Reference"] })));
  });
  test("separate files apply drawer organization and retry only failures without reimporting successes", async () => {
    await openDraft("");
    const files = [new File(["First"], "first.md"), new File(["Second"], "second.txt")];
    pickVideo(files[0]);
    await screen.findByLabelText("Markdown content");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(window, { key: "k", code: "KeyK", altKey: true });
    await waitFor(() => expect(screen.getByLabelText("Choose files")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files } });
    await screen.findByRole("region", { name: "Selected files" });
    fireEvent.change(screen.getByRole("textbox", { name: "Tags" }), { target: { value: "Reference" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Collection" }), { target: { value: "Reading" } });
    vi.mocked(importFiles).mockResolvedValueOnce({ results: [
      { fileName: "first.md", status: "saved", itemId: "first" },
      { fileName: "second.txt", status: "failed", error: "Storage full" },
    ] });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Storage full")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry failed files" })).toBeEnabled());
    expect(importFiles).toHaveBeenCalledWith(files, expect.objectContaining({ collectionName: "Reading", tagNames: ["Reference"] }));
    expect(screen.getByRole("textbox", { name: "Collection" })).toBeDisabled();
    vi.mocked(importFiles).mockResolvedValueOnce({ results: [{ fileName: "second.txt", status: "saved", itemId: "second" }] });
    fireEvent.click(screen.getByRole("button", { name: "Retry failed files" }));
    await waitFor(() => expect(importFiles).toHaveBeenCalledTimes(2));
    expect(vi.mocked(importFiles).mock.calls[1][0]).toEqual([files[1]]);
  });

});
