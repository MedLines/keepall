import { describe, expect, test } from "vitest";
import {
  captureReducer,
  initialCaptureState,
  shouldBlockDialogDismiss,
  type CaptureState,
} from "./capture";

function state(partial: Partial<CaptureState>): CaptureState {
  return { ...initialCaptureState, ...partial };
}

describe("captureReducer", () => {
  test("open moves idle into reading and clears the draft", () => {
    expect(
      captureReducer(state({ input: "stale", status: "idle" }), {
        type: "open",
      }),
    ).toEqual({
      status: "reading",
      input: "",
      override: null,
      error: null,
    });
  });

  test("save from idle is ignored", () => {
    expect(
      captureReducer(initialCaptureState, { type: "save" }),
    ).toEqual(initialCaptureState);
  });

  test("clipboard is ignored unless reading", () => {
    expect(
      captureReducer(initialCaptureState, {
        type: "clipboard",
        text: "https://example.com",
      }),
    ).toEqual(initialCaptureState);
  });

  test("clipboard while reading opens the dialog with the text", () => {
    expect(
      captureReducer(state({ status: "reading" }), {
        type: "clipboard",
        text: "https://example.com",
      }),
    ).toMatchObject({ status: "open", input: "https://example.com" });
  });

  test("dismiss is ignored while saving", () => {
    const saving = state({ status: "saving", input: "keep me" });
    expect(captureReducer(saving, { type: "dismiss" })).toEqual(saving);
  });

  test("typing clears a manual Link/Note override", () => {
    expect(
      captureReducer(
        state({
          status: "open",
          input: "https://example.com",
          override: "note",
        }),
        { type: "input", text: "https://example.com/docs" },
      ),
    ).toMatchObject({
      status: "open",
      input: "https://example.com/docs",
      override: null,
    });
  });

  test("save from saving is ignored", () => {
    const saving = state({ status: "saving", input: "hello" });
    expect(captureReducer(saving, { type: "save" })).toEqual(saving);
  });

  test("failed from saving keeps the input", () => {
    expect(
      captureReducer(state({ status: "saving", input: "https://x.com" }), {
        type: "failed",
        message: "Couldn't save. Try again.",
      }),
    ).toMatchObject({
      status: "failed",
      input: "https://x.com",
      error: "Couldn't save. Try again.",
    });
  });
});

describe("shouldBlockDialogDismiss", () => {
  test("blocks only while a Dexie write is in flight", () => {
    expect(shouldBlockDialogDismiss("saving")).toBe(true);
    expect(shouldBlockDialogDismiss("open")).toBe(false);
    expect(shouldBlockDialogDismiss("failed")).toBe(false);
  });
});
