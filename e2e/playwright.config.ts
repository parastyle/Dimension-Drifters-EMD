import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const E2E_ROOT = import.meta.dirname;

export default defineConfig({
  testDir: path.join(E2E_ROOT, "tests"),
  globalSetup: path.join(E2E_ROOT, "helpers/global-stack.ts"),
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  outputDir: path.resolve(E2E_ROOT, "../.tmp-bin/playwright"),
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
