import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "storybook-addon-pseudo-states"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  core: { disableTelemetry: true },
  // LogoIcon loads its layers from /icons.
  staticDirs: [{ from: "../public/icons", to: "/icons" }],
};

export default config;
