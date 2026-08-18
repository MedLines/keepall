import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { deleteKeepallDatabase } from "@/persistence/db";

beforeEach(async () => {
  await deleteKeepallDatabase();
});
