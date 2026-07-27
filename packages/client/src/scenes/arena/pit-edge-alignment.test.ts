import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  type ArenaMap,
  characterScale,
  DEFAULT_CHARACTER,
  isPlayerGroundContactInPit,
  PLAYER_GROUND_CONTACT_OFFSET_Y,
  TILE_GROUND,
  TILE_PIT,
} from "@dd/shared";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { wholeArtCharacterVisualScale } from "../../sprites/whole-art-character.js";

const EDGE_TOLERANCE_PX = 4;

function boundaryFixture(): ArenaMap {
  return {
    cols: 1,
    rows: 2,
    tileSize: 80,
    tiles: Uint8Array.from([TILE_GROUND, TILE_PIT]),
    zoneIds: new Uint8Array(2),
    zoneSeeds: [],
    spawnX: 40,
    spawnY: 40,
    seeds: { seedTerrain: 1, seedHazard: 2, seedTheme: 3, seedDecor: 4 },
  };
}

describe("painted pit edge alignment", () => {
  it(`keeps the player damage contact within ${EDGE_TOLERANCE_PX}px of the rendered Wild West lip`, async () => {
    const rimPath = fileURLToPath(
      new URL("../../../public/tiles/wild-west/rim.png", import.meta.url),
    );
    const { data, info } = await sharp(rimPath).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    expect([info.width, info.height]).toEqual([1024, 256]);

    const rowLuminance: number[] = [];
    for (let y = 0; y < info.height; y++) {
      let total = 0;
      for (let x = 0; x < info.width; x++) {
        const index = (y * info.width + x) * info.channels;
        total +=
          (data[index] ?? 0) * 0.2126 +
          (data[index + 1] ?? 0) * 0.7152 +
          (data[index + 2] ?? 0) * 0.0722;
      }
      rowLuminance.push(total / info.width);
    }

    // buildPaintedRims centres all 256 source rows on the exact tile boundary. Find the strongest authored
    // horizontal edge in the 16px lip window; the default Wild West asset reads 1px into the pit.
    const sourceCentreY = info.height / 2;
    let edgeSourceY = sourceCentreY;
    let strongestDelta = -1;
    for (let y = sourceCentreY - 8; y <= sourceCentreY + 8; y++) {
      const delta = Math.abs((rowLuminance[y] ?? 0) - (rowLuminance[y - 1] ?? 0));
      if (delta > strongestDelta) {
        strongestDelta = delta;
        edgeSourceY = y;
      }
    }
    const paintedEdgeOffsetPx = edgeSourceY - sourceCentreY;
    expect(paintedEdgeOffsetPx).toBe(1);

    const map = boundaryFixture();
    const tileBoundaryY = map.tileSize;
    const rootAtDamageBoundaryY = tileBoundaryY - PLAYER_GROUND_CONTACT_OFFSET_Y;
    expect(isPlayerGroundContactInPit(map, 40, rootAtDamageBoundaryY - 0.01)).toBe(false);
    expect(isPlayerGroundContactInPit(map, 40, rootAtDamageBoundaryY)).toBe(true);

    // Read the renderer constants without importing rig-core: that module initializes Phaser and is not
    // Node-safe. This keeps the measurement tied to the production shadow instead of duplicating its values.
    const rigCoreSource = await readFile(
      fileURLToPath(new URL("../../entities/rig/rig-core.ts", import.meta.url)),
      "utf8",
    );
    const spriteRigSource = await readFile(
      fileURLToPath(new URL("../../entities/SpriteRig.ts", import.meta.url)),
      "utf8",
    );
    const targetBodyHeight = Number(
      /export const TARGET_BODY_H = ([\d.]+)/.exec(rigCoreSource)?.[1],
    );
    const shadowBodyFraction = Number(
      /\.ellipse\(0, TARGET_BODY_H \* ([\d.]+), TARGET_BODY_H \* 0\.6/.exec(
        spriteRigSource,
      )?.[1],
    );
    expect(targetBodyHeight).toBe(76);
    expect(shadowBodyFraction).toBe(0.42);
    const visibleContactOffsetY =
      targetBodyHeight *
      shadowBodyFraction *
      characterScale(DEFAULT_CHARACTER) *
      wholeArtCharacterVisualScale(DEFAULT_CHARACTER);
    expect(visibleContactOffsetY).toBeCloseTo(21.1418767, 6);
    const oldVisibleContactWorldY = tileBoundaryY + visibleContactOffsetY;
    const newVisibleContactWorldY = rootAtDamageBoundaryY + visibleContactOffsetY;
    const paintedEdgeWorldY = tileBoundaryY + paintedEdgeOffsetPx;
    expect(Math.abs(oldVisibleContactWorldY - paintedEdgeWorldY)).toBeGreaterThan(20);
    expect(Math.abs(newVisibleContactWorldY - paintedEdgeWorldY)).toBeLessThanOrEqual(
      EDGE_TOLERANCE_PX,
    );
  });
});
