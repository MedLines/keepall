import { defineConfig, devices } from "@playwright/test";

const port = process.env.WEBSITE_TEST_PORT ?? "3114";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "website-preparation.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  use: {
    baseURL,
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: `pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/about`,
    reuseExistingServer: process.env.WEBSITE_TEST_REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
