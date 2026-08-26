import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "./page";

test("renders the Keepall heading as a home link", async () => {
  render(<HomePage />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Keepall" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Keepall" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(await screen.findByText("No items yet.")).toBeInTheDocument();
});
