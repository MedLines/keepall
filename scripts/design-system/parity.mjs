// Deterministic code ↔ Figma parity check. Reads design-system/manifest.code.json,
// design-system/manifest.figma.json and design-system/parity.config.json, prints a table, and
// exits 1 when anything is red. Code wins every disagreement; a red row names the Figma fix.
// usage: node scripts/design-system/parity.mjs [--all]   (--all also prints green rows)
import { readFileSync } from "node:fs";
import path from "node:path";
import { OKLCH_to_XYZ_D65, XYZ_D65_to_sRGB } from "@csstools/color-helpers";

const root = process.cwd();
const read = (file) => JSON.parse(readFileSync(path.join(root, "design-system", file), "utf8"));
const code = read("manifest.code.json");
const figma = read("manifest.figma.json");
const config = read("parity.config.json");
const showAll = process.argv.includes("--all");

const rows = [];
const add = (status, area, subject, detail, fix = "") => rows.push({ status, area, subject, detail, fix });
const gap = (anchor) => (/^[a-z0-9-]+$/.test(anchor) ? `GAPS.md#${anchor}` : anchor);

// --- components ---------------------------------------------------------------------------------

const codeByName = new Map(code.components.map((c) => [c.name, c]));
const figmaByName = new Map(figma.components.map((c) => [c.name, c]));
const paired = new Set();
const pairedFigma = new Set();

