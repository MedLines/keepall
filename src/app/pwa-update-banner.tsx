"use client";

type PwaUpdateBannerProps = {
  onReload: () => void;
};

export function PwaUpdateBanner({ onReload }: PwaUpdateBannerProps) {
  return (
    <div
      className="relative z-20 border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-950"
      role="status"
      data-testid="pwa-update-banner"
    >
      <p className="inline">
        Update available. Reload when you’re ready — your library data stays on
        this device.{" "}
      </p>
      <button
        className="relative z-20 ml-1 inline-flex items-center rounded-md bg-sky-900 px-3 py-1 text-sm font-medium text-sky-50 hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-900"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onReload();
        }}
      >
        Reload
      </button>
    </div>
  );
}
