import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BulkFileImport } from "./bulk-file-import";
import type { ReadableImageDirectory } from "./read-image-directory";

vi.mock("./storage-quota-warning", () => ({ storageQuotaWarningForImport: vi.fn().mockResolvedValue(null) }));
afterEach(() => vi.unstubAllGlobals());

function renderImport(defaultCollectionName = "") {
  const onBusyChange = vi.fn();
  const onSelect = vi.fn();
  return { ...render(<BulkFileImport buttonClassName="" defaultCollectionName={defaultCollectionName} onBusyChange={onBusyChange} onSelect={onSelect} />), onBusyChange, onSelect };
}
const files = [new File(["image"], "photo.png", { type: "image/png" }), new File(["# Plan"], "plan.md"), new File(["Plain text"], "plain.txt")];

test("bulk selection hands mixed files to the drawer without opening a review modal", async () => {
  const { container, onBusyChange, onSelect } = renderImport("Reading");
  fireEvent.change(container.querySelector('input[data-bulk-files]')!, { target: { files } });
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(files, "Reading", null));
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
});

test("folder upload defaults to the folder collection and preserves every selected file", async () => {
  const selected = [...files, new File(["later"], "page.html")];
  selected.forEach((file) => Object.defineProperty(file, "webkitRelativePath", { configurable: true, value: `Mixed library/${file.name}` }));
  const { container, onSelect } = renderImport();
  fireEvent.change(container.querySelector('input[webkitdirectory]')!, { target: { files: selected } });
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(selected, "Mixed library", null));
});

test("read-only directory picker scans nested mixed files and locks controls while reading", async () => {
  let release!: (file: File) => void;
  const pending = new Promise<File>((resolve) => { release = resolve; });
  const directory: ReadableImageDirectory = { kind: "directory", name: "Picked library", async *values() {
    yield { kind: "file", name: files[0].name, getFile: async () => files[0] };
    yield { kind: "directory", name: "Nested", async *values() {
      yield { kind: "file", name: files[1].name, getFile: () => pending };
      yield { kind: "file", name: files[2].name, getFile: async () => files[2] };
    } };
  } };
  const picker = vi.fn().mockResolvedValue(directory);
  vi.stubGlobal("showDirectoryPicker", picker);
  const { container, onBusyChange, onSelect } = renderImport();
  const upload = vi.spyOn(container.querySelector('input[webkitdirectory]')! as HTMLInputElement, "click");
  fireEvent.click(screen.getByRole("button", { name: "Import folder" }));
  await screen.findByText(/1 file found · photo.png/);
  expect(screen.getByRole("button", { name: "Import folder" })).toBeDisabled();
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  expect(picker).toHaveBeenCalledWith({ mode: "read", id: "keepall-import-folder" });
  expect(upload).not.toHaveBeenCalled();
  await act(async () => release(files[1]));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(files, "Picked library", null));
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
});

test("canceling the directory picker releases the drawer without a selection or error", async () => {
  vi.stubGlobal("showDirectoryPicker", vi.fn().mockRejectedValue(new DOMException("Canceled", "AbortError")));
  const { onBusyChange, onSelect } = renderImport();
  fireEvent.click(screen.getByRole("button", { name: "Import folder" }));
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
});

test("canceling a folder scan releases controls and a late file cannot stage a selection", async () => {
  let release!: (file: File) => void;
  const pending = new Promise<File>(resolve => { release = resolve; });
  const directory: ReadableImageDirectory = { kind: "directory", name: "Pending folder", async *values() {
    yield { kind: "file", name: "pending.txt", getFile: () => pending };
  } };
  vi.stubGlobal("showDirectoryPicker", vi.fn().mockResolvedValue(directory));
  const { onBusyChange, onSelect } = renderImport();
  fireEvent.click(screen.getByRole("button", { name: "Import folder" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel reading" }));
  expect(await screen.findByText("Folder reading canceled. No files were added.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Import folder" })).toBeEnabled();
  await act(async () => release(files[0]));
  expect(onSelect).not.toHaveBeenCalled();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});
