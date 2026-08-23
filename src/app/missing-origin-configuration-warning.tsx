"use client";

export function MissingOriginConfigurationWarning() {
  return (
    <div
      className="border-b border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-950"
      role="alert"
      data-testid="missing-origin-configuration-warning"
    >
      Keepall is not configured for this deployment. Set{" "}
      <code className="font-mono text-xs">NEXT_PUBLIC_KEEPALL_ORIGIN</code> on
      Vercel Production and Preview to your canonical URL. The library still
      works here; install/offline features are disabled until configured.
    </div>
  );
}
