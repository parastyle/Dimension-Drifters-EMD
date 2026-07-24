import {
  advanceChestCadence,
  CHEST_FIRST_TICKS,
  CHEST_KIND_STANDARD,
  CHEST_KIND_WEAPON_CACHE,
  CHEST_WEAPON_GUARANTEE_TICKS,
  COMMONS_CHEST_WEIGHTS,
  chestCadenceInitial,
  generateArena,
  isArenaDiscSafe,
  isInsidePoi,
  isPitAtPx,
  MAP_ZONE_COMMONS,
  MAP_ZONE_SCAR,
  placeChestOnArena,
  rollChestReward,
  SCAR_CHEST_WEIGHTS,
  TICK_RATE,
  WEAPON_IDS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("B20 L2 chest cadence", () => {
  it("spawns at the first deadline and never exceeds the 2.5-minute weapon-cache drought", () => {
    const seed = 0x5eed20;
    let state = chestCadenceInitial(0, seed);
    const first = advanceChestCadence(state, CHEST_FIRST_TICKS - 1, seed);
    expect(first.spawns).toEqual([]);

    const advanced = advanceChestCadence(state, 20 * 60 * TICK_RATE, seed);
    state = advanced.state;
    expect(advanced.spawns[0]).toMatchObject({
      spawnTick: CHEST_FIRST_TICKS,
      kind: CHEST_KIND_STANDARD,
    });
    const weaponTicks = [
      0,
      ...advanced.spawns
        .filter((spawn) => spawn.kind === CHEST_KIND_WEAPON_CACHE)
        .map((spawn) => spawn.spawnTick),
    ];
    expect(weaponTicks.length).toBeGreaterThan(4);
    for (let index = 1; index < weaponTicks.length; index++) {
      expect(
        (weaponTicks[index] as number) - (weaponTicks[index - 1] as number),
      ).toBeLessThanOrEqual(CHEST_WEAPON_GUARANTEE_TICKS);
    }
    expect(state.nextSpawnTick).toBeGreaterThan(20 * 60 * TICK_RATE);
  });
});

describe("B20 L2 zone risk and deterministic instancing", () => {
  it("pins scar weighting above commons for weapon quality and rare relics", () => {
    expect(SCAR_CHEST_WEIGHTS.weaponChance).toBeGreaterThan(COMMONS_CHEST_WEIGHTS.weaponChance);
    expect(SCAR_CHEST_WEIGHTS.relicChance).toBeGreaterThan(COMMONS_CHEST_WEIGHTS.relicChance);
    expect(SCAR_CHEST_WEIGHTS.rareRelicChance).toBeGreaterThan(
      COMMONS_CHEST_WEIGHTS.rareRelicChance,
    );
    expect(SCAR_CHEST_WEIGHTS.tierWeights[2]).toBeGreaterThan(COMMONS_CHEST_WEIGHTS.tierWeights[2]);

    const sample = (
      zone: typeof MAP_ZONE_COMMONS | typeof MAP_ZONE_SCAR,
      elapsedSeconds: number,
    ) => {
      let rare = 0;
      let high = 0;
      for (let index = 0; index < 2_000; index++) {
        const reward = rollChestReward({
          roomSeed: 0x7a0e20,
          chestSequence: index,
          spawnTick: index * 1_100,
          elapsedSeconds,
          zone,
          kind: CHEST_KIND_STANDARD,
          playerKey: `weight-${index}`,
          weaponIds: WEAPON_IDS,
        });
        if (reward.relics.some((relic) => relic.rarity === "rare")) rare++;
        if (reward.weapon?.tier === "high") high++;
      }
      return { rare, high };
    };
    const commons = sample(MAP_ZONE_COMMONS, 0);
    const scar = sample(MAP_ZONE_SCAR, 0);
    const lateCommons = sample(MAP_ZONE_COMMONS, 1_200);
    expect(scar.rare).toBeGreaterThan(commons.rare);
    expect(scar.high).toBeGreaterThan(commons.high);
    expect(lateCommons.high).toBeGreaterThan(commons.high);
  });

  it("produces reproducible per-player rolls without sharing one co-op receipt", () => {
    const input = {
      roomSeed: 0x12345678,
      chestSequence: 9,
      spawnTick: 4_200,
      elapsedSeconds: 330,
      zone: MAP_ZONE_SCAR,
      kind: CHEST_KIND_WEAPON_CACHE,
      weaponIds: WEAPON_IDS,
    } as const;
    const openerA = rollChestReward({ ...input, playerKey: "player-a" });
    expect(rollChestReward({ ...input, playerKey: "player-a" })).toEqual(openerA);

    const receipts = new Set(
      Array.from({ length: 12 }, (_, index) =>
        JSON.stringify(rollChestReward({ ...input, playerKey: `player-${index}` })),
      ),
    );
    expect(receipts.size).toBeGreaterThan(1);
  });

  it("places repeatably on valid ground outside pits and POIs", () => {
    const map = generateArena({
      seedTerrain: 101,
      seedHazard: 202,
      seedTheme: 303,
      seedDecor: 404,
    });
    const a = placeChestOnArena(map, 0xc0ffee, 7, 900, []);
    const b = placeChestOnArena(map, 0xc0ffee, 7, 900, []);
    expect(b).toEqual(a);
    expect(isArenaDiscSafe(map, a.x, a.y, 24)).toBe(true);
    expect(isPitAtPx(map, a.x, a.y)).toBe(false);
    expect(isInsidePoi(map, a.x, a.y)).toBe(false);
    expect(Number.isInteger(a.zone)).toBe(true);
  });
});
