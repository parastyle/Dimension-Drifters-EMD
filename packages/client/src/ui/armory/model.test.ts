import { createMetaAccountV4, type SingleWeaponEntryV1 } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  armoryCarrySelection,
  armoryEntryViews,
  armorySummary,
  createArmoryDraft,
  toggleArmoryEntry,
} from "./model.js";

function entry(
  n: number,
  rarity: SingleWeaponEntryV1["weapon"]["rarity"] = "common",
): SingleWeaponEntryV1 {
  const suffix = String(n).padStart(22, "a");
  return {
    kind: "single",
    entryId: `wi_${suffix}`,
    weapon: {
      instanceId: `wi_${suffix}`,
      weaponId: "rusty-cleaver",
      rarity,
      affix: "",
      provenance: "migration-earned",
      sourceWorldTier: n % 3,
    },
  };
}

describe("armory carry model", () => {
  it("restores exact Last Carry ids without silently substituting a missing weapon", () => {
    const account = createMetaAccountV4();
    const kept = entry(1);
    account.weaponBank.stash.push(kept);
    account.weaponBank.lastCarry = {
      placements: [
        { entryId: kept.entryId, zone: "active", start: 0 },
        { entryId: "wi_missing_missing_miss", zone: "pack", start: 0 },
      ],
      activeEntryId: kept.entryId,
    };
    const draft = createArmoryDraft(account);
    expect(draft.placements).toEqual([{ entryId: kept.entryId, zone: "active", start: 0 }]);
    expect(draft.activeEntryId).toBe(kept.entryId);
  });

  it("stages Active before Pack, makes the exact stake legible, and emits the join contract", () => {
    const account = createMetaAccountV4();
    account.revision = 7;
    account.weaponBank.stash.push(entry(1, "rare"), entry(2), entry(3), entry(4));
    let draft = createArmoryDraft(account);
    for (const row of account.weaponBank.stash)
      draft = toggleArmoryEntry(account, draft, row.entryId).draft;
    expect(draft.placements.map((row) => row.zone)).toEqual(["active", "active", "active", "pack"]);
    const summary = armorySummary(account, draft);
    expect(summary).toMatchObject({
      atRiskPhysical: 4,
      atRiskEntries: 4,
      safeEntries: 0,
      activePhysical: 3,
      packPhysical: 1,
      requiredWorldTier: 2,
    });
    expect(summary.atRiskValue).toBeGreaterThan(0);
    expect(armoryEntryViews(account, draft)[0]?.placement?.zone).toBe("active");
    expect(armoryCarrySelection(account, draft, "menu_request")).toMatchObject({
      requestId: "menu_request",
      expectedRevision: 7,
      requestedWorldTier: 2,
      activeEntryId: account.weaponBank.stash[0]?.entryId,
    });
  });

  it("keeps the starter floor outside the at-risk count when the Stash is empty", () => {
    const account = createMetaAccountV4();
    const summary = armorySummary(account, createArmoryDraft(account));
    expect(summary.atRiskPhysical).toBe(0);
    expect(summary.safeEntries).toBe(0);
  });
});
