import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { ContactForm } from "./contact-form";

const transport = vi.fn();
beforeEach(() => {
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
});

function fillMessage() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Export fails" } });
}

test("unconfigured form remains editable with useful copy and GitHub reports", async () => {
  transport.mockResolvedValue(Response.json({ available: false }));
  render(<ContactForm />);
  await screen.findByText(/Email sending isn't available yet/);
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  fillMessage();
  fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "bug" } });
  fireEvent.change(screen.getByLabelText("Browser and device"), { target: { value: "Firefox on Linux" } });
  fireEvent.change(screen.getByLabelText("Steps to reproduce"), { target: { value: "Click export" } });
  const link = screen.getByRole("link", { name: "Open GitHub draft" });
  const body = new URL(link.getAttribute("href")!).searchParams.get("body");
  expect(body).toContain("Export fails");
  expect(body).toContain("Click export");
  expect(body).toContain("Firefox on Linux");
  expect(body).not.toContain("ada@example.com");
  expect(transport).toHaveBeenCalledTimes(1);
});

test("pending disables resubmission and provider failure preserves the draft", async () => {
  let fail!: (response: Response) => void;
  transport.mockResolvedValueOnce(Response.json({ available: true }));
  transport.mockImplementationOnce(() => new Promise(resolve => { fail = resolve; }));
  render(<ContactForm />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled());
  fillMessage();
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  fail(Response.json({ error: "Private provider details" }, { status: 502 }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Message")).toHaveValue("Export fails");
  expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  expect(screen.queryByText(/Private provider/)).not.toBeInTheDocument();
  expect(screen.queryByText(/submitted/)).not.toBeInTheDocument();
});

test("only accepted delivery shows confirmation", async () => {
  transport.mockResolvedValueOnce(Response.json({ available: true }));
  transport.mockResolvedValueOnce(Response.json({ accepted: true }));
  render(<ContactForm />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled());
  fillMessage();
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText(/Your message was submitted/);
  expect(screen.getByLabelText("Message")).toHaveValue("Export fails");
});

test("clipboard failure opens a selectable report without losing its contents", async () => {
  transport.mockResolvedValue(Response.json({ available: false }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
  render(<ContactForm />);
  fillMessage();
  fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
  const report = await screen.findByLabelText("Report to copy");
  await waitFor(() => expect(report).toHaveFocus());
  expect((report as HTMLTextAreaElement).value).toContain("Export fails");
});

test("long reports remain available in full when they cannot fit a GitHub URL", async () => {
  transport.mockResolvedValue(Response.json({ available: false }));
  render(<ContactForm />);
  const message = "失敗".repeat(2400);
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: message } });
  fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "bug" } });
  fireEvent.change(screen.getByLabelText("Steps to reproduce"), { target: { value: "Repeat export. ".repeat(140) } });
  expect(screen.getByRole("link", { name: "Open GitHub issue" })).toHaveAttribute("href", "https://github.com/MedLines/keepall/issues/new");
  expect(screen.getByText(/too long for a GitHub link/)).toBeInTheDocument();
  expect((screen.getByLabelText("Report to copy") as HTMLTextAreaElement).value).toContain(message);
});
