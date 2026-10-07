import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "website-preparation.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  use: {
    baseURL: "http://localhost:3114",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "pnpm exec next start --port 3114",
    url: "http://localhost:3114/about",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
