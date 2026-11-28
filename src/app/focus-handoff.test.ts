import { afterEach, describe, expect, test } from "vitest";
import { focusIsUnclaimed } from "./focus-handoff";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(html: string) {
  document.body.insertAdjacentHTML("beforeend", html);
}

describe("focusIsUnclaimed", () => {
  test("is unclaimed while focus is inside the closing popup", () => {
    mount('<div id="popup"><button id="item">Deselect all</button></div>');
    document.getElementById("item")!.focus();
    expect(focusIsUnclaimed(document.getElementById("popup"))).toBe(true);
  });

  test("is unclaimed once focus falls back to the page", () => {
    mount('<div id="popup"></div>');
    (document.activeElement as HTMLElement | null)?.blur();
    expect(focusIsUnclaimed(document.getElementById("popup"))).toBe(true);
    expect(focusIsUnclaimed(null)).toBe(true);
  });

  test("is claimed when something outside the popup took focus", () => {
    mount('<div id="popup"><button>Deselect all</button></div><input id="palette-search">');
    document.getElementById("palette-search")!.focus();
    expect(focusIsUnclaimed(document.getElementById("popup"))).toBe(false);
  });
});
