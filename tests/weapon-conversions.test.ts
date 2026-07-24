import {
  bladeAngleAt,
  pairEligible,
  swingDescriptorFor,
  thrownProjectileKindFor,
  thrownProjectileSpriteId,
  WEAPONS,
  weaponDeliveryFor,
  weaponDisplaySpriteId,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { weaponArtGeometryFor } from "../packages/client/src/sprites/art-geometry.generated.js";
import { tomeOpenArtFor } from "../packages/client/src/sprites/tome-open-art.js";

// W-CONVERT — append-only catalog/runtime contract for the eight owner-approved conversions.
describe("W-CONVERT weapon contracts", () => {
  it("makes Verdigris a page-flutter melee weapon while retaining parity-scaled open art", () => {
    const weapon = WEAPONS["x2-verdigris-grand-grimoire"];
    if (!weapon) throw new Error("Verdigris fixture is required");
    const geometry = weaponArtGeometryFor(weapon.id);

    expect(weapon.tags).toMatchObject({ classPool: "melee", delivery: "melee-arc" });
    expect(weaponDeliveryFor(weapon)).toBe("melee");
    expect(weapon.chainLightning).toBeUndefined();
    expect(weapon.performance).toMatchObject({
      action: "page-flip",
      continuous: true,
      suppressSwing: true,
    });
    expect(tomeOpenArtFor(weapon.id)).toBeDefined();
    expect(geometry?.open?.displayLengthMul).toBeGreaterThan(0);
    expect(geometry?.closed.displayLengthMul).toBeGreaterThan(0);
  });

  it.each([
    "x2-coyote-trickster-s-sparkmitt",
    "x2-sparkknuckle-hex-mitt",
  ] as const)("makes %s an unbindable held-combo glove pair without a player aura", (weaponId) => {
    const weapon = WEAPONS[weaponId];
    const other = WEAPONS["x2-cinderpalm-brand-glove"];
    if (!weapon || !other) throw new Error(`Missing glove fixture: ${weaponId}`);

    expect(weapon.tags).toMatchObject({ grip: "2H", delivery: "glove-pair", fireMode: "hold" });
    expect(weapon.glovePair).toEqual({});
    expect(weapon.swingStyle).toBe("punch");
    expect(weapon.performance?.continuous).toBe(true);
    expect(weapon.gun).toBeUndefined();
    expect(weapon.chainLightning).toBeUndefined();
    expect(pairEligible(weapon, other)).toBe(false);
  });

  it("rotates Permafrost Bardiche's authoritative arc through two full revolutions", () => {
    const weapon = WEAPONS["x2-permafrost-bardiche"];
    if (!weapon) throw new Error("Permafrost Bardiche fixture is required");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const start = bladeAngleAt(0, weapon.swingArc, 0);
    const quarter = bladeAngleAt(0, weapon.swingArc, 0.25);
    const finish = bladeAngleAt(0, weapon.swingArc, 1);

    expect(weapon.swingStyle).toBe("spin");
    expect(weapon.performance?.continuous).toBe(true);
    expect(weapon.swingArc).toBeCloseTo(Math.PI * 4, 10);
    expect(quarter - start).toBeCloseTo(Math.PI, 10);
    expect(finish - start).toBeCloseTo(Math.PI * 4, 10);
    expect(swing).toMatchObject({ style: "spin", activeStartSeconds: 0 });
    expect(swing.activeEndSeconds).toBe(swing.poseSeconds);
  });

  it("reclasses Tesla Faradayer as a ranged electric gun with a spark projectile", () => {
    const weapon = WEAPONS["x2-tesla-faradayer"];
    if (!weapon?.gun) throw new Error("Tesla Faradayer gun fixture is required");

    expect(weapon.tags).toMatchObject({ classPool: "ranged", delivery: "projectile" });
    expect(weaponDeliveryFor(weapon)).toBe("gun");
    expect(weapon.gun).toMatchObject({
      damage: weapon.damage,
      fireRate: weapon.cooldown,
      bulletKind: "spark",
      muzzle: "spark",
    });
    expect(weapon.chainLightning).toBeUndefined();
  });

  it.each(["x2-gallows-splitter", "x2-boothill-hatchet"] as const)(
    "%s throws its own sprite on a positive ballistic arc",
    (weaponId) => {
      const weapon = WEAPONS[weaponId];
      if (!weapon?.thrown) throw new Error(`Missing thrown conversion: ${weaponId}`);
      const kind = thrownProjectileKindFor(weapon);

      expect(weapon.tags.delivery).toBe("thrown");
      expect(weapon.thrown.arcHeight).toBeGreaterThan(0);
      expect(thrownProjectileSpriteId(kind)).toBe(weaponDisplaySpriteId(weapon));
    },
  );

  it("marks Cogwright's Tesla-Rod as a warp-only attack with the reviewed arrival-burst default", () => {
    const weapon = WEAPONS["x2-cogwright-s-tesla-rod"];
    if (!weapon) throw new Error("Cogwright Tesla-Rod fixture is required");

    expect(weapon.tags.delivery).toBe("warp");
    expect(weapon.warp).toEqual({ burstRadius: 48 });
    expect(weapon.damage).toBe(4);
    expect(weapon.chainLightning).toBeUndefined();
    expect(weapon.gun).toBeUndefined();
    expect(weapon.cast).toBeUndefined();
  });
});
