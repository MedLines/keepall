import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { NoteEditorControls } from "@/app/note-editor-controls";
import { motionCssVariables } from "@/components/ui/motion-tokens";
import { captureStyles } from "@/app/capture-styles";
import { CheckIcon, CloseIcon, CollectionIcon, HashIcon, PlusIcon, SearchIcon, UploadIcon, ImageIcon, NoteIcon, PdfIcon, VideoIcon } from "@/app/shell-icons";

const icons = { check: CheckIcon, close: CloseIcon, collection: CollectionIcon, tag: HashIcon, add: PlusIcon, search: SearchIcon, upload: UploadIcon, image: ImageIcon, note: NoteIcon, pdf: PdfIcon, video: VideoIcon };
export const drawerUi = {
  motionCssVariables,
  className(names: string) {
    return names.split(" ").map(name => `${name} ${captureStyles[name as keyof typeof captureStyles] ?? ""}`).join(" ");
  },
  icon(name: keyof typeof icons, className = "size-4") {
    const Icon = icons[name];
    return renderToStaticMarkup(<Icon className={className} />);
  },
  mountNoteControls(element: HTMLElement, props: ComponentProps<typeof NoteEditorControls>) {
    const root = createRoot(element);
    const update = (value: ComponentProps<typeof NoteEditorControls>) => flushSync(() => root.render(<NoteEditorControls {...value} />));
    update(props);
    return { update, destroy: () => root.unmount() };
  },
};
Object.assign(globalThis, { __keepallDrawerUi: drawerUi });
