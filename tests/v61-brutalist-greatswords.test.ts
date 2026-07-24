import { existsSync, readFileSync } from "node:fs";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  bladeExtensionGeometryFor,
  DROP_POOL,
  meleeComboSelectionFor,
  WEAPON_CATALOG_IDS,
  WEAPON_RESOURCE_IDS,
  WEAPON_RESOURCE_PROFILES,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { movementPostureFor } from "../packages/client/src/sprites/pose-language.js";
import {
  BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS,
  BRUTALIST_GREATSWORD_IDS,
  brutalistGreatswordExtensionFor,
  weaponSupportsBladeExtension,
} from "../packages/client/src/vfx/blade-extension-treatments.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

const LINE = [
  ["x2-rimewrit-grave-slab", "Rimewrit Grave-Slab", "frost", 14, 0.92, 15.22],
  ["x2-pyre-gallows-brand", "Pyre-Gallows Brand", "fire", 13, 0.8, 16.25],
  ["x2-stormrail-colossus", "Stormrail Colossus", "shock", 11.5, 0.7, 16.43],
  ["x2-nullwake-ordinance", "Nullwake Ordinance", "void", 15, 0.94, 15.96],
  ["x2-dawnwall-testament", "Dawnwall Testament", "holy", 12.5, 0.78, 16.03],
  ["x2-cairnfall-monolith", "Cairnfall Monolith", "physical", 16, 1.02, 15.69],
] as const;

const PRIMARY_GREATSWORD_DPS_MEDIAN = 16.67;

describe("V6.1 brutalist greatsword line", () => {
  it("ships six active two-hand slabs in the authored DPS band and existing status vocabulary", () => {
    expect(BRUTALIST_GREATSWORD_IDS).toEqual(LINE.map(([id]) => id));
    expect(WEAPON_CATALOG_IDS).toHaveLength(357);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(344);
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(13);
    expect(WEAPON_RESOURCE_IDS).toHaveLength(357);

    for (const [id, name, element, damage, cooldown, expectedDps] of LINE) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      if (!weapon) continue;
      expect(weapon).toMatchObject({
        id,
        name,
        damage,
        cooldown,
        expansion: true,
        twoHanded: true,
        sizeClass: "great",
        stance: "two-hands-on-hilt",
        swingStyle: "chop",
        tags: {
          classPool: "melee",
          delivery: "melee-arc",
          element,
          family: "greatsword",
          grip: "2H",
          size: "XL",
        },
      });
      const dps = Math.round((weapon.damage / weapon.cooldown) * 100) / 100;
      expect(dps, id).toBe(expectedDps);
      expect(dps, id).toBeGreaterThanOrEqual(PRIMARY_GREATSWORD_DPS_MEDIAN * 0.9);
      expect(dps, id).toBeLessThanOrEqual(PRIMARY_GREATSWORD_DPS_MEDIAN * 1.01);
      expect(meleeComboSelectionFor(weapon), id).toMatchObject({
        family: "chop",
        variant: "greatsword-momentum",
      });
      expect(movementPostureFor(weapon).key, id).toBe("weighted");
      expect(DROP_POOL, id).toContain(id);
      expect(WEAPON_RESOURCE_PROFILES[id], id).toBeDefined();
      expect(weapon.gun, `${id}/muzzle`).toBeUndefined();
      expect(weapon.quake, `${id}/shake`).toBeUndefined();
    }

    expect(WEAPONS["x2-rimewrit-grave-slab"]?.hitStatus).toEqual(
      WEAPONS["x2-glacier-headtaker"]?.hitStatus,
    );
    for (const [id] of LINE.slice(1)) expect(WEAPONS[id]?.hitStatus, id).toBeUndefined();
  });

  it("uses six distinct generated sheets through the one overlapping 3x blade-tip geometry", () => {
    expect(BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS).toHaveLength(6);
    expect(
      new Set(BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS.map((entry) => entry.textureKey)),
    ).toHaveLength(6);
    expect(
      new Set(BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS.map((entry) => entry.url)),
    ).toHaveLength(6);

    for (const [id] of LINE) {
      const weapon = WEAPONS[id]!;
      const treatment = brutalistGreatswordExtensionFor(id);
      expect(treatment, id).toBeDefined();
      expect(weaponSupportsBladeExtension(id), id).toBe(true);
      expect(existsSync(`packages/client/public/${treatment?.url}`), id).toBe(true);

      const geometry = bladeExtensionGeometryFor(weapon);
      expect(geometry, `${id}/geometry`).toBeDefined();
      if (!geometry) continue;
      expect(geometry.totalBladeLength / geometry.physicalBladeLength, id).toBeCloseTo(3, 8);
      expect(geometry.overlapLength / geometry.physicalBladeLength, id).toBeCloseTo(0.3, 8);
      expect(geometry.extensionLength, id).toBeGreaterThan(
        geometry.totalBladeLength - geometry.physicalBladeLength,
      );
    }

    const daylight = readFileSync(
      "packages/client/public/vfx/brutalist-greatswords/radiant-daylight-blade.png",
    );
    const procession = readFileSync(
      "packages/client/public/vfx/headsman-prototypes/pale-procession.png",
    );
    expect(daylight.equals(procession)).toBe(false);

    // V7.1 unification: the extension has NO pose solver of its own. It draws in the blade's
    // sampled basis, takes its width from the blade's MEASURED width (never an authored
    // thickness), and sits one layer under the physical blade so the join stays hidden.
    // These pin the architecture, not a particular line of code — the behavioural coverage
    // lives in VfxPlayer.blade-extension.test.ts / SpriteRig.blade-extension.test.ts.
    const runtime = readFileSync("packages/client/src/vfx/VfxPlayer.ts", "utf8");
    expect(runtime).toContain("bladeExtensionGeometryFor(weapon)");
    expect(runtime, "extension must not resolve its own pose").not.toContain(
      "bladeExtensionPoseAt",
    );
    expect(runtime, "width must be measured, not authored").not.toContain("thicknessScale");
    expect(runtime).toMatch(/\.setDepth\(pose\.depth - 1\)[\s\S]{0,80}?draw\.bladeWidth/);
  });

  it("registers one-part sprites, Weaponsmith suites, and Testing Grounds deep links", () => {
    const portal = readFileSync("tools/portal/index.html", "utf8");
    const assignments = JSON.parse(
      readFileSync("tools/weaponsmith/assignments.json", "utf8"),
    ) as Record<string, { suite?: Record<string, { on?: boolean }> }>;
    expect(portal).toContain('"count":344');

    for (const [id] of LINE) {
      const sprite = SPRITES[id as keyof typeof SPRITES];
      expect(sprite, id).toBeDefined();
      expect(sprite?.kind, id).toBe("weapon");
      expect(sprite?.parts, id).toHaveLength(1);
      expect(existsSync(`packages/client/public/sprites/${id}/part-1.png`), id).toBe(true);

      expect(assignments[id]?.suite, id).toMatchObject({
        "blade-trail": { on: true },
        "painted-impact": { on: true },
        "impact-flash": { on: true },
      });
      expect(WEAPON_VFX[id], id).toBeDefined();
      expect(WEAPON_VFX[id]?.spawnAtCursor, `${id}/anchor`).toBeUndefined();
      expect(portal, id).toContain(`"path":"/?dev=weapon:${id}"`);
      expect(portal, id).toContain(
        `"thumb":"../../packages/client/public/sprites/${id}/part-1.png"`,
      );
    }
  });
});
