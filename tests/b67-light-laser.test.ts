import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  activeWeaponUtilityMode,
  nextWeaponUtilityMode,
  WEAPONS,
  type WeaponDefSource,
  WeaponUtilityMode,
  weaponUtilityCapability,
} from "@dd/shared";
import { weaponUtilityTransform } from "../packages/client/src/scenes/arena/weapon-utility-renderer.js";
import { afterAll, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
afterAll(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("B67 weapon light/laser capability and cycling", () => {
  const both = { weaponUtility: "both" } as const;
  const light = { weaponUtility: "light" } as const;
  const laser = { weaponUtility: "laser" } as const;
  const neither = {} as const;

  it("uses an honest absent default and intersects retained preference with current hardware", () => {
    expect(weaponUtilityCapability(neither)).toBe("neither");
    expect(activeWeaponUtilityMode(neither, WeaponUtilityMode.Both)).toBe(WeaponUtilityMode.Off);
    expect(activeWeaponUtilityMode(light, WeaponUtilityMode.Both)).toBe(WeaponUtilityMode.Light);
    expect(activeWeaponUtilityMode(laser, WeaponUtilityMode.Both)).toBe(WeaponUtilityMode.Laser);
  });

  it("cycles a combo with one key and makes single-purpose hardware a plain off/on toggle", () => {
    expect(nextWeaponUtilityMode(both, WeaponUtilityMode.Off)).toBe(WeaponUtilityMode.Light);
    expect(nextWeaponUtilityMode(both, WeaponUtilityMode.Light)).toBe(WeaponUtilityMode.Laser);
    expect(nextWeaponUtilityMode(both, WeaponUtilityMode.Laser)).toBe(WeaponUtilityMode.Both);
    expect(nextWeaponUtilityMode(both, WeaponUtilityMode.Both)).toBe(WeaponUtilityMode.Off);
    expect(nextWeaponUtilityMode(light, WeaponUtilityMode.Off)).toBe(WeaponUtilityMode.Light);
    expect(nextWeaponUtilityMode(light, WeaponUtilityMode.Light)).toBe(WeaponUtilityMode.Off);
    expect(nextWeaponUtilityMode(laser, WeaponUtilityMode.Off)).toBe(WeaponUtilityMode.Laser);
    expect(nextWeaponUtilityMode(laser, WeaponUtilityMode.Laser)).toBe(WeaponUtilityMode.Off);
    expect(nextWeaponUtilityMode(neither, WeaponUtilityMode.Both)).toBe(WeaponUtilityMode.Both);
  });

  it("keeps the complete catalog census closed over the four capabilities", () => {
    const counts = { neither: 0, light: 0, laser: 0, both: 0 };
    for (const weapon of Object.values(WEAPONS)) counts[weaponUtilityCapability(weapon)]++;
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(
      Object.keys(WEAPONS).length,
    );
  });

  it("anchors both directional effects at the weapon muzzle, never the player root", () => {
    const geometry = weaponUtilityTransform(410, 220, 0, 1, 410, 700);
    expect(geometry).toEqual({
      x: 410,
      y: 220,
      angle: Math.PI / 2,
      laserLength: 480,
    });
  });
});

describe("B67 strict concept generation", () => {
  it("emits explicit light/laser declarations, derives positive combo art data, and rejects negation", () => {
    const directory = mkdtempSync(join(tmpdir(), "dd-b67-generator-"));
    temporaryDirectories.push(directory);
    const catalog = JSON.parse(readFileSync("data/weapon-concepts-300.json", "utf8")) as {
      weapons: Array<
        Record<string, unknown> & {
          id: string;
          type: string;
          banned?: boolean;
          artPrompt?: string;
        }
      >;
    };
    const targets = catalog.weapons.filter((weapon) => !weapon.banned && weapon.type === "ranged");
    const [lightTarget, laserTarget, overrideTarget, comboTarget, negativeTarget] = targets;
    if (!lightTarget || !laserTarget || !overrideTarget || !comboTarget || !negativeTarget) {
      throw new Error("missing ranged generator fixtures");
    }
    lightTarget.weaponUtility = "light";
    laserTarget.weaponUtility = "laser";
    overrideTarget.weaponUtility = "neither";
    overrideTarget.artPrompt =
      (overrideTarget.artPrompt ?? "") + " Small boxy under-barrel laser/light combo unit.";
    comboTarget.artPrompt =
      (comboTarget.artPrompt ?? "") +
      " Small boxy combination unit rail-mounted beneath the barrel with a smoked lens.";
    negativeTarget.artPrompt =
      (negativeTarget.artPrompt ?? "") +
      " No bipod, sling, strap, improvised repair, emitted light, or rail-mounted laser/light combo unit.";

    const sourcePath = join(directory, "weapon-concepts.json");
    const outputPath = join(directory, "weapons.generated.ts");
    const tiersPath = join(directory, "tiers.generated.ts");
    const taxonomyPath = join(directory, "taxonomy.generated.ts");
    writeFileSync(sourcePath, JSON.stringify(catalog), "utf8");
    const result = spawnSync(process.execPath, ["tools/artkit/gen-weapon-expansion.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DD_WEAPON_CONCEPTS_SRC: sourcePath,
        DD_WEAPON_EXPANSION_OUT: outputPath,
        DD_WEAPON_TIERS_OUT: tiersPath,
        DD_WEAPON_TAXONOMY_OUT: taxonomyPath,
      },
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const generated = readFileSync(outputPath, "utf8");
    const match = generated.match(
      /export const GENERATED_WEAPONS:[^=]+=\s*([\s\S]+?);\s*export const GENERATED_MELEE_COMBO_BARS/,
    );
    if (!match?.[1]) throw new Error("could not parse generated weapon map");
    const definitions = JSON.parse(match[1]) as Record<string, WeaponDefSource>;
    expect(definitions[lightTarget.id]?.weaponUtility).toBe("light");
    expect(definitions[laserTarget.id]?.weaponUtility).toBe("laser");
    expect(definitions[overrideTarget.id]?.weaponUtility).toBeUndefined();
    expect(definitions[comboTarget.id]?.weaponUtility).toBe("both");
    expect(definitions[negativeTarget.id]?.weaponUtility).toBeUndefined();
  }, 30_000);

  it("matches the B63 yes/no roster when those parallel concept rows are present", () => {
    const order = readFileSync("docs/sol-reports/order-b63-modern-guns.md", "utf8");
    const expected = new Map<string, boolean>();
    for (const line of order.split(/\r?\n/)) {
      const match = line.match(/^\|\s*\d{2}\s*\|\s*([^|]+?)\s*\|(?:[^|]*\|){3}\s*(yes|no)\s*\|$/i);
      if (match?.[1] && match[2]) expected.set(match[1].trim(), match[2].toLowerCase() === "yes");
    }
    expect(expected.size).toBe(30);

    const concepts = (
      JSON.parse(readFileSync("data/weapon-concepts-300.json", "utf8")) as {
        weapons: Array<{ id: string; name: string }>;
      }
    ).weapons.filter((weapon) => expected.has(weapon.name));
    if (concepts.length === 0) return;
    for (const concept of concepts) {
      expect(
        weaponUtilityCapability(WEAPONS[concept.id]),
        `${concept.name} capability must match its B63 art affordance`,
      ).toBe(expected.get(concept.name) ? "both" : "neither");
    }
  });
});
