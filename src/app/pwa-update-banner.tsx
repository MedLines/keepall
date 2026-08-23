"use client";

type PwaUpdateBannerProps = {
  onReload: () => void;
};

export function PwaUpdateBanner({ onReload }: PwaUpdateBannerProps) {
  return (
    <div
      className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-950"
      role="status"
      data-testid="pwa-update-banner"
    >
      Update available.{" "}
      <button
        className="font-medium underline underline-offset-2"
        type="button"
        onClick={onReload}
      >
        Reload
      </button>{" "}
      when you’re ready — your library data stays on this device.
    </div>
  );
}
