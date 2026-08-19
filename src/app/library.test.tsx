import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { listItems } from "@/persistence/items";
import { Library } from "./library";

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
}));

describe("Library", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
  });

  test("does not show the empty copy when loading fails", async () => {
    vi.mocked(listItems).mockRejectedValue(new Error("idb down"));
    render(<Library />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load items.",
    );
    expect(screen.queryByText("No items yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
