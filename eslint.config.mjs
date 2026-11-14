import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";
import { plugin as shadcn } from "@shadcn/lint";
import { globSync, readFileSync } from "node:fs";

// Design-system gate. Theme and component discovery come from components.json
// (src/app/globals.css, @/components/ui).
const TOKENS = "src/app/styles/tokens.css";
const CONVENTIONS = "docs/interface-conventions.md";
// Button and IconButton take their size and shape from props; callers may only place them.
// Button keeps px-* because size="toolbar" leaves horizontal padding to the caller.
const SIZE_DENY = ["shape", "w-*", "h-*", "size-*", "min-w-*", "min-h-*", "max-w-*", "max-h-*"];
const PADDING_DENY = ["p", "py", "pt", "pr", "pb", "pl", "ps", "pe", "gap", "gap-x", "gap-y", "space-x", "space-y"];
// Keepall's own classes, declared as plain selectors in src/**/*.css. Tailwind cannot
// see them, so no-unknown-classes allows exactly these names and still flags the rest.
const CSS_CLASSES = [...new Set(
  globSync("src/**/*.css", { exclude: (path) => path.includes("prototypes") })
    .flatMap((file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").match(/\.-?[_a-zA-Z][\w-]*/g) ?? [])
    .map((selector) => selector.slice(1)),
)].sort();
// Classes with no CSS that tests, scripts or the extension select by name.
const HOOK_CLASSES = ["bookmark-import-option", "item-type-icon", "kd-palette-result", "library-review-content", "row-action-popup", "video-viewer-canvas"];
// Runtime geometry that JavaScript computes (virtualizers, media sizing, motion variables).
const COMPUTED_STYLE_PROPERTIES = ["--*", "transform", "width", "height", "aspectRatio", "gridTemplateColumns"];

const BUTTON_MESSAGE = `<{{component}}> owns its size and shape: "{{className}}" is not allowed. Use the size prop ({{sizes|see button.tsx}}) and variant prop ({{variants|see button.tsx}}); place it with margin here or gap on the parent. See ${CONVENTIONS}.`;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["**/*.test.*", "**/*.spec.*"],
    plugins: { sonarjs },
    // Advisory limits for application code; test setup keeps its existing rules.
    rules: {
      complexity: ["warn", { max: 20, variant: "classic" }],
      "sonarjs/cognitive-complexity": ["warn", 15],
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}", ".storybook/**/*.{ts,tsx}"],
    plugins: { shadcn },
    rules: {
      "shadcn/no-raw-colors": ["error", {
        message: `"{{className}}" is a raw color. Use a semantic role from ${TOKENS}: {{suggestions|see the --color-bg-*, --color-text-*, --color-border-* roles}}. If none fits, propose a new role there first.`,
      }],
      "shadcn/no-arbitrary-values": ["error", {
        message: `"{{className}}" is an arbitrary value. Use a theme value instead: {{suggestions|see the scales in ${TOKENS}}}. If none fits, add a named token to ${TOKENS} and explain it in ${CONVENTIONS}.`,
      }],
      "shadcn/no-inline-styles": ["error", {
        allow: COMPUTED_STYLE_PROPERTIES,
        message: `Inline style "{{property}}" bypasses the design system. Use utility classes backed by ${TOKENS}, or a class in src/app/styles/ (see ${CONVENTIONS}).`,
      }],
      "shadcn/no-unknown-classes": ["error", {
        allow: [...CSS_CLASSES, ...HOOK_CLASSES],
        message: `"{{className}}" is not a Tailwind utility this theme generates. {{suggestions|Check the spelling, or use a utility backed by ${TOKENS}.}}`,
      }],
      "shadcn/no-restyle": ["warn", {
        allow: ["layout"],
        message: {
          default: `Don't restyle <{{component}}> with "{{className}}". Use a variant ({{variants|none defined}}) as described in ${CONVENTIONS}.`,
        },
        contracts: [
          {
            pattern: "^Button$",
            allow: ["layout", "px"],
            deny: [...SIZE_DENY, ...PADDING_DENY],
            message: { default: BUTTON_MESSAGE },
          },
          {
            pattern: "^IconButton$",
            allow: ["layout"],
            deny: [...SIZE_DENY, ...PADDING_DENY, "px"],
            message: { default: BUTTON_MESSAGE },
          },
          {
            // Scroll containers are sized and framed by their caller (conventions: "Scrolling panels").
            pattern: "^(ScrollArea|ScrollPanel|ScrollTextarea)$",
            allow: ["layout", "spacing", "shape", "ui-field", "scroll-fade"],
          },
        ],
      }],
    },
  },
  {
    // Components style themselves.
    files: ["src/components/ui/**"],
    rules: { "shadcn/no-restyle": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "extension/note-preview.js",
    "extension/drawer-styles.js",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".learning/**",
    // Local, gitignored UI experiments that never ship.
    "src/app/prototypes/**",
    // Serwist build output (regenerated by `pnpm build`)
    "public/sw.js",
    "public/sw.js.map",
    "public/swe-worker*",
    "public/serwist*",
    "public/pdfjs/**",
    "public/ocr/**",
  ]),
]);

export default eslintConfig;
