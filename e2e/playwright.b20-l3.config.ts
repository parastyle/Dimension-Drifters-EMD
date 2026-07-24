import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: path.join(import.meta.dirname, "tests"),
  testMatch: "b20-l3-economy-live-gate.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  retries: 0,
  reporter: "line",
  outputDir: path.resolve(import.meta.dirname, "../.tmp-bin/playwright-b20-l3"),
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
