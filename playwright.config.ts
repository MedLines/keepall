import { defineConfig, devices } from "@playwright/test";

const port = process.env.KEEPALL_E2E_PORT ?? "3100";
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/pwa-update.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: ["**/library-corners.spec.ts", "**/video-polish.spec.ts", "**/video-hover-preview.spec.ts"],
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
