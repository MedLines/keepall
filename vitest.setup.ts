import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto";
import { afterEach, beforeEach } from "vitest";
import { deleteKeepallDatabase } from "@/persistence/db";

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

beforeEach(async () => {
  await deleteKeepallDatabase();
});

afterEach(() => {
  cleanup();
});
