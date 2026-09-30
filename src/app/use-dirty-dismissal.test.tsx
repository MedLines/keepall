import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useDirtyDismissal } from "./use-dirty-dismissal";

test("a rejected dismissal preserves the draft session and a reverted draft closes normally", () => {
  const dismiss = vi.fn();
  const cancel = vi.fn();
  const { result, rerender } = renderHook(({ dirty }) => useDirtyDismissal(dirty, dismiss), { initialProps: { dirty: true } });
  act(() => result.current.requestDismiss({ cancel }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(dismiss).not.toHaveBeenCalled();
  act(() => result.current.confirmationProps.onOpenChange(false));
  expect(dismiss).not.toHaveBeenCalled();
  rerender({ dirty: false });
  act(() => result.current.requestDismiss({ cancel }));
  expect(dismiss).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});
