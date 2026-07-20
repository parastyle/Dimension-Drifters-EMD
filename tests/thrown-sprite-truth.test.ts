import {
  isThrownProjectileKind,
  thrownProjectileKindFor,
  thrownProjectileSpriteId,
  thrownProjectileRotationPolicy,
  thrownProjectileWeaponId,
  WEAPONS,
  weaponDisplaySpriteId,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

// G4 -- append-only catalog law: every thrown-tagged weapon launches the exact art held by its rig.
describe("thrown projectile sprite truth", () => {
  const thrownWeapons = Object.values(WEAPONS).filter(
    (weapon) => weapon.tags.delivery === "thrown",
  );

  it("resolves every thrown-tagged projectile to its held sprite with no exception table", () => {
    expect(thrownWeapons.length).toBeGreaterThan(0);
    for (const weapon of thrownWeapons) {
      const heldSpriteId = weaponDisplaySpriteId(weapon);
      const kind = thrownProjectileKindFor(weapon);
      expect(weapon.thrown, `${weapon.id}: thrown tag requires thrown stats`).toBeDefined();
      expect(isThrownProjectileKind(kind), weapon.id).toBe(true);
      expect(thrownProjectileWeaponId(kind), weapon.id).toBe(weapon.id);
      expect(thrownProjectileSpriteId(kind), weapon.id).toBe(heldSpriteId);
    }
  });

  it.each([
    "x2-bogwater-twinbits",
    "x2-saloon-tomahawk",
  ])("%s no longer falls through to Rusty Cleaver art", (weaponId) => {
    const weapon = WEAPONS[weaponId];
    if (!weapon) throw new Error(`Missing reported G4 weapon: ${weaponId}`);
    const spriteId = thrownProjectileSpriteId(thrownProjectileKindFor(weapon));
    expect(spriteId).toBe(weaponDisplaySpriteId(weapon));
    expect(spriteId).not.toBe("rusty-cleaver");
  });

  it("keeps the old generic cleaver kind readable without making it the new launch rule", () => {
    expect(thrownProjectileWeaponId("cleaver")).toBe("rusty-cleaver");
    expect(thrownProjectileSpriteId("cleaver")).toBe("rusty-cleaver");
    const rustyCleaver = WEAPONS["rusty-cleaver"];
    if (!rustyCleaver) throw new Error("Missing Rusty Cleaver compatibility fixture");
    expect(thrownProjectileKindFor(rustyCleaver)).toBe("thrown:rusty-cleaver");
  });

  it("resolves each NW thrown weapon's authored in-flight rotation policy", () => {
    expect(thrownProjectileRotationPolicy(WEAPONS["x2-boothook-harpoon"])).toBe("point-forward");
    expect(thrownProjectileRotationPolicy(WEAPONS["x2-coilshot-meteor"])).toBe("spin");
    expect(thrownProjectileRotationPolicy(WEAPONS["x2-carrion-cudgel"])).toBe("spin");
  });
});
