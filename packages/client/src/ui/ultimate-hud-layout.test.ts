import { describe, expect, it } from "vitest";
import { ultimateHudLayout } from "./ultimate-hud-layout.js";
import type { WeaponDockLayout } from "./weapon-dock-layout.js";

const dock: WeaponDockLayout = {
  scale: 1,
  junctionSize: 100,
  junction: { x: 1450, y: 800 },
  cornerLeft: 1400,
  cornerTop: 750,
  bottomChipWidth: 70,
  bottomChipHeight: 50,
  rightChipWidth: 50,
  rightChipHeight: 70,
  gap: 6,
  bottom: [],
  right: [],
  bottomTab: { x: 0, y: 0 },
  rightTab: { x: 0, y: 0 },
  bottomOccupiedLeft: 0,
  rightOccupiedTop: 0,
  focus: { x: 0, y: 0, scale: 1 },
};

describe("ultimateHudLayout", () => {
  it("keeps Ultimate Charge on the junction shoulder opposite the horizontal Drive bar", () => {
    const result = ultimateHudLayout({
      screenWidth: 1600,
      screenHeight: 900,
      barX: 20,
      xpY: 860,
      uiScale: 1,
      belt: false,
      dock,
      dockBodyScale: 1,
    });
    expect(result.x).toBe(1414);
    expect(result.y).toBe(765);
    expect(result.radius).toBe(10.5);
  });

  it("keeps Ultimate Charge in its distinct belt-rail slot beside Drive", () => {
    const result = ultimateHudLayout({
      screenWidth: 1600,
      screenHeight: 900,
      barX: 20,
      xpY: 860,
      uiScale: 1,
      belt: true,
    });
    expect(result.x).toBe(250);
    expect(result.y).toBe(835);
  });

  it("clamps the complete dial onto tiny screens", () => {
    const result = ultimateHudLayout({
      screenWidth: 20,
      screenHeight: 20,
      barX: 20,
      xpY: 10,
      uiScale: 1,
      belt: true,
    });
    expect(result.x).toBeGreaterThanOrEqual(result.radius + 3);
    expect(result.y).toBeGreaterThanOrEqual(result.radius + 3);
  });
});
