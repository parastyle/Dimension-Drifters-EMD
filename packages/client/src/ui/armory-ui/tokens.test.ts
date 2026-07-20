import { describe, expect, it } from "vitest";
import { ARMORY_ART_STATUS, rarityMark } from "./tokens.js";

describe("armory visual tokens", () => {
  it("keeps redundant rarity diamonds, including six hollow Cursed marks", () => {
    expect(rarityMark("Common")).toBe("COMMON ◆");
    expect(rarityMark("Ultimate")).toBe("ULTIMATE ◆◆◆◆◆◆");
    expect(rarityMark("Cursed")).toBe("CURSED ◇◇◇◇◇◇");
  });

  it("preserves explicit manifest art-state language", () => {
    expect(ARMORY_ART_STATUS.rendering.label).toBe("ART RENDERING…");
    expect(ARMORY_ART_STATUS.unavailable.label).toBe("ART UNAVAILABLE");
    expect(ARMORY_ART_STATUS.artless.label).toBe("INTENTIONALLY ARTLESS");
  });
});
