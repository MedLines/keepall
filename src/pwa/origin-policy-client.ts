import {
  resolveOriginDeploymentPolicy,
  type OriginDeploymentPolicy,
} from "./canonical-origin";

export function readConfiguredKeepallOrigin(): string | undefined {
  return process.env.NEXT_PUBLIC_KEEPALL_ORIGIN;
}

/** Resolve deployment policy in the browser only (call after mount). */
export function getClientOriginDeploymentPolicy(): OriginDeploymentPolicy {
  return resolveOriginDeploymentPolicy(
    window.location.origin,
    readConfiguredKeepallOrigin(),
  );
}
