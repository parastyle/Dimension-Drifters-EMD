import { describe, expect, it } from "vitest";
import { objectiveHudCopy, objectiveHudLayout, objectiveTimer } from "./objective-hud-layout.js";

describe("objective HUD copy", () => {
  it("keeps arena truth while excluding controls and build trivia", () => {
    const copy = objectiveHudCopy({
      mode: "arena",
      dimensionName: "Verdant Ruins",
      depth: 3,
      bossActive: false,
      portalOpen: false,
      bossEtaSeconds: 83.9,
      runMoney: 12,
      bankedMoney: 40,
    });

    expect(copy.location).toBe("Verdant Ruins · Depth 3");
    expect(copy.objective).toBe("Survive · Boss in 1:23");
    expect(copy.economy).toBe("◈ 12 run money · 40 banked");
    expect(`${copy.location} ${copy.objective} ${copy.economy}`).not.toMatch(
      /RMB|LMB|STR|DEX|KIT|character/i,
    );
  });

  it("gives portal, boss-rush, belt, and connection states intentional copy", () => {
    const portal = objectiveHudCopy({
      mode: "arena",
      dimensionName: "Ashlands",
      depth: 2,
      bossActive: false,
      portalOpen: true,
      bossEtaSeconds: 0,
      runMoney: 5,
      bankedMoney: 9,
      lagging: true,
    });
    expect(portal.objective).toBe("Choose a gate · Bank & end or push deeper");
    expect(portal.notice).toBe("⚠ Connection lag");

    const rush = objectiveHudCopy({
      mode: "bossrush",
      dimensionName: "Frostfell",
      depth: 11,
      bossActive: true,
      portalOpen: false,
      bossEtaSeconds: 0,
      runMoney: 0,
      bankedMoney: 0,
    });
    expect(rush.location).toBe("Frostfell · Depth 11");
    expect(rush.objective).toBe("Boss 10/10 · Cut it down");

    const belt = objectiveHudCopy({
      mode: "belt",
      dimensionName: "Wild West",
      depth: 1,
      bossActive: false,
      portalOpen: false,
      bossEtaSeconds: 0,
      runMoney: 0,
      bankedMoney: 0,
      beltRoomName: "The Catwalk",
      beltLocked: true,
    });
    expect(belt.location).toBe("The Catwalk");
    expect(belt.objective).toBe("Clear this room");
    expect(belt.economy).toBe("◈ 0 run money · 0 banked");
  });

  it("formats negative and hour-scale countdowns without prose", () => {
    expect(objectiveTimer(-4)).toBe("0:00");
    expect(objectiveTimer(3_661)).toBe("61:01");
  });
});

describe("objective HUD layout", () => {
  it("keeps every cluster inside a laptop viewport without overlap", () => {
    const layout = objectiveHudLayout({
      screenWidth: 1024,
      uiScale: 1,
      showEconomy: true,
      showNotice: true,
    });

    expect(layout.objective.x).toBeGreaterThanOrEqual(0);
    expect(layout.objective.x + layout.objective.width).toBeLessThanOrEqual(1024);
    expect(layout.location.x + layout.location.width).toBeLessThanOrEqual(layout.economy?.x ?? 0);
    expect((layout.economy?.x ?? 0) + (layout.economy?.width ?? 0)).toBeLessThanOrEqual(
      layout.notice?.x ?? 0,
    );
    expect((layout.notice?.x ?? 0) + (layout.notice?.width ?? 0)).toBeLessThanOrEqual(1024);
    expect(layout.progressWidth).toBeLessThanOrEqual(1024 - 24);
  });

  it("constrains the objective and chips on a narrow supported viewport", () => {
    const layout = objectiveHudLayout({
      screenWidth: 640,
      uiScale: 1,
      showEconomy: true,
      showNotice: false,
    });

    expect(layout.objective.width).toBe(336);
    expect(layout.objective.x).toBe(152);
    expect(layout.location.x).toBeGreaterThanOrEqual(12);
    expect((layout.economy?.x ?? 0) + (layout.economy?.width ?? 0)).toBeLessThanOrEqual(628);
  });
});
