import { describe, expect, test } from "vitest";
import { itemMediaLayoutId } from "@/domain/library-view";
import { itemMediaLayoutProps } from "./item-media-layout";

describe("itemMediaLayoutProps", () => {
  test("omits layoutId when the user prefers reduced motion", () => {
    expect(itemMediaLayoutProps("n1", "grid", true)).toEqual({});
  });

  test("ties layout animation to grid/list mode, not sidebar width", () => {
    expect(itemMediaLayoutProps("n1", "list", false)).toEqual({
      layout: true,
      layoutId: itemMediaLayoutId("n1"),
      layoutDependency: "list",
      transition: { type: "spring", duration: 0.35, bounce: 0 },
    });
  });
});
