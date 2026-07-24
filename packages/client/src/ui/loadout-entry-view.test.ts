import { describe, expect, it } from "vitest";
import { loadoutEntryView } from "./loadout-entry-view.js";

function player(overrides: Record<string, unknown> = {}) {
  return {
    activeSlot: 0,
    charges: 7,
    maxCharges: 12,
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
  it("projects exactly the active weapon", () => {
    expect(loadoutEntryView(player())).toEqual({
      leadId: "x-gun-nailgun",
      leadSlot: 0,
      rarity: 2,
      affix: "keen",
      earned: true,
      charges: 7,
      maxCharges: 12,
    });
  });

  it("keeps a second same-class one-hander independent from the active slot", () => {
    const view = loadoutEntryView(player());
    expect(view.leadId).toBe("x-gun-nailgun");
    expect(JSON.stringify(view)).not.toContain("x-gun-ricochet-pistol");
    expect("offId" in view).toBe(false);
  });

  it("keeps fists as one unarmed entry", () => {
    const view = loadoutEntryView(
      player({
        charges: 0,
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
    expect("offId" in view).toBe(false);
  });
});
