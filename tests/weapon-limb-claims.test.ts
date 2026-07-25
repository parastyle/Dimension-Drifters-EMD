import { readFileSync } from "node:fs";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  type MeleeComboStep,
  meleeComboSelectionFor,
  WEAPON_LIMBS,
  WEAPONS,
  type WeaponDef,
  type WeaponLimb,
  type WeaponLimbClaim,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

interface ClaimOverride {
  weaponId: string;
  scope: "held" | "comboBeat";
  beat?: number;
  claims: WeaponLimbClaim[];
  reason: string;
}

const overrideLedger = JSON.parse(
  readFileSync("data/weapon-limb-claim-overrides.json", "utf8"),
) as {
  schemaVersion: number;
  overrides: ClaimOverride[];
};

const claim = (limb: WeaponLimb): WeaponLimbClaim => ({ limb, release: "handoff" });
const bothHands = (): WeaponLimbClaim[] => [claim("hand-l"), claim("hand-r")];

function weaponFor(weaponId: string): WeaponDef {
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new RangeError(`Unknown census weapon ${weaponId}`);
  return weapon;
}

function inferredHeldClaims(weapon: WeaponDef): WeaponLimbClaim[] {
  if (weapon.tags.classPool === "caster" || weapon.cast || weapon.beam || weapon.glovePair) {
    return bothHands();
  }
  return weapon.tags.grip === "1H" ? [claim("hand-r")] : bothHands();
}

function inferredBeatClaims(step: Readonly<MeleeComboStep>): WeaponLimbClaim[] {
  const side = step.choreography?.hand ?? step.hand;
  if ((step.limb ?? "hand") === "hand") {
    if (side === "both") return bothHands();
    return [claim(side === "off" ? "hand-l" : "hand-r")];
  }
  if (side === "both") return [claim("foot-l"), claim("foot-r")];
  return [claim(side === "off" ? "foot-l" : "foot-r")];
}

function overrideFor(
  weaponId: string,
  scope: ClaimOverride["scope"],
  beat?: number,
): ClaimOverride | undefined {
  return overrideLedger.overrides.find(
    (override) =>
      override.weaponId === weaponId && override.scope === scope && override.beat === beat,
  );
}

function claimKey(claims: readonly Readonly<WeaponLimbClaim>[]): string {
  return JSON.stringify(claims);
}

function expectValidClaimSet(claims: readonly Readonly<WeaponLimbClaim>[], label: string): void {
  expect(new Set(claims.map((entry) => entry.limb)).size, `${label}: duplicate limb`).toBe(
    claims.length,
  );
  for (const entry of claims) {
    expect(WEAPON_LIMBS, `${label}: ${entry.limb}`).toContain(entry.limb);
    expect(["snap", "handoff"], `${label}: ${entry.release}`).toContain(entry.release);
  }
}

function increment(distribution: Record<number, number>, free: number): void {
  distribution[free] = (distribution[free] ?? 0) + 1;
}

