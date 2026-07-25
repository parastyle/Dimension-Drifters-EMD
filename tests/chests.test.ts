import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ALL_AUGMENT_IDS,
  advanceChestCadence,
  CHEST_CONTENT_HP_POTION,
  CHEST_CONTENT_MONEY,
  CHEST_CONTENT_PET,
  CHEST_CONTENT_TRINKET,
  CHEST_CONTENT_WEAPON,
  CHEST_FIRST_TICKS,
  CHEST_HP_POTION_HEAL_FRACTION,
  CHEST_KIND_STANDARD,
  CHEST_KIND_WEAPON_CACHE,
  CHEST_WEAPON_GUARANTEE_TICKS,
  COMMONS_CHEST_WEIGHTS,
  chestCadenceInitial,
  chestWeaponTierWeights,
  generateArena,
  isArenaDiscSafe,
  isInsidePoi,
  isPitAtPx,
  MAP_ZONE_COMMONS,
  MAP_ZONE_SCAR,
  placeChestOnArena,
  resolveChestHpPotion,
  rollChestReward,
  SCAR_CHEST_WEIGHTS,
  SCAR_WEAPON_TIER_MULTIPLIERS,
  TICK_RATE,
  TRINKET_AUGMENT_MAPPING,
  WEAPON_TIER_CURVE_ANCHORS,
  WEAPONS,
  type WeaponTier,
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
  it("pins the five-entry table and shifts Scar rolls toward lasting run power", () => {
    expect(Object.keys(COMMONS_CHEST_WEIGHTS.content).sort()).toEqual(
      [
        CHEST_CONTENT_TRINKET,
        CHEST_CONTENT_WEAPON,
        CHEST_CONTENT_PET,
        CHEST_CONTENT_HP_POTION,
        CHEST_CONTENT_MONEY,
      ].sort(),
    );
    expect(
      Object.values(COMMONS_CHEST_WEIGHTS.content).reduce((sum, weight) => sum + weight, 0),
    ).toBe(100);
    expect(Object.values(SCAR_CHEST_WEIGHTS.content).reduce((sum, weight) => sum + weight, 0)).toBe(
      100,
    );
    for (const kind of [CHEST_CONTENT_TRINKET, CHEST_CONTENT_WEAPON, CHEST_CONTENT_PET]) {
      expect(SCAR_CHEST_WEIGHTS.content[kind]).toBeGreaterThan(COMMONS_CHEST_WEIGHTS.content[kind]);
    }
    expect(SCAR_CHEST_WEIGHTS.rareTrinketChance).toBeGreaterThan(
      COMMONS_CHEST_WEIGHTS.rareTrinketChance,
    );
    expect(SCAR_CHEST_WEIGHTS.augmentTrinketChance).toBeGreaterThan(
      COMMONS_CHEST_WEIGHTS.augmentTrinketChance,
    );
    expect(SCAR_WEAPON_TIER_MULTIPLIERS[0]).toBeLessThan(1);
    expect(SCAR_WEAPON_TIER_MULTIPLIERS[4]).toBeGreaterThan(1);

    const sample = (zone: typeof MAP_ZONE_COMMONS | typeof MAP_ZONE_SCAR) => {
      let rare = 0;
      let augmentBearing = 0;
      const kinds = new Map<string, number>();
      for (let index = 0; index < 5_000; index++) {
        const reward = rollChestReward({
          roomSeed: 0x7a0e20,
          chestSequence: index,
          spawnTick: index * 1_100,
          elapsedSeconds: 0,
          zone,
          kind: CHEST_KIND_STANDARD,
          playerKey: `weight-${index}`,
          weaponIds: ACTIVE_WEAPON_CATALOG_IDS,
        });
        kinds.set(reward.content, (kinds.get(reward.content) ?? 0) + 1);
        if (reward.trinket?.rarity === "rare") rare++;
        if (reward.trinket?.augmentId) augmentBearing++;
        if (reward.weapon) expect(reward.weapon.tier).toBe(WEAPONS[reward.weapon.id]?.tier);
      }
      return { rare, augmentBearing, kinds };
    };
    const commons = sample(MAP_ZONE_COMMONS);
    const scar = sample(MAP_ZONE_SCAR);
    expect(scar.rare).toBeGreaterThan(commons.rare);
    expect(scar.augmentBearing).toBeGreaterThan(commons.augmentBearing);
    for (const kind of [
      CHEST_CONTENT_TRINKET,
      CHEST_CONTENT_WEAPON,
      CHEST_CONTENT_PET,
      CHEST_CONTENT_HP_POTION,
      CHEST_CONTENT_MONEY,
    ]) {
      expect(commons.kinds.get(kind)).toBeGreaterThan(0);
      expect(scar.kinds.get(kind)).toBeGreaterThan(0);
    }
  });

  it("simulates the authored minute 0/5/10/15 tier distributions", () => {
    const sample = (minute: number): number[] => {
      const counts = [0, 0, 0, 0, 0];
      const samples = 5_000;
      for (let index = 0; index < samples; index++) {
        const reward = rollChestReward({
          roomSeed: 0xb205c0de,
          chestSequence: index,
          spawnTick: index * 997,
          elapsedSeconds: minute * 60,
          zone: MAP_ZONE_COMMONS,
          kind: CHEST_KIND_WEAPON_CACHE,
          playerKey: `clock-${minute}-${index}`,
          weaponIds: ACTIVE_WEAPON_CATALOG_IDS,
        });
        expect(reward.weapon).toBeDefined();
        counts[(reward.weapon?.tier ?? 1) - 1]++;
      }
      return counts.map((count) => count / samples);
    };

    for (const anchor of WEAPON_TIER_CURVE_ANCHORS) {
      expect(chestWeaponTierWeights(anchor.minute * 60, MAP_ZONE_COMMONS)).toEqual(anchor.weights);
      const observed = sample(anchor.minute);
      for (let index = 0; index < anchor.weights.length; index++) {
        expect(observed[index]).toBeCloseTo((anchor.weights[index] ?? 0) / 100, 1);
      }
    }

    const late = sample(15);
    expect(late[0]).toBeGreaterThan(0);
    expect(late[1]).toBeGreaterThan(0);
    expect(late[3] + late[4]).toBeGreaterThan(0.35);
  });

  it("renormalizes against available authored tiers without mislabeling the reward", () => {
    const onlyTier: WeaponTier = 5;
    const weaponIds = ACTIVE_WEAPON_CATALOG_IDS.filter((id) => WEAPONS[id]?.tier === onlyTier);
    const reward = rollChestReward({
      roomSeed: 5,
      chestSequence: 0,
      spawnTick: 0,
      elapsedSeconds: 0,
      zone: MAP_ZONE_COMMONS,
      kind: CHEST_KIND_WEAPON_CACHE,
      playerKey: "tier-five-only",
      weaponIds,
    });
    expect(reward.weapon?.tier).toBe(onlyTier);
    expect(WEAPONS[reward.weapon?.id ?? ""]?.tier).toBe(onlyTier);
  });

  it("produces reproducible per-player rolls without sharing one co-op receipt", () => {
    const input = {
      roomSeed: 0x12345678,
      chestSequence: 9,
      spawnTick: 4_200,
      elapsedSeconds: 330,
      zone: MAP_ZONE_SCAR,
      kind: CHEST_KIND_WEAPON_CACHE,
      weaponIds: ACTIVE_WEAPON_CATALOG_IDS,
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

  it("keeps every authored augment reachable through an explicit trinket mapping", () => {
    const mapped = new Set(Object.values(TRINKET_AUGMENT_MAPPING).flat());
    expect([...mapped].sort()).toEqual([...ALL_AUGMENT_IDS].sort());
  });

  it("heals exactly 35% max HP and clamps overheal", () => {
    expect(CHEST_HP_POTION_HEAL_FRACTION).toBe(0.35);
    expect(resolveChestHpPotion(20, 100)).toEqual({ hp: 55, healed: 35 });
    expect(resolveChestHpPotion(90, 100)).toEqual({ hp: 100, healed: 10 });
    expect(resolveChestHpPotion(100, 100)).toEqual({ hp: 100, healed: 0 });
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
