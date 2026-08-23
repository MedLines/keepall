import { describe, expect, test } from "vitest";
import {
  isLocalDevOrigin,
  normalizeKeepallOrigin,
  resolveOriginDeploymentPolicy,
} from "./canonical-origin";

describe("normalizeKeepallOrigin", () => {
  test("returns null for missing or blank values", () => {
    expect(normalizeKeepallOrigin(undefined)).toBeNull();
    expect(normalizeKeepallOrigin("")).toBeNull();
    expect(normalizeKeepallOrigin("   ")).toBeNull();
  });

  test("normalizes configured values to URL.origin", () => {
    expect(normalizeKeepallOrigin("https://keepall.app/")).toBe(
      "https://keepall.app",
    );
    expect(normalizeKeepallOrigin("https://keepall.app/library")).toBe(
      "https://keepall.app",
    );
  });

  test("returns null for invalid URLs", () => {
    expect(normalizeKeepallOrigin("not-a-url")).toBeNull();
  });
});

describe("isLocalDevOrigin", () => {
  test("accepts localhost and 127.0.0.1", () => {
    expect(isLocalDevOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalDevOrigin("http://127.0.0.1:3100")).toBe(true);
  });

  test("rejects production hosts", () => {
    expect(isLocalDevOrigin("https://keepall.app")).toBe(false);
  });
});

describe("resolveOriginDeploymentPolicy", () => {
  test("allows PWA features on local dev regardless of canonical config", () => {
    expect(
      resolveOriginDeploymentPolicy(
        "http://localhost:3000",
        "https://keepall.app",
      ),
    ).toEqual({
      canonicalOrigin: "https://keepall.app",
      registerServiceWorker: true,
      requestPersistentStorage: true,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: false,
    });
  });

  test("disables PWA features and warns when canonical origin is missing", () => {
    expect(
      resolveOriginDeploymentPolicy("https://preview.vercel.app", undefined),
    ).toEqual({
      canonicalOrigin: null,
      registerServiceWorker: false,
      requestPersistentStorage: false,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: true,
    });
  });

  test("disables PWA features when canonical origin is invalid", () => {
    expect(
      resolveOriginDeploymentPolicy(
        "https://preview.vercel.app",
        "not-a-url",
      ),
    ).toEqual({
      canonicalOrigin: null,
      registerServiceWorker: false,
      requestPersistentStorage: false,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: true,
    });
  });

  test("enables PWA on the canonical production origin", () => {
    expect(
      resolveOriginDeploymentPolicy(
        "https://keepall.app",
        "https://keepall.app/",
      ),
    ).toEqual({
      canonicalOrigin: "https://keepall.app",
      registerServiceWorker: true,
      requestPersistentStorage: true,
      showNonCanonicalWarning: false,
      showMissingConfigurationWarning: false,
    });
  });

  test("warns and disables PWA-only features on non-canonical production hosts", () => {
    expect(
      resolveOriginDeploymentPolicy(
        "https://preview-abc.vercel.app",
        "https://keepall.app",
      ),
    ).toEqual({
      canonicalOrigin: "https://keepall.app",
      registerServiceWorker: false,
      requestPersistentStorage: false,
      showNonCanonicalWarning: true,
      showMissingConfigurationWarning: false,
    });
  });
});
