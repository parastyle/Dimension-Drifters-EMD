import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: path.resolve(import.meta.dirname, "../../../../e2e/tests"),
  testMatch: "anim-combo-bridge-live-gate.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 360_000,
  expect: { timeout: 30_000 },
  reporter: "line",
  outputDir: path.resolve(import.meta.dirname, "../../../../.tmp-bin/anim-combo-bridge"),
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    viewport: { width: 640, height: 360 },
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-frame-rate-limit",
        "--disable-gpu-vsync",
      ],
    },
  },
});
