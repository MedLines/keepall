/**
 * Hidden build marker for automated two-deploy PWA update verification.
 * Set via NEXT_PUBLIC_BUILD_MARKER at build time only.
 */
export function BuildMarker() {
  const marker = process.env.NEXT_PUBLIC_BUILD_MARKER;
  if (!marker) {
    return null;
  }

  return (
    <p className="sr-only" data-testid="build-marker">
      {marker}
    </p>
  );
}
