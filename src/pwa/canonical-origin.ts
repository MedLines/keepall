const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

/**
 * Normalize configured canonical origin (e.g. https://keepall.app/path → https://keepall.app).
 * Returns null when unset or invalid.
 */
export function normalizeKeepallOrigin(
  raw: string | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function isLocalDevOrigin(origin: string): boolean {
  try {
    return LOCAL_DEV_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export type OriginDeploymentPolicy = {
  canonicalOrigin: string | null;
  registerServiceWorker: boolean;
  requestPersistentStorage: boolean;
  showNonCanonicalWarning: boolean;
  showMissingConfigurationWarning: boolean;
};

export function resolveOriginDeploymentPolicy(
  currentOrigin: string,
  configuredCanonicalRaw: string | undefined,
): OriginDeploymentPolicy {
  const canonicalOrigin = normalizeKeepallOrigin(configuredCanonicalRaw);

  if (isLocalDevOrigin(currentOrigin)) {
    return {
      canonicalOrigin,
      registerServiceWorker: true,
      requestPersistentStorage: true,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: false,
    };
  }

  if (!canonicalOrigin) {
    return {
      canonicalOrigin: null,
      registerServiceWorker: false,
      requestPersistentStorage: false,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: true,
    };
  }

  if (currentOrigin === canonicalOrigin) {
    return {
      canonicalOrigin,
      registerServiceWorker: true,
      requestPersistentStorage: true,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: false,
    };
  }

  return {
    canonicalOrigin,
    registerServiceWorker: false,
    requestPersistentStorage: false,
    showNonCanonicalWarning: true,
    showMissingConfigurationWarning: false,
  };
}
