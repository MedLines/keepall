import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PersistentStorageStatusLine } from "./persistent-storage-status";

const { requestPersistentStorage } = vi.hoisted(() => ({
  requestPersistentStorage: vi.fn(),
}));

vi.mock("@/pwa/persistent-storage", () => ({
  requestPersistentStorage,
  persistentStorageMessage: () =>
    "Storage may be cleared under browser pressure.",
}));

describe("PersistentStorageStatusLine", () => {
  beforeEach(() => {
    requestPersistentStorage.mockReset();
    requestPersistentStorage.mockResolvedValue("denied");
    window.localStorage.clear();
  });

  test("remembers when the storage warning is dismissed", async () => {
    const first = render(<PersistentStorageStatusLine />);

    expect(
      await screen.findByText("Storage may be cleared under browser pressure."),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss storage warning" }),
    );
    expect(
      screen.queryByText("Storage may be cleared under browser pressure."),
    ).not.toBeInTheDocument();

    first.unmount();
    render(<PersistentStorageStatusLine />);

    await waitFor(() => {
      expect(requestPersistentStorage).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.queryByText("Storage may be cleared under browser pressure."),
    ).not.toBeInTheDocument();
  });
});
