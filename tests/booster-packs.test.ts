import {
  ACTIVE_WEAPON_CATALOG_IDS,
  createMetaAccountV4,
  createMetaAccountV5,
  DEFAULT_CHARACTER,
  DROP_POOL,
  lockedPackCandidates,
  META_ACCOUNT_VERSION,
  openBoosterPack,
  PACK_PRICES,
  PACK_PULLS,
  PACK_RARITIES,
  packDuplicateRefund,
  PET_IDS,
  petPackRarity,
  sanitizeMetaAccountV5,
  STARTER_PET_ID,
  STARTER_UNLOCKED_CHARACTER_IDS,
  STARTER_UNLOCKED_WEAPON_IDS,
  unlockedWeaponDropPool,
  WEAPON_IDS,
  WEAPON_PACK_RARITY_BY_TIER,
  WEAPONS,
  weaponPackRarity,
  WHOLE_ART_CHARACTERS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("B20 L4 booster pack rarity and pricing", () => {
  it("maps the authored weapon tier field into the documented four rarity bands", () => {
    expect(WEAPON_PACK_RARITY_BY_TIER).toEqual({
      1: "common",
      2: "common",
      3: "uncommon",
      4: "rare",
      5: "legendary",
    });
    const baseline = WEAPONS["rusty-cleaver"];
    expect(baseline).toBeDefined();
    expect(
      ([1, 2, 3, 4, 5] as const).map((tier) =>
        weaponPackRarity({ ...(baseline as NonNullable<typeof baseline>), tier }),
      ),
    ).toEqual(["common", "common", "uncommon", "rare", "legendary"]);
    expect(PET_IDS.map((id) => [id, petPackRarity(id)])).toEqual([
      ["verdant-wing", "common"],
      ["hearth-newt", "common"],
      ["lodestar-moth", "uncommon"],
      ["copper-snail", "uncommon"],
      ["gilded-gecko", "rare"],
      ["brass-crab", "uncommon"],
      ["pale-firefly", "rare"],
      ["slate-tortoise", "legendary"],
    ]);
  });

  it("calculates the locked 50% rarity-weighted duplicate refunds", () => {
    expect(PACK_RARITIES.map((rarity) => packDuplicateRefund("weapon", rarity))).toEqual([
      15, 22, 37, 75,
    ]);
    expect(PACK_RARITIES.map((rarity) => packDuplicateRefund("pet", rarity))).toEqual([
      20, 30, 50, 100,
    ]);
    expect(PACK_RARITIES.map((rarity) => packDuplicateRefund("character", rarity))).toEqual([
      25, 37, 62, 125,
    ]);
  });
});

describe("B20 L4 seeded pack opening", () => {
  it("replays the exact same three-card receipt from the same seed", () => {
    const account = createMetaAccountV5();
    account.scrip = 1_000;
    const first = openBoosterPack(account, "weapon", 0x20_04_0057);
    const replay = openBoosterPack(account, "weapon", 0x20_04_0057);
    expect(first.ok && replay.ok).toBe(true);
    if (!first.ok || !replay.ok) return;
    expect(first.receipt.pulls).toEqual(replay.receipt.pulls);
    expect(first.receipt.pulls).toHaveLength(PACK_PULLS);
    expect(first.receipt.seed).toBe(0x20_04_0057);
    expect(first.account.scrip).toBe(1_000 - PACK_PRICES.weapon + first.receipt.refundTotal);
  });

  it("samples the purchase-time locked pool with replacement and exposes every duplicate refund", () => {
    const account = createMetaAccountV5();
    account.scrip = 500;
    for (const id of PET_IDS) {
      if (id !== "pale-firefly") account.pets[id] = { bondXp: 0 };
    }
    expect(lockedPackCandidates(account, "pet").map((candidate) => candidate.id)).toEqual([
      "pale-firefly",
    ]);
    const opened = openBoosterPack(account, "pet", 77);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.receipt.pulls.map((pull) => [pull.id, pull.duplicate, pull.refund])).toEqual([
      ["pale-firefly", false, 0],
      ["pale-firefly", true, 50],
      ["pale-firefly", true, 50],
    ]);
    expect(opened.receipt.refundTotal).toBe(100);
    expect(opened.account.scrip).toBe(480);
    expect(opened.account.pets["pale-firefly"]).toEqual({ bondXp: 0 });
  });

  it("rejects purchases without bank funds and sold-out collections without mutation", () => {
    const poor = createMetaAccountV5();
    expect(openBoosterPack(poor, "weapon", 1)).toEqual({
      ok: false,
      account: poor,
      reason: "insufficient-funds",
    });
    const complete = createMetaAccountV5();
    complete.scrip = 1_000;
    complete.unlockedCharacters = [...WHOLE_ART_CHARACTERS];
    expect(openBoosterPack(complete, "character", 1)).toEqual({
      ok: false,
      account: complete,
      reason: "sold-out",
    });
  });
});

