import { describe, expect, it } from "vitest";
import { backpackModalLayout, weaponDockLayout } from "./weapon-dock-layout.js";

describe("AAA weapon dock geometry", () => {
  it.each([
    { width: 1_920, height: 1_080, junction: 152, idle: 116, chip: [104, 72], focus: [360, 520] },
    { width: 1_280, height: 720, junction: 128, idle: 96, chip: [88, 64], focus: [320, 456] },
  ])("matches the explicit $widthÃ—$height tier", ({ width, height, junction, idle, chip, focus }) => {
    const layout = weaponDockLayout({
      screenWidth: width,
      screenHeight: height,
      rosterCount: 326,
      bottomVisible: 2,
      rightVisible: 2,
      leftStop: 16,
      topStop: 16,
    });
    expect(layout.junctionSize).toBe(junction);
    expect(layout.junctionSize * (layout.idleScale ?? 0)).toBeCloseTo(idle, 4);
    expect([layout.bottomChipWidth, layout.bottomChipHeight]).toEqual(chip);
    expect([layout.focus.width, layout.focus.height]).toEqual(focus);
    expect(layout.bottom).toHaveLength(2);
    expect(layout.right).toHaveLength(2);
  });
});

describe("backpack modal geometry", () => {
  it.each([
    { width: 1_920, height: 1_080, panel: [1_536, 824], header: 72, dock: 120, cell: [244, 176] },
    { width: 1_280, height: 720, panel: [1_184, 624], header: 64, dock: 100, cell: [181, 136] },
  ])("uses the fixed 12-cell $width tier", ({ width, height, panel, header, dock, cell }) => {
    const layout = backpackModalLayout(width, height);
    expect([layout.panel.width, layout.panel.height]).toEqual(panel);
    expect(layout.header.height).toBe(header);
    expect(layout.dock.height).toBe(dock);
    expect(layout.cells).toHaveLength(12);
    expect([layout.cells[0]?.width, layout.cells[0]?.height]).toEqual(cell);
  });
});
