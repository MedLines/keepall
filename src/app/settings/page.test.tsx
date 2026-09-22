import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SettingsPage from "./page";

test("groups working settings and labels future controls", () => {
  render(<SettingsPage />);

  expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Appearance" })).toHaveTextContent("Light theme");
  expect(screen.getByRole("region", { name: "Backup" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Import" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Storage" })).toHaveTextContent("Planned");
  expect(screen.getByRole("region", { name: "Storage" })).toHaveTextContent("Site storage used");
  expect(screen.getByRole("button", { name: "Refresh storage status" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Help" })).toHaveTextContent("Alt + K");
  expect(screen.getByRole("region", { name: "Link previews" })).toHaveTextContent("Planned");
  expect(screen.queryByRole("button", { name: /OS vault|system theme/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute(
    "href",
    "/",
  );
});
