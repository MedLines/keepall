import { afterEach, describe, expect, test, vi } from "vitest";
import {
  persistentStorageMessage,
  requestPersistentStorage,
} from "./persistent-storage";

describe("requestPersistentStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns unavailable when StorageManager.persist is missing", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await requestPersistentStorage()).toBe("unavailable");
  });

  test("returns granted when persist() is true", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", { storage: { persist } });
    expect(await requestPersistentStorage()).toBe("granted");
    expect(persist).toHaveBeenCalledOnce();
  });

  test("returns denied when persist() is false", async () => {
    vi.stubGlobal("navigator", {
      storage: { persist: vi.fn().mockResolvedValue(false) },
    });
    expect(await requestPersistentStorage()).toBe("denied");
  });

  test("returns unavailable when persist() throws", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persist: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    expect(await requestPersistentStorage()).toBe("unavailable");
  });
});

describe("persistentStorageMessage", () => {
  test("describes each status", () => {
    expect(persistentStorageMessage("granted")).toMatch(/persistent/i);
    expect(persistentStorageMessage("denied")).toMatch(/cleared/i);
    expect(persistentStorageMessage("unavailable")).toMatch(/not available/i);
  });
});
