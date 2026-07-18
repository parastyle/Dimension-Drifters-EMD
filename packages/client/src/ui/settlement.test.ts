import type { SingleWeaponEntryV1, WeaponExpeditionReservationV1 } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { settlementPresentation } from "./settlement.js";

function entry(n: number, weaponId = "rusty-cleaver"): SingleWeaponEntryV1 {
  const suffix = String(n).padStart(22, "a");
  return {
    kind: "single",
    entryId: `wi_${suffix}`,
    weapon: {
      instanceId: `wi_${suffix}`,
      weaponId,
      rarity: "rare",
      affix: "keen",
      provenance: "migration-earned",
      sourceWorldTier: 0,
    },
  };
}

const expedition: WeaponExpeditionReservationV1 = {
  runId: "run_result",
  commitRevision: 0,
  status: "committed",
  entries: [
    { entry: entry(1), stakeOrigin: "committed", location: "active", start: 0 },
    { entry: entry(2), stakeOrigin: "found", location: "pack", start: 0 },
  ],
};

describe("settlement ceremony copy", () => {
  it("celebrates extraction with the exact kept and found counts", () => {
    const view = settlementPresentation(
      {
        ok: true,
        outcome: "victory",
        returnedEntries: 2,
        returnedPhysical: 2,
        intakeEntries: 0,
        lostEntries: 0,
        lostPhysical: 0,
      },
      expedition,
    );
    expect(view.primary).toBe("Kept: 2 weapons · Found: 1");
    expect(view.heading).toContain("BANKED");
  });

  it("names every destroyed component on defeat instead of hiding behind a count", () => {
    const view = settlementPresentation(
      {
        ok: true,
        outcome: "defeat",
        returnedEntries: 0,
        returnedPhysical: 0,
        intakeEntries: 0,
        lostEntries: 2,
        lostPhysical: 2,
      },
      expedition,
    );
    expect(view.primary).toContain("Lost: Rare Keen Rusty Cleaver");
    expect(view.lostNames).toHaveLength(2);
    expect(view.detail).toContain("Home-Issue blade returns");
  });
});
