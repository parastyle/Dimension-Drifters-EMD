import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

const MAX_DERIVED_RADIUS_SOURCE_PX = 2;
const overrides = JSON.parse(readFileSync("data/weapon-muzzle-overrides.json", "utf8")) as Record<
  string,
  { reason?: string }
>;

describe("V7 catalog-wide art-space muzzle law", () => {
  it("keeps generated derivation synchronized with every installed gun and beam PNG", () => {
    expect(() =>
      execFileSync(process.execPath, ["tools/artkit/gen-weapon-muzzles.mjs", "--check"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  }, 30_000);

  it("requires every muzzle to remain near its derived barrel tip or carry a documented override", () => {
    const failures: string[] = [];
    let weaponCount = 0;
    let pointCount = 0;
    for (const weapon of Object.values(WEAPONS)) {
      if (!weapon.gun && !weapon.beam) continue;
      weaponCount++;
      if (!weapon.muzzle?.points.length) {
        failures.push(`${weapon.id}: no art-space muzzle`);
        continue;
      }
      for (const [index, point] of weapon.muzzle.points.entries()) {
        pointCount++;
        const dimensions = weapon.muzzle.parts[point.part];
        if (!dimensions) {
          failures.push(`${weapon.id}[${index}]: missing part ${point.part}`);
          continue;
        }
        if (
          point.x < 0 ||
          point.x >= dimensions.width ||
          point.y < 0 ||
          point.y >= dimensions.height
        ) {
          failures.push(
            `${weapon.id}[${index}]: (${point.x},${point.y}) outside ${dimensions.width}x${dimensions.height}`,
          );
        }
        const radius = Math.hypot(point.x - point.derived.x, point.y - point.derived.y);
        if (radius <= MAX_DERIVED_RADIUS_SOURCE_PX) {
          if (point.overrideReason) failures.push(`${weapon.id}[${index}]: redundant override`);
          continue;
        }
        const authoredOverride = overrides[weapon.id];
        if (!point.overrideReason?.trim() || point.overrideReason !== authoredOverride?.reason) {
          failures.push(
            `${weapon.id}[${index}]: ${radius.toFixed(1)}px from derived (${point.derived.x},${point.derived.y}) without matching documented override`,
          );
        }
      }
    }

    expect(weaponCount).toBe(145);
    expect(pointCount).toBeGreaterThanOrEqual(145);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("repairs the V7-reported set through weapon-owned PNG coordinates", () => {
    expect(WEAPONS["x2-brimstone-gallows-rifle"]?.muzzle?.points[0]).toMatchObject({
      x: 255,
      y: 13.3,
    });
    expect(WEAPONS["x2-gravedog-auto-rifle"]?.muzzle?.points[0]).toMatchObject({
      x: 255,
      y: 19.9,
    });
    expect(WEAPONS["x2-stormspur-coil-carbine"]?.muzzle?.points[0]).toMatchObject({
      x: 254,
      y: 15,
    });
    expect(WEAPONS["x2-hollowpoint-hex"]?.muzzle?.points[0]).toMatchObject({
      x: 255,
      y: 30.9,
    });
    expect(WEAPONS["x2-coyote-stinger"]?.muzzle?.points).toHaveLength(2);
    expect(WEAPONS["x2-stormcaller-tesla-gatling"]?.muzzle?.points).toHaveLength(6);
  });
});
