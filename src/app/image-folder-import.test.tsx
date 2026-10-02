import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mockNavigation } from "../../vitest.setup";
import { buildCollection } from "@/domain/collection";
import { listCollections } from "@/persistence/collections";
import { importImageFolder } from "@/persistence/image-folder-import";
import { ImageFolderImport } from "./image-folder-import";
import type { ReadableImageDirectory } from "./read-image-directory";

vi.mock("@/persistence/image-folder-import", () => ({ importImageFolder: vi.fn() }));
vi.mock("@/persistence/collections", () => ({ listCollections: vi.fn() }));
vi.mock("./storage-quota-warning", () => ({
  sumImportableFolderBytes: vi.fn(() => 1),
  storageQuotaWarningForImport: vi.fn().mockResolvedValue(null),
}));

const summary = { added: 1, reused: 0, skippedOversize: 0, skippedInvalid: 0, skippedEmpty: 0, skippedRead: 0 };
beforeEach(() => {
  vi.mocked(importImageFolder).mockReset().mockResolvedValue(summary);
  vi.mocked(listCollections).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function reviewFolder(collectionName = "Photos") {
  const { container } = render(<ImageFolderImport buttonClassName="" onBusyChange={() => {}} />);
  fireEvent.change(container.querySelector('input[webkitdirectory]')!, {
    target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
  });
  const review = await screen.findByRole("dialog", { name: "Import image folder" });
  fireEvent.change(within(review).getByLabelText("Collection (optional)"), { target: { value: collectionName } });
  fireEvent.click(within(review).getByRole("button", { name: "Import images" }));
}

test("Open folder navigates to the imported collection using its id", async () => {
  vi.mocked(listCollections).mockResolvedValue([buildCollection({ name: "My photos" }, { id: "photos & trips" })]);
  await reviewFolder(" My   photos ");
  const complete = await screen.findByRole("dialog", { name: "Import complete" });
  expect(complete).toHaveTextContent("Images are saved in My photos.");
  expect(importImageFolder).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ collectionName: "My photos" }));
  fireEvent.click(within(complete).getByRole("button", { name: "Open folder" }));
  await screen.findByRole("status");
  expect(mockNavigation.push).toHaveBeenCalledWith("/?collection=photos%20%26%20trips");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("a blank collection offers Open Unsorted", async () => {
  await reviewFolder("");
  const complete = await screen.findByRole("dialog", { name: "Import complete" });
  expect(complete).toHaveTextContent("Images are saved in Unsorted.");
  fireEvent.click(within(complete).getByRole("button", { name: "Open Unsorted" }));
  expect(mockNavigation.push).toHaveBeenCalledWith("/?unsorted=1");
  expect(listCollections).not.toHaveBeenCalled();
});

test("an interrupted import keeps its files and destination available for retry", async () => {
  vi.mocked(importImageFolder).mockRejectedValueOnce(new Error("Storage unavailable"));
  await reviewFolder("Retry photos");
  const stopped = await screen.findByRole("dialog", { name: "Import stopped" });
  expect(within(stopped).getByRole("alert")).toHaveTextContent("Images already saved won't be duplicated.");
  expect(within(stopped).getByLabelText("Collection (optional)")).toHaveValue("Retry photos");
  fireEvent.click(within(stopped).getByRole("button", { name: "Retry import" }));
  const complete = await screen.findByRole("dialog", { name: "Import complete" });
  expect(complete).toHaveTextContent("Images: 1 added.");
  expect(importImageFolder).toHaveBeenCalledTimes(2);
  expect(vi.mocked(importImageFolder).mock.calls[0]?.[0]).toBe(vi.mocked(importImageFolder).mock.calls[1]?.[0]);
});

test("a folder navigation error leaves the completion result open for another attempt", async () => {
  vi.mocked(listCollections).mockRejectedValueOnce(new Error("Storage unavailable"));
  await reviewFolder();
  const complete = await screen.findByRole("dialog", { name: "Import complete" });
  fireEvent.click(within(complete).getByRole("button", { name: "Open folder" }));
  expect(await within(complete).findByRole("alert")).toHaveTextContent("Try again, or open it from the sidebar.");
  expect(complete).toHaveTextContent("Images: 1 added.");
  expect(mockNavigation.push).not.toHaveBeenCalled();
  expect(within(complete).getByRole("button", { name: "Open folder" })).toBeEnabled();
});

test("an import with only skipped files reports completion without claiming images were saved", async () => {
  vi.mocked(importImageFolder).mockResolvedValueOnce({ ...summary, added: 0, skippedInvalid: 1 });
  await reviewFolder();
  const complete = await screen.findByRole("dialog", { name: "Import complete" });
  expect(complete).toHaveTextContent("No images were added. Review the skipped files below.");
  expect(within(complete).getByRole("status")).toHaveTextContent("Images: 0 added, 1 skipped.");
  expect(within(complete).getByRole("status")).toHaveTextContent("Skipped: 1 unsupported type.");
});

test("the read-only picker scans subfolders and shows progress without opening the upload input", async () => {
  const file = new File(["image"], "photo.png", { type: "image/png" });
  let releaseFile!: (file: File) => void;
  const pendingFile = new Promise<File>((resolve) => { releaseFile = resolve; });
  const directory: ReadableImageDirectory = {
    kind: "directory", name: "Picked photos",
    async *values() {
      yield {
        kind: "directory", name: "Nested",
        async *values() { yield { kind: "file", name: file.name, getFile: () => pendingFile }; },
      };
    },
  };
  const picker = vi.fn().mockResolvedValue(directory);
  vi.stubGlobal("showDirectoryPicker", picker);
  const { container } = render(<ImageFolderImport buttonClassName="" onBusyChange={() => {}} />);
  const uploadClick = vi.spyOn(container.querySelector('input[webkitdirectory]') as HTMLInputElement, "click");
  fireEvent.click(screen.getByRole("button", { name: "Import images" }));
  const reading = await screen.findByRole("dialog", { name: "Reading image folder" });
  expect(reading).toHaveTextContent("Finding files in Picked photos.");
  expect(within(reading).getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  expect(within(reading).getByRole("button", { name: "Close" })).toBeDisabled();
  expect(picker).toHaveBeenCalledExactlyOnceWith({ mode: "read", id: "keepall-image-folder" });
  expect(uploadClick).not.toHaveBeenCalled();
  await act(async () => { releaseFile(file); });
  const review = await screen.findByRole("dialog", { name: "Import image folder" });
  expect(within(review).getByLabelText("Collection (optional)")).toHaveValue("Picked photos");
  fireEvent.click(within(review).getByRole("button", { name: "Import images" }));
  await screen.findByRole("dialog", { name: "Import complete" });
  expect(importImageFolder).toHaveBeenCalledWith([file], expect.objectContaining({ collectionName: "Picked photos" }));
});

test("canceling the read-only picker does not open the old upload dialog or report an error", async () => {
  vi.stubGlobal("showDirectoryPicker", vi.fn().mockRejectedValue(new DOMException("Canceled", "AbortError")));
  const { container } = render(<ImageFolderImport buttonClassName="" onBusyChange={() => {}} />);
  const uploadClick = vi.spyOn(container.querySelector('input[webkitdirectory]') as HTMLInputElement, "click");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Import images" })); });
  expect(uploadClick).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Import images" })).toBeEnabled();
});

test("denied folder access reports a recovery action without falling back to upload", async () => {
  vi.stubGlobal("showDirectoryPicker", vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")));
  const { container } = render(<ImageFolderImport buttonClassName="" onBusyChange={() => {}} />);
  const uploadClick = vi.spyOn(container.querySelector('input[webkitdirectory]') as HTMLInputElement, "click");
  fireEvent.click(screen.getByRole("button", { name: "Import images" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Allow folder access, then select it again.");
  expect(uploadClick).not.toHaveBeenCalled();
});

test("an empty directory offers another folder choice", async () => {
  vi.stubGlobal("showDirectoryPicker", vi.fn().mockResolvedValue({ kind: "directory", name: "Empty", async *values() {} }));
  render(<ImageFolderImport buttonClassName="" onBusyChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Import images" }));
  expect(await screen.findByRole("status")).toHaveTextContent("This folder is empty. Choose a folder containing images.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(importImageFolder).not.toHaveBeenCalled();
});
