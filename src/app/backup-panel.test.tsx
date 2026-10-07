import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BackupValidationError, type BackupCounts, type BackupImportProgress } from "@/domain/backup";
import { BackupPanel } from "./backup-panel";

const { prepareBackupFile, countCurrentLibrary } = vi.hoisted(() => ({
  prepareBackupFile: vi.fn(), countCurrentLibrary: vi.fn(),
}));
vi.mock("@/persistence/backup-archive", () => ({ prepareBackupFile, exportKeepallArchive: vi.fn() }));
vi.mock("@/persistence/backup", () => ({ countCurrentLibrary }));

const counts: BackupCounts = { total: 2, active: 1, trash: 1, links: 0, notes: 2,
  images: 0, videos: 0, documents: 0, documentAssets: 0, tags: 0, collections: 0, imageAssets: 0, videoAssets: 0 };
const incoming: BackupCounts = { ...counts, total: 1, active: 1, trash: 0, notes: 1 };
function chooseFile(container: HTMLElement) {
  const input = container.querySelector('input[accept*="application/json"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["backup"], "review.keepall.json")] } });
  return input;
}
let replace: ReturnType<typeof vi.fn>;
let merge: ReturnType<typeof vi.fn>;
beforeEach(() => {
  prepareBackupFile.mockReset(); countCurrentLibrary.mockReset();
  replace = vi.fn().mockResolvedValue([]);
  merge = vi.fn().mockResolvedValue({ added: 1, updated: 0, unchanged: 0, addedLinkIds: [] });
  prepareBackupFile.mockResolvedValue({ name: "review.keepall.json", size: 123, exportedAt: 1000,
    counts: incoming, replace, merge });
  countCurrentLibrary.mockResolvedValue(counts);
});
afterEach(() => vi.restoreAllMocks());

test("reads before review, keeps file selected when replacement is canceled, and commits only on confirmation", async () => {
  let resolve!: (value: unknown) => void;
  prepareBackupFile.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const { container } = render(<BackupPanel />);
  const input = chooseFile(container);
  expect(input).toHaveAttribute("hidden");
  expect(input).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("status")).toHaveTextContent("Reading backup");
  expect(screen.queryByRole("dialog", { name: "Import backup" })).not.toBeInTheDocument();
  resolve({ name: "review.keepall.json", size: 123, exportedAt: 1000, counts: incoming, replace, merge });
  const review = await screen.findByRole("dialog", { name: "Import backup" });
  expect(review).toHaveTextContent("review.keepall.json");
  const contents = within(review).getByRole("table", { name: "Backup contents comparison" });
  expect(within(contents).getByRole("rowheader", { name: "All items" }).closest("tr")).toHaveTextContent("All items21 active11 active");
  expect(within(contents).getByRole("rowheader", { name: "In Trash" }).closest("tr")).toHaveTextContent("In Trash10");
  expect(within(contents).getByRole("rowheader", { name: "Notes" }).closest("tr")).toHaveTextContent("Notes21");
  expect(within(review).getByText("Item counts include Trash.")).toBeVisible();
  fireEvent.click(within(review).getByRole("button", { name: "Replace library" }));
  const confirm = await screen.findByRole("dialog", { name: "Replace library?" });
  expect(confirm).toHaveTextContent("2 items (1 active, 1 in Trash)");
  fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
  expect(await screen.findByRole("dialog", { name: "Import backup" })).toHaveTextContent("review.keepall.json");
  expect(replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Replace library" }));
  const again = await screen.findByRole("dialog", { name: "Replace library?" });
  fireEvent.click(within(again).getByRole("button", { name: "Confirm replacement" }));
  await waitFor(() => expect(replace).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Library replaced from backup"));
});

test("invalid files show an alert and never offer restore actions", async () => {
  prepareBackupFile.mockRejectedValue(new BackupValidationError("Archive is damaged"));
  const { container } = render(<BackupPanel />);
  chooseFile(container);
  expect(await screen.findByRole("alert")).toHaveTextContent("Archive is damaged");
  expect(screen.queryByRole("dialog", { name: "Import backup" })).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

test("failed merges explain that the library is unchanged and allow another attempt", async () => {
  merge.mockRejectedValueOnce(new DOMException("Storage full", "QuotaExceededError"));
  const { container } = render(<BackupPanel />);
  chooseFile(container);
  let review = await screen.findByRole("dialog", { name: "Import backup" });
  fireEvent.click(within(review).getByRole("button", { name: "Merge" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your library wasn't changed");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Import backup" })).not.toBeInTheDocument());
  chooseFile(container);
  review = await screen.findByRole("dialog", { name: "Import backup" });
  fireEvent.click(within(review).getByRole("button", { name: "Merge" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Merged: 1 added"));
});

test("restore shows pending state and blocks a second operation until completion", async () => {
  let finish!: (value: string[]) => void;
  replace.mockReturnValue(new Promise<string[]>((resolve) => { finish = resolve; }));
  const { container } = render(<BackupPanel />);
  chooseFile(container);
  const review = await screen.findByRole("dialog", { name: "Import backup" });
  fireEvent.click(within(review).getByRole("button", { name: "Replace library" }));
  const confirm = await screen.findByRole("dialog", { name: "Replace library?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Confirm replacement" }));
  expect(within(confirm).getByRole("button", { name: "Restoring library…" })).toBeDisabled();
  expect(within(confirm).getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(replace).toHaveBeenCalledOnce();
  finish([]);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Library replaced from backup"));
});

test("a completed read after unmount cannot open review", async () => {
  let finish!: (value: unknown) => void;
  prepareBackupFile.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { container, unmount } = render(<BackupPanel />);
  chooseFile(container);
  unmount();
  finish({ name: "late.json", size: 1, exportedAt: 1, counts: incoming, replace, merge });
  await Promise.resolve();
  expect(countCurrentLibrary).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: "Import backup" })).not.toBeInTheDocument();
});

test.each(["merge", "replace"] as const)("%s displays live progress inside its dialog and stays open until committed", async (mode) => {
  let finish!: (value: unknown) => void;
  let report!: (progress: BackupImportProgress) => void;
  const action = mode === "merge" ? merge : replace;
  action.mockImplementation((onProgress) => {
    report = onProgress;
    return new Promise((resolve) => { finish = resolve; });
  });
  const { container } = render(<BackupPanel variant="sidebar" onClose={vi.fn()} />);
  chooseFile(container);
  const review = await screen.findByRole("dialog", { name: "Import backup" });
  if (mode === "replace") {
    fireEvent.click(within(review).getByRole("button", { name: "Replace library" }));
    const confirmation = await screen.findByRole("dialog", { name: "Replace library?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm replacement" }));
  } else {
    fireEvent.click(within(review).getByRole("button", { name: "Merge" }));
  }
  const dialog = screen.getByRole("dialog", { name: mode === "merge" ? "Merging backup" : "Restoring library" });
  expect(within(dialog).getByRole("progressbar")).toBeVisible();
  expect(dialog).toHaveTextContent("Keep this tab open");
  expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close backup", hidden: true })).toBeDisabled();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(dialog).toBeVisible();
  act(() => report({ phase: mode === "merge" ? "merging-items" : "restoring-items", completed: 3, total: 10 }));
  expect(within(dialog).getByRole("progressbar")).toHaveAttribute("value", "3");
  expect(within(dialog).getByRole("progressbar")).toHaveAttribute("max", "10");
  expect(dialog).toHaveTextContent("3 of 10 items");
  act(() => report({ phase: "saving-library" }));
  expect(dialog).toHaveTextContent("Saving library");
  expect(within(dialog).getByRole("progressbar")).not.toHaveAttribute("value");
  expect(dialog).toBeVisible();
  await act(async () => finish(mode === "merge" ? { added: 10, updated: 0, unchanged: 0, addedLinkIds: [] } : []));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("status")).toHaveTextContent(mode === "merge" ? "Merged: 10 added" : "Library replaced from backup");
});

test.each(["merge", "replace"] as const)("failed %s releases the dialog and explains that the library is unchanged", async (mode) => {
  const action = mode === "merge" ? merge : replace;
  action.mockRejectedValueOnce(new DOMException("Storage full", "QuotaExceededError"));
  const { container } = render(<BackupPanel />);
  chooseFile(container);
  const review = await screen.findByRole("dialog", { name: "Import backup" });
  if (mode === "replace") {
    fireEvent.click(within(review).getByRole("button", { name: "Replace library" }));
    const confirm = await screen.findByRole("dialog", { name: "Replace library?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm replacement" }));
  } else {
    fireEvent.click(within(review).getByRole("button", { name: "Merge" }));
  }
  expect(await screen.findByRole("alert")).toHaveTextContent("Your library wasn't changed");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Import backup" })).toBeEnabled();
  expect(screen.getByRole("status")).not.toHaveTextContent(/Merged:|Library replaced/);
});
