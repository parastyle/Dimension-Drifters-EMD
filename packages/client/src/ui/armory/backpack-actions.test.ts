import { describe, expect, it } from "vitest";
import { backpackPrimaryIntent, backpackTileIntent } from "./backpack-actions.js";

describe("backpack reversible/destructive intent separation", () => {
  it("equips and stows directly only in Inventory", () => {
    expect(backpackTileIntent("inventory", "bag")).toBe("equip");
    expect(backpackTileIntent("inventory", "slot")).toBe("stow");
  });

  it("makes SELL tiles selection-only and reserves selling for the detail action", () => {
    expect(backpackTileIntent("sell", "bag")).toBe("select");
    expect(backpackTileIntent("sell", "slot")).toBe("select");
    expect(backpackPrimaryIntent("sell", "bag")).toBe("sell");
  });
});
