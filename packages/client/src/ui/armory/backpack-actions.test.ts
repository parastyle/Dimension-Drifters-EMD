import { describe, expect, it } from "vitest";
import { backpackPrimaryIntent, backpackTileIntent } from "./backpack-actions.js";

describe("backpack reversible/destructive intent separation", () => {
  it("equips and stows directly only in Inventory", () => {
    expect(backpackTileIntent("inventory", "bag")).toBe("equip");
    expect(backpackTileIntent("inventory", "slot")).toBe("stow");
  });

  it("uses the bag detail action for damage-budget disassembly", () => {
    expect(backpackPrimaryIntent("inventory", "bag")).toBe("disassemble");
    expect(backpackPrimaryIntent("inventory", "slot")).toBe("stow");
  });
});
