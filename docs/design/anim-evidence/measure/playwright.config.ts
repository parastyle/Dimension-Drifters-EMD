import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "anim-measure.probe.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 420_000,
  expect: { timeout: 30_000 },
  reporter: "line",
  outputDir: "../../../../.tmp-bin/anim-measure-playwright",
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    viewport: { width: 960, height: 540 },
    trace: "retain-on-failure",
  },
});
