// Only tokens.css may write literal colours. Every other stylesheet in src/app/styles/
// uses the semantic custom properties declared there (see docs/interface-conventions.md).
const COLOR_FUNCTIONS = ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color"];
const MESSAGE = "Literal colours belong in src/app/styles/tokens.css. Use a semantic custom property (var(--color-…)) instead; see docs/interface-conventions.md.";

/** @type {import("stylelint").Config} */
const config = {
  rules: {
    "color-no-hex": [true, { message: MESSAGE }],
    "color-named": ["never", { message: MESSAGE }],
    "function-disallowed-list": [COLOR_FUNCTIONS, { message: MESSAGE }],
  },
  overrides: [
    {
      files: ["src/app/styles/tokens.css"],
      rules: {
        "color-no-hex": null,
        "color-named": null,
        "function-disallowed-list": null,
      },
    },
  ],
};

export default config;
