import { swingDescriptorFor, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  resolveWeaponEffectRecipe,
  shouldSpawnLegacyQuakeVfx,
  WEAPON_EFFECT_RECIPES,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import { weaponVfxSuiteFor } from "../packages/client/src/vfx/weapon-vfx-suite.js";

const REMOVED_VFX_IDS = ["rusty-cleaver", "tombstone-greatsword", "x-sword-anchor"] as const;

function weapon(id: (typeof REMOVED_VFX_IDS)[number]) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B15 weapon fixture: ${id}`);
  return definition;
}

describe("B15 and adjacent B10 weapon VFX removals", () => {
  it("keeps all three weapons out of the generated bespoke VFX census", () => {
    for (const id of REMOVED_VFX_IDS) expect(WEAPON_VFX[id], id).toBeUndefined();
  });

  it("suppresses every Rusty Cleaver suite while preserving its throw and cosmetic arc", () => {
    const rusty = weapon("rusty-cleaver");
    const swing = swingDescriptorFor(rusty, rusty.cooldown);
    expect(rusty).toMatchObject({
      damage: 4,
      cooldown: 0.26,
      range: 118,
      displayLength: 76,
      suppressVfx: true,
      thrown: {
        speed: 660,
        range: 520,
        damage: 7,
        charges: 3,
        refillSeconds: 1.5,
        pierce: 2,
        arcHeight: 124,
      },
    });
    expect(resolveWeaponEffectRecipe(rusty)).toBeUndefined();
    expect(weaponVfxSuiteFor(rusty.id, rusty.tags.element, swing.style)).toMatchObject({
      authored: true,
      suite: {},
    });
  });

  it("suppresses Tombstone's swing and quake treatments without changing quake authority", () => {
    const tombstone = weapon("tombstone-greatsword");
    const swing = swingDescriptorFor(tombstone, tombstone.cooldown);
    expect(tombstone).toMatchObject({
      damage: 11,
      cooldown: 0.78,
      range: 156,
      displayLength: 124,
      suppressVfx: true,
      quake: { radius: 270, damage: 8 },
    });
    expect(tombstone.quake?.vfx).toBeUndefined();
    expect(resolveWeaponEffectRecipe(tombstone)).toBeUndefined();
    expect(shouldSpawnLegacyQuakeVfx(tombstone)).toBe(false);
    expect(weaponVfxSuiteFor(tombstone.id, tombstone.tags.element, swing.style)).toMatchObject({
      authored: true,
      suite: {},
    });
  });

  it("removes Drowned Anchor's explicit deluge while preserving its blade contract", () => {
    const drowned = weapon("x-sword-anchor");
    expect(drowned).toMatchObject({
      damage: 14,
      cooldown: 0.95,
      range: 172,
      displayLength: 247.5,
      swingArc: 3.1,
    });
    expect(drowned.effectRecipe).toBeUndefined();
    expect(drowned.effectEmitter).toBeUndefined();
    expect(drowned.effectTiming).toBeUndefined();
    expect(resolveWeaponEffectRecipe(drowned)).toBeUndefined();
    expect(
      (WEAPON_EFFECT_RECIPES as Partial<Record<string, unknown>>)["drowned-anchor-deluge"],
    ).toBeUndefined();
  });
});
