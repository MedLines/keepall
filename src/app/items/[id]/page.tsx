import { Suspense } from "react";
import { ImageItemPage } from "../../image-item-page";
import { safeLibraryReturnHref } from "../../item-page-navigation";

export default function ItemPage(props: PageProps<"/items/[id]">) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-bg-shell text-sm text-text-secondary">Loading image…</div>}>
      <ResolvedItemPage params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ResolvedItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const from = typeof query.from === "string" ? query.from : undefined;
  return <ImageItemPage itemId={id} returnHref={safeLibraryReturnHref(from)} />;
}
