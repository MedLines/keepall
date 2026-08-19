import type { CaptureOverride } from "./classify";

export type CaptureStatus =
  | "idle"
  | "reading"
  | "open"
  | "saving"
  | "saved"
  | "failed";

export type CaptureState = {
  status: CaptureStatus;
  input: string;
  override: CaptureOverride;
  error: string | null;
};

export const initialCaptureState: CaptureState = {
  status: "idle",
  input: "",
  override: null,
  error: null,
};

export type CaptureEvent =
  | { type: "open" }
  | { type: "clipboard"; text: string }
  | { type: "clipboardUnavailable" }
  | { type: "input"; text: string }
  | { type: "override"; kind: CaptureOverride }
  | { type: "save" }
  | { type: "saved" }
  | { type: "failed"; message: string }
  | { type: "dismiss" };

export function captureReducer(
  state: CaptureState,
  event: CaptureEvent,
): CaptureState {
  switch (event.type) {
    case "open":
      if (
        state.status === "reading" ||
        state.status === "open" ||
        state.status === "saving"
      ) {
        return state;
      }

      return {
        status: "reading",
        input: "",
        override: null,
        error: null,
      };

    case "clipboard":
      if (state.status !== "reading") {
        return state;
      }

      return { ...state, status: "open", input: event.text };

    case "clipboardUnavailable":
      if (state.status !== "reading") {
        return state;
      }

      return { ...state, status: "open", input: "" };

    case "input":
      if (state.status !== "open" && state.status !== "failed") {
        return state;
      }

      return {
        status: "open",
        input: event.text,
        override: null,
        error: null,
      };

    case "override":
      if (state.status !== "open" && state.status !== "failed") {
        return state;
      }

      return { ...state, status: "open", override: event.kind, error: null };

    case "save":
      if (state.status !== "open" && state.status !== "failed") {
        return state;
      }

      return { ...state, status: "saving", error: null };

    case "saved":
      if (state.status !== "saving") {
        return state;
      }

      return { ...state, status: "saved", error: null };

    case "failed":
      if (
        state.status !== "saving" &&
        state.status !== "open" &&
        state.status !== "failed"
      ) {
        return state;
      }

      return { ...state, status: "failed", error: event.message };

    case "dismiss":
      if (state.status === "saving" || state.status === "idle") {
        return state;
      }

      return initialCaptureState;

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

// Guard used by the UI to prevent native dialog dismissal while a Dexie write
// is in flight. The reducer is the source of truth for whether "dismiss"
// should change state, but the DOM can still close the dialog, creating a
// state/DOM mismatch unless we block or immediately re-open it.
export function shouldBlockDialogDismiss(
  status: CaptureStatus,
): boolean {
  return status === "saving";
}
