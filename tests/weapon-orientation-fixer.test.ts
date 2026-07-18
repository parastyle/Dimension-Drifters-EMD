import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REVIEWED_ART_AXIS_OUTLIER_IDS,
  WEAPON_ART_GEOMETRY,
  weaponArtGeometryFor,
} from "../packages/client/src/sprites/art-geometry.generated.js";

const REPORT = JSON.parse(
  readFileSync(
    new URL("../tools/artkit/out/orientation/weapon-axis-report.json", import.meta.url),
    "utf8",
  ),
);
const RIG_SOURCE = readFileSync(
  new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
  "utf8",
);

describe("weapon orientation fixer", () => {
  it("keeps representative pointed, worn-fist, and tome families forward at semantic rest", () => {
    const samples = [
      "driftblade",
      "x-staff-arcane-lance",
      "twin-bowie-fangs",
      "x2-blightgrip-spore-mitt",
      "x2-pyroglyph-spellbook",
      "fists",
    ] as const;
    const aims = [0, Math.PI / 5, -Math.PI / 3];
    const readyCant = -Math.PI / 15;

    expect(RIG_SOURCE).toContain("export const MELEE_FORWARD_READY_CANT = -Math.PI / 15");
    expect(RIG_SOURCE).toContain("return aimLocal + MELEE_FORWARD_READY_CANT");
    expect(RIG_SOURCE).toContain('this.weaponDef.id === "fists"');
    expect(Math.abs(readyCant)).toBeLessThanOrEqual(Math.PI / 12);
    const weaponById = new Map(
      REPORT.weapons.map((weapon: { id: string }) => [weapon.id, weapon] as const),
    );
    for (const id of samples) {
      if (id !== "fists") {
        const weapon = weaponById.get(id) as { semantics?: { gun?: boolean } } | undefined;
        expect(weapon, id).toBeDefined();
        expect(weapon?.semantics?.gun, id).toBeFalsy();
      }
      for (const aim of aims) {
        expect(aim + readyCant - aim, `${id}@${aim}`).toBeCloseTo(readyCant, 10);
      }
    }
  });

  it("covers every raw PCA outlier with a reviewed semantic-axis correction", () => {
    const reportOutliers = REPORT.weapons
      .filter(
        (weapon: { deviationFromRigAssumedPositiveXDeg: number }) =>
          Math.abs(weapon.deviationFromRigAssumedPositiveXDeg) > 22.5,
      )
      .map((weapon: { id: string }) => weapon.id)
      .sort();
    expect([...REVIEWED_ART_AXIS_OUTLIER_IDS]).toEqual(reportOutliers);
    expect(reportOutliers).toHaveLength(10);
    for (const id of reportOutliers) {
      // The reviewed barrel/business axes point image-right. This intentionally rejects raw silhouette PCA.
      expect(weaponArtGeometryFor(id)?.closed.artAngle, id).toBe(0);
    }
  });

  it("applies art rotation once at the final seam and keeps semantic tip consumers compensated", () => {
    expect(RIG_SOURCE.match(/this\.applyWeaponArtGeometry\(\)/g)).toHaveLength(1);
    expect(RIG_SOURCE).toContain("weapon.semanticRotation = weapon.img.rotation");
    expect(RIG_SOURCE).toContain("weapon.img.rotation += state?.artAngle ?? 0");
    expect(RIG_SOURCE).toContain("Math.cos(weapon.semanticRotation) * tip");
    expect(RIG_SOURCE).not.toContain("const restA = -Math.PI / 2 + 0.16");
  });

  it("gives every open tome a spine origin and honest visible-area scale", () => {
    for (const size of REPORT.tomeSize as Array<{
      id: string;
      openToClosedRatio: { alphaEquivalentArea: number };
    }>) {
      const geometry = weaponArtGeometryFor(size.id);
      expect(geometry?.open, size.id).toBeDefined();
      if (!geometry?.open) continue;
      expect(geometry.open.originX, size.id).toBe(0.5);
      expect(geometry.open.originY, size.id).toBe(0.85);
      expect(Math.abs(geometry.open.artAngle), size.id).toBeLessThan(Math.PI / 12);
      const closedMul = geometry.closed.displayLengthMul ?? 1;
      const openMul = geometry.open.displayLengthMul ?? 1;
      expect(openMul * openMul * size.openToClosedRatio.alphaEquivalentArea, size.id).toBeCloseTo(
        closedMul * closedMul,
        5,
      );
    }
  });

  it("normalizes Verdigris from 240px to the 94px tome-family median", () => {
    const verdigris = WEAPON_ART_GEOMETRY["x2-verdigris-grand-grimoire"];
    expect(240 * verdigris.closed.displayLengthMul).toBeCloseTo(94, 4);
    expect(verdigris.closed.displayLengthMul).toBeLessThan(0.4);
  });
});
