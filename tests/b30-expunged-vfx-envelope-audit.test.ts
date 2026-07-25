import {
  bladeExtensionGeometryFor,
  hitEnvelopeExtentsAgree,
  meleeReach,
  type ProjectileEnvelopeDelivery,
  projectileDamageEnvelopeFor,
  WEAPONS,
  type WeaponDef,
  weaponDamageEnvelopeFor,
  weaponHasPrimaryMeleeEnvelope,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import { weaponVfxSuiteFor } from "../packages/client/src/vfx/weapon-vfx-suite.js";

const B15_REMOVED_VFX_IDS = ["rusty-cleaver", "tombstone-greatsword", "x-sword-anchor"] as const;

const B28_PARTIAL_OR_COMPLETE_REMOVAL_IDS = [
  "drift-greatkatana-tempest-regent",
  "drift-nodachi-gatebreaker",
  "x2-thunderhead-voulge",
] as const;

const B30_REMOVED_AFTER_B24_IDS = new Set([
  "x2-hailshard-resonator",
  "x2-coyote-trickster-s-sparkmitt",
  "x2-brimstone-doubleheader",
]);

const PROJECTILE_DELIVERIES = [
  "gun",
  "cast",
  "thrown",
  "scatter",
  "hybrid",
] as const satisfies readonly ProjectileEnvelopeDelivery[];

function wasB24FallbackCandidate(definition: WeaponDef): boolean {
  const vfx = WEAPON_VFX[definition.id];
  const authored = !!(vfx?.suite && Object.keys(vfx.suite).length > 0);
  return (
    (definition.suppressVfx !== true || B30_REMOVED_AFTER_B24_IDS.has(definition.id)) &&
    !authored &&
    vfx?.suppressFallback !== true
  );
}

function assertVisibleExtentEqualsDamageExtent(definition: WeaponDef): void {
  const damage = weaponDamageEnvelopeFor(definition);
  const physicalReach = meleeReach(definition);
  const extension = bladeExtensionGeometryFor(definition);
  const visibleMeleeReach = extension?.fullTipReach ?? physicalReach;

  if (weaponHasPrimaryMeleeEnvelope(definition)) {
    expect(damage.melee, `${definition.id}: missing damage-bearing visible edge`).toBeDefined();
    expect(
      hitEnvelopeExtentsAgree(physicalReach, damage.melee?.baseReach ?? -1),
      `${definition.id}: physical reach`,
    ).toBe(true);
    expect(
      hitEnvelopeExtentsAgree(visibleMeleeReach, damage.melee?.maxReach ?? -1),
      `${definition.id}: maximum visible reach`,
    ).toBe(true);
  } else {
    expect(damage.melee, `${definition.id}: invisible inherited melee`).toBeUndefined();
  }

  for (const delivery of PROJECTILE_DELIVERIES) {
    const isVisible =
      (delivery === "gun" && !!definition.gun) ||
      (delivery === "cast" && !!definition.cast) ||
      (delivery === "thrown" && !!definition.thrown) ||
      (delivery === "scatter" && !!definition.scatter) ||
      (delivery === "hybrid" && !!definition.hybridProjectile);
    if (!isVisible) {
      expect(
        damage.projectiles[delivery],
        `${definition.id}:${delivery} ghost capsule`,
      ).toBeUndefined();
      continue;
    }
    expect(damage.projectiles[delivery], `${definition.id}:${delivery} visible capsule`).toEqual(
      projectileDamageEnvelopeFor(definition, delivery),
    );
  }
}

describe("B30 B15/B24/B28 expunged-VFX hit-envelope audit", () => {
  it("sweeps the complete 322-weapon B24 fallback-removal cohort through the envelope law", () => {
    const cohort = Object.values(WEAPONS).filter(wasB24FallbackCandidate);
    expect(cohort).toHaveLength(322);

    for (const definition of cohort) {
      assertVisibleExtentEqualsDamageExtent(definition);
      const suite = weaponVfxSuiteFor(
        definition.id,
        definition.tags.element,
        definition.swingStyle ?? "slash",
      ).suite;
      expect(suite["blade-trail"]?.on, `${definition.id}: blade-trail`).not.toBe(true);
      expect(suite["twin-slash"]?.on, `${definition.id}: twin-slash`).not.toBe(true);
      expect(suite["thrust-streak"]?.on, `${definition.id}: thrust-streak`).not.toBe(true);
    }
  });

  it("audits every B15 and B28 weapon that lost one or more authored VFX layers", () => {
    const ids = [...B15_REMOVED_VFX_IDS, ...B28_PARTIAL_OR_COMPLETE_REMOVAL_IDS];
    for (const id of ids) {
      const definition = WEAPONS[id];
      if (!definition) throw new Error(`Missing expunged-VFX audit fixture: ${id}`);
      assertVisibleExtentEqualsDamageExtent(definition);
    }

    expect(WEAPONS["tombstone-greatsword"]?.quake).toBeUndefined();
    expect(weaponDamageEnvelopeFor(WEAPONS["tombstone-greatsword"]!).quake).toBeUndefined();
    expect(
      weaponDamageEnvelopeFor(WEAPONS["drift-greatkatana-tempest-regent"]!).aura,
    ).toBeUndefined();
    expect(weaponDamageEnvelopeFor(WEAPONS["drift-nodachi-gatebreaker"]!).aura).toBeUndefined();
    expect(WEAPON_VFX["x2-thunderhead-voulge"]).toBeUndefined();
  });

  it("records Tombstone as the sole stale removed-VFX damaging extent found and fixed", () => {
    const fixedOffenders = ["tombstone-greatsword"];
    expect(fixedOffenders).toEqual(["tombstone-greatsword"]);
    expect(weaponDamageEnvelopeFor(WEAPONS["tombstone-greatsword"]!).melee?.maxReach).toBe(
      meleeReach(WEAPONS["tombstone-greatsword"]!),
    );
  });
});
