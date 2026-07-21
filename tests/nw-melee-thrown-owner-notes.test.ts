import { meleeComboSelectionFor, meleeReach, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  resolveWeaponEffectRecipe,
  shouldSpawnLegacyQuakeVfx,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing NW owner-note weapon: ${id}`);
  return definition;
}

function motions(id: string) {
  const selection = meleeComboSelectionFor(weapon(id));
  if (!selection) throw new Error(`Missing NW owner-note combo: ${id}`);
  return selection.sequence.map((step) => step.motion);
}

describe("NW-MELEE owner-note catalog contracts", () => {
  it("authors the required stance, grip, size, and bespoke presentation records", () => {
    expect(weapon("x2-godsbone-pillar").performance?.hold).toBe("drag-at-feet");
    expect(weapon("x2-cinderbrand-cleaver")).toMatchObject({
      swingStyle: "chop",
      effectEmitter: "blade",
      performance: { action: "overhead-downswing" },
    });
    expect(weapon("x2-sanctified-headsman")).toMatchObject({
      displayLength: 186.3,
      effectRecipe: "sanctified-holy-slash",
      effectEmitter: "blade",
    });
    expect(weapon("drift-nodachi-pale-horizon").twoHanded).toBe(true);
    expect(weapon("x2-voltfang-tachi").twoHanded).toBe(true);
    expect(weapon("drift-greatkatana-moonwake").bespokeVfxSheet).toBe(true);
    expect(weapon("x2-wickfire-fauchard").performance).toMatchObject({
      hold: "upright",
      action: "default-swing",
    });
    expect(weapon("x2-quicksilver-censer").performance?.hold).toBe("hanging-chain");
  });

  it("keeps the ordered combo reads while every new beat preserves base damage", () => {
    expect(motions("x2-glacier-headtaker").slice(0, 2)).toEqual(["overhead", "rising-chop"]);
    expect(motions("x2-dustdevil-glaive").slice(0, 2)).toEqual(["jab", "slash"]);
    expect(motions("x2-saintspar-lochaber").slice(0, 2)).toEqual([
      "overhead",
      "rising-chop",
    ]);
    expect(motions("x2-quicksilver-censer").slice(0, 2)).toEqual(["rising-chop", "overhead"]);
    expect(motions("x2-voltfang-tachi")[1]).toBe("rising-ward");
    expect(motions("x2-hollowmoon-reaver")).toEqual([
      "draw-cut",
      "choked-turn",
      "rising-ward",
      "petalfall",
      "sentence-fall",
    ]);
    for (const id of [
      "x2-glacier-headtaker",
      "x2-dustdevil-glaive",
      "x2-saintspar-lochaber",
      "x2-quicksilver-censer",
      "x2-voltfang-tachi",
      "x2-hollowmoon-reaver",
      "x2-mournveil-scythe",
    ]) {
      const selection = meleeComboSelectionFor(weapon(id));
      expect(selection?.sequence.every((step) => step.path.damageMultiplier === 1), id).toBe(true);
    }
  });

  it("scales Quarry's blood recipe fourfold and suppresses its replaced quake accent", () => {
    expect(resolveWeaponEffectRecipe(weapon("x2-quarry-splitter-bardiche"))).toMatchObject({
      id: "quarry-quad-spatter",
      swingPack: "blood-splat",
      swingScaleMultiplier: 4,
      emitter: "blade",
    });
    expect(resolveWeaponEffectRecipe(weapon("x2-buckhorn-boarspear"))).toMatchObject({
      id: "hangman-blood-spatter",
      impactPack: "blood-splat",
      impactAnchor: "target",
      emitter: "blade",
    });
    expect(shouldSpawnLegacyQuakeVfx(weapon("x2-quarry-splitter-bardiche"))).toBe(false);
  });

  it("keeps both no-VFX weapons clean while retaining their authored combos", () => {
    for (const id of ["x2-dustdevil-glaive", "x2-saintspar-lochaber"]) {
      const definition = weapon(id);
      expect(definition.suppressVfx, id).toBe(true);
      expect(definition.quake, id).toBeUndefined();
      expect(definition.comboVariant, id).toBeTypeOf("string");
      expect(shouldSpawnLegacyQuakeVfx(definition), id).toBe(false);
    }
  });

  it("uses the real Mournveil damage radius for its full held fan-spin VFX", () => {
    const mournveil = weapon("x2-mournveil-scythe");
    expect(mournveil).toMatchObject({
      swingStyle: "spin",
      swingArc: Math.PI * 2,
      performance: { continuous: true },
    });
    expect(WEAPON_VFX[mournveil.id]?.vfxRadius).toBe(meleeReach(mournveil));
    const selection = meleeComboSelectionFor(mournveil);
    expect(selection?.sequence.every((step) => step.path.kind === "fan")).toBe(true);
    expect(selection?.sequence.map((step) => step.path.deltaAngle)).toEqual([
      Math.PI * 2,
      -Math.PI * 2,
      Math.PI * 2,
    ]);
  });

  it("adds three green poison chain hops to Venomtongue without changing its primary edge", () => {
    const venom = weapon("x2-venomtongue-trident");
    expect(venom.tags.element).toBe("toxic");
    expect(venom.damage).toBe(9);
    expect(venom.chainLightning).toMatchObject({
      jumps: 3,
      damage: 3,
      vfx: { color: 0.32 },
    });
  });
});

describe("NW-THROWN owner-note catalog contracts", () => {
  it("authors Coilshot's draw twirl, Boothook's point flight, and Carrion's one-hop poison ricochet", () => {
    expect(weapon("x2-coilshot-meteor")).toMatchObject({
      performance: { action: "throw-release", preThrowRevolutions: 1 },
      thrown: { rotation: "spin" },
    });
    expect(weapon("x2-boothook-harpoon").thrown?.rotation).toBe("point-forward");
    expect(weapon("x2-carrion-cudgel")).toMatchObject({
      damage: 6,
      tags: { element: "toxic" },
      thrown: {
        damage: 3,
        rotation: "spin",
        ricochetHops: 1,
        ricochetRange: 260,
      },
    });
  });
});
