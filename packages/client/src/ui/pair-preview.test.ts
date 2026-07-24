import {
  dualOffhandDamageMultiplier,
  lootCooldownMult,
  PAIR_TEMPO,
  WEAPONS,
  weaponAttackCooldown,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { pairPreview } from "./pair-preview.js";

describe("pairPreview", () => {
  it("shows a deterministic eligible gun pair with zero in-run service fee", () => {
    const preview = pairPreview({
      lead: { weaponId: "x-gun-nailgun", rarity: 1, affix: "swift", earned: true },
      off: { weaponId: "x-gun-ricochet-pistol", rarity: 3, affix: "keen", earned: true },
      loadoutIds: ["x-gun-nailgun", "x-gun-ricochet-pistol", "rusty-cleaver"],
    });
    expect(preview.eligible).toBe(true);
    expect(preview.fee).toBe(0);
    expect(preview.separateMagazines).toBe(true);
    expect(preview.leadDamage).toBeGreaterThan(0);
    expect(preview.offDamage).toBeGreaterThan(0);
    expect(preview.combinedDamage).toBeCloseTo(preview.leadDamage + preview.offDamage, 8);
  });

  it("uses the lead speed affix for both incoming-hand gaps", () => {
    const preview = pairPreview({
      lead: { weaponId: "x-gun-nailgun", rarity: 0, affix: "swift", earned: false },
      off: { weaponId: "x-gun-ricochet-pistol", rarity: 0, affix: "keen", earned: false },
      loadoutIds: ["x-gun-nailgun", "x-gun-ricochet-pistol"],
    });
    const lead = WEAPONS["x-gun-nailgun"];
    const off = WEAPONS["x-gun-ricochet-pistol"];
    expect(lead).toBeDefined();
    expect(off).toBeDefined();
    if (!lead || !off) throw new Error("pair fixtures missing");
    const cadence = lootCooldownMult("swift");
    expect(preview.leadGapSeconds).toBeCloseTo(PAIR_TEMPO * weaponAttackCooldown(lead) * cadence);
    expect(preview.offGapSeconds).toBeCloseTo(PAIR_TEMPO * weaponAttackCooldown(off) * cadence);
  });

  it("exposes the shared capped off-hand multiplier and never charges for unearned halves", () => {
    const preview = pairPreview({
      lead: { weaponId: "x-gun-nailgun", rarity: 4, affix: "", earned: false },
      off: { weaponId: "x-gun-ricochet-pistol", rarity: 4, affix: "", earned: false },
      loadoutIds: ["x-gun-nailgun", "x-gun-ricochet-pistol"],
    });
    const lead = WEAPONS["x-gun-nailgun"];
    const off = WEAPONS["x-gun-ricochet-pistol"];
    expect(lead).toBeDefined();
    expect(off).toBeDefined();
    if (!lead || !off) throw new Error("pair fixtures missing");
    expect(preview.fee).toBe(0);
    expect(preview.offhandMultiplier).toBe(dualOffhandDamageMultiplier(lead, off));
  });

  it("refuses an ineligible same-id pair without presenting invented output", () => {
    const preview = pairPreview({
      lead: { weaponId: "x-gun-nailgun", rarity: 2, affix: "", earned: true },
      off: { weaponId: "x-gun-nailgun", rarity: 2, affix: "", earned: true },
      loadoutIds: ["x-gun-nailgun"],
    });
    expect(preview.eligible).toBe(false);
    expect(preview.combinedDps).toBe(0);
  });
});
