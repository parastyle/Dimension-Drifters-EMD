import { readFileSync } from "node:fs";
import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  REVIEWED_ART_AXIS_OUTLIER_IDS,
  WEAPON_ART_GEOMETRY,
  weaponArtGeometryFor,
} from "../packages/client/src/sprites/art-geometry.generated.js";

const RIG_SOURCE = ["rig-core.ts", "rig-combat.ts", "rig-gear.ts", "rig-pose.ts"]
  .map((file) =>
    readFileSync(new URL(`../packages/client/src/entities/rig/${file}`, import.meta.url), "utf8"),
  )
  .join("\n");

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
    for (const id of samples) {
      if (id !== "fists") {
        const weapon = WEAPONS[id];
        expect(weapon, id).toBeDefined();
        expect(weapon?.gun, id).toBeUndefined();
      }
      for (const aim of aims) {
        expect(aim + readyCant - aim, `${id}@${aim}`).toBeCloseTo(readyCant, 10);
      }
    }
  });

  it("keeps the tracked reviewed PCA-outlier census on semantic-axis corrections", () => {
    expect(REVIEWED_ART_AXIS_OUTLIER_IDS).toHaveLength(10);
    expect([...REVIEWED_ART_AXIS_OUTLIER_IDS]).toEqual([...REVIEWED_ART_AXIS_OUTLIER_IDS].sort());
    for (const id of REVIEWED_ART_AXIS_OUTLIER_IDS) {
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
    const openTomes = Object.entries(WEAPON_ART_GEOMETRY).filter(
      ([, geometry]) => "open" in geometry,
    );
    expect(openTomes).toHaveLength(7);
    for (const [id, geometry] of openTomes) {
      if (!("open" in geometry) || !geometry.open) continue;
      expect(geometry.open.originX, id).toBe(0.5);
      expect(geometry.open.originY, id).toBe(0.85);
      expect(Math.abs(geometry.open.artAngle), id).toBeLessThan(Math.PI / 12);
      const closedMul = geometry.closed.displayLengthMul ?? 1;
      const openMul = geometry.open.displayLengthMul ?? 1;
      expect(Number.isFinite(closedMul) && closedMul > 0, `${id}:closed scale`).toBe(true);
      expect(Number.isFinite(openMul) && openMul > 0, `${id}:open scale`).toBe(true);
    }
  });

  it("normalizes Verdigris from 240px to the 94px tome-family median", () => {
    const verdigris = WEAPON_ART_GEOMETRY["x2-verdigris-grand-grimoire"];
    expect(240 * verdigris.closed.displayLengthMul).toBeCloseTo(94, 4);
    expect(verdigris.closed.displayLengthMul).toBeLessThan(0.4);
  });
});
