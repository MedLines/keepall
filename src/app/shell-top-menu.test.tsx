import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ShellTopMenu } from "./shell-top-menu";

const options = [
  { value: "all", label: "All types", count: 12 },
  { value: "image", label: "Images", count: 4 },
];

describe("ShellTopMenu", () => {
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

  test("passes the selected option value to its caller", () => {
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
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
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
});
