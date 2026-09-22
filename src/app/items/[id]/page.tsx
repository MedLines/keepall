import { Suspense } from "react";
import { ItemPageContent } from "../../item-page-content";
import { safeLibraryReturnHref } from "../../item-page-navigation";

export default function ItemPage(props: PageProps<"/items/[id]">) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-bg-shell text-sm text-text-secondary">Loading item…</div>}>
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
  return <ItemPageContent itemId={id} returnHref={safeLibraryReturnHref(from)} />;
}
