import { describe, expect, it } from "vitest";
import { loadoutEntryView } from "./loadout-entry-view.js";

function player(overrides: Record<string, unknown> = {}) {
  return {
    activeSlot: 0,
    affix: "",
    attackSeq: 10,
    charges: 7,
    dualWield: { offhandSlot: 255, offCharges: 0, offMaxCharges: 0 },
    maxCharges: 12,
    pairBaseSeq: 10,
    slots: [
      { weapon: "x-gun-nailgun", rarity: 2, affix: "keen", earned: true },
      { weapon: "x-gun-ricochet-pistol", rarity: 3, affix: "swift", earned: true },
      { weapon: "", rarity: 0, affix: "", earned: false },
    ],
    weapon: "x-gun-nailgun",
    weaponAffix: "keen",
    weaponRarity: 2,
    ...overrides,
  } as never;
}

describe("loadoutEntryView", () => {
  it("projects an unpaired held weapon without inventing an off hand", () => {
    expect(loadoutEntryView(player())).toEqual({
      leadId: "x-gun-nailgun",
      leadSlot: 0,
      rarity: 2,
      affix: "keen",
      earned: true,
      charges: 7,
      maxCharges: 12,
      nextHand: 0,
      pairKey: "x-gun-nailgun",
    });
  });

  it("reads off-hand identity from its linked arsenal row and resources from dualWield", () => {
    const view = loadoutEntryView(
      player({
        attackSeq: 11,
        dualWield: { offhandSlot: 1, offCharges: 3, offMaxCharges: 8 },
      }),
    );
    expect(view).toMatchObject({
      offId: "x-gun-ricochet-pistol",
      offSlot: 1,
      offRarity: 3,
      offAffix: "swift",
      offEarned: true,
      offCharges: 3,
      offMaxCharges: 8,
      nextHand: 1,
      pairKey: "x-gun-nailgun|x-gun-ricochet-pistol",
    });
  });

  it("rejects a stale or self-referential link as an unpaired entry", () => {
    const stale = loadoutEntryView(player({ dualWield: { offhandSlot: 2 } }));
    const self = loadoutEntryView(player({ dualWield: { offhandSlot: 0 } }));
    expect(stale.offId).toBeUndefined();
    expect(self.offId).toBeUndefined();
    expect(stale.pairKey).toBe("x-gun-nailgun");
  });

  it("keeps fists as one unarmed entry even when a stale off pointer arrives", () => {
    const view = loadoutEntryView(
      player({
        charges: 0,
        dualWield: { offhandSlot: 1, offCharges: 3, offMaxCharges: 8 },
        maxCharges: 0,
        slots: [
          { weapon: "fists", rarity: 0, affix: "", earned: false },
          { weapon: "x-gun-ricochet-pistol", rarity: 3, affix: "swift", earned: true },
        ],
        weapon: "fists",
        weaponAffix: "",
        weaponRarity: 0,
      }),
    );
    expect(view.leadId).toBe("fists");
    expect(view.offId).toBeUndefined();
    expect(view.pairKey).toBe("fists");
  });
});
