import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ShellTopMenu } from "./shell-top-menu";

const options = [
  { value: "all", label: "All types", count: 12 },
  { value: "image", label: "Images", count: 4 },
];

describe("ShellTopMenu", () => {
  test("shows a styled tooltip and keeps a trigger-only icon out of the dropdown rows", async () => {
    render(<ShellTopMenu ariaLabel="List columns" value="all" options={options} onChange={vi.fn()} iconOnly triggerIcon={<span data-testid="columns-icon" />} />);
    const trigger = screen.getByRole("combobox", { name: "List columns: All types" });
    expect(trigger).not.toHaveAttribute("title");
    expect(within(trigger).getByTestId("columns-icon")).toBeInTheDocument();
    fireEvent.focus(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("List columns: All types");
    fireEvent.click(trigger);
    expect(within(screen.getByRole("listbox")).queryByTestId("columns-icon")).not.toBeInTheDocument();
  });

  test("announces its purpose and selected value on the trigger", () => {
    render(
      <ShellTopMenu
        ariaLabel="Filter by type"
        value="image"
        options={options}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Filter by type: Images" }),
    ).toBeInTheDocument();
  });

  test("reports the selected value and preserves option counts and emphasis", () => {
    render(
      <ShellTopMenu
        ariaLabel="Sort library"
        value="image"
        options={options}
        onChange={() => {}}
        emphasized
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: "Sort library: Images",
    });
    expect(trigger).toHaveClass("ui-primary");
    fireEvent.click(trigger);

    const listbox = screen.getByRole("listbox", { name: "Sort library" });
    expect(
      within(listbox).getByRole("option", { name: "Images 4" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(listbox).getByRole("option", { name: "All types 12" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  test("passes the selected option value to its caller", async () => {
    const onChange = vi.fn();
    render(
      <ShellTopMenu
        ariaLabel="Filter by type"
        value="all"
        options={options}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: "Filter by type: All types",
    });
    fireEvent.click(trigger);
    const option = screen.getByRole("option", { name: "Images 4" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option, { detail: 1 });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("image");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  test("keeps an icon-only trigger named with its selected value", () => {
    render(
      <ShellTopMenu
        ariaLabel="Filter by type"
        value="image"
        options={options}
        onChange={() => {}}
        iconOnly
        emphasized
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: "Filter by type: Images",
    });
    expect(trigger).toHaveClass("ui-selected");
  });

  test("keeps keyboard selection working with the shared hover highlight", async () => {
    const onChange = vi.fn();
    render(<ShellTopMenu ariaLabel="Filter by type" value="all" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    const first = screen.getByRole("option", { name: "All types 12" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const next = screen.getByRole("option", { name: "Images 4" });
    await waitFor(() => expect(next).toHaveFocus());
    fireEvent.keyDown(next, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("image");
  });
});
