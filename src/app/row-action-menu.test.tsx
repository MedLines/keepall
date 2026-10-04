import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Menu } from "@base-ui/react/menu";
import { expect, test, vi } from "vitest";
import { RowActionMenu } from "./row-action-menu";

test("builds action contents only when a menu opens, including after closed rerenders", async () => {
  const menu = vi.fn(() => <Menu.Item>Test action</Menu.Item>);
  const triggerRef = createRef<HTMLButtonElement>();
  const { rerender } = render(<RowActionMenu label="Actions" trigger={null} triggerRef={triggerRef} menu={menu}>{() => <div>Card</div>}</RowActionMenu>);
  expect(menu).not.toHaveBeenCalled();
  rerender(<RowActionMenu label="Actions" trigger={null} triggerRef={triggerRef} menu={menu}>{() => <div>Selected card</div>}</RowActionMenu>);
  expect(menu).not.toHaveBeenCalled();
  fireEvent.contextMenu(screen.getByText("Selected card"));
  expect(await screen.findByRole("menuitem", { name: "Test action" })).toBeVisible();
  expect(menu).toHaveBeenCalled();
});
