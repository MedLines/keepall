import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "storybook-addon-pseudo-states",
    // Serves an MCP endpoint at /mcp on the dev server so agents can list and read components.
    "@storybook/addon-mcp",
  ],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  // The components manifest feeds the MCP docs tools (docs-list, docs-show).
  features: { componentsManifest: true },
  core: { disableTelemetry: true },
  // LogoIcon loads its layers from /icons.
  staticDirs: [{ from: "../public/icons", to: "/icons" }],
};

export default config;
