import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { UNDO_NOTICE_TIMEOUT_MS, UndoNotice } from "./undo-notice";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function renderNotice(props: Partial<Parameters<typeof UndoNotice>[0]> = {}) {
  const onUndo = vi.fn();
  const onDismiss = vi.fn();
  const view = render(
    <UndoNotice
      message="Moved “A persisted note” to Trash."
      undoLabel="Undo moving A persisted note to Trash"
      busy={false}
      onUndo={onUndo}
      onDismiss={onDismiss}
      {...props}
    />,
  );
  return { onUndo, onDismiss, view };
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

test("withdraws itself once the countdown runs out", () => {
  const { onDismiss } = renderNotice();

  advance(UNDO_NOTICE_TIMEOUT_MS - 100);
  expect(onDismiss).not.toHaveBeenCalled();

  advance(100);
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("holds the notice while focus is inside it", () => {
  const { onDismiss } = renderNotice();
  const undo = screen.getByRole("button", { name: "Undo moving A persisted note to Trash" });
  fireEvent.focus(undo);

  advance(UNDO_NOTICE_TIMEOUT_MS * 3);
  expect(onDismiss).not.toHaveBeenCalled();

  fireEvent.blur(undo);
  advance(UNDO_NOTICE_TIMEOUT_MS);
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("holds the notice while a write is pending or the caller pins it open", () => {
  const { onDismiss, view } = renderNotice({ busy: true });
  advance(UNDO_NOTICE_TIMEOUT_MS * 2);
  expect(onDismiss).not.toHaveBeenCalled();

  view.rerender(
    <UndoNotice message="Moved “A persisted note” to Trash." undoLabel="Undo moving A persisted note to Trash" busy={false} paused onUndo={vi.fn()} onDismiss={onDismiss} />,
  );
  advance(UNDO_NOTICE_TIMEOUT_MS * 2);
  expect(onDismiss).not.toHaveBeenCalled();
});

test("reports undo and dismissal, keeping Undo enabled when nothing is pending", () => {
  const { onUndo, onDismiss } = renderNotice();

  fireEvent.click(screen.getByRole("button", { name: "Undo moving A persisted note to Trash" }));
  expect(onUndo).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "Dismiss Trash notice" }));
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("states the move and disables Undo while a write is pending", () => {
  renderNotice({ busy: true });

  expect(screen.getByRole("status")).toHaveTextContent("Moved “A persisted note” to Trash.");
  expect(screen.getByRole("button", { name: "Undo moving A persisted note to Trash" })).toBeDisabled();
});
