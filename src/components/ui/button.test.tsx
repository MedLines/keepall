import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlusIcon } from "@/app/shell-icons";
import { Button, buttonClassName } from "./button";

const componentsCss = readFileSync(path.join(process.cwd(), "src/app/styles/components.css"), "utf8");

describe("icon-side button padding", () => {
  it("gives md, lg and toolbar buttons the .ui-button padding rule, and leaves caller-sized buttons alone", () => {
    for (const size of ["md", "lg", "toolbar"] as const) expect(buttonClassName({ size }).split(" ")).toContain("ui-button");
    expect(buttonClassName({ size: "none" }).split(" ")).not.toContain("ui-button");
  });

  it("trims the side with an icon to three quarters of --button-px", () => {
    expect(componentsCss).toMatch(/\.ui-button \{\s*--button-px: calc\(var\(--spacing\) \* 4\);\s*padding-inline: var\(--button-px\);/);
    expect(componentsCss).toContain(".ui-button:has(> svg:first-child + :not(.sr-only, .hidden)) { padding-inline-start: calc(var(--button-px) * 0.75); }");
    expect(componentsCss).toContain(".ui-button:has(> :not(.sr-only, .hidden) + svg:last-child) { padding-inline-end: calc(var(--button-px) * 0.75); }");
    expect(componentsCss).toMatch(/@utility button-px-\* \{\s*--button-px: --spacing\(--value\(integer\)\);/);
  });

  it("wraps bare text so the rule can see which side the icon is on", () => {
    render(<Button><PlusIcon />Save item</Button>);
    const button = screen.getByRole("button", { name: "Save item" });
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(button.lastElementChild?.tagName.toLowerCase()).toBe("span");
    expect(button.lastElementChild?.textContent).toBe("Save item");
  });

  it("leaves element children as they are", () => {
    render(<Button><span data-testid="label">Done</span></Button>);
    expect(screen.getByTestId("label").parentElement?.tagName.toLowerCase()).toBe("button");
  });
});
