// Writes design-system/manifest.code.json: the components Storybook's components manifest
// lists (props, allowed values, defaults, purpose) plus every custom property in tokens.css.
// usage: node scripts/design-system/manifest-code.mjs [--from <url-or-file>]
// Default source: a running Storybook at http://localhost:6006, else storybook-static/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const fromArg = process.argv.indexOf("--from");
const STATIC = path.join(root, "storybook-static/manifests/components.json");

async function loadManifest() {
  const from = fromArg > -1 ? process.argv[fromArg + 1] : null;
  if (from && !from.startsWith("http")) return JSON.parse(readFileSync(from, "utf8"));
  const url = from ?? "http://localhost:6006/manifests/components.json";
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (response.ok) return await response.json();
  } catch { /* fall through to the static build */ }
  if (existsSync(STATIC)) return JSON.parse(readFileSync(STATIC, "utf8"));
  throw new Error(`No components manifest: start Storybook (pnpm storybook) or run pnpm build-storybook.`);
}

const unquote = (value) => value.replace(/^["'`]|["'`]$/g, "");

function describeProp(name, prop) {
  const ts = prop.tsType ?? {};
  const literals = ts.name === "union" && ts.elements?.every((e) => e.name === "literal")
    ? ts.elements.map((e) => unquote(e.value))
    : null;
  const type = literals ? "enum" : ts.name === "boolean" ? "boolean" : ts.name === "string" ? "string" : ts.name ?? "unknown";
  const out = { name, type };
  if (literals) out.values = literals;
  if (prop.defaultValue?.value !== undefined) out.default = unquote(prop.defaultValue.value);
  if (prop.required) out.required = true;
  if (prop.description) out.description = prop.description;
  return out;
}

/** The purpose is the description's first paragraph (the DRAFT line until it is rewritten). */
const purposeOf = (description = "") => description.split(/\n\s*\n/)[0].trim();

// --- tokens.css -------------------------------------------------------------------------------

function parseTokens(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const scopes = { root: {}, light: {}, dark: {}, themeInline: {}, theme: {} };
  const blocks = [
    [/:root\[data-theme="light"\]\s*\{([^}]*)\}/g, "light"],
    [/:root\[data-theme="dark"\]\s*\{([^}]*)\}/g, "dark"],
    [/:root\s*\{([^}]*)\}/g, "root"],
    [/@theme inline\s*\{([^}]*)\}/g, "themeInline"],
    [/@theme(?: default)?\s*\{([^}]*)\}/g, "theme"],
  ];
  for (const [pattern, scope] of blocks) {
    for (const [, body] of clean.matchAll(pattern)) {
      for (const [, name, value] of body.matchAll(/(--[\w-]+(?:\*)?)\s*:\s*([^;]+);/g)) {
        scopes[scope][name] = value.replace(/\s+/g, " ").trim();
      }
    }
  }
  return scopes;
}

/** Split a top-level light-dark(a, b) into its two arguments. */
function splitLightDark(value) {
  const match = /^light-dark\((.*)\)$/.exec(value);
  if (!match) return null;
  let depth = 0;
  for (let i = 0; i < match[1].length; i++) {
    const ch = match[1][i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) return { light: match[1].slice(0, i).trim(), dark: match[1].slice(i + 1).trim() };
  }
  return null;
}

function tokenEntries(scopes) {
  const tokens = {};
  const add = (name, value, source) => {
    if (name.endsWith("*")) return; // namespace resets such as --color-*: initial
    const pair = splitLightDark(value);
    tokens[name] = pair ? { light: pair.light, dark: pair.dark, source } : { value, source };
  };
  for (const [name, value] of Object.entries(scopes.root)) add(name, value, ":root");
  for (const [name, value] of Object.entries(scopes.themeInline)) add(name, value, "@theme inline");
  for (const [name, value] of Object.entries(scopes.theme)) add(name, value, "@theme");
  // Values that differ per data-theme block (e.g. --backdrop-scrim).
  for (const [name, value] of Object.entries(scopes.dark)) {
    if (tokens[name]?.value !== undefined) tokens[name] = { light: tokens[name].value, dark: value, source: tokens[name].source };
  }
  const resets = Object.keys({ ...scopes.themeInline, ...scopes.theme }).filter((n) => n.endsWith("-*")).sort();
  return { tokens, resets };
}

