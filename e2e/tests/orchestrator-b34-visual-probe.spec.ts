import { test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

// Orchestrator visual gate: boots each corporate floor headless and retains captures.
const FLOORS = ["corporate-grid", "corporate-grid-portrait-hall", "corporate-grid-marble-gallery"];

for (const floor of FLOORS) {
  test(`captures ${floor}`, async ({ page }) => {
    await runArenaSpec(page, async (baseURL) => {
      await page.goto(`${baseURL}/?belt=${floor}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(9000);
      await page.keyboard.press("KeyH");
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(2500);
      await page.keyboard.up("KeyD");
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `docs/owner-notes-audit-v11-evidence/b34-l1-ldtk-pipeline/orchestrator-${floor}.png`,
      });
    });
  });
}
