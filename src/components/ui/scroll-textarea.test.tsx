import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ScrollTextarea } from "./scroll-textarea";

test("the scrolling field remains the editable textbox and exposes its native ref", () => {
  const ref = createRef<HTMLTextAreaElement>();
  const onChange = vi.fn();
  const onKeyDown = vi.fn();
  render(<ScrollTextarea ref={ref} aria-label="Note" className="ui-field h-32" value="Text" onChange={onChange} onKeyDown={onKeyDown} />);
  const field = screen.getByRole("textbox", { name: "Note" });
  expect(ref.current).toBe(field);
  expect(field).toHaveAttribute("tabindex", "0");
  fireEvent.change(field, { target: { value: "Edited text" } });
  expect(onChange).toHaveBeenCalledOnce();
  fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
  expect(onKeyDown).toHaveBeenCalledOnce();
});

test("the custom track updates when controlled text starts or stops overflowing", async () => {
  const props = { "aria-label": "Markdown", onChange: vi.fn(), className: "ui-field h-32" };
  const { rerender, container } = render(<ScrollTextarea {...props} value="Short" />);
  const field = screen.getByRole("textbox", { name: "Markdown" }) as HTMLTextAreaElement;
  Object.defineProperties(field, {
    clientHeight: { value: 100 }, clientWidth: { value: 200 }, scrollWidth: { value: 200 },
    scrollHeight: { get: () => field.value.length > 100 ? 500 : 100 },
  });
  rerender(<ScrollTextarea {...props} value={"Long text ".repeat(100)} />);
  await waitFor(() => expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).not.toBeNull());
  rerender(<ScrollTextarea {...props} value="Short again" />);
  await waitFor(() => expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).toBeNull());
});
