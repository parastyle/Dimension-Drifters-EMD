import { WEAPONS } from "@dd/shared";
import {
  ANVIL_QUAKE_VARIANT_ASSIGNMENTS,
  LEGACY_ANVIL_QUAKE_CLUSTER_IDS,
  resolveQuakeVfxRecipe,
} from "../packages/client/src/vfx/quake-vfx-recipes.js";
import {
  resolveWeaponEffectRecipe,
  shouldSpawnLegacyQuakeVfx,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { describe, expect, it } from "vitest";

const legacyPackFor = (
  id: string,
): "grave-call" | "quake-burst" | undefined => {
  const weapon = WEAPONS[id];
  if (!weapon?.quake || !shouldSpawnLegacyQuakeVfx(weapon)) return undefined;
  const semantic = `${weapon.name} ${weapon.tags.family}`.toLowerCase();
  return /gravekeeper|tombstone|grave/.test(semantic)
    ? "grave-call"
    : "quake-burst";
};

describe("V3X Anvil-Heart quake VFX family", () => {
  it("inventories exactly every weapon that resolved to Anvil-Heart's legacy quake-burst path", () => {
    expect(legacyPackFor("x2-anvil-heart-quake-maul-staff")).toBe(
      "quake-burst",
    );
    const resolved = Object.keys(WEAPONS)
      .filter((id) => legacyPackFor(id) === "quake-burst")
      .sort();
    expect([...LEGACY_ANVIL_QUAKE_CLUSTER_IDS].sort()).toEqual(resolved);
    expect(Object.keys(ANVIL_QUAKE_VARIANT_ASSIGNMENTS).sort()).toEqual(
      resolved,
    );
  });

  it("keeps every recipe element-coherent and caps identical signatures at four weapons", () => {
    const bySignature = new Map<string, string[]>();
    for (const id of LEGACY_ANVIL_QUAKE_CLUSTER_IDS) {
      const weapon = WEAPONS[id];
      const recipe = resolveQuakeVfxRecipe(weapon);
      expect(recipe, id).toBeDefined();
      expect(recipe?.element, id).toBe(weapon?.tags.element);
      const ids = bySignature.get(recipe!.signature) ?? [];
      ids.push(id);
      bySignature.set(recipe!.signature, ids);
    }
    const largest = Math.max(
      ...[...bySignature.values()].map((ids) => ids.length),
    );
    expect(largest).toBeLessThanOrEqual(4);
  });

  it("does not steal replaced/suppressed quake identities back into the family", () => {
    for (const id of [
      "x2-tombwarden-claymore",
      "x2-hangman-s-greatcleaver",
      "x2-quarry-splitter-bardiche",
      "x2-sermon-bell",
      "x2-vagrant-s-wishing-marble",
      "x2-cairn-of-hollow-names",
    ]) {
      const weapon = WEAPONS[id];
      expect(resolveWeaponEffectRecipe(weapon)?.suppressQuakeVfx, id).toBe(
        true,
      );
      expect(resolveQuakeVfxRecipe(weapon), id).toBeUndefined();
    }
  });
});
