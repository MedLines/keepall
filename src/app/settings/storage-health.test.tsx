import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
