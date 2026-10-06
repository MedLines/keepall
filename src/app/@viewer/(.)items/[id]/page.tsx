import { ItemPageContent } from "../../../item-page-content";
import { ItemRouteViewer } from "../../../item-route-viewer";
import { safeLibraryReturnHref } from "../../../item-page-navigation";

export default async function ItemViewerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnHref = safeLibraryReturnHref(typeof query.from === "string" ? query.from : undefined);
  return <ItemRouteViewer><ItemPageContent key={id} itemId={id} returnHref={returnHref} /></ItemRouteViewer>;
}
