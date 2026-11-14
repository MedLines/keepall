import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import * as shellIcons from "./shell-icons";

describe("icon catalogue story", () => {
  test("lists every exported shell icon by name", () => {
    const story = readFileSync(join(__dirname, "shell-icons.stories.tsx"), "utf8");
    const missing = Object.keys(shellIcons)
      .filter(name => name.endsWith("Icon") && name !== "LogoIcon")
      .filter(name => !story.includes(`<IconTile name="${name}"><${name} `));
    expect(missing).toEqual([]);
  });
});
