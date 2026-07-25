import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readWeaponRow, writeWeaponRow } from "../tools/weaponsmith/catalog-row-store.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Pose Studio catalog round-trip", () => {
  it("loads a row, applies an expressible edit, saves, and reloads identically", () => {
    const directory = mkdtempSync(join(tmpdir(), "dd-pose-studio-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "weapon-concepts-300.json");
    const row = {
      id: "round-trip-katana",
      name: "Round Trip Katana",
      type: "melee",
      family: "katana",
      grip: "2H",
      stats: {
        displayLength: 128,
        gripFrac: 0.12,
      },
      gripPoints: {
        primary: { x: 0.12, y: 0.5 },
        secondary: { x: 0.24, y: 0.5, role: "shaft" },
      },
      poseLanguage: { idle: "secondary-grip" },
      comboBar: [
        {
          name: "Measured Draw",
          motion: "draw-cut",
          direction: 1,
          hand: "both",
          timing: { activeStart: 0.12, activeEnd: 0.42, impact: 0.28, followEnd: 0.64 },
          path: {
            kind: "sweep",
            arcMultiplier: 1,
            rangeMultiplier: 1,
            damageMultiplier: 1,
            knockback: 0,
          },
          ribbon: {
            profile: "open-c",
            radialStart: 0.2,
            radialEnd: 1,
            widthMultiplier: 0.8,
            end: "clean",
          },
        },
      ],
    };
    writeFileSync(
      path,
      `${JSON.stringify({ generated: "fixture", weapons: [row] }, null, 2)}\n`,
      "utf8",
    );

    const loaded = readWeaponRow(row.id, path);
    expect(loaded).toEqual(row);
    loaded.gripPoints.primary.x = 0.16;
    loaded.comboBar[0].path.rangeMultiplier = 1.08;
    loaded.comboBar[0].timing.impact = 0.31;
    loaded.elementTransforms = {
      hold: {
        "part-1": { dx: 2, dy: -1, rotationRad: 0.1, scale: 1.05 },
      },
      poses: {
        held: {
          "hand-r": { dx: 4, dy: 3, rotationRad: -0.2, scale: 0.9 },
        },
      },
      beats: {
        0: {
          "hand-l": { dx: 7, dy: -5, rotationRad: 0.3, scale: 1.2 },
        },
      },
    };

    const saved = writeWeaponRow(row.id, loaded, path);
    const reloaded = readWeaponRow(row.id, path);

    expect(saved).toEqual(loaded);
    expect(reloaded).toEqual(loaded);
  });
});