for (const pair of config.components) {
  const c = codeByName.get(pair.code);
  const f = figmaByName.get(pair.figma);
  if (!c || !f) { add("red", "component", pair.code, `Pairing points at a missing component (${!c ? "code" : "Figma"}).`, "Fix parity.config.json."); continue; }
  paired.add(c.name); pairedFigma.add(f.name);

  if (c.name === f.name) add("green", "component", c.name, "Name matches.");
  else add("red", "component", c.name, `Figma calls it "${f.name}".`, `Rename the Figma ${f.type === "COMPONENT_SET" ? "component set" : "component"} ${f.nodeId} to "${c.name}" (renaming keeps its key).`);

  const ignoreFigma = { ...config.ignoreFigmaPropertiesEverywhere, ...pair.ignoreFigmaProperties };
  const ignoreCode = pair.ignoreCodeProps ?? {};
  const enumProps = c.props.filter((p) => p.type === "enum" && !(p.name in ignoreCode));

  for (const fp of f.properties.filter((p) => p.type === "VARIANT")) {
    if (fp.name in ignoreFigma) { add("gap", "property", `${c.name}.${fp.name}`, `Figma-only variant (${fp.options.join(", ")}).`, gap(ignoreFigma[fp.name])); continue; }
    const cp = enumProps.find((p) => p.name.toLowerCase() === fp.name.toLowerCase());
    if (!cp) { add("red", "property", `${c.name}.${fp.name}`, `Figma variant with no code prop (${fp.options.join(", ")}).`, `Remove the "${fp.name}" property, or list it in parity.config.json with a GAPS.md reason.`); continue; }
    if (cp.name !== fp.name) add("red", "property", `${c.name}.${cp.name}`, `Figma spells it "${fp.name}".`, `Rename the Figma property "${fp.name}" to "${cp.name}".`);
    else add("green", "property", `${c.name}.${cp.name}`, "Name matches.");
    const missing = cp.values.filter((v) => !fp.options.includes(v));
    const extra = fp.options.filter((v) => !cp.values.includes(v));
    if (!missing.length && !extra.length) add("green", "values", `${c.name}.${cp.name}`, cp.values.join(", "));
    else add("red", "values", `${c.name}.${cp.name}`, `code [${cp.values.join(", ")}] vs Figma [${fp.options.join(", ")}]`,
      [extra.length && `Rename or remove Figma values ${extra.map((v) => `"${v}"`).join(", ")}`, missing.length && `add ${missing.map((v) => `"${v}"`).join(", ")}`].filter(Boolean).join("; ") + ".");
    if (cp.default === undefined) add("red", "default", `${c.name}.${cp.name}`, `Code exposes no default; Figma defaults to "${fp.default}".`, `Declare the default in the component's props first (code), then set the Figma default to match.`);
    else if (cp.default === fp.default) add("green", "default", `${c.name}.${cp.name}`, cp.default);
    else add("red", "default", `${c.name}.${cp.name}`, `code "${cp.default}" vs Figma "${fp.default}".`, `Set the Figma default of "${fp.name}" to "${cp.default}".`);
  }
  for (const cp of enumProps) {
    if (f.properties.some((p) => p.type === "VARIANT" && p.name.toLowerCase() === cp.name.toLowerCase())) continue;
    add("red", "property", `${c.name}.${cp.name}`, `Code prop [${cp.values.join(", ")}] has no Figma variant.`, `Add a "${cp.name}" variant property with values ${cp.values.join(", ")}.`);
  }

  // Description: the Figma description should open with the code purpose (the JSDoc first paragraph).
  if (c.purpose.startsWith("DRAFT:")) add("pending", "description", c.name, "Code purpose is still a DRAFT line.", "Rewrite the DRAFT line in code, then copy it to the start of the Figma description.");
  else if (f.description.startsWith(c.purpose)) add("green", "description", c.name, "Figma description opens with the code purpose.");
  else add("red", "description", c.name, `Figma description does not open with "${c.purpose}".`, `Start the Figma description of ${f.nodeId} with the code purpose.`);
  if (/&(quot|amp|lt|gt|#\d+);/.test(f.description)) add("red", "description", c.name, "Figma description contains HTML entities (e.g. &quot;).", "Replace the entities with plain characters.");
}

for (const f of figma.components) {
  if (pairedFigma.has(f.name)) continue;
  if (f.name in config.figmaWithoutCodeComponent) add("known", "component", f.name, `Figma only: ${config.figmaWithoutCodeComponent[f.name]}`);
  else add("red", "component", f.name, "Figma component with no code counterpart.", "Pair it in parity.config.json, or remove it.");
  if (/&(quot|amp|lt|gt|#\d+);/.test(f.description)) add("red", "description", f.name, "Figma description contains HTML entities (e.g. &quot;).", "Replace the entities with plain characters.");
}
for (const c of code.components) {
  if (paired.has(c.name)) continue;
  if (c.name in config.codeWithoutFigmaComponent) add("gap", "component", c.name, "Not drawn in Figma.", gap(config.codeWithoutFigmaComponent[c.name]));
  else add("red", "component", c.name, "Missing in Figma.", `Add a "${c.name}" component${c.props.some((p) => p.type === "enum") ? ` with variant properties ${c.props.filter((p) => p.type === "enum").map((p) => p.name).join(", ")}` : ""}.`);
}

// --- icons ----------------------------------------------------------------------------------------

const words = (s) => s.replace(/Icon$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
const codeIcons = new Map(code.icons.filter((i) => i.name.endsWith("Icon") && i.name !== "LogoIcon").map((i) => [words(i.name), i.name]));
const figmaIcons = new Map(figma.icons.map((i) => [i.name.replace(/^Icon\//, "").toLowerCase(), i]));
for (const [key, name] of codeIcons) {
  const fi = figmaIcons.get(key);
  if (!fi) add("red", "icon", name, "Missing in Figma.", `Add "Icon/${words(name).replace(/^\w/, (ch) => ch.toUpperCase())}" to the Icons page.`);
  else add("green", "icon", name, fi.name);
}
for (const [key, fi] of figmaIcons) {
  if (!codeIcons.has(key)) add("red", "icon", fi.name, "No code icon with this name.", `Rename to the code icon it draws (Icon/<Name> ↔ <Name>Icon), or remove it.`);
}

// --- variables ------------------------------------------------------------------------------------

const allTokens = { ...code.tokens.otherSources, ...code.tokens.values };
const figmaVars = new Map(figma.variables.flatMap((col) => col.variables.map((v) => [v.name, { ...v, collection: col.collection, modes: col.modes }])));

function splitTopLevel(text, separator = ",") {
  const parts = []; let depth = 0; let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++; else if (ch === ")") depth--;
    else if (ch === separator && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

/** Resolve a code token to a concrete string for "light" or "dark". */
function codeValue(name, mode, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const t = allTokens[name];
  if (!t) return null;
  const raw = t.value ?? t[mode];
  return raw.replace(/var\((--[\w-]+)\)/g, (_, ref) => codeValue(ref, mode, seen) ?? `var(${ref})`)
    .replace(/light-dark\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, args) => splitTopLevel(args)[mode === "light" ? 0 : 1]);
}

function parseColor(text) {
  text = text.trim();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(text);
  if (m) { const n = parseInt(m[1], 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/i.exec(text);
  if (m) {
    const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
    const rgb = XYZ_D65_to_sRGB(OKLCH_to_XYZ_D65([l, Number(m[3]), Number(m[4])])).map((v) => Math.min(1, Math.max(0, v)));
    return [...rgb, m[5] === undefined ? 1 : Number(m[5])];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[/,]\s*([\d.]+))?\s*\)$/i.exec(text);
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] === undefined ? 1 : Number(m[4])];
  if (text === "white") return [1, 1, 1, 1];
  if (text === "black") return [0, 0, 0, 1];
  return null;
}

/** Colours inside a box-shadow list, in order. */
const shadowColors = (text) => [...text.matchAll(/(oklch\([^()]*\)|#[0-9a-f]{6,8}|rgba?\([^()]*\))/gi)].map(([c]) => parseColor(c));

function toPx(text) {
  text = text.trim();
  let m = /^calc\(var\(--spacing\) \* ([\d.]+)\)$/.exec(text) ?? /^calc\(0\.25rem \* ([\d.]+)\)$/.exec(text);
  if (m) return Number(m[1]) * 4;
  m = /^(-?[\d.]+)(rem|px|ms)?$/.exec(text);
  if (m) return m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
  return null;
}

function figmaValue(v, mode) {
  const value = v.values[mode] ?? v.values.Value;
  if (value && value.alias) {
    const target = figmaVars.get(value.alias);
    return target ? figmaValue(target, target.values[mode] !== undefined ? mode : "Value") : null;
  }
  return value;
}

const close = (a, b, tolerance = 0.006) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tolerance);
const fmt = (c) => c ? `rgba(${c.slice(0, 3).map((x) => Math.round(x * 255)).join(" ")} / ${Math.round(c[3] * 1000) / 1000})` : "?";
const referenced = new Set();

for (const [name, v] of figmaVars) {
  const prefix = Object.keys(config.variables.gapNamePrefixes).find((p) => name.startsWith(p));
  const ref = /^var\((--[\w-]+)\)$/.exec(v.codeSyntax ?? "")?.[1];
  if (ref) referenced.add(ref);
  if (prefix) { add("gap", "variable", name, `${v.codeSyntax} — Figma-only tuned value.`, gap(config.variables.gapNamePrefixes[prefix])); continue; }
  if (name in config.variables.gapNames) { add("gap", "variable", name, `${v.codeSyntax}`, gap(config.variables.gapNames[name])); continue; }

  const modes = v.modes.includes("Light") ? ["Light", "Dark"] : ["Value"];
  if (!ref) {
    // Literal code syntax such as 999px or calc(var(--spacing) * 4).
    const px = toPx(v.codeSyntax.replace("var(--spacing)", "var(--spacing)"));
    if (px !== null && px === v.values.Value) add("green", "variable", name, `${v.codeSyntax} = ${px}`);
    else add("red", "variable", name, `Code syntax "${v.codeSyntax}" does not resolve to ${v.values.Value}.`, "Point the code syntax at the token that holds this value.");
    continue;
  }
  if (!(ref in allTokens)) { add("red", "variable", name, `${ref} is not a code token.`, `Rename the code syntax to an existing token, or remove the variable.`); continue; }

  const problems = [];
  for (const mode of modes) {
    const cssMode = mode === "Dark" ? "dark" : "light";
    const resolved = codeValue(ref, cssMode);
    const fv = figmaValue(v, mode);
    if (v.type === "COLOR") {
      let codeColor;
      if (ref.startsWith("--shadow-")) {
        const index = /-(\d+)$/.test(name) ? Number(/-(\d+)$/.exec(name)[1]) - 1 : 0;
        codeColor = shadowColors(resolved)[index] ?? null;
      } else codeColor = parseColor(resolved);
      if (!codeColor || !Array.isArray(fv) || !close(codeColor, fv)) problems.push(`${mode}: code ${fmt(codeColor)} vs Figma ${fmt(Array.isArray(fv) ? fv : null)}`);
    } else if (v.type === "FLOAT") {
      let px = toPx(resolved);
      if (ref === "--opacity-disabled" && px !== null) px = Math.round(px * 100);
      if (px === null || Math.abs(px - fv) > 0.01) problems.push(`${mode}: code ${resolved} vs Figma ${fv}`);
    } else if (String(resolved).trim() !== String(fv).trim()) problems.push(`${mode}: code "${resolved}" vs Figma "${fv}"`);
  }
  if (problems.length) add("red", "variable", name, problems.join("; "), `Set the Figma value to the code value (${ref}).`);
  else add("green", "variable", name, `${ref} matches in ${modes.join(" and ")}.`);
}

// Code tokens a designer would reach for, with no Figma variable.
const designToken = /^--(color-|shadow-|radius-|text-(?!.*--)|tracking-|spacing-card|opacity-|focus-|motion-(quick|glide|flourish)|delay-|ease-|neutral-|white$|paper$|card-)/;
for (const name of Object.keys(code.tokens.values)) {
  if (!designToken.test(name) || referenced.has(name)) continue;
  if (name in config.variables.codeOnlyTokens) add("gap", "token", name, "Code only.", gap(config.variables.codeOnlyTokens[name]));
  else add("red", "token", name, "Missing in Figma.", `Add a variable with code syntax var(${name}).`);
}

// --- report ---------------------------------------------------------------------------------------

const ICON = { green: "\x1b[32m✓\x1b[0m", red: "\x1b[31m✗\x1b[0m", gap: "\x1b[2m○\x1b[0m", pending: "\x1b[33m●\x1b[0m", known: "\x1b[2m·\x1b[0m" };
const order = ["component", "property", "values", "default", "description", "icon", "variable", "token"];
const shown = rows.filter((r) => showAll || r.status !== "green").sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area) || a.subject.localeCompare(b.subject));
const width = Math.min(34, Math.max(...shown.map((r) => r.subject.length), 10));
for (const area of order) {
  const group = shown.filter((r) => r.area === area);
  if (!group.length) continue;
  console.log(`\n\x1b[1m${area}\x1b[0m`);
  for (const r of group) console.log(`  ${ICON[r.status]} ${r.subject.padEnd(width)}  ${r.detail}${r.fix ? `\n    ${" ".repeat(width)}  → ${r.fix}` : ""}`);
}
const count = (s) => rows.filter((r) => r.status === s).length;
console.log(`\n${ICON.green} ${count("green")} match   ${ICON.red} ${count("red")} drift   ${ICON.pending} ${count("pending")} pending   ${ICON.gap} ${count("gap")} gap   ${ICON.known} ${count("known")} known${showAll ? "" : "   (green rows hidden; --all shows them)"}`);
process.exit(count("red") ? 1 : 0);
