import Link from "next/link";
import { ArrowLeftIcon, LinkIcon } from "./shell-icons";
import { ThemeControl } from "./theme-control";

type Props = {
  returnHref: string;
  title: string;
  sourceUrl?: string;
  titleAsHeading?: boolean;
};

const CONTROL = "ui-control inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-3 text-sm font-medium";

export function ItemPageHeader({ returnHref, title, sourceUrl, titleAsHeading = false }: Props) {
  const Title = titleAsHeading ? "h1" : "span";

  return (
    <header className="z-10 shrink-0 border-b border-border-control bg-bg-canvas">
      <div className="mx-auto flex min-h-16 w-full max-w-[100rem] items-center gap-3 px-3 sm:px-5">
        <Link className={`${CONTROL} sm:ps-2.5`} href={returnHref} aria-label="Back to library">
          <ArrowLeftIcon />
          <span className="hidden sm:inline">Library</span>
        </Link>
        <Title className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary sm:text-lg" title={title}>
          {title}
        </Title>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          {sourceUrl ? (
            <a className={`${CONTROL} xl:ps-2.5`} href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Source link">
              <LinkIcon />
              <span className="hidden xl:inline">Source link</span>
            </a>
          ) : null}
          <ThemeControl compact />
        </div>
      </div>
    </header>
  );
}
