import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "./page";

test("renders the Keepall home link and library shell", async () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: "Keepall home" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(await screen.findByText("No items yet.")).toBeInTheDocument();
});