describe("B20 L4 starter and persistence laws", () => {
  it("ships a valid 74-weapon, 58-family starter set containing every base/default weapon", () => {
    expect(STARTER_UNLOCKED_WEAPON_IDS).toHaveLength(74);
    expect(new Set(STARTER_UNLOCKED_WEAPON_IDS).size).toBe(74);
    expect(STARTER_UNLOCKED_WEAPON_IDS).toContain("rusty-cleaver");
    expect(STARTER_UNLOCKED_WEAPON_IDS.every((id) => ACTIVE_WEAPON_CATALOG_IDS.includes(id))).toBe(
      true,
    );
    expect(WEAPON_IDS.every((id) => STARTER_UNLOCKED_WEAPON_IDS.includes(id))).toBe(true);
    const families = new Set(
      STARTER_UNLOCKED_WEAPON_IDS.map(
        (id) => WEAPONS[id]?.tags.family ?? WEAPONS[id]?.tags.classPool,
      ),
    );
    expect(families.size).toBeGreaterThanOrEqual(58);

    expect(STARTER_UNLOCKED_CHARACTER_IDS).toHaveLength(6);
    expect(STARTER_UNLOCKED_CHARACTER_IDS).toContain(DEFAULT_CHARACTER);
    expect(STARTER_UNLOCKED_CHARACTER_IDS.every((id) => WHOLE_ART_CHARACTERS.includes(id))).toBe(
      true,
    );
    expect(createMetaAccountV5().pets).toHaveProperty(STARTER_PET_ID);
  });

  it("round-trips balance and new unlocks through the canonical V5 account sanitizer", () => {
    const source = createMetaAccountV5();
    source.scrip = 900;
    const opened = openBoosterPack(source, "character", 4_242);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const roundTrip = sanitizeMetaAccountV5(JSON.parse(JSON.stringify(opened.account)) as unknown);
    expect(roundTrip.version).toBe(META_ACCOUNT_VERSION);
    expect(roundTrip.scrip).toBe(opened.account.scrip);
    expect(new Set(roundTrip.unlockedCharacters)).toEqual(
      new Set(opened.account.unlockedCharacters),
    );
    expect(new Set(roundTrip.unlockedWeapons)).toEqual(new Set(opened.account.unlockedWeapons));
  });

  it("migrates V4, repairs starters, and preserves a banked weapon as unlocked", () => {
    const legacy = createMetaAccountV4();
    const bankedWeapon = DROP_POOL.find((id) => !STARTER_UNLOCKED_WEAPON_IDS.includes(id));
    expect(bankedWeapon).toBeDefined();
    if (!bankedWeapon) return;
    legacy.weaponBank.stash.push({
      kind: "single",
      entryId: "wi_aaaaaaaaaaaaaaaaaaaaaa",
      weapon: {
        instanceId: "wi_aaaaaaaaaaaaaaaaaaaaaa",
        weaponId: bankedWeapon,
        rarity: "common",
        affix: "",
        provenance: "migration-earned",
        sourceWorldTier: 0,
      },
    });
    const migrated = sanitizeMetaAccountV5(legacy);
    expect(migrated.version).toBe(5);
    expect(migrated.unlockedWeapons).toContain(bankedWeapon);
    expect(migrated.unlockedWeapons).toEqual(
      expect.arrayContaining([...STARTER_UNLOCKED_WEAPON_IDS]),
    );
    expect(migrated.unlockedCharacters).toEqual(
      expect.arrayContaining([...STARTER_UNLOCKED_CHARACTER_IDS]),
    );
  });

  it("filters every chest/drop candidate through only that account's active unlocks", () => {
    const account = createMetaAccountV5();
    const locked = ACTIVE_WEAPON_CATALOG_IDS.find((id) => !account.unlockedWeapons.includes(id));
    expect(locked).toBeDefined();
    if (!locked) return;
    expect(unlockedWeaponDropPool(account)).not.toContain(locked);
    account.unlockedWeapons.push(locked);
    expect(unlockedWeaponDropPool(account)).toContain(locked);
    expect(
      unlockedWeaponDropPool(account).every((id) => ACTIVE_WEAPON_CATALOG_IDS.includes(id)),
    ).toBe(true);
  });
});
