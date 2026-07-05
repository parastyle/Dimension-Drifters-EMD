import {
  AFFIXES,
  affixById,
  BASE_POWER_MEDIAN,
  CURSED_AFFIXES,
  classPowerMedian,
  DROP_BAND_HIGH,
  DROP_BAND_LOW,
  DROP_POOL,
  effectivePower,
  isDropEligible,
  lootCooldownMult,
  lootDamageMult,
  RARITIES,
  RARITY_COMMON,
  RARITY_CURSED,
  rollAffix,
  rollDropWeapon,
  rollRarity,
  salvageValue,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

// §10/§13 v0.104 — the loot spine (audit C5/H7/M3). These pin the LOCKED canon: seven rarity tiers,
// exactly one Terraria affix, cursed as the telegraphed gamble tier, LUK reading into rarity odds, and
// the M3 power budget acting as the automatic curation gate for the 297-weapon expansion.

describe("§10 rarity canon", () => {
  it("exactly SEVEN tiers, in the LOCKED order, Cursed last", () => {
    expect(RARITIES.map((r) => r.id)).toEqual([
      "common",
      "uncommon",
      "rare",
      "really-rare",
      "legendary",
      "ultimate",
      "cursed",
    ]);
    expect(RARITY_COMMON).toBe(0);
    expect(RARITY_CURSED).toBe(6);
  });

  it("damage multipliers rise through the ladder (cursed sits mid-high — its variance is the affix)", () => {
    for (let i = 1; i < RARITY_CURSED; i++) {
      expect(RARITIES[i]?.dmg ?? 0).toBeGreaterThan(RARITIES[i - 1]?.dmg ?? 99);
    }
    expect(RARITIES[RARITY_CURSED]?.dmg).toBeGreaterThan(1);
  });

  it("salvage value rises through the non-cursed ladder (§13 rarity drives the parts value)", () => {
    for (let i = 1; i < RARITY_CURSED; i++) {
      expect(salvageValue(i)).toBeGreaterThan(salvageValue(i - 1));
    }
  });
});

describe("rollRarity (§11 LUK reads into rarity)", () => {
  it("maps the roll across the full ladder (roll 0 → Common, roll→1 → Cursed)", () => {
    expect(rollRarity(0)).toBe(RARITY_COMMON);
    expect(rollRarity(0.999999)).toBe(RARITY_CURSED);
  });

  it("is monotonic in the roll (a higher roll never yields a lower tier)", () => {
    let prev = 0;
    for (let r = 0; r < 1; r += 0.001) {
      const t = rollRarity(r);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it("LUK up-weights the higher tiers — the same roll can only tier-UP with more LUK", () => {
    for (let r = 0.05; r < 1; r += 0.05) {
      expect(rollRarity(r, 10)).toBeGreaterThanOrEqual(rollRarity(r, 1));
    }
    // And it genuinely moves the needle: fewer Commons at LUK 10 than LUK 1 over a sweep.
    let c1 = 0;
    let c10 = 0;
    for (let r = 0; r < 1; r += 0.001) {
      if (rollRarity(r, 1) === RARITY_COMMON) c1++;
      if (rollRarity(r, 10) === RARITY_COMMON) c10++;
    }
    expect(c10).toBeLessThan(c1 * 0.6);
  });
});

describe("rollAffix (§10 exactly one, cursed rolls the gamble table)", () => {
  it("non-cursed tiers roll from the standard table, cursed from the extreme table", () => {
    for (let r = 0; r < 1; r += 0.01) {
      expect(AFFIXES).toContain(rollAffix(r, RARITY_COMMON));
      expect(CURSED_AFFIXES).toContain(rollAffix(r, RARITY_CURSED));
    }
  });

  it("the cursed table contains both jackpots and duds (great-but-dangerous OR sucks-to-have)", () => {
    expect(CURSED_AFFIXES.some((a) => a.dmg > 1.3)).toBe(true);
    expect(CURSED_AFFIXES.some((a) => a.dmg < 0.7)).toBe(true);
  });

  it("affixById resolves both tables and falls back to plain", () => {
    expect(affixById("keen").dmg).toBeGreaterThan(1);
    expect(affixById("doomed").dmg).toBeLessThan(1);
    expect(affixById("no-such-affix")).toBe(AFFIXES[0]);
    expect(affixById("")).toBe(AFFIXES[0]);
  });
});

describe("loot multipliers (WYSIWYG with the server's damage/cooldown)", () => {
  it("a plain Common contributes exactly 1 (no loot = the pre-loot game)", () => {
    expect(lootDamageMult(RARITY_COMMON, "")).toBe(1);
    expect(lootCooldownMult("")).toBe(1);
  });

  it("Legendary Keen hits harder; Swift swings faster; Heavy trades speed for damage", () => {
    expect(lootDamageMult(4, "keen")).toBeCloseTo(1.45 * 1.12, 6);
    expect(lootCooldownMult("swift")).toBeLessThan(1);
    expect(lootDamageMult(RARITY_COMMON, "heavy")).toBeGreaterThan(1);
    expect(lootCooldownMult("heavy")).toBeGreaterThan(1);
  });
});

describe("M3 power budget + H7 drop pool (the automatic curation)", () => {
  it("the base class medians are sane and positive", () => {
    expect(BASE_POWER_MEDIAN).toBeGreaterThan(5);
    for (const cls of ["melee", "ranged", "caster"]) {
      expect(classPowerMedian(cls)).toBeGreaterThan(5);
    }
  });

  it("every DROP_POOL member exists, is not fists, and passes the eligibility gate", () => {
    expect(DROP_POOL.length).toBeGreaterThan(100); // the arsenal fantasy is REAL (was 17)
    for (const id of DROP_POOL) {
      const def = WEAPONS[id];
      expect(def, id).toBeDefined();
      expect(id).not.toBe("fists");
      if (def) expect(isDropEligible(def), id).toBe(true);
    }
  });

  it("every EXPANSION pool member sits inside its class-median band (no printer, no dead stick)", () => {
    for (const id of DROP_POOL) {
      const def = WEAPONS[id];
      if (!def?.expansion) continue;
      const anchor = classPowerMedian(def.tags.classPool);
      const p = effectivePower(def);
      expect(
        p,
        `${id} power ${p.toFixed(1)} vs anchor ${anchor.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(anchor * DROP_BAND_LOW);
      expect(p, `${id}`).toBeLessThanOrEqual(anchor * DROP_BAND_HIGH);
    }
  });

  it("rez/support weapons never enter the RNG pool (they're deliberate picks)", () => {
    expect(DROP_POOL).not.toContain("gravediggers-spade");
  });

  it("rollDropWeapon maps any roll to a real pool member", () => {
    for (let r = 0; r < 1; r += 0.01) {
      expect(DROP_POOL).toContain(rollDropWeapon(r));
    }
  });
});
