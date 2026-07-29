import { readFileSync } from "node:fs";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  BOSS_DEF_IDS,
  CULTIST_BEHAVIOURS,
  CULTIST_CHARACTER_IDS,
  CULTIST_SUBCLASS_BEHAVIOUR_TABLE,
  DIMENSIONS,
  ENEMY_KINDS,
  RUNNER_CHARACTER_ID,
  WEAPONS,
  cultistBehaviourForWeapon,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("three enemy archetypes", () => {
  it("replaces every live legacy category with Runner, Cultist, or Big", () => {
    const live = new Set(
      Object.values(ENEMY_KINDS)
        .filter((kind) => kind.archetype !== "dummy")
        .map((kind) => kind.archetype),
    );
    expect([...live].sort()).toEqual(["big", "cultist", "runner"]);
    expect(BOSS_DEF_IDS).toHaveLength(13);
  });

  it("keeps Runner bodies cheap and weaponless", () => {
    const runners = Object.values(ENEMY_KINDS).filter((kind) => kind.archetype === "runner");
    expect(runners.length).toBeGreaterThan(0);
    for (const runner of runners) {
      expect(runner.sprite).toBe(RUNNER_CHARACTER_ID);
      expect(runner.ranged).toBeUndefined();
      expect(runner.wieldsWeapon).toBeUndefined();
      expect(runner.combos).toBeUndefined();
      expect(runner.leap).toBeDefined();
    }
  });

  it("maps every active weapon subclass into exactly 13 reusable behaviours", () => {
    expect(Object.keys(CULTIST_BEHAVIOURS)).toHaveLength(13);
    const activeSubclasses = new Set(
      ACTIVE_WEAPON_CATALOG_IDS.map((id) => WEAPONS[id]?.tags.subclass).filter(
        (subclass): subclass is string => !!subclass,
      ),
    );
    for (const subclass of activeSubclasses)
      expect(CULTIST_SUBCLASS_BEHAVIOUR_TABLE[subclass], subclass).toBeDefined();
    for (const weaponId of ACTIVE_WEAPON_CATALOG_IDS) {
      const weapon = WEAPONS[weaponId];
      if (!weapon) throw new Error(`active weapon missing: ${weaponId}`);
      expect(CULTIST_BEHAVIOURS[cultistBehaviourForWeapon(weapon).id]).toBeDefined();
    }
  });

  it("retains the six purple Cultist identities and all playable dimensions", () => {
    expect(CULTIST_CHARACTER_IDS).toHaveLength(6);
    expect(new Set(CULTIST_CHARACTER_IDS).size).toBe(6);
    expect(Object.keys(DIMENSIONS).length).toBeGreaterThanOrEqual(6);
    for (const dimension of Object.values(DIMENSIONS)) {
      expect(dimension.roster.length, dimension.id).toBeGreaterThan(0);
      for (const kindId of dimension.roster) expect(ENEMY_KINDS[kindId], kindId).toBeDefined();
      expect(ENEMY_KINDS[dimension.boss]?.archetype, dimension.boss).toBe("big");
    }
  });

  it("pins the live server and client call sites so the replacement cannot merge inert", () => {
    const progression = readFileSync(
      new URL("../packages/server/src/rooms/room/room-progression.ts", import.meta.url),
      "utf8",
    );
    const enemies = readFileSync(
      new URL("../packages/server/src/rooms/room/room-enemies.ts", import.meta.url),
      "utf8",
    );
    const room = readFileSync(
      new URL("../packages/server/src/rooms/GameRoom.ts", import.meta.url),
      "utf8",
    );
    const arena = readFileSync(
      new URL("../packages/client/src/scenes/ArenaScene.ts", import.meta.url),
      "utf8",
    );

    expect(progression).toContain("this.stepCultists(dt);");
    expect(enemies).toContain("this.initializeEnemyIdentity(enemy, kind);");
    expect(enemies).toContain("this.initializeEnemyIdentity(enemy, kind, weaponId);");
    expect(room).toContain('[roomEnemyMethods, "stepCultists"]');
    expect(room).toContain('[roomEnemyMethods, "initializeEnemyIdentity"]');
    expect(arena).toContain(
      "resolveEnemySprite(kind, enemy.kind, enemy.appearanceId)",
    );
    expect(arena).toContain(
      "anim.enemyArchetype = es ? ENEMY_KINDS[es.kind]?.archetype : undefined;",
    );
  });
});
