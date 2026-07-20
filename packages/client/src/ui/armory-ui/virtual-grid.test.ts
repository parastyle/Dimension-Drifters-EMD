import { describe, expect, it } from "vitest";
import { VirtualGridFocusController, virtualGridWindow } from "./virtual-grid.js";

describe("armory canvas virtual grid", () => {
  it("bounds the wide Closet window to three visible rows plus two overscan rows", () => {
    const window = virtualGridWindow({
      itemCount: 113,
      columns: 3,
      rowHeight: 228,
      viewportHeight: 648,
      scrollOffset: 2_400,
      overscanRows: 1,
    });
    expect(window.poolSize).toBeLessThanOrEqual(15);
    expect(window.firstIndex).toBeGreaterThan(0);
    expect(window.lastIndexExclusive).toBeLessThan(113);
  });

  it("stays within the eight-tile pool for the two-column floor window", () => {
    expect(
      virtualGridWindow({
        itemCount: 113,
        columns: 2,
        rowHeight: 192,
        viewportHeight: 384,
        scrollOffset: 0,
        overscanRows: 1,
      }).poolSize,
    ).toBe(6);
  });

  it("wraps keyboard focus and scrolls the focused row into view", () => {
    const focus = new VirtualGridFocusController(3, 113, 228, 648);
    expect(focus.move("left")).toBe(112);
    expect(focus.scrollOffset).toBeGreaterThan(0);
    expect(focus.move("right")).toBe(0);
    expect(focus.scrollOffset).toBe(0);
    focus.focus(10);
    focus.move("page-next");
    expect(focus.focusedIndex).toBe(16);
    expect(focus.scrollOffset).toBeGreaterThan(0);
  });

  it("keeps keyboard focus higher priority than hover through explicit controller state", () => {
    const focus = new VirtualGridFocusController(3, 10, 100, 300);
    focus.selectedId = "focused";
    focus.hoverId = "hovered";
    expect(focus.previewId("equipped")).toBe("focused");
    focus.hoverId = "";
    expect(focus.previewId("equipped")).toBe("focused");
  });
});
