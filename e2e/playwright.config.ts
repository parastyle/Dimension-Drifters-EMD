import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  outputDir: "../.tmp-bin/playwright",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