describe("B54 L2 generated limb-claim census", () => {
  it("resolves justified held and per-beat claims for every active weapon", () => {
    expect(overrideLedger.schemaVersion).toBe(1);
    const usedOverrides = new Set<string>();

    for (const weaponId of ACTIVE_WEAPON_CATALOG_IDS) {
      const weapon = weaponFor(weaponId);
      const claims = weapon.limbClaims;
      expect(claims, `${weaponId}: missing limbClaims`).toBeDefined();
      if (!claims) throw new RangeError(`${weaponId}: missing limbClaims`);

      const heldOverride = overrideFor(weaponId, "held");
      const expectedHeld = heldOverride?.claims ?? inferredHeldClaims(weapon);
      if (heldOverride) usedOverrides.add(`${weaponId}:held`);
      expect(claims.held, `${weaponId}: held`).toEqual(expectedHeld);
      expectValidClaimSet(claims.held, `${weaponId}:held`);

      const sequence = meleeComboSelectionFor(weapon)?.sequence ?? [];
      expect(claims.comboBeats, `${weaponId}: combo beat count`).toHaveLength(sequence.length);
      for (let beat = 0; beat < sequence.length; beat++) {
        const step = sequence[beat];
        if (!step) throw new RangeError(`${weaponId}: missing combo beat ${beat}`);
        const beatOverride = overrideFor(weaponId, "comboBeat", beat);
        const expectedBeat = beatOverride?.claims ?? inferredBeatClaims(step);
        if (beatOverride) usedOverrides.add(`${weaponId}:comboBeat:${beat}`);
        expect(claims.comboBeats[beat], `${weaponId}: beat ${beat} ${step.name}`).toEqual(
          expectedBeat,
        );
        expectValidClaimSet(
          claims.comboBeats[beat] ?? [],
          `${weaponId}:comboBeat:${beat}:${step.name}`,
        );
      }
    }

    expect(usedOverrides.size).toBe(overrideLedger.overrides.length);
    for (const override of overrideLedger.overrides) {
      expect(
        override.reason.trim().length,
        `${override.weaponId}: override reason`,
      ).toBeGreaterThan(12);
      const weapon = weaponFor(override.weaponId);
      let inferred: WeaponLimbClaim[];
      if (override.scope === "held") {
        inferred = inferredHeldClaims(weapon);
      } else {
        const step =
          override.beat === undefined
            ? undefined
            : meleeComboSelectionFor(weapon)?.sequence[override.beat];
        if (!step) {
          throw new RangeError(`${override.weaponId}: missing override beat ${override.beat}`);
        }
        inferred = inferredBeatClaims(step);
      }
      expect(
        claimKey(override.claims),
        `${override.weaponId}:${override.scope}:${override.beat ?? "-"} must differ from inference`,
      ).not.toBe(claimKey(inferred));
    }
  });

  it("keeps most channels free and forbids four-appendage ownership", () => {
    const heldFree: Record<number, number> = {};
    const comboFree: Record<number, number> = {};
    let comboActions = 0;
    let actionsWithMostChannelsFree = 0;
    const allFourAppendageClaims: string[] = [];
    const physical = new Set<WeaponLimb>(["hand-l", "hand-r", "foot-l", "foot-r"]);

    for (const weaponId of ACTIVE_WEAPON_CATALOG_IDS) {
      const weapon = weaponFor(weaponId);
      const claims = weapon.limbClaims;
      if (!claims) throw new RangeError(`${weaponId}: missing limbClaims`);
      const held = new Set(claims.held.map((entry) => entry.limb));
      const heldFreeCount = WEAPON_LIMBS.length - held.size;
      increment(heldFree, heldFreeCount);
      if (heldFreeCount >= 4) actionsWithMostChannelsFree++;

      for (let beat = 0; beat < claims.comboBeats.length; beat++) {
        comboActions++;
        const effective = new Set(held);
        for (const entry of claims.comboBeats[beat] ?? []) effective.add(entry.limb);
        const free = WEAPON_LIMBS.length - effective.size;
        increment(comboFree, free);
        if (free >= 4) actionsWithMostChannelsFree++;
        if ([...physical].every((limb) => effective.has(limb))) {
          allFourAppendageClaims.push(`${weaponId}:${beat}`);
        }
      }
    }

    const totalActions = ACTIVE_WEAPON_CATALOG_IDS.length + comboActions;
    expect(allFourAppendageClaims).toEqual([]);
    expect(actionsWithMostChannelsFree / totalActions).toBeGreaterThan(0.9);
    console.info(
      `[limb-claim census] ${JSON.stringify({
        weapons: ACTIVE_WEAPON_CATALOG_IDS.length,
        heldActions: ACTIVE_WEAPON_CATALOG_IDS.length,
        comboActions,
        totalActions,
        heldFreeChannels: heldFree,
        comboFreeChannels: comboFree,
        mostChannelsFree: actionsWithMostChannelsFree,
        allFourAppendageClaims: allFourAppendageClaims.length,
        overrides: overrideLedger.overrides.length,
      })}`,
    );
  });
});
