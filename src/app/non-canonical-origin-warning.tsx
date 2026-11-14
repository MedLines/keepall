"use client";

type NonCanonicalOriginWarningProps = {
  canonicalOrigin: string;
};

export function NonCanonicalOriginWarning({
  canonicalOrigin,
}: NonCanonicalOriginWarningProps) {
  return (
    <div
      className="border-b border-border-warning bg-bg-warning px-4 py-2 text-center text-sm text-text-warning"
      role="alert"
      data-testid="non-canonical-origin-warning"
    >
      This is not your real Keepall library. Data here stays on this preview
      origin only.{" "}
      <a
        className="font-medium underline underline-offset-2"
        href={canonicalOrigin}
      >
        Open Keepall at {canonicalOrigin}
      </a>
    </div>
  );
}
