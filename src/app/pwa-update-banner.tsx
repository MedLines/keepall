"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/use-translations";

type PwaUpdateBannerProps = {
  onReload: () => void;
};

export function PwaUpdateBanner({ onReload }: PwaUpdateBannerProps) {
  const t = useTranslations("ShellBanners");
  return (
    <div
      className="relative z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-border-subtle bg-bg-surface px-4 py-2 text-center text-sm text-text-primary"
      role="status"
      data-testid="pwa-update-banner"
    >
      <p>
        {t("updateAvailable")}
      </p>
      <Button
        variant="primary"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onReload();
        }}
      >
        {t("reload")}
      </Button>
    </div>
  );
}
