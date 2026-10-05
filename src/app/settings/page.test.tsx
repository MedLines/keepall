import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SettingsPage from "./page";

test("groups working settings in tabs and explains storage beside recovery controls", async () => {
  render(<SettingsPage />);

  expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Appearance" })).toHaveTextContent("Light theme");
  expect(screen.getByRole("region", { name: "Link previews" })).toHaveTextContent("Only the page address is sent");
  expect(screen.queryByRole("region", { name: "Backup" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Storage & backups" }));
  expect(screen.getByRole("region", { name: "Backup" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Import" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Import bookmarks" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Import images" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Storage" })).toHaveTextContent("Saved locally in this browser profile");
  expect(screen.getByRole("region", { name: "Storage" })).toHaveTextContent("Site storage used");
  expect(screen.getByRole("button", { name: "Refresh storage status" })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Export backup" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Installation" }));
  expect(screen.getByRole("region", { name: "Install Keepall" })).toHaveTextContent("separate storage from Safari");
  expect(screen.queryByRole("tab", { name: "Help" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Help & guides" })[0]).toHaveAttribute("href", "/help");
  expect(screen.queryByText(/cloud sync/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /OS vault|system theme/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute(
    "href",
    "/",
  );
});
