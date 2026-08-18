import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "./page";

test("renders the Keepall heading", async () => {
  render(<HomePage />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Keepall" }),
  ).toBeInTheDocument();
  expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
});
