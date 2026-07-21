import { existsSync, readFileSync } from "node:fs";
import { meleeReach, swingDescriptorFor, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { KATANA_SLASH_ASSIGNMENTS } from "../packages/client/src/vfx/katana-slash.generated.js";
import {
  MUZZLE_FLASH_ASSIGNMENTS,
  MUZZLE_FLASH_SHEET,
  MUZZLE_FLASH_VARIANTS,
} from "../packages/client/src/vfx/muzzle-flash-catalog.js";
import {
  resolveWeaponEffectRecipe,
  WEAPON_EFFECT_RECIPES,
  weaponEffectCuePoint,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import {
  CIRCLE_IMPACT_LAYER_IDS,
  HIT_CLASS_TRIGGERS,
  RIFTCALLER_DELETED_AURA_LAYERS,
  splitWeaponVfxSuite,
  weaponVfxSuiteFor,
} from "../packages/client/src/vfx/weapon-vfx-suite.js";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing V6G weapon ${id}`);
  return definition;
}

function pngDimensions(path: string): { width: number; height: number } {
  const data = readFileSync(path);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("V6G1 whole-catalog impact-anchor law", () => {
  it("classifies every renderer layer and makes every hit-class layer target-anchored", () => {
    for (const [layerId, layer] of Object.entries(globalThis.VFXLAYERS.LAYERS)) {
      expect(layer.anchor, `${layerId}:anchor`).toBeTruthy();
      if ((HIT_CLASS_TRIGGERS as readonly string[]).includes(layer.trigger))
        expect(layer.anchor, `${layerId}:${layer.trigger}`).toBe("target");
    }
    for (const recipe of Object.values(WEAPON_EFFECT_RECIPES)) {
      if (recipe.classification === "impact") expect(recipe.impactAnchor, recipe.id).toBe("target");
      else expect(recipe.impactAnchor, recipe.id).not.toBe("target");
    }
    let resolvedCatalogLayers = 0;
    const closeCombatFamilies = new Set<string>();
    for (const definition of Object.values(WEAPONS)) {
      if (definition.archived) continue;
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const { suite } = weaponVfxSuiteFor(definition.id, definition.tags.element, swing.style);
      if (
        /fist|claw|gauntlet|knuckle|vambrace/i.test(
          `${definition.id} ${definition.name} ${definition.tags.family}`,
        )
      )
        closeCombatFamilies.add(definition.id);
      for (const [layerId, enabled] of Object.entries(suite)) {
        if (!enabled.on) continue;
        resolvedCatalogLayers += 1;
        const layer = globalThis.VFXLAYERS.LAYERS[layerId];
        expect(layer, `${definition.id}:${layerId}`).toBeDefined();
        if (layer && (HIT_CLASS_TRIGGERS as readonly string[]).includes(layer.trigger))
          expect(layer.anchor, `${definition.id}:${layerId}`).toBe("target");
      }
    }
    expect(resolvedCatalogLayers).toBeGreaterThan(300);
    expect(closeCombatFamilies).toContain("x2-wendigo-claws");
    expect(closeCombatFamilies).toContain("x2-revenant-knuckle");
  });

  it("routes Wendigo and every Revenant circle-sharing melee to the attacked target", () => {
    for (const id of ["x2-wendigo-claws", "x2-revenant-knuckle"]) {
      const definition = weapon(id);
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const { suite } = weaponVfxSuiteFor(id, definition.tags.element, swing.style);
      const split = splitWeaponVfxSuite(suite);
      expect(Object.keys(split.target), id).not.toHaveLength(0);
      for (const layerId of Object.keys(split.target))
        expect(globalThis.VFXLAYERS.LAYERS[layerId]?.anchor, `${id}:${layerId}`).toBe("target");
    }

    const circleSharers = Object.values(WEAPONS)
      .filter((definition) => !definition.archived && definition.tags.classPool === "melee")
      .filter((definition) => {
        const swing = swingDescriptorFor(definition, definition.cooldown);
        const { suite } = weaponVfxSuiteFor(definition.id, definition.tags.element, swing.style);
        return CIRCLE_IMPACT_LAYER_IDS.some((layerId) => suite[layerId]?.on);
      });
    expect(circleSharers.map(({ id }) => id)).toContain("x2-revenant-knuckle");
    for (const definition of circleSharers) {
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const split = splitWeaponVfxSuite(
        weaponVfxSuiteFor(definition.id, definition.tags.element, swing.style).suite,
      );
      for (const layerId of CIRCLE_IMPACT_LAYER_IDS)
        if (split.target[layerId]?.on)
          expect(globalThis.VFXLAYERS.LAYERS[layerId]?.anchor, `${definition.id}:${layerId}`).toBe(
            "target",
          );
    }
  });

  it("deletes Riftcaller's self aura and moves Dustreaper's 30x flame to the clamped target", () => {
    const rift = weapon("x2-riftcaller-naginata");
    const riftSwing = swingDescriptorFor(rift, rift.cooldown);
    const riftSuite = weaponVfxSuiteFor(rift.id, rift.tags.element, riftSwing.style).suite;
    for (const layerId of RIFTCALLER_DELETED_AURA_LAYERS)
      expect(riftSuite[layerId], layerId).toBeUndefined();

    const dustreaper = weapon("x2-dustreaper-zweihander");
    const recipe = resolveWeaponEffectRecipe(dustreaper);
    expect(recipe).toMatchObject({
      classification: "impact",
      impactAnchor: "target",
      impactPack: "fire-wisp",
      swingCount: 150,
    });
    if (!recipe) throw new Error("Missing Dustreaper recipe");
    const swing = swingDescriptorFor(dustreaper, dustreaper.cooldown);
    const reach = meleeReach(dustreaper);
    const point = weaponEffectCuePoint(
      recipe,
      dustreaper,
      { x: 0, y: 0 },
      { x: reach * 3, y: 0 },
      0,
      swing,
      swing.impactSeconds,
    );
    expect(point.x).toBeCloseTo(reach, 8);
    expect(point.y).toBeCloseTo(0, 8);
  });
});

describe("V6G2 katana slash program", () => {
  it("assigns unique Codex-image slash sheets to every katana/tachi-class blade", () => {
    const katanaIds = Object.values(WEAPONS)
      .filter(
        (definition) =>
          !definition.archived &&
          (!!definition.katanaHook ||
            /katana|tachi|wakizashi|nodachi|odachi/i.test(
              `${definition.id} ${definition.tags.family}`,
            )),
      )
      .map(({ id }) => id)
      .sort();
    expect(Object.keys(KATANA_SLASH_ASSIGNMENTS).sort()).toEqual(katanaIds);
    expect(new Set(Object.values(KATANA_SLASH_ASSIGNMENTS).map(({ url }) => url)).size).toBe(
      katanaIds.length,
    );
    expect(new Set(Object.values(KATANA_SLASH_ASSIGNMENTS).map(({ label }) => label)).size).toBe(
      katanaIds.length,
    );
    for (const [id, assignment] of Object.entries(KATANA_SLASH_ASSIGNMENTS)) {
      expect(existsSync(`packages/client/public/${assignment.url}`), id).toBe(true);
      expect(pngDimensions(`packages/client/public/${assignment.url}`), id).toEqual({
        width: 960,
        height: 96,
      });
      expect(assignment.language, id).toMatch(/crescent|crosscut|ripple|inkstroke|seam/);
    }
    const player = readFileSync(
      new URL("../packages/client/src/vfx/VfxPlayer.ts", import.meta.url),
      "utf8",
    );
    const renderer = readFileSync(
      new URL("../packages/client/src/vfx/vfx-render.js", import.meta.url),
      "utf8",
    );
    expect(player).toContain("slashArt: katanaSlash");
    expect(renderer).toContain("meta.slashArt || PER_WISP_ART");
    expect(renderer).toContain("art.frames - 1");
  });
});

describe("V6G3/V6G4 painted effect programs", () => {
  it("removes the audited engine-shape type specimens from live effect paths", () => {
    const arenaVfx = readFileSync(
      new URL("../packages/client/src/scenes/arena/vfx.ts", import.meta.url),
      "utf8",
    );
    const explosion = arenaVfx.slice(
      arenaVfx.indexOf("export function spawnExplosion("),
      arenaVfx.indexOf("export function spawnSplat("),
    );
    expect(explosion).not.toContain("spawnExplosionCore");
    expect(explosion).not.toMatch(/\.add\.(?:circle|ellipse|rectangle)\(/);
    const quake = arenaVfx.slice(
      arenaVfx.indexOf("export function spawnQuake("),
      arenaVfx.indexOf("interface DamageNumberEntry"),
    );
    expect(quake).not.toMatch(/\.add\.(?:circle|ellipse|rectangle)\(/);

    const effectVfx = readFileSync(
      new URL("../packages/client/src/vfx/weapon-effect-vfx.ts", import.meta.url),
      "utf8",
    );
    expect(effectVfx.slice(0, effectVfx.indexOf("spawnWeaponSwingIdentity"))).not.toContain(
      "scene.add.circle",
    );
    const renderer = readFileSync(
      new URL("../packages/client/src/vfx/vfx-render.js", import.meta.url),
      "utf8",
    );
    expect(renderer).toContain("paintBrokenRim");
    expect(renderer).toContain("drawGeneratedMuzzleFlash(");
    expect(renderer.match(/drawGeneratedMuzzleFlash\(/g)).toHaveLength(2);
  });

  it("covers the complete gun catalog with six generated flashes and no adjacent duplicate", () => {
    const guns = Object.values(WEAPONS).filter(
      (definition) => !!definition.gun && !definition.archived,
    );
    expect(MUZZLE_FLASH_VARIANTS).toHaveLength(6);
    expect(MUZZLE_FLASH_SHEET.originX).toBeLessThan(0.1);
    expect(Object.keys(MUZZLE_FLASH_ASSIGNMENTS)).toHaveLength(guns.length);
    for (let index = 0; index < guns.length; index++) {
      const assignment = MUZZLE_FLASH_ASSIGNMENTS[guns[index]?.id ?? ""];
      expect(assignment, guns[index]?.id).toBeDefined();
      if (index > 0) {
        const previous = MUZZLE_FLASH_ASSIGNMENTS[guns[index - 1]?.id ?? ""];
        expect(assignment?.frame, `${previous?.weaponId} -> ${assignment?.weaponId}`).not.toBe(
          previous?.frame,
        );
      }
    }
    expect(existsSync("packages/client/public/particles/v6g-muzzle-flashes.png")).toBe(true);
    expect(pngDimensions("packages/client/public/particles/v6g-muzzle-flashes.png")).toEqual({
      width: 1152,
      height: 192,
    });
    const arenaVfx = readFileSync(
      new URL("../packages/client/src/scenes/arena/vfx.ts", import.meta.url),
      "utf8",
    );
    const liveMuzzle = arenaVfx.slice(
      arenaVfx.indexOf("export function spawnMuzzleFlash("),
      arenaVfx.indexOf("export function spawnBulletImpact("),
    );
    expect(liveMuzzle).toContain("muzzleFlashAssignmentFor(weaponId, style)");
    expect(liveMuzzle).not.toMatch(/shakeVia|cameras\.main\.shake/);
  });
});

describe("V6G5 forward staff grip law", () => {
  it("places a second hand further up every cursor-pointed two-hand staff shaft", () => {
    const cursorStaffExceptions = new Set(["x-staff-storm-rod", "x2-gravesinger-s-hex-wand"]);
    const ids = Object.values(WEAPONS)
      .filter(
        (definition) =>
          !definition.archived &&
          definition.tags.classPool === "caster" &&
          definition.tags.grip === "2H" &&
          (/staff|stave/i.test(`${definition.id} ${definition.tags.family}`) ||
            cursorStaffExceptions.has(definition.id)),
      )
      .map(({ id }) => id);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      const definition = weapon(id);
      expect(definition.tags.grip, id).toBe("2H");
      expect(definition.gripPoints?.secondary?.role, id).toBe("shaft");
      expect(definition.gripPoints?.secondary?.x, id).toBeGreaterThan(
        (definition.gripPoints?.primary.x ?? 1) + 0.2,
      );
    }
  });
});
