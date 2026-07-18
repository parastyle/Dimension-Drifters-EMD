import { describe, expect, it } from "vitest";
import { AUTO_RENDER_PIXEL_BUDGET, chooseRenderDpr, textRenderDpr } from "./render-dpr.js";
import { SETTINGS_STORAGE_KEY, type SettingsStorage, SettingsStore } from "./settings.js";

describe("pixel-budgeted render DPR", () => {
  it.each([
    ["audit 1600x900 DPR 1 baseline", 1600, 900, 1, 1],
    ["audit 1600x900 DPR 2 baseline", 1600, 900, 2, 2],
    ["1080p DPR 2", 1920, 1080, 2, Math.sqrt(AUTO_RENDER_PIXEL_BUDGET / (1920 * 1080))],
    ["1440p DPR 2", 2560, 1440, 2, Math.sqrt(AUTO_RENDER_PIXEL_BUDGET / (2560 * 1440))],
    ["audit 4K CSS DPR 2 worst case", 3840, 2160, 2, 1],
  ])("chooses the expected scale for %s", (_label, width, height, dpr, expected) => {
    expect(chooseRenderDpr(width, height, dpr, "auto")).toBeCloseTo(expected, 8);
  });

  it("keeps native and performance overrides deterministic", () => {
    expect(chooseRenderDpr(3840, 2160, 2, "native")).toBe(2);
    expect(chooseRenderDpr(1600, 900, 2, "performance")).toBe(1);
  });

  it("keeps UI texture density at its 2x minimum", () => {
    expect(textRenderDpr(1)).toBe(2);
    expect(textRenderDpr(1.7)).toBe(2);
  });
});

describe("render-scale settings", () => {
  it("persists the v1 render-scale override and sanitizes unknown values", () => {
    const values = new Map<string, string>();
    const storage: SettingsStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const first = new SettingsStore(storage);
    expect(first.load().rendering.renderScale).toBe("auto");
    first.update({ rendering: { renderScale: "native" } });
    expect(new SettingsStore(storage).load().rendering.renderScale).toBe("native");

    values.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 1, rendering: { renderScale: "future-mode" } }),
    );
    expect(new SettingsStore(storage).load().rendering.renderScale).toBe("auto");
  });
});
