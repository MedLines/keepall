import type { ReactNode } from "react";

export function MediaViewerToolbar({ view, navigation, zoom, pdf = false }: {
  view: ReactNode; navigation: ReactNode; zoom?: ReactNode; pdf?: boolean;
}) {
  return <div className="media-viewer-toolbar" data-media-viewer-toolbar data-pdf-toolbar={pdf || undefined}>
    <span aria-hidden="true" className="scroll-fade-overlay absolute inset-x-0 top-full h-6" />
    <div className="media-viewer-mode">{view}</div>
    <div className="media-viewer-navigation">{navigation}</div>
    <div className="media-viewer-zoom">{zoom}</div>
  </div>;
}
