import { createMetaAccountV5, GEAR_CATALOG, GEAR_IDS, STARTER_GEAR_LOADOUT } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

// MenuScene extends Phaser classes, but this file exercises only the pure dev-account projection.
vi.mock("phaser", () => {
  const target = function PhaserStub() {};
  let stub: unknown;
  stub = new Proxy(target, {
    get(inner, property) {
      if (property === "prototype") return inner.prototype;
      if (property === Symbol.toPrimitive) return () => 0;
      return stub;
    },
    apply: () => 0,
    construct: () => ({}),
  });
  return { default: stub };
});

const { devInspectionAccount } = await import("./MenuScene.js");

describe("MenuScene dev inspection links", () => {
  it("grants the complete closet and equips a requested gear id in its canonical slot", () => {
    const account = createMetaAccountV5();
    const gearId = "ash-walker-shirt";
    const slot = GEAR_CATALOG[gearId].slot;

    const inspected = devInspectionAccount(account, `gear:${gearId}`);

    expect(inspected.ownedGear).toEqual([...GEAR_IDS]);
    expect(inspected.equippedGear[slot]).toBe(gearId);
    expect(inspected.equippedGear.hat).toBe(STARTER_GEAR_LOADOUT.hat);
    expect(account.ownedGear).not.toEqual([...GEAR_IDS]);
  });

  it("owns and selects a requested pet without erasing the rest of the account", () => {
    const account = createMetaAccountV5();
    const inspected = devInspectionAccount(account, "pet:gilded-gecko");

    expect(inspected.selectedPetId).toBe("gilded-gecko");
    expect(inspected.pets["gilded-gecko"]).toEqual({ bondXp: 0 });
    expect(inspected.weaponBank).toBe(account.weaponBank);
  });
});
