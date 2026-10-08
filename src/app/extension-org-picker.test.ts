import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fireEvent, within } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";

const source = readFileSync("extension/org-picker.js", "utf8");
let dispose: () => void;
afterEach(() => { dispose?.(); document.body.replaceChildren(); });

function setup() {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const context = { document, clearTimeout, ResizeObserver: class { observe() {} disconnect() {} } };
  runInNewContext(source, context);
  const factory = (context as typeof context & { __keepallCreateOrgPicker: (root: ShadowRoot) => {
    element: HTMLElement; destroy: () => void; selection: () => object; load: (message: object) => void;
  } }).__keepallCreateOrgPicker;
  const picker = factory(shadow);
  shadow.append(picker.element);
  picker.load({ collections: [{ id: "c1", name: "Reading list" }], tags: [
    ...Array.from({ length: 7 }, (_, index) => ({ id: `t${index}`, name: `Design ${index}` })),
    { id: "assigned", name: "Already assigned" },
  ], tagIds: ["assigned"] });
  dispose = picker.destroy;
  return { picker, panel: within(picker.element) };
}

test("only creates a collection with no normalized substring matches, including Unsorted", () => {
  const { picker, panel } = setup();
  const search = panel.getByRole("textbox", { name: "Filter or new collection" });
  for (const value of ["", "  READing   li  ", "UNS"]) {
    fireEvent.input(search, { target: { value } });
    expect(panel.queryByRole("button", { name: /Create collection/ })).toBeNull();
  }
  fireEvent.input(search, { target: { value: "  READing   li  " } });
  fireEvent.keyDown(search, { key: "Enter" });
  expect(picker.selection()).toMatchObject({ collectionId: "c1" });
  fireEvent.input(search, { target: { value: "Uns" } });
  fireEvent.keyDown(search, { key: "Enter" });
  expect(picker.selection()).toMatchObject({ collectionId: null });
});

test("matches assigned tags, suggestions beyond six, and pending names before creating", () => {
  const { picker, panel } = setup();
  const search = panel.getByRole("textbox", { name: "Filter or create tag" });
  for (const value of ["assigned", "Design", "Design 6"]) {
    fireEvent.input(search, { target: { value } });
    expect(panel.queryByRole("button", { name: /Create tag/ })).toBeNull();
  }
  fireEvent.keyDown(search, { key: "Enter" });
  expect(picker.selection()).toMatchObject({ tagIds: ["assigned", "t6"], tagNames: [] });
  fireEvent.input(search, { target: { value: "  New   topic " } });
  fireEvent.click(panel.getByRole("button", { name: "Create tag “New topic”" }));
  fireEvent.input(search, { target: { value: "TOP" } });
  expect(panel.queryByRole("button", { name: /Create tag/ })).toBeNull();
  fireEvent.keyDown(search, { key: "Enter" });
  expect(picker.selection()).toMatchObject({ tagNames: ["New topic"] });
});

test("preserves save shortcuts and composition, and treats HTML names as text", () => {
  const { picker, panel } = setup();
  const search = panel.getByRole("textbox", { name: "Filter or create tag" });
  fireEvent.input(search, { target: { value: "<img src=x>" } });
  for (const modifier of [{ isComposing: true }, { ctrlKey: true }, { metaKey: true }]) {
    fireEvent.keyDown(search, { key: "Enter", ...modifier });
    expect(picker.selection()).toMatchObject({ tagNames: [] });
  }
  fireEvent.click(panel.getByRole("button", { name: "Create tag “<img src=x>”" }));
  expect(panel.getByRole("button", { name: "Remove tag <img src=x>" })).toBeInTheDocument();
  expect(picker.element.querySelector("img")).toBeNull();
});
