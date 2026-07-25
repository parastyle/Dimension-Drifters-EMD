import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyWeaponElementTransform,
  resolveWeaponElementTransform,
  WEAPONS,
  type WeaponElementRenderTransform,
  type WeaponElementTransforms,
} from "@dd/shared";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("B47 authored element transform composition", () => {
  const authored: WeaponElementTransforms = {
    hold: {
      "hand-l": { dx: 2, dy: 3, rotationRad: 0.1, scale: 1.2 },
    },
    poses: {
      held: {
        "hand-l": { dx: 5, dy: -1, rotationRad: 0.2, scale: 0.5 },
      },
    },
    beats: {
      2: {
        "hand-l": { dx: -1, dy: 4, rotationRad: -0.05, scale: 2 },
      },
    },
  };

  it("composes hold, pose, then beat and mirrors X/rotation only", () => {
    const right = resolveWeaponElementTransform(authored, "hand-l", "held", 2, 1);
    expect(right).toMatchObject({ dx: 6, dy: 6, scale: 1.2 });
    expect(right?.rotationRad).toBeCloseTo(0.25, 12);
    const left = resolveWeaponElementTransform(authored, "hand-l", "held", 2, -1);
    expect(left).toMatchObject({ dx: -6, dy: 6, scale: 1.2 });
    expect(left?.rotationRad).toBeCloseTo(-0.25, 12);
    expect(resolveWeaponElementTransform(authored, "hand-r", "held", 2, 1)).toBeUndefined();
  });

  it("applies the authored affine on top of a computed pose", () => {
    const base: WeaponElementRenderTransform = {
      x: 20,
      y: -8,
      rotation: 0.4,
      scaleX: -0.3,
      scaleY: 0.25,
    };
    const applied = applyWeaponElementTransform(
      base,
      resolveWeaponElementTransform(authored, "hand-l", "held", 2, 1),
    );
    expect(applied).toMatchObject({ x: 26, y: -2 });
    expect(applied.rotation).toBeCloseTo(0.65, 12);
    expect(applied.scaleX).toBeCloseTo(-0.36, 12);
    expect(applied.scaleY).toBeCloseTo(0.3, 12);
  });
});

describe("B47 backward-compatible unauthored census", () => {
  it("keeps every unauthored WeaponDef render transform byte-identical", () => {
    const samples: readonly WeaponElementRenderTransform[] = [
      { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { x: 18.25, y: -31.5, rotation: 2.4, scaleX: -0.375, scaleY: 0.42 },
      { x: -7, y: 12, rotation: -1.8, scaleX: 1.25, scaleY: 0.8 },
    ];
    const unauthored = Object.values(WEAPONS).filter((weapon) => !weapon.elementTransforms);
    expect(unauthored.length).toBe(Object.keys(WEAPONS).length);
    for (const weapon of unauthored) {
      for (const facing of [1, -1] as const) {
        for (const pose of ["idle", "held"] as const) {
          for (const base of samples) {
            const before = JSON.stringify(base);
            const resolved = resolveWeaponElementTransform(
              weapon.elementTransforms,
              "part-1",
              pose,
              0,
              facing,
            );
            const after = JSON.stringify(applyWeaponElementTransform(base, resolved));
            expect(after, `${weapon.id}/${facing}/${pose}`).toBe(before);
          }
        }
      }
    }
  });
});

describe("B47 generator element transform emission", () => {
  it("strictly emits hold, pose, and beat maps into WeaponDef", () => {
    const directory = mkdtempSync(join(tmpdir(), "dd-b47-generator-"));
    temporaryDirectories.push(directory);
    const catalog = JSON.parse(readFileSync("data/weapon-concepts-300.json", "utf8")) as {
      weapons: Array<
        Record<string, unknown> & { id: string; banned?: boolean; comboBar?: unknown[] }
      >;
    };
    const target = catalog.weapons.find(
      (weapon) => !weapon.banned && Array.isArray(weapon.comboBar) && weapon.comboBar.length > 0,
    );
    if (!target) throw new Error("missing combo generator fixture");
    target.elementTransforms = {
      hold: {
        "part-1": { dx: 2, dy: -3, rotationRad: 0.12, scale: 1.1 },
      },
      poses: {
        held: {
          "hand-r": { dx: 4, dy: 5, rotationRad: -0.2, scale: 0.9 },
        },
      },
      beats: {
        0: {
          head: { dx: -1, dy: 2, rotationRad: 0.05, scale: 1.04 },
        },
      },
    };
    const sourcePath = join(directory, "weapon-concepts.json");
    const outputPath = join(directory, "weapons.generated.ts");
    const tiersPath = join(directory, "tiers.generated.ts");
    writeFileSync(sourcePath, JSON.stringify(catalog), "utf8");
    const result = spawnSync(process.execPath, ["tools/artkit/gen-weapon-expansion.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DD_WEAPON_CONCEPTS_SRC: sourcePath,
        DD_WEAPON_EXPANSION_OUT: outputPath,
        DD_WEAPON_TIERS_OUT: tiersPath,
      },
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const generated = readFileSync(outputPath, "utf8");
    const match = generated.match(
      /export const GENERATED_WEAPONS:[^=]+=\s*([\s\S]+?);\s*export const GENERATED_MELEE_COMBO_BARS/,
    );
    if (!match?.[1]) throw new Error("could not parse generated weapon map");
    const definitions = JSON.parse(match[1]) as Record<
      string,
      { elementTransforms?: WeaponElementTransforms }
    >;
    expect(definitions[target.id]?.elementTransforms).toEqual(target.elementTransforms);
  }, 30_000);
});
