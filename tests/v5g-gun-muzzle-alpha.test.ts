import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  GUN_HAND_FORWARD,
  gunMuzzleReach,
  resolvedGunGripPoints,
  WEAPONS,
  weaponDisplaySpriteId,
  weaponMuzzleOffsets,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: { sync: { read(bytes: Buffer): { width: number; height: number; data: Buffer } } };
};

const ALPHA_THRESHOLD = 32;
const MAX_MUZZLE_TO_ALPHA_WORLD_PX = 27;
const MAX_FRONT_EDGE_DRIFT_WORLD_PX = 9;
const REPAIRED_RIFLES = new Set([
  "x2-brimstone-gallows-rifle",
  "x2-gravedog-auto-rifle",
  "x2-stormspur-coil-carbine",
  "x2-hellbore-gatling",
]);

function nearestFrontAlphaDistance(
  png: { width: number; height: number; data: Buffer },
  x: number,
  y: number,
): { distance: number; frontX: number } {
  let frontX = -1;
  for (let py = 0; py < png.height; py++) {
    for (let px = 0; px < png.width; px++) {
      if ((png.data[(py * png.width + px) * 4 + 3] ?? 0) >= ALPHA_THRESHOLD)
        frontX = Math.max(frontX, px);
    }
  }
  if (frontX < 0) return { distance: Number.POSITIVE_INFINITY, frontX };

  const frontBandStart = frontX - Math.max(4, Math.ceil(png.width * 0.16));
  let distance = Number.POSITIVE_INFINITY;
  for (let py = 0; py < png.height; py++) {
    for (let px = Math.max(0, frontBandStart); px <= frontX; px++) {
      if ((png.data[(py * png.width + px) * 4 + 3] ?? 0) < ALPHA_THRESHOLD) continue;
      distance = Math.min(distance, Math.hypot(x - px, y - py));
    }
  }
  return { distance, frontX };
}

describe("V5G catalog-wide gun muzzle alpha law", () => {
  it("authors the four repaired barrels and keeps Hellbore's far hand on its angled foregrip", () => {
    expect(WEAPONS["x2-gravedog-auto-rifle"]?.gun?.muzzleOffsets).toEqual([
      { forward: -2, lateral: -14 },
    ]);
    expect(WEAPONS["x2-stormspur-coil-carbine"]?.gun?.muzzleOffsets).toEqual([
      { forward: -2, lateral: -10 },
    ]);
    expect(WEAPONS["x2-brimstone-gallows-rifle"]?.gun?.muzzleOffsets).toEqual([
      { forward: -2, lateral: -17 },
    ]);
    expect(WEAPONS["x2-hellbore-gatling"]?.gun?.muzzleOffsets).toEqual([
      { forward: -2, lateral: -12 },
    ]);
    expect(WEAPONS["x2-hellbore-gatling"]?.gripPoints).toEqual({
      primary: { x: 0.08, y: 0.65 },
      secondary: { x: 0.22, y: 0.44, role: "vertical-foregrip" },
    });
  });

  it("keeps every authored muzzle lane on sprite alpha near the weapon front", () => {
    const failures: string[] = [];
    let checked = 0;
    for (const weapon of Object.values(WEAPONS)) {
      if (!weapon.gun) continue;
      const spriteId = weaponDisplaySpriteId(weapon);
      const part = SPRITES[spriteId as keyof typeof SPRITES]?.parts[0];
      if (!part) {
        failures.push(`${weapon.id}: missing installed sprite part`);
        continue;
      }
      const png = PNG.sync.read(
        readFileSync(
          new URL(
            `../packages/client/public/sprites/${spriteId}/${part.file}`,
            import.meta.url,
          ),
        ),
      );
      const scale = weapon.displayLength / png.width;
      const primary = resolvedGunGripPoints(weapon)?.primary ?? {
        x: weapon.gripFrac,
        y: 0.5,
      };
      for (const [lane, offset] of weaponMuzzleOffsets(weapon).entries()) {
        // SpriteRig pivots on this same primary anchor. In unrotated sprite pixels the shared
        // forward/lateral offsets therefore land at the following painted point.
        const muzzleX =
          primary.x * png.width +
          (gunMuzzleReach(weapon) - GUN_HAND_FORWARD + offset.forward) / scale;
        const muzzleY = primary.y * png.height + offset.lateral / scale;
        const alpha = nearestFrontAlphaDistance(png, muzzleX, muzzleY);
        const worldDistance = alpha.distance * scale;
        const frontEdgeDrift = Math.abs(muzzleX - alpha.frontX) * scale;
        checked++;
        const alphaLimit = REPAIRED_RIFLES.has(weapon.id)
          ? 9
          : MAX_MUZZLE_TO_ALPHA_WORLD_PX;
        if (worldDistance > alphaLimit || frontEdgeDrift > MAX_FRONT_EDGE_DRIFT_WORLD_PX) {
          failures.push(
            `${weapon.id}[${lane}]: ${worldDistance.toFixed(2)}px from front alpha ` +
              `/ ${frontEdgeDrift.toFixed(2)}px front drift ` +
              `(muzzle ${muzzleX.toFixed(1)},${muzzleY.toFixed(1)}; front x=${alpha.frontX})`,
          );
        }
      }
    }

    expect(checked).toBeGreaterThan(100);
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
