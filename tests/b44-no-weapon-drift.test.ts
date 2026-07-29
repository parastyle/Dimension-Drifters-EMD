import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVER_MOTION_SOURCES } from "../packages/server/src/rooms/room/room-progression.js";
import { meleeComboSelectionFor, WEAPONS } from "../packages/shared/src/index.js";

const REMOVED_MOTION_KEYS = new Set([
  "forwardDrift",
  "rootMotion",
  "finisherDashImpulse",
  "dashImpulse",
  "lunge",
  "userKnockbackMultiplier",
]);

function forbiddenKeyPaths(value: unknown, path = "catalog"): string[] {
  if (!value || typeof value !== "object") return [];
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (REMOVED_MOTION_KEYS.has(key)) paths.push(childPath);
    paths.push(...forbiddenKeyPaths(child, childPath));
  }
  return paths;
}

describe("B44 no-weapon-drift standing law", () => {
  it("has zero authored weapon displacement fields in the complete runtime catalog", () => {
    expect(forbiddenKeyPaths(WEAPONS)).toEqual([]);
  });

  it("keeps the schema and generator closed against every removed displacement key", () => {
    const schema = readFileSync("packages/shared/src/weapons.ts", "utf8");
    const melee = readFileSync("packages/shared/src/melee.ts", "utf8");
    const generator = readFileSync("tools/artkit/gen-weapon-expansion.mjs", "utf8");
    for (const key of REMOVED_MOTION_KEYS) {
      expect(schema, `weapons schema: ${key}`).not.toContain(`${key}?:`);
      expect(melee, `melee schema: ${key}`).not.toContain(`${key}?:`);
      expect(generator, `generator mapping: ${key}`).not.toMatch(
        new RegExp(`(?:["']${key}["']|\\b${key})\\s*:`),
      );
    }
  });

  it("has a closed census with gun fire as the sole sanctioned weapon-motion epoch", () => {
    expect(SERVER_MOTION_SOURCES).toEqual([
      "dodge-roll",
      "distance-jump",
      "slide-hop",
      "parry-slide",
      "parry-launch",
      "enemy-contact-hit",
      "enemy-commit-hit",
      "enemy-commit-launch",
      "hostile-projectile-hit",
      "lava-gap-recovery",
      "elevator-boarding",
      "revive-placement",
      "teleport-placement",
      "ultimate",
      "weapon-fire-recoil",
    ]);
    expect(SERVER_MOTION_SOURCES.filter((source) => /weapon|attack/i.test(source))).toEqual([
      "weapon-fire-recoil",
    ]);

    const context = readFileSync("packages/server/src/rooms/room/room-progression.ts", "utf8");
    expect(context).toContain(
      "beginServerMotion(player: PlayerState, ticks: number, source: ServerMotionSource): void;",
    );
  });

  it("preserves former travel reach within 10% without changing at-range DPS", () => {
    const guards = [
      {
        id: "x2-cinderbrand-cleaver",
        oldReach: 158 + 72 / 3,
        newReach: 182,
        d: 5.555555555555555,
        cd: 1 / 3,
      },
      {
        id: "x2-coyote-trickster-s-sparkmitt",
        oldReach: 150 + 48 * 0.12,
        newReach: 156,
        d: 1.0588235294117647,
        cd: 0.12,
      },
      { id: "x2-venomtongue-trident", oldReach: 195 + 128, newReach: 323, d: 9, cd: 0.46 },
      { id: "x2-frostfang-rakes", oldReach: 108 + 64, newReach: 172, d: 6, cd: 0.3 },
      { id: "x2-thunderhead-stormfists", oldReach: 200 + 480, newReach: 680, d: 14, cd: 0.8 },
      { id: "gravediggers-spade", oldReach: 210 + 144, newReach: 354, d: 8, cd: 0.6 },
      { id: "x2-quarry-splitter-bardiche", oldReach: 240 + 96, newReach: 336, d: 15, cd: 0.88 },
      { id: "drift-katana-riftstep", oldReach: 203.3, newReach: 150 * 1.36, d: 6.5, cd: 0.35 },
    ] as const;

    for (const guard of guards) {
      const weapon = WEAPONS[guard.id];
      if (!weapon) throw new Error(`Missing B44 reach guard ${guard.id}`);
      const reachDelta = Math.abs(guard.newReach - guard.oldReach) / guard.oldReach;
      expect(reachDelta, `${guard.id}:reach`).toBeLessThanOrEqual(0.1);
      const quakeDamage =
        guard.id === "x2-thunderhead-stormfists" ? (weapon.quake?.damage ?? 0) : 0;
      const revolutionHits = guard.id === "gravediggers-spade" ? 3 : 1;
      const damagePerBeat = weapon.damage * revolutionHits + quakeDamage;
      expect(damagePerBeat, `${guard.id}:damage`).toBeCloseTo(guard.d, 12);
      expect(weapon.cooldown, `${guard.id}:cooldown`).toBeCloseTo(guard.cd, 12);
      expect(damagePerBeat / weapon.cooldown, `${guard.id}:dps`).toBeCloseTo(
        guard.d / guard.cd,
        12,
      );
    }

    expect(WEAPONS["x2-thunderhead-stormfists"]?.quake?.placementRange).toBe(480);
    expect(
      meleeComboSelectionFor(WEAPONS["drift-katana-riftstep"]!)?.sequence[3]?.path.rangeMultiplier,
    ).toBe(1.36);

    const tesla = WEAPONS["x2-cogwright-s-tesla-rod"];
    expect(tesla?.warp?.burstRadius).toBe(48);
    expect((tesla?.damage ?? 0) / (tesla?.cooldown ?? 1)).toBeCloseTo(4 / 0.36, 12);
  });
});
