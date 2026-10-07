import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import SettingsPage from "./page";
import { SettingsTabs } from "./settings-tabs";

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

test("rapid tab changes retain form values and expose only the active panel", () => {
  window.history.replaceState(window.history.state, "", "/settings");
  render(<SettingsTabs general={<label>Draft setting<input defaultValue="Original" /></label>} storage={<p>Storage panel</p>} installation={<p>Installation panel</p>} />);
  const input = screen.getByRole("textbox", { name: "Draft setting" });
  fireEvent.change(input, { target: { value: "Unsaved edit" } });
  fireEvent.click(screen.getByRole("tab", { name: "Storage & backups" }));
  expect(screen.queryByRole("textbox", { name: "Draft setting" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  fireEvent.click(screen.getByRole("tab", { name: "Installation" }));
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  fireEvent.click(screen.getByRole("tab", { name: "General" }));
  expect(screen.getByRole("textbox", { name: "Draft setting" })).toBe(input);
  expect(input).toHaveValue("Unsaved edit");
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  window.history.replaceState(window.history.state, "", "/");
});

test("tab changes reset the scroll viewport and heading links work within the active tab", () => {
  window.history.replaceState(window.history.state, "", "/settings");
  render(<main><div data-slot="scroll-area-viewport" data-testid="viewport">
    <SettingsTabs general={<p>General panel</p>} storage={<h2 id="backup-heading">Backup</h2>} installation={<p>Installation panel</p>} />
  </div></main>);
  const viewport = screen.getByTestId("viewport");
  viewport.scrollTop = 300;
  fireEvent.click(screen.getByRole("tab", { name: "Storage & backups" }));
  expect(viewport.scrollTop).toBe(0);

  const heading = screen.getByRole("heading", { name: "Backup" });
  heading.scrollIntoView = vi.fn();
  viewport.scrollTop = 200;
  window.history.replaceState(window.history.state, "", "#backup-heading");
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
  expect(viewport.scrollTop).toBe(0);
  expect(screen.getByRole("tabpanel")).toContainElement(heading);
  window.history.replaceState(window.history.state, "", "/");
});
