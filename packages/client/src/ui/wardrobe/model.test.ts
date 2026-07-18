import { createMetaAccountV4, GEAR_SLOTS, STARTER_GEAR_LOADOUT } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  applyWardrobePreset,
  equipWardrobeItem,
  overwriteWardrobePreset,
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

  it("previews the flat Drifter and reports all twelve legacy collections", () => {
    const account = createMetaAccountV4();
    expect(wardrobePreview(account).baseStats).toEqual({ str: 2, dex: 2, int: 2, con: 2, luk: 2 });
    const sets = wardrobeSetViews(account);
    expect(sets).toHaveLength(12);
    expect(sets.every((row) => row.total === GEAR_SLOTS.length)).toBe(true);
    expect(sets[0]?.name).toContain("Asha");
  });
});
