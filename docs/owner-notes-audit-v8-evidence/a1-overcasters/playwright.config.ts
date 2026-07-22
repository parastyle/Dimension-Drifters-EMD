import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "before-live-probe.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 150_000,
  expect: { timeout: 30_000 },
  reporter: "line",
  outputDir: "../../../.tmp-bin/playwright-v8-a1-before",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    viewport: { width: 640, height: 360 },
  },
});
