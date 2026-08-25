import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { deleteKeepallDatabase } from "@/persistence/db";

type NavStore = {
  pathname: string;
  params: URLSearchParams;
  listeners: Set<() => void>;
};

const navStore: NavStore = {
  pathname: "/",
  params: new URLSearchParams(),
  listeners: new Set(),
};

function subscribe(listener: () => void) {
  navStore.listeners.add(listener);
  return () => {
    navStore.listeners.delete(listener);
  };
}

function emit() {
  for (const listener of navStore.listeners) {
    listener();
  }
}

export const mockNavigation = {
  get pathname() {
    return navStore.pathname;
  },
  get searchParams() {
    return navStore.params;
  },
  replace: vi.fn((href: string) => {
    const queryIndex = href.indexOf("?");
    navStore.params =
      queryIndex >= 0
        ? new URLSearchParams(href.slice(queryIndex + 1))
        : new URLSearchParams();
    emit();
  }),
};

vi.mock("next/navigation", () => ({
  usePathname: () =>
    useSyncExternalStore(
      subscribe,
      () => navStore.pathname,
      () => navStore.pathname,
    ),
  useSearchParams: () =>
    useSyncExternalStore(
      subscribe,
      () => navStore.params,
      () => navStore.params,
    ),
  useRouter: () => ({
    replace: mockNavigation.replace,
  }),
}));

if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;

  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }

  if (typeof proto.close !== "function") {
    proto.close = function close() {
      this.removeAttribute("open");
    };
  }
}

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = vi.fn(() => "blob:vitest-mock");
}

if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = vi.fn();
}

beforeEach(async () => {
  navStore.pathname = "/";
  navStore.params = new URLSearchParams();
  navStore.listeners.clear();
  mockNavigation.replace.mockReset();
  mockNavigation.replace.mockImplementation((href: string) => {
    const queryIndex = href.indexOf("?");
    navStore.params =
      queryIndex >= 0
        ? new URLSearchParams(href.slice(queryIndex + 1))
        : new URLSearchParams();
    emit();
  });
  await deleteKeepallDatabase();
});

afterEach(() => {
  cleanup();
});
