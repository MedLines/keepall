export const ITEMS_CHANGED_EVENT = "keepall:items-changed";

export const PREVIEW_WELCOME_EVENT = "keepall:preview-welcome";

export type PreviewWelcomeDetail = {
  linkIds: string[];
};

export function dispatchPreviewWelcome(linkIds: string[]) {
  if (linkIds.length === 0) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<PreviewWelcomeDetail>(PREVIEW_WELCOME_EVENT, {
      detail: { linkIds },
    }),
  );
}
