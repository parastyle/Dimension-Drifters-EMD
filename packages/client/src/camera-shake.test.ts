import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  budgetedCameraShakeIntensity,
  PLAYER_WEAPON_SHAKE_SCALE,
} from "./camera-shake.js";

describe("V5G1 global player-weapon camera budget", () => {
  it("keeps the raw Phaser shake API behind the three audited camera-layer adapters", () => {
    const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
    const directSites: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.name.endsWith(".ts")) {
          const source = readFileSync(absolute, "utf8");
          if (/\b(?:camera|(?:this|scene)\.cameras\.main)\.shake\(/.test(source))
            directSites.push(path.relative(sourceRoot, absolute).replaceAll("\\", "/"));
        }
      }
    };
    visit(sourceRoot);
    expect(directSites.sort()).toEqual([
      "scenes/ArenaScene.ts",
      "scenes/arena/vfx.ts",
      "vfx/worm-boss-vfx.ts",
    ]);
  });

  it("preserves enemy, boss, movement, hurt, and other world-authored shake", () => {
    for (const raw of [0, 0.0007, 0.006, 0.014, 0.03])
      expect(budgetedCameraShakeIntensity(raw, "world")).toBe(raw);
  });

  it("catalog-sweeps every player weapon below 5% of every authored raw source", () => {
    for (const weapon of Object.values(WEAPONS)) {
      const rawSources = [
        weapon.gun?.recoil,
        weapon.gun?.explode
          ? Math.min(0.02, 0.006 + weapon.gun.explode.radius / 9_000)
          : undefined,
        weapon.scatter?.explode
          ? Math.min(0.02, 0.006 + weapon.scatter.explode.radius / 9_000)
          : undefined,
        weapon.quake ? 0.03 : undefined,
        weapon.beam ? 0.006 : undefined,
        // Hit-confirm/final-blow receipt ceiling applies to every delivery family.
        0.006,
      ].filter((value): value is number => value !== undefined);

      for (const raw of rawSources) {
        const admitted = budgetedCameraShakeIntensity(raw, "player-weapon");
        expect(admitted, `${weapon.id}: raw ${raw}`).toBeLessThanOrEqual(
          raw * PLAYER_WEAPON_SHAKE_SCALE + Number.EPSILON,
        );
      }
    }
  });
});
