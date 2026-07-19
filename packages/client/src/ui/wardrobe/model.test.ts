import {
  createMetaAccountV4,
  GEAR_SLOTS,
  type PairedWeaponEntryV1,
  type SingleWeaponEntryV1,
  STARTER_GEAR_LOADOUT,
  type WeaponInstanceV1,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  applyWardrobePreset,
  beginPrestigeReceiptFlow,
  equipWardrobeItem,
  overwriteWardrobePreset,
  PRESTIGE_CONFIRM_HOLD_MS,
  prestigeCeremonyView,
  prestigeHoldProgress,
  receivePrestigeAccount,
  receivePrestigeReceipt,
  sanitizeWardrobePresetState,
  wardrobePresetViews,
  wardrobePreview,
  wardrobeSetViews,
  wardrobeSlotItems,
} from "./model.js";

describe("wardrobe model", () => {
  it("lists owned items first, keeps locked catalog rows readable, and rejects an unowned equip", () => {
    const account = createMetaAccountV4();
    const hats = wardrobeSlotItems(account, "hat");
    expect(hats[0]).toMatchObject({ id: "blank-drifter-hat", owned: true, equipped: true });
    expect(hats.find((row) => row.id === "ash-walker-hat")).toMatchObject({
      owned: false,
      lockedCopy: "Found in Ashlands",
    });
    expect(equipWardrobeItem(account, "ash-walker-hat").equippedGear.hat).toBe("blank-drifter-hat");
  });

  it("provides immutable Starter plus five writable presets and applies only owned slot-correct ids", () => {
    const account = createMetaAccountV4();
    account.ownedGear.push("ash-walker-hat", "ash-walker-shirt");
    const state = sanitizeWardrobePresetState(
      {
        version: 1,
        selected: 9,
        presets: [
          {
            name: "  Ash road  ",
            loadout: { ...STARTER_GEAR_LOADOUT, hat: "ash-walker-hat", boots: "ash-walker-shirt" },
          },
        ],
      },
      account,
    );
    const views = wardrobePresetViews(state);
    expect(views).toHaveLength(6);
    expect(views[0]).toMatchObject({ name: "Starter / Reset", writable: false });
    expect(views[1]?.name).toBe("Ash road");
    expect(views[1]?.loadout).toMatchObject({
      hat: "ash-walker-hat",
      boots: "blank-drifter-boots",
    });
    const applied = applyWardrobePreset(account, state, 1);
    expect(applied.account.equippedGear.hat).toBe("ash-walker-hat");
    const overwritten = overwriteWardrobePreset(state, applied.account, 1);
    expect(overwritten.presets[0]?.loadout.hat).toBe("ash-walker-hat");
  });

  it("preserves legacy preset shirt choices as torsos and drops pants without inventing a head", () => {
    const account = createMetaAccountV4();
    account.ownedGear.push("ash-walker-shirt");
    const state = sanitizeWardrobePresetState(
      {
        version: 1,
        selected: 1,
        presets: [
          {
            name: "Legacy pair",
            loadout: {
              ...STARTER_GEAR_LOADOUT,
              torso: undefined,
              head: undefined,
              shirt: "ash-walker-shirt",
              pants: "ash-walker-pants",
            },
          },
        ],
      },
      account,
    );
    expect(state.presets[0]?.loadout).toMatchObject({
      torso: "ash-walker-shirt",
      head: "blank-drifter-head",
    });
    expect("pants" in (state.presets[0]?.loadout ?? {})).toBe(false);
  });

  it("previews the flat Drifter and reports all twelve legacy collections", () => {
    const account = createMetaAccountV4();
    expect(wardrobePreview(account).baseStats).toEqual({ str: 2, dex: 2, int: 2, con: 2, luk: 2 });
    const sets = wardrobeSetViews(account);
    expect(sets).toHaveLength(12);
    expect(sets.every((row) => row.total === GEAR_SLOTS.length)).toBe(true);
    expect(sets[0]?.name).toContain("Asha");
  });
});