// --- write ------------------------------------------------------------------------------------

const manifest = await loadManifest();
// Prototypes (Storybook's Prototypes section) are experiments built from system parts, not parts.
const components = Object.values(manifest.components)
  .filter((entry) => !entry.id.startsWith("prototypes-"))
  .map((entry) => {
    const docgen = entry.reactDocgen ?? {};
    const description = entry.description ?? docgen.description ?? "";
    return {
      name: entry.name,
      storybookId: entry.id,
      import: entry.jsDocTags?.import?.[0] ?? null,
      purpose: purposeOf(description),
      description,
      props: Object.entries(docgen.props ?? {}).map(([name, prop]) => describeProp(name, prop)),
      stories: (entry.stories ?? []).map((story) => story.name),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const { tokens, resets } = tokenEntries(parseTokens(readFileSync(path.join(root, "src/app/styles/tokens.css"), "utf8")));

// Custom properties the app also relies on but declares elsewhere. They are listed separately so
// a Figma variable that points at one of them is not reported as missing from tokens.css.
const otherSources = {};
const addOther = (name, value, source) => { if (!(name in tokens) && !(name in otherSources)) otherSources[name] = { value, source }; };
for (const file of ["components.css", "library.css", "library-content.css", "overlays.css", "transitions.css"]) {
  const scopes = parseTokens(readFileSync(path.join(root, "src/app/styles", file), "utf8"));
  for (const [name, value] of Object.entries(scopes.root)) addOther(name, value, `src/app/styles/${file} :root`);
}
const { motionCssVariables } = await import(path.join(root, "src/components/ui/motion-tokens.ts"));
for (const [name, value] of Object.entries(motionCssVariables)) addOther(name, String(value), "src/components/ui/motion-tokens.ts");
// Tailwind's default theme for the scales Keepall keeps open (see resetNamespaces for the closed ones).
const tailwindTheme = parseTokens(readFileSync(path.join(root, "node_modules/tailwindcss/theme.css"), "utf8")).theme;
for (const [name, value] of Object.entries(tailwindTheme)) {
  if (/^--(spacing|text-|font-weight-|leading-|tracking-|radius-)/.test(name) && !resets.some((r) => name.startsWith(r.slice(0, -1)))) {
    addOther(name, value, "tailwindcss/theme.css");
  }
}

// The closed icon set: every *Icon export of shell-icons.tsx, plus DocumentIcon's formats.
const shellIcons = [...readFileSync(path.join(root, "src/app/shell-icons.tsx"), "utf8").matchAll(/^export function (\w+Icon)\b/gm)].map(([, name]) => name);
const documentFormats = /DocumentFormat = ([^;]+);/.exec(readFileSync(path.join(root, "src/domain/document.ts"), "utf8"))[1].split("|").map((v) => unquote(v.trim()));
const icons = [
  ...shellIcons.map((name) => ({ name, import: `import { ${name} } from "@/app/shell-icons";` })),
  ...documentFormats.map((format) => ({ name: `DocumentIcon format="${format}"`, import: 'import { DocumentIcon } from "@/app/document-icon";' })),
].sort((a, b) => a.name.localeCompare(b.name));

const out = {
  $comment: "Generated by scripts/design-system/manifest-code.mjs from Storybook's components manifest and src/app/styles/tokens.css. Do not edit by hand.",
  components,
  icons,
  tokens: {
    resetNamespaces: resets,
    values: Object.fromEntries(Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b))),
    otherSources: Object.fromEntries(Object.entries(otherSources).sort(([a], [b]) => a.localeCompare(b))),
  },
};
const file = path.join(root, "design-system/manifest.code.json");
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${path.relative(root, file)}: ${components.length} components, ${Object.keys(tokens).length} tokens.`);
