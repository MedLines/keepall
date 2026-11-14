// Only tokens.css may write literal colours. Every other stylesheet in src/app/styles/
// uses the semantic custom properties declared there (see docs/interface-conventions.md).
// Mask properties are exempt: black/transparent there set alpha, not a visible colour.
const COLOR_FUNCTION = "/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(/";
const NOT_A_MASK = "/^(?!(-webkit-)?mask)/";
const MESSAGE = "Literal colours belong in src/app/styles/tokens.css. Use a semantic custom property (var(--color-…)) instead; see docs/interface-conventions.md.";

/** @type {import("stylelint").Config} */
const config = {
  rules: {
    "color-no-hex": [true, { message: MESSAGE }],
    "color-named": ["never", { ignoreProperties: ["/^(-webkit-)?mask/"], message: MESSAGE }],
    "declaration-property-value-disallowed-list": [{ [NOT_A_MASK]: [COLOR_FUNCTION] }, { message: MESSAGE }],
  },
  overrides: [
    {
      files: ["src/app/styles/tokens.css"],
      rules: {
        "color-no-hex": null,
        "color-named": null,
        "declaration-property-value-disallowed-list": null,
      },
    },
  ],
};

export default config;
