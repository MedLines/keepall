// Read-only export of the Figma library into the shape of manifest.figma.json.
// Run it with the Figma MCP's use_figma tool (or a development plugin) on file 4EpNWgQsSifv6pmqROO03g,
// then save the returned object as design-system/manifest.figma.json. It changes nothing in the file.
// The result is about 90 KB; if a runner caps its return size, run the variables and components
// sections separately.

const COMPONENT_PAGES = ["Buttons", "Inputs", "Menus & overlays", "Navigation", "Library"];
const r4 = (n) => Math.round(n * 10000) / 10000;

async function exportVariables() {
  const collections = [];
  for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
    const modeName = Object.fromEntries(c.modes.map((m) => [m.modeId, m.name]));
    const variables = [];
    for (const id of c.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      const values = {};
      for (const [modeId, value] of Object.entries(v.valuesByMode)) {
        if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") values[modeName[modeId]] = { alias: (await figma.variables.getVariableByIdAsync(value.id)).name };
        else if (value && typeof value === "object" && "r" in value) values[modeName[modeId]] = [r4(value.r), r4(value.g), r4(value.b), r4(value.a ?? 1)];
        else values[modeName[modeId]] = value;
      }
      const entry = { name: v.name, codeSyntax: v.codeSyntax?.WEB ?? null, type: v.resolvedType, scopes: v.scopes, values };
      if (v.description) entry.description = v.description;
      variables.push(entry);
    }
    collections.push({ collection: c.name, modes: c.modes.map((m) => m.name), variables });
  }
  return collections;
}

async function exportComponents() {
  const components = [];
  let icons = [];
  for (const page of figma.root.children) {
    if (![...COMPONENT_PAGES, "Icons"].includes(page.name)) continue;
    await figma.setCurrentPageAsync(page);
    const nodes = page.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })
      .filter((n) => !(n.type === "COMPONENT" && n.parent?.type === "COMPONENT_SET"));
    if (page.name === "Icons") { icons = nodes.map((n) => ({ name: n.name, nodeId: n.id, key: n.key })); continue; }
    for (const n of nodes) {
      const properties = Object.entries(n.componentPropertyDefinitions).map(([raw, d]) => {
        const [name, id] = raw.split("#");
        const p = { name, type: d.type, default: d.defaultValue };
        if (id) p.id = id;
        if (d.variantOptions) p.options = d.variantOptions;
        return p;
      });
      const c = { name: n.name, page: page.name, type: n.type, nodeId: n.id, key: n.key, description: n.description, properties };
      if (n.type === "COMPONENT_SET") c.variantCount = n.children.length;
      components.push(c);
    }
  }
  return { components, icons };
}

const { components, icons } = await exportComponents();
return {
  $comment: "Read-only export of the Figma library via use_figma (Plugin API). Regenerate with design-system/figma-export.js. Do not edit by hand.",
  source: { fileKey: figma.fileKey, fileName: figma.root.name, exportedAt: new Date().toISOString().slice(0, 10) },
  components,
  icons,
  variables: await exportVariables(),
};
