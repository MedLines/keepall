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

// A buttonClassName() element (md, lg or toolbar) that mixes an icon with bare text: CSS can't see a text node, so the
// icon-side padding rule (.ui-button in components.css) can't tell which side the icon is on.
const BUTTON_TEXT_ELEMENT = {
  meta: { type: "problem", schema: [], messages: { wrap: "Wrap this button's text in a <span> so the icon-side padding rule can see which side the icon is on (Button does this itself)." } },
  create(context) {
    const usesButtonClassName = (opening) => opening.attributes.some((attr) => attr.type === "JSXAttribute" && attr.name.name === "className"
      && attr.value?.type === "JSXExpressionContainer" && attr.value.expression.type === "CallExpression" && attr.value.expression.callee.name === "buttonClassName"
      // size "none" buttons set their own padding by hand, so the rule doesn't apply to them.
      && !attr.value.expression.arguments[0]?.properties?.some((prop) => prop.key?.name === "size" && prop.value?.value === "none"));
    return {
      JSXElement(node) {
        if (!usesButtonClassName(node.openingElement)) return;
        const hasIcon = node.children.some((child) => child.type === "JSXElement" && /Icon$/.test(child.openingElement.name.name ?? ""));
        const text = node.children.find((child) => child.type === "JSXText" && /\S/.test(child.value));
        if (hasIcon && text) context.report({ node: text, messageId: "wrap" });
      },
    };
  },
};

// Text buttons: the side with an icon gets 3/4 of --button-px (components.css .ui-button).
const BUTTON_PADDING_SYNTAX = [
  {
    selector: "CallExpression[callee.name='buttonClassName']:not(:has(Property[key.name='size'] Literal[value='none'])) Property[key.name='className'] :matches(Literal[value=/(^|\\s)(px|ps|pe)-/], TemplateElement[value.raw=/(^|\\s)(px|ps|pe)-/])",
    message: "Set a text button's side padding with button-px-* (default 4), not px-/ps-/pe-, so the side with an icon gets its smaller padding. See Button in src/components/ui/button.tsx.",
  },
  {
    selector: "JSXOpeningElement[name.name='Button']:not(:has(JSXAttribute[name.name='size'][value.value='none'])) JSXAttribute[name.name='className'] :matches(Literal[value=/(^|\\s)(px|ps|pe)-/], TemplateElement[value.raw=/(^|\\s)(px|ps|pe)-/])",
    message: "Set a Button's side padding with button-px-* (default 4), not px-/ps-/pe-, so the side with an icon gets its smaller padding.",
  },
];

// Files whose interface text lives in src/i18n/messages. Add a file once its strings move there;
// from then on, text written straight into its JSX is an error. See docs/interface-conventions.md.
const TRANSLATED_FILES = [
  "src/app/backup-panel.tsx",
  "src/app/capture-file-list.tsx",
  "src/app/capture-host.tsx",
  "src/app/capture-image-layout.tsx",
  "src/app/capture-import-progress.tsx",
  "src/app/capture-link-conflict-dialog.tsx",
  "src/app/capture-org-browser.tsx",
  "src/app/capture-org-panel.tsx",
  "src/app/capture-type-menu.tsx",
  "src/app/item-organizer-drawer.tsx",
  "src/app/jump-palette.tsx",
  "src/app/language-setting.tsx",
  "src/app/library-bulk-bar.tsx",
  "src/app/library-empty-state.tsx",
  "src/app/library-shell.tsx",
  "src/app/library-top-bar.tsx",
  "src/app/library-type-filter-menu.tsx",
  "src/app/logo-context-menu.tsx",
  "src/app/note-editor-controls.tsx",
  "src/app/note-format-control.tsx",
  "src/app/offline-banner.tsx",
  "src/app/org-name-suggest.tsx",
  "src/app/organizer-drawer.tsx",
  "src/app/pending-file-preview.tsx",
  "src/app/persistent-storage-status.tsx",
  "src/app/pwa-update-banner.tsx",
  "src/app/settings/agents-panel.tsx",
  "src/app/settings/agents-settings.tsx",
  "src/app/settings/backup-folder-controls.tsx",
  "src/app/settings/connect-agent-panel.tsx",
  "src/app/settings/keyboard-shortcuts-settings.tsx",
  "src/app/settings/settings-page-content.tsx",
  "src/app/settings/settings-sections.tsx",
  "src/app/settings/settings-tabs.tsx",
  "src/app/settings/storage-health.tsx",
  "src/app/shell-top-menu.tsx",
  "src/app/sidebar-resize-handle.tsx",
  "src/app/theme-control.tsx",
  "src/app/undo-notice.tsx",
  "src/components/ui/confirm-dialog.tsx",
  "src/components/ui/modal-dialog.tsx",
  "src/components/ui/side-drawer.tsx",
];
const TEXT_ATTRIBUTES = "aria-label|aria-description|alt|placeholder|label|ariaLabel|content|tooltip";

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
    // Text buttons: the side with an icon gets 3/4 of --button-px (components.css .ui-button).
    files: ["src/**/*.{jsx,tsx}"],
    plugins: { keepall: { rules: { "button-text-element": BUTTON_TEXT_ELEMENT } } },
    rules: {
      "keepall/button-text-element": "error",
      "no-restricted-syntax": ["error", ...BUTTON_PADDING_SYNTAX],
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
        // Layout geometry (calc/min/viewport sizes, grid tracks, z layers), the inherit
        // keyword for radius, and transition property lists carry no design value.
        allow: ["layout", "rounded-[inherit]", "transition-*"],
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
    files: TRANSLATED_FILES,
    rules: {
      // Decorative separators carry no words to translate.
      "react/jsx-no-literals": ["error", { noStrings: false, allowedStrings: ["·", "/", "+"] }],
      "no-restricted-syntax": ["error", ...BUTTON_PADDING_SYNTAX, {
        selector: `JSXAttribute[name.name=/^(${TEXT_ATTRIBUTES})$/] > Literal[value=/[A-Za-z]/]`,
        message: "Interface text goes in src/i18n/messages/en.ts and comes from useTranslations() (src/i18n/use-translations.ts).",
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
    "**/.wrangler/**",
    "playwright-report/**",
    "test-results/**",
    ".learning/**",
    // Agent worktrees and local QA scripts hold whole checkouts; linting them takes minutes.
    ".claude/**",
    ".qa/**",
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
