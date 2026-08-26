export const OPEN_CAPTURE_EVENT = "keepall:open-capture";

export function openCaptureDialog(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CAPTURE_EVENT));
}
