import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StorageHealth } from "./storage-health";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows approximate site usage and persistence without requesting it", async () => {
  const persist = vi.fn();
  vi.stubGlobal("navigator", {
    storage: {
      estimate: vi.fn().mockResolvedValue({
        usage: 20 * 1024 * 1024,
        quota: 2 * 1024 * 1024 * 1024,
      }),
      persisted: vi.fn().mockResolvedValue(true),
      persist,
    },
  });

  render(<StorageHealth />);

  expect(await screen.findByText("20 MB")).toBeInTheDocument();
  expect(screen.getByText("2 GB")).toBeInTheDocument();
  expect(screen.getByText("Granted")).toBeInTheDocument();
  expect(screen.getByText(/not a backup/i)).toBeInTheDocument();
  expect(persist).not.toHaveBeenCalled();
  expect(screen.getByRole("meter", { name: "Estimated storage usage" })).toHaveAttribute("aria-valuetext", "20 MB used out of 2 GB");
});

test("keeps the persistence result when the size estimate fails", async () => {
  vi.stubGlobal("navigator", {
    storage: {
      estimate: vi.fn().mockRejectedValue(new Error("Blocked")),
      persisted: vi.fn().mockResolvedValue(false),
    },
  });

  render(<StorageHealth />);

  expect(await screen.findByText("Not granted")).toBeInTheDocument();
  expect(screen.getAllByText("Unavailable")).toHaveLength(2);
});

test("shows unavailable states when the browser has no storage API", async () => {
  vi.stubGlobal("navigator", {});

  render(<StorageHealth />);

  expect(await screen.findAllByText("Unavailable")).toHaveLength(3);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
});

test("refreshes the read-only values on request", async () => {
  const estimate = vi
    .fn()
    .mockResolvedValueOnce({ usage: 1024 * 1024, quota: 2 * 1024 * 1024 })
    .mockResolvedValueOnce({ usage: 2 * 1024 * 1024, quota: 4 * 1024 * 1024 });
  vi.stubGlobal("navigator", {
    storage: {
      estimate,
      persisted: vi.fn().mockResolvedValue(false),
    },
  });

  render(<StorageHealth />);
  expect(await screen.findByText("1 MB")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Refresh storage status" }));

  await waitFor(() => {
    expect(screen.getByText("2 MB")).toBeInTheDocument();
    expect(screen.getByText("4 MB")).toBeInTheDocument();
  });
  expect(estimate).toHaveBeenCalledTimes(2);
});

test("caps the meter when usage exceeds the browser allowance", async () => {
  vi.stubGlobal("navigator", { storage: {
    estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 1024 }),
    persisted: vi.fn().mockResolvedValue(false),
  } });
  render(<StorageHealth />);
  expect(await screen.findByRole("meter")).toHaveAttribute("aria-valuenow", "100");
});

test("retains the previous storage values and meter while a refresh is pending", async () => {
  let finishRefresh!: (value: StorageEstimate) => void;
  const refresh = new Promise<StorageEstimate>(resolve => { finishRefresh = resolve; });
  vi.stubGlobal("navigator", { storage: {
    estimate: vi.fn()
      .mockResolvedValueOnce({ usage: 1024 * 1024, quota: 2 * 1024 * 1024 })
      .mockReturnValueOnce(refresh),
    persisted: vi.fn().mockResolvedValue(false),
  } });
  render(<StorageHealth />);
  expect(await screen.findByText("1 MB")).toBeInTheDocument();
  const meter = screen.getByRole("meter");
  fireEvent.click(screen.getByRole("button", { name: "Refresh storage status" }));
  expect(screen.getByText("1 MB")).toBeInTheDocument();
  expect(screen.queryByText("Checking…")).not.toBeInTheDocument();
  expect(screen.getByRole("meter")).toBe(meter);
  expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
  await act(async () => { finishRefresh({ usage: 2 * 1024 * 1024, quota: 4 * 1024 * 1024 }); });
  expect(screen.getByRole("meter")).toBe(meter);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "2 MB used out of 4 MB");
  expect(screen.getByRole("button", { name: "Refresh storage status" })).toBeEnabled();
});