// METAGAME WAVE 6 — append-only ceremony eligibility, consequence copy, and receipt flow.
const prestigeWeapon = (n: number, weaponId: string): WeaponInstanceV1 => ({
  instanceId: `wi_${n.toString(36).padStart(22, "0")}`,
  weaponId,
  rarity: "common",
  affix: "",
  provenance: "enemy-drop",
  sourceWorldTier: 0,
});

describe("wardrobe prestige ceremony model", () => {
  it("uses the game-clear + cap law and names the complete at-stake and survivor ledgers", () => {
    const account = createMetaAccountV4();
    account.prestige = 4;
    account.scrip = 321;
    const single: SingleWeaponEntryV1 = {
      kind: "single",
      entryId: prestigeWeapon(1, "rusty-cleaver").instanceId,
      weapon: prestigeWeapon(1, "rusty-cleaver"),
    };
    const pair: PairedWeaponEntryV1 = {
      kind: "pair",
      entryId: `wp_${"2".padStart(22, "0")}`,
      lead: prestigeWeapon(2, "rattler-sabre"),
      offhand: prestigeWeapon(3, "gravediggers-spade"),
    };
    const intake: SingleWeaponEntryV1 = {
      kind: "single",
      entryId: prestigeWeapon(4, "rusty-cleaver").instanceId,
      weapon: prestigeWeapon(4, "rusty-cleaver"),
    };
    account.weaponBank.stash.push(single, pair);
    account.weaponBank.intake.push(intake);
    account.weaponBank.lastCarry.placements.push({
      entryId: single.entryId,
      zone: "active",
      start: 0,
    });

    expect(prestigeCeremonyView(account, false)).toMatchObject({
      eligible: false,
      worldTier: 4,
      hatSlots: 5,
      nextHatSlots: 6,
    });
    const view = prestigeCeremonyView(account, true);
    expect(view).toMatchObject({
      eligible: true,
      nextWorldTier: 5,
      atStake: {
        stashEntries: 2,
        intakeEntries: 1,
        totalEntries: 3,
        physicalWeapons: 4,
        pairEntries: 1,
        distinctWeaponIds: 3,
        lastCarryReferences: 1,
      },
    });
    expect(view.costCopy).toContain("ENTIRE WEAPON BANK WIPED");
    expect(view.costCopy).toContain("SCRIP PAID · 0");
    expect(view.survivorCopy).toContain("Fists + Home-Issue Rusty Cleaver starter floor");
    expect(view.survivorCopy).toContain("gear");
    expect(view.survivorCopy).toContain("pets");
    expect(view.survivorCopy).toContain("321 Scrip");

    account.prestige = 30;
    expect(prestigeCeremonyView(account, true)).toMatchObject({
      eligible: false,
      eligibilityCopy: "WORLD TIER 30 · HAT TOWER AT CAP",
      hatSlots: 30,
      nextHatSlots: 30,
    });
  });

  it("requires the deliberate two-second hold and reveals only after receipt + canonical refresh agree", () => {
    const account = createMetaAccountV4();
    account.prestige = 2;
    account.revision = 7;
    expect(prestigeHoldProgress(1_000, 1_000 + PRESTIGE_CONFIRM_HOLD_MS - 1)).toBeLessThan(1);
    expect(prestigeHoldProgress(1_000, 1_000 + PRESTIGE_CONFIRM_HOLD_MS)).toBe(1);

    const started = beginPrestigeReceiptFlow(account, true, "  prestige-test  ");
    expect(started?.request).toEqual({ requestId: "prestige-test", expectedRevision: 7 });
    if (!started) throw new Error("eligible prestige flow required");
    const withReceipt = receivePrestigeReceipt(started, {
      ok: true,
      removedEntries: 3,
      removedPhysical: 4,
      prestige: 3,
      scripPaid: 0,
      revision: 8,
    });
    expect(withReceipt.status).toBe("awaiting-account");
    const refreshed = createMetaAccountV4();
    refreshed.prestige = 3;
    refreshed.revision = 8;
    expect(receivePrestigeAccount(withReceipt, refreshed).status).toBe("revealed");

    const accountFirst = receivePrestigeAccount(started, refreshed);
    expect(accountFirst.status).toBe("pending");
    expect(receivePrestigeReceipt(accountFirst, withReceipt.receipt).status).toBe("revealed");
  });
});
