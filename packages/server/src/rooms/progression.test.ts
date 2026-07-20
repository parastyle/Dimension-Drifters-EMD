import {
  ATTRS,
  applyCastGradeFloor,
  augmentGateForWeapon,
  CAST_GRADE_FLOOR,
  CAST_GRADE_FLOOR_ENABLED,
  CHARACTER_LINEAGE,
  CON_HP_PER,
  defaultFlexAttr,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  PLAYABLE_CHARACTERS,
  PlayerState,
  POINTS_PER_LEVEL,
  quirkForCharacter,
  SIGNATURE_INTERVAL,
  spreadForCharacter,
  WEAPONS,
  type WeaponDef,
  xpToNextLevel,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { allocate, applyAllocationChoice, consumeFlex, levelUpPlayer } from "./progression.js";

// §12 the per-run progression maths (XP → level → auto-allocation → flex/signature owed) are the most
// consequential per-tick mutations and had ZERO direct coverage (only pure deriveStats was tested). An
// off-by-one in the level loop or a dropped flex point silently corrupts every run.

const fresh = () => new PlayerState(); // defaults: level 1, xp 0, xpToNext 6, 1/1/1/1/1, hp/maxHp 100

describe("levelUpPlayer (§12)", () => {
  it("a single level: carries the xp remainder, preserves stats until one +2/+1 decision", () => {
    const p = fresh();
    p.runCharacter = "cc-asha-the-ash-walker";
    levelUpPlayer(p, p.xpToNext); // exactly one level's worth
    expect(p.level).toBe(2);
    expect(p.xp).toBe(0);
    expect(ATTRS.map((attr) => p[attr])).toEqual([1, 1, 1, 1, 1]); // no class auto-growth
    expect(p.flexPending).toBe(1);
    expect(applyAllocationChoice(p, "str")).toBe("dex"); // +2 STR, then ATTRS-first lowest ballast
    expect(ATTRS.map((attr) => p[attr])).toEqual([3, 2, 1, 1, 1]);
    expect(p.xpToNext).toBeCloseTo(xpToNextLevel(2), 6);
    expect(p.flexTimer).toBe(LEVELUP_WINDOW_SECONDS);
  });

  it("carries the leftover xp below the next threshold", () => {
    const p = fresh();
    levelUpPlayer(p, p.xpToNext + 4); // one level + a 4-xp remainder (< the new, larger xpToNext)
    expect(p.level).toBe(2);
    expect(p.xp).toBe(4);
  });

  it("a multi-level single call owes one flex point per level gained", () => {
    const p = fresh();
    levelUpPlayer(p, 100); // several levels in one grant
    expect(p.level).toBeGreaterThan(2);
    expect(p.flexPending).toBe(p.level - 1); // one per level over the L1 start
    expect(p.xp).toBeLessThan(p.xpToNext); // never leaves the player over the threshold
  });

  it("grants exactly one signature pick at each 5th level", () => {
    const p = fresh();
    // enough to blow past the cap → every multiple-of-5 level (5,10,…,30) granted one sig
    levelUpPlayer(p, 1e9);
    expect(p.level).toBe(LEVEL_CAP);
    expect(p.sigPending).toBe(Math.floor(LEVEL_CAP / SIGNATURE_INTERVAL)); // 30/5 = 6
  });

  it("clamps at LEVEL_CAP, zeroes leftover xp, and a further grant is a no-op", () => {
    const p = fresh();
    levelUpPlayer(p, 1e9);
    expect(p.level).toBe(LEVEL_CAP);
    expect(p.xp).toBe(0);
    const before = { level: p.level, xp: p.xp, str: p.str };
    levelUpPlayer(p, 1e9); // capped → nothing changes
    expect({ level: p.level, xp: p.xp, str: p.str }).toEqual(before);
  });
});

describe("allocate (§12 CON → maxHp)", () => {
  it("raising CON raises maxHp by CON_HP_PER and tops up current hp by the same delta", () => {
    const p = fresh();
    allocate(p, "con", 1);
    expect(p.maxHp).toBe(100 + CON_HP_PER);
    expect(p.hp).toBe(100 + CON_HP_PER);
  });

  it("a hurt player gains only the maxHp DELTA, not a full heal", () => {
    const p = fresh();
    p.hp = 50;
    allocate(p, "con", 1);
    expect(p.maxHp).toBe(100 + CON_HP_PER);
    expect(p.hp).toBe(50 + CON_HP_PER); // gained the +8, still hurt
  });
});

describe("consumeFlex (§12 pick window)", () => {
  it("decrements pending and refreshes the window while more picks are owed, closes it when done", () => {
    const p = fresh();
    p.flexPending = 2;
    consumeFlex(p);
    expect(p.flexPending).toBe(1);
    expect(p.flexTimer).toBe(LEVELUP_WINDOW_SECONDS); // still owed → window stays open
    consumeFlex(p);
    expect(p.flexPending).toBe(0);
    expect(p.flexTimer).toBe(0); // nothing owed → window closes
  });

  it("keeps the window open for a still-owed signature pick", () => {
    const p = fresh();
    p.flexPending = 1;
    p.sigPending = 1;
    consumeFlex(p);
    expect(p.flexPending).toBe(0);
    expect(p.flexTimer).toBe(LEVELUP_WINDOW_SECONDS); // sig still owed → window stays open
  });
});

// §classmerge replacement for the dissolved class-growth premise: identity is seeded by the spread.
describe("§classmerge character spreads replace class growth", () => {
  it("the default Drifter is the flat sum-10 control spread", () => {
    expect(spreadForCharacter("drifter")).toEqual({ str: 2, dex: 2, int: 2, con: 2, luk: 2 });
  });
  it("former caster/scoundrel/duelist/warden lineages seed their authored, equal-budget spreads", () => {
    expect(spreadForCharacter("cc-pyra-cinderhowl-the-flame-caster")).toEqual({
      str: 2,
      dex: 2,
      int: 4,
      con: 1,
      luk: 1,
    });
    expect(spreadForCharacter("cc-the-bandida-la-sombra")).toEqual({
      str: 2,
      dex: 3,
      int: 1,
      con: 1,
      luk: 3,
    });
    expect(spreadForCharacter("cc-s-jiro-the-wayward-blade")).toEqual({
      str: 3,
      dex: 4,
      int: 1,
      con: 1,
      luk: 1,
    });
    expect(spreadForCharacter("cc-sir-galloway-the-unbending")).toEqual({
      str: 2,
      dex: 1,
      int: 1,
      con: 4,
      luk: 2,
    });
  });
});

describe("§classmerge allocation and migration invariants", () => {
  it("resolves +2 chosen and +1 current-lowest ballast while preserving one decision", () => {
    const p = fresh();
    p.runCharacter = "cc-asha-the-ash-walker";
    p.str = 4;
    p.dex = 3;
    p.int = 2;
    p.con = 2;
    p.luk = 1;
    const ballast = applyAllocationChoice(p, "dex");
    expect(ballast).toBe("luk");
    expect({ str: p.str, dex: p.dex, int: p.int, con: p.con, luk: p.luk }).toEqual({
      str: 4,
      dex: 5,
      int: 2,
      con: 2,
      luk: 2,
    });
  });

  it("keeps old per-level income and the non-Drifter mono-stat ceiling inside the 62 envelope", () => {
    const p = fresh();
    p.character = "cc-raijin-k-the-storm-fist";
    p.runCharacter = p.character;
    Object.assign(p, spreadForCharacter(p.runCharacter));
    const before = ATTRS.reduce((sum, attr) => sum + p[attr], 0);
    levelUpPlayer(p, 1e9);
    while (p.flexPending > 0) {
      applyAllocationChoice(p, "str");
      consumeFlex(p);
    }
    const after = ATTRS.reduce((sum, attr) => sum + p[attr], 0);
    expect(after - before).toBe((LEVEL_CAP - 1) * POINTS_PER_LEVEL);
    expect(p.str).toBe(62);
    expect(after).toBe(97);
  });

  it("applies the Drifter's Unwritten ballast bend without changing total income", () => {
    const p = fresh();
    p.runCharacter = "drifter";
    const before = ATTRS.reduce((sum, attr) => sum + p[attr], 0);
    expect(applyAllocationChoice(p, "int")).toBe("int");
    expect(p.int).toBe(4);
    expect(ATTRS.reduce((sum, attr) => sum + p[attr], 0) - before).toBe(POINTS_PER_LEVEL);
  });

  it("covers every playable id with lineage, a sum-10 1..4 spread, and one quirk", () => {
    for (const id of PLAYABLE_CHARACTERS) {
      const spread = spreadForCharacter(id);
      expect(CHARACTER_LINEAGE[id]).toBeDefined();
      expect(ATTRS.reduce((sum, attr) => sum + spread[attr], 0)).toBe(10);
      for (const attr of ATTRS) expect(spread[attr]).toBeGreaterThanOrEqual(1);
      for (const attr of ATTRS) expect(spread[attr]).toBeLessThanOrEqual(4);
      expect(quirkForCharacter(id).id).toBeTruthy();
    }
  });

  it("chooses timeout defaults by source grade, ATTRS tie order, and CON fallback", () => {
    expect(defaultFlexAttr(WEAPONS["x-staff-arcane-lance"])).toBe("int");
    expect(defaultFlexAttr({ scalingGrades: { str: "S", dex: "S" } } as WeaponDef)).toBe("str");
    expect(defaultFlexAttr(undefined)).toBe("con");
  });

  it("keeps weapon-class augment gate outputs byte-identical for the fixed six-lane arsenal", () => {
    expect(
      [
        "gravediggers-spade",
        "x-gun-revolver-cannon",
        "x-staff-arcane-lance",
        "x2-voltcaster-machine-pistol",
        "rusty-cleaver",
        "x2-null-grimoire-of-the-hollow-page",
      ].map((id) => [id, augmentGateForWeapon(WEAPONS[id])]),
    ).toEqual([
      ["gravediggers-spade", "parry"],
      ["x-gun-revolver-cannon", "gun"],
      ["x-staff-arcane-lance", "cast"],
      ["x2-voltcaster-machine-pistol", "beam"],
      ["rusty-cleaver", "parry"],
      ["x2-null-grimoire-of-the-hollow-page", "cast+beam"],
    ]);
  });

  it("ships the cast grade floor flag off while pinning its enabled behavior", () => {
    expect(CAST_GRADE_FLOOR_ENABLED).toBe(false);
    expect(applyCastGradeFloor(1.05)).toBe(1.05);
    expect(applyCastGradeFloor(1.05, true)).toBe(CAST_GRADE_FLOOR);
    expect(applyCastGradeFloor(CAST_GRADE_FLOOR + 0.2, true)).toBeCloseTo(CAST_GRADE_FLOOR + 0.2);
  });

  it("declares roll-dependent descriptors inert until wave 21b owns their seam", () => {
    const coldsnap = quirkForCharacter("cc-cordell-coldsnap-vane");
    expect(coldsnap.availability).toBe("inert");
    expect(coldsnap.inert?.requires).toBe("dodge-roll");
    expect(coldsnap.hooks?.onRollEnd?.({})).toEqual([{ kind: "reload-held-gun" }]);
  });
});

// ULT U1 — appended authoritative allocation law coverage.
const ultimateShared = await import("@dd/shared");
const ultimateProgression = await import("./progression.js");

describe("ULT U1 allocation-frequency attunement and temper", () => {
  it("locks the family on the fifth +2/+1 decision and counts ballast in allocRun", () => {
    const p = fresh();
    p.runCharacter = "drifter";
    for (let i = 0; i < 4; i++) applyAllocationChoice(p, "str");
    expect(ATTRS.reduce((sum, attr) => sum + p.allocRun[attr], 0)).toBe(12);
    expect(p.ultArchetype).toBe(0);
    applyAllocationChoice(p, "str");
    expect(p.allocRun.str).toBe(15); // Drifter ballast follows the chosen attribute.
    expect(ultimateShared.ultimateFamilyForCode(p.ultArchetype)).toBe(
      ultimateShared.UltimateFamily.Seismarch,
    );
    expect(ultimateShared.ultimateVariantForCode(p.ultArchetype)).toBe("dex");
  });

  it("keeps the family locked, drifts only after an overtaking allocation, and tempers at 30", () => {
    const p = fresh();
    p.runCharacter = "drifter";
    for (let i = 0; i < 5; i++) applyAllocationChoice(p, "str");
    const family = p.ultFamily;
    for (let i = 0; i < 5; i++) applyAllocationChoice(p, "int");
    expect(ATTRS.reduce((sum, attr) => sum + p.allocRun[attr], 0)).toBe(30);
    expect(p.ultFamily).toBe(family);
    expect(p.ultVariant).toBe("int");
    expect(p.ultTempered).toBe(true);
    applyAllocationChoice(p, "luk");
    expect(p.ultVariant).toBe("int"); // post-temper allocations cannot rewrite the variant.
  });

  it("applies spread bias, raw totals, then ATTRS order for replay-stable ties", () => {
    const spreadBias = fresh();
    spreadBias.runCharacter = "cc-pyra-cinderhowl-the-flame-caster";
    for (const attr of ATTRS) spreadBias.allocRun[attr] = 3;
    ultimateProgression.evaluateUltimateAllocation(spreadBias);
    expect(ultimateShared.ultimateFamilyForCode(spreadBias.ultArchetype)).toBe(
      ultimateShared.UltimateFamily.SunspiteComet,
    );
    expect(spreadBias.ultVariant).toBe("str");

    const rawTie = fresh();
    rawTie.runCharacter = "drifter";
    for (const attr of ATTRS) rawTie.allocRun[attr] = 3;
    rawTie.luk = 9;
    ultimateProgression.evaluateUltimateAllocation(rawTie);
    expect(ultimateShared.ultimateFamilyForCode(rawTie.ultArchetype)).toBe(
      ultimateShared.UltimateFamily.DimensionDoor,
    );
    expect(rawTie.ultVariant).toBe("str");
  });
});

// Pet P1 — appended pure account/catalog/progression contract coverage.
const petShared = await import("@dd/shared");

describe("pet v1 account sanitization and deterministic progression", () => {
  it("drops unknown/malformed rows, clamps NaN/huge XP, and falls back from an unowned selection", () => {
    const account = petShared.sanitizeMetaAccountV2({
      version: 2,
      revision: -4,
      scrip: Number.POSITIVE_INFINITY,
      upgrades: { vitality: 99, fortune: -3, power: "2.9" },
      pets: {
        "unknown-pet": { bondXp: 300 },
        "hearth-newt": "malformed",
        "gilded-gecko": { bondXp: Number.NaN },
        "brass-crab": { bondXp: 1e30 },
        "copper-snail": null,
      },
      selectedPetId: "copper-snail",
      slateTortoisePityMisses: 99,
    });
    expect(account).toEqual({
      version: 2,
      revision: 0,
      scrip: 0,
      upgrades: { vitality: 3, fortune: 0, power: 2 },
      pets: {
        "verdant-wing": { bondXp: 0 },
        "gilded-gecko": { bondXp: 0 },
        "brass-crab": { bondXp: 3600 },
      },
      selectedPetId: "verdant-wing",
      slateTortoisePityMisses: 7,
    });
    expect(petShared.petLevelForXp(account.pets["gilded-gecko"]?.bondXp)).toBe(1);
    expect(petShared.petLevelForXp(account.pets["brass-crab"]?.bondXp)).toBe(10);
  });

  it("rejects unsupported/malformed account versions as a safe starter record", () => {
    expect(
      petShared.sanitizeMetaAccountV2({ version: 3, pets: { "brass-crab": { bondXp: 3600 } } }),
    ).toEqual(petShared.createMetaAccountV2());
    expect(petShared.sanitizeMetaAccountV2(["not", "an", "account"])).toEqual(
      petShared.createMetaAccountV2(),
    );
  });

  it("pins every lifetime threshold and derives stage/capstone goldens at levels 1, 9, and 10", () => {
    expect(petShared.PET_BOND_XP_THRESHOLDS).toEqual([
      0, 120, 300, 540, 840, 1200, 1620, 2100, 2700, 3600,
    ]);
    expect(petShared.PET_BOND_XP_THRESHOLDS.map((xp) => petShared.petLevelForXp(xp))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(petShared.petLevelForXp(3599)).toBe(9);
    expect([1, 9, 10].map(petShared.petStageBandForLevel)).toEqual([1, 3, 3]);
    expect([1, 9, 10].map(petShared.petHasCapstone)).toEqual([false, false, true]);
  });

  it("resolves all eight approved roster formulas at levels 1/9/10", () => {
    const mods = (id: (typeof petShared.PET_IDS)[number]) =>
      [1, 9, 10].map((level) => petShared.petModsForLevel(id, level));
    expect(
      mods("verdant-wing").map((m) => [m.passiveRegenMultiplier, m.weaponChargeCapacityAdd]),
    ).toEqual([
      [1.05, 0],
      [1.45, 0],
      [1.5, 1],
    ]);
    expect(
      mods("hearth-newt").map((m) => [m.healingReceivedMultiplier, m.descentHealMaxHpFraction]),
    ).toEqual([
      [1.02, 0],
      [1.18, 0],
      [1.2, 0.15],
    ]);
    expect(mods("lodestar-moth").map((m) => [180 + m.xpMoteReachAdd, m.boundaryEchoReach])).toEqual(
      [
        [198, 0],
        [342, 0],
        [360, 600],
      ],
    );
    expect(mods("copper-snail").map((m) => [m.earnedPickupRadius, m.bagCapacityAdd])).toEqual([
      [50, 0],
      [82, 0],
      [86, 1],
    ]);
    expect(mods("gilded-gecko").map((m) => [m.saleBonusRate, m.saleBonusCap])).toEqual([
      [0.02, 2],
      [0.18, 18],
      [0.2, 30],
    ]);
    expect(mods("brass-crab").map((m) => [m.reloadDurationMultiplier, m.stowedReloadRate])).toEqual(
      [
        [0.99, 1],
        [0.91, 1],
        [0.9, 1.25],
      ],
    );
    expect(mods("pale-firefly").map((m) => [96 + m.reviveReachAdd, m.reviveHpFraction])).toEqual([
      [102, 0],
      [150, 0],
      [156, 0.4],
    ]);
    expect(
      mods("slate-tortoise").map((m) => [m.groundHazardDamageMultiplier, m.pitRegenMultiplier]),
    ).toEqual([
      [0.985, 1],
      [0.865, 1],
      [0.85, 1.5],
    ]);
  });

  it("banks only bounded XP into an owned row and discards overflow at level 10", () => {
    const account = petShared.createMetaAccountV2();
    account.pets["verdant-wing"]!.bondXp = 3500;
    const first = ultimateProgression.bankPetBondXp(account, "verdant-wing", 999999);
    expect(first).toMatchObject({
      earnedBondXp: 500,
      awardedBondXp: 100,
      newBondXp: 3600,
      newLevel: 10,
    });
    const maxed = ultimateProgression.bankPetBondXp(account, "verdant-wing", 500);
    expect(maxed).toMatchObject({ awardedBondXp: 0, oldLevel: 10, newLevel: 10 });
  });
});

describe("gear G1/G2 shared catalog, account, and allocation laws", () => {
  it("ships the 96 authored launch rows with closed slots/codes and enforces every slot budget", () => {
    expect(petShared.GEAR_SLOTS).toEqual([
      "hat",
      "glasses",
      "facialHair",
      "head",
      "torso",
      "gloves",
      "boots",
      "cloak",
    ]);
    expect(petShared.LAUNCH_GEAR_IDS).toHaveLength(96);
    expect(petShared.GEAR_IDS).toHaveLength(113);
    const codes = new Set<number>();
    for (const id of petShared.GEAR_IDS) {
      const item: import("@dd/shared").GearDef = petShared.GEAR_CATALOG[id];
      expect(item.id).toBe(id);
      expect(item.artKey.length).toBeGreaterThan(0);
      expect(codes.has(item.netCode)).toBe(false);
      codes.add(item.netCode);
      if (item.budgetUnits > petShared.GEAR_SLOT_BUDGETS[item.slot]) {
        expect({ id, exception: item.budgetException }).toEqual({
          id: "ironhand-gloves",
          exception: "legacy-upgrade-rank-3",
        });
      }
      if (item.quirkRef) expect(["hat", "head"]).toContain(item.slot);
      expect(petShared.gearForNetCode(item.netCode)?.id).toBe(id);
    }
  });

  it("reconstructs all twelve launch spreads and leaves the blank starter at flat 2s with no quirk", () => {
    const expected = {
      "ash-walker": [2, 2, 2, 3, 1],
      "ashen-crusader": [3, 1, 1, 4, 1],
      "molten-core": [2, 1, 4, 2, 1],
      coldsnap: [1, 3, 1, 2, 3],
      graveside: [2, 2, 2, 1, 3],
      "nine-veils": [1, 2, 4, 1, 2],
      "demon-mask": [3, 2, 1, 3, 1],
      thornwatch: [2, 4, 1, 2, 1],
      "neon-mirage": [1, 4, 1, 2, 2],
      "house-edge": [1, 2, 1, 2, 4],
      unbending: [2, 1, 1, 4, 2],
      pressurized: [1, 2, 4, 2, 1],
    } as const;
    for (const [setId, spread] of Object.entries(expected)) {
      const loadout: Record<import("@dd/shared").GearSlot, import("@dd/shared").GearId> = {
        ...petShared.STARTER_GEAR_LOADOUT,
      };
      for (const slot of petShared.GEAR_SLOTS) {
        const suffix = slot === "facialHair" ? "facial-hair" : slot === "torso" ? "shirt" : slot;
        const id = `${setId}-${suffix}`;
        expect(petShared.isGearId(id)).toBe(true);
        if (petShared.isGearId(id)) loadout[slot] = id;
      }
      const runtime = petShared.resolveGearLoadout(loadout);
      expect(petShared.ATTRS.map((attr) => runtime.baseStats[attr])).toEqual(spread);
      expect(petShared.ATTRS.reduce((sum, attr) => sum + runtime.baseStats[attr], 0)).toBe(10);
    }
    const blank = petShared.resolveGearLoadout(petShared.STARTER_GEAR_LOADOUT);
    expect(blank.baseStats).toEqual({ str: 2, dex: 2, int: 2, con: 2, luk: 2 });
    expect(blank.quirk.id).toBe("none");
  });

  it("canonicalizes unknown, unowned, wrong-slot, duplicate, extra, and malformed account claims", () => {
    const account = petShared.sanitizeMetaAccountV3({
      version: 3,
      revision: 1e30,
      scrip: Number.NaN,
      pets: { "brass-crab": { bondXp: 1e30 }, constructor: { bondXp: 99 } },
      selectedPetId: "unknown-pet",
      slateTortoisePityMisses: 99,
      ownedGear: ["neon-mirage-hat", "neon-mirage-hat", "unknown-gear", 7],
      equippedGear: {
        hat: "neon-mirage-hat",
        glasses: "neon-mirage-hat",
        facialHair: "unknown-gear",
        shirt: "mended-workshirt",
        gloves: "blank-drifter-gloves",
        pants: "blank-drifter-pants",
        boots: "blank-drifter-boots",
        cloak: "blank-drifter-cloak",
        prototype: "pressurized-hat",
      },
      stats: { str: 999 },
      mods: { drawLockMult: -100 },
      quirkRef: "package-deal",
    });
    expect(account.version).toBe(3);
    expect(account.revision).toBe(0xffffffff);
    expect(account.scrip).toBe(0);
    expect(account.pets).toEqual({
      "verdant-wing": { bondXp: 0 },
      "brass-crab": { bondXp: 3600 },
    });
    expect(account.selectedPetId).toBe("verdant-wing");
    expect(account.slateTortoisePityMisses).toBe(7);
    expect(account.ownedGear).toEqual([...petShared.STARTER_GEAR_IDS, "neon-mirage-hat"]);
    expect(account.equippedGear).toEqual({
      ...petShared.STARTER_GEAR_LOADOUT,
      head: "neon-mirage-hat",
    });
    expect(Object.keys(account).sort()).toEqual([
      "equippedGear",
      "ownedGear",
      "pets",
      "revision",
      "scrip",
      "selectedPetId",
      "slateTortoisePityMisses",
      "version",
    ]);
    expect(petShared.sanitizeMetaAccountV3({ version: 3, ownedGear: {} }).ownedGear).toEqual([
      ...petShared.STARTER_GEAR_IDS,
    ]);
    expect(
      petShared.sanitizeMetaAccountV3({ version: 99, ownedGear: ["neon-mirage-hat"] }),
    ).toEqual(petShared.createMetaAccountV3());
  });

  it("migrates META_UPGRADES once into visible highest-rank gear and never stores invisible levels", () => {
    const old = petShared.createMetaAccountV2();
    old.revision = 41;
    old.scrip = 321;
    old.upgrades = { vitality: 2, fortune: 3, power: 1 };
    old.pets["hearth-newt"] = { bondXp: 840 };
    old.selectedPetId = "hearth-newt";
    old.slateTortoisePityMisses = 6;
    const migrated = petShared.sanitizeMetaAccountV3(old);
    expect(migrated).toMatchObject({
      version: 3,
      revision: 41,
      scrip: 321,
      selectedPetId: "hearth-newt",
      slateTortoisePityMisses: 6,
      equippedGear: {
        ...petShared.STARTER_GEAR_LOADOUT,
        torso: "reinforced-workshirt",
        glasses: "loaded-readers",
        gloves: "work-gloves",
      },
    });
    expect(migrated.ownedGear).toEqual([
      ...petShared.STARTER_GEAR_IDS,
      "reinforced-workshirt",
      "loaded-readers",
      "work-gloves",
    ]);
    expect("upgrades" in migrated).toBe(false);
    expect(petShared.sanitizeMetaAccountV3(migrated)).toEqual(migrated);
  });

  it("migrates every retired pants ownership row to its torso and silently drops equipped pants", () => {
    for (const [pantsId, torsoId] of Object.entries(petShared.LEGACY_PANTS_TO_TORSO)) {
      const account = petShared.sanitizeMetaAccountV4({
        ...petShared.createMetaAccountV4(),
        revision: 17,
        ownedGear: [pantsId],
        equippedGear: {
          hat: "blank-drifter-hat",
          glasses: "blank-drifter-glasses",
          facialHair: "blank-drifter-facial-hair",
          shirt: torsoId,
          gloves: "blank-drifter-gloves",
          pants: pantsId,
          boots: "blank-drifter-boots",
          cloak: "blank-drifter-cloak",
        },
      });
      expect(account.revision).toBe(17);
      expect(account.ownedGear).toContain(torsoId);
      expect(account.ownedGear).not.toContain(pantsId);
      expect(account.equippedGear.torso).toBe(torsoId);
      expect(account.equippedGear.head).toBe("blank-drifter-head");
      expect("pants" in account.equippedGear).toBe(false);
    }
  });

  it("uses the identical old quirk object/modifier seam when a signature head carries that quirk", () => {
    const loadout = { ...petShared.STARTER_GEAR_LOADOUT, head: "ash-walker-hat" } as const;
    const gear = petShared.resolveGearLoadout(loadout);
    const legacy = petShared.quirkForCharacter("cc-asha-the-ash-walker");
    expect(gear.quirk).toBe(legacy);
    expect(gear.quirk.hooks?.onParrySuccess?.({ parryHeal: 9 })).toEqual(
      legacy.hooks?.onParrySuccess?.({ parryHeal: 9 }),
    );
    const neon = petShared.resolveGearLoadout({
      ...petShared.STARTER_GEAR_LOADOUT,
      head: "neon-mirage-hat",
    });
    expect(neon.mods.drawLockMult).toBe(
      petShared.runtimeModsForQuirk(petShared.quirkForCharacter("cc-neon-mirage")).drawLockMult,
    );
  });

  it("keeps gear and raw attributes outside the ultimate allocation ledger", () => {
    const first = fresh();
    const second = fresh();
    for (const player of [first, second]) {
      player.gearSeeded = true;
      Object.assign(player.allocRun, { str: 6, dex: 3, int: 3, con: 3, luk: 0 });
    }
    Object.assign(first, { str: 20, dex: 1, int: 1, con: 1, luk: 1 });
    Object.assign(second, { str: 1, dex: 1, int: 1, con: 1, luk: 20 });
    ultimateProgression.evaluateUltimateAllocation(first);
    ultimateProgression.evaluateUltimateAllocation(second);
    expect([first.ultArchetype, first.ultFamily, first.ultVariant]).toEqual([
      second.ultArchetype,
      second.ultFamily,
      second.ultVariant,
    ]);
    expect(petShared.ATTRS.reduce((sum, attr) => sum + first.allocRun[attr], 0)).toBe(15);
  });

  it("pins schema 31 while retaining the nested final wire envelope", () => {
    expect(petShared.SCHEMA_VERSION).toBe(33);
    const playerSymbols = Object.getOwnPropertySymbols(petShared.PlayerState);
    const playerMetadata = (
      petShared.PlayerState as unknown as Record<symbol, Record<number, { name: string }>>
    )[playerSymbols[0]!];
    if (!playerMetadata) throw new Error("PlayerState schema metadata is required");
    expect(playerMetadata[63]?.name).toBe("dualWield");
    expect(playerMetadata[64]).toBeUndefined();
    const tailSymbols = Object.getOwnPropertySymbols(petShared.DualWieldState);
    const tailMetadata = (
      petShared.DualWieldState as unknown as Record<symbol, Record<number, { name: string }>>
    )[tailSymbols[0]!];
    if (!tailMetadata) throw new Error("DualWieldState schema metadata is required");
    expect([tailMetadata[4]?.name, tailMetadata[5]?.name]).toEqual(["gearUpper", "gearLower"]);
    const player = new petShared.PlayerState();
    player.gearUpper = "1,2,3,4,5";
    player.gearLower = "6,7,8";
    expect([player.dualWield.gearUpper, player.dualWield.gearLower]).toEqual([
      "1,2,3,4,5",
      "6,7,8",
    ]);
  });
});

// Metagame Wave 2 — appended weapon-bank data, transaction, economy, and prestige laws.
const bankInstanceId = (n: number) => `wi_${n.toString(36).padStart(22, "0")}`;
const bankPairId = (n: number) => `wp_${n.toString(36).padStart(22, "0")}`;
const bankWeapon = (
  n: number,
  weaponId = "rusty-cleaver",
  rarity: import("@dd/shared").WeaponRarityId = "common",
  affix: import("@dd/shared").WeaponAffixId = "",
  tier = 0,
): import("@dd/shared").WeaponInstanceV1 => ({
  instanceId: bankInstanceId(n),
  weaponId,
  rarity,
  affix,
  provenance: "enemy-drop",
  sourceWorldTier: tier,
});
const bankSingle = (
  n: number,
  weaponId = "rusty-cleaver",
  rarity: import("@dd/shared").WeaponRarityId = "common",
  affix: import("@dd/shared").WeaponAffixId = "",
  tier = 0,
): import("@dd/shared").SingleWeaponEntryV1 => {
  const weapon = bankWeapon(n, weaponId, rarity, affix, tier);
  return { kind: "single", entryId: weapon.instanceId, weapon };
};
const bankWith = (...entries: import("@dd/shared").WeaponBankEntryV1[]) => ({
  version: 1 as const,
  shelfUpgrades: 0,
  stash: entries,
  intake: [],
  lastCarry: { placements: [], activeEntryId: "" },
  expedition: null,
});

describe("weapon bank B1 — strict forged-payload boundary", () => {
  it("enforces every forged-legendary rejection row while dropping noncanonical power and price", () => {
    const legal = bankSingle(1, "rusty-cleaver", "legendary", "brutal", 30);
    const cases: Array<[string, unknown]> = [
      ["unknown definition", { ...legal, weapon: { ...legal.weapon, weaponId: "unknown-id" } }],
      ["fists", { ...legal, weapon: { ...legal.weapon, weaponId: "fists" } }],
      ["legendary cursed affix", { ...legal, weapon: { ...legal.weapon, affix: "blessed" } }],
      [
        "cursed normal affix",
        { ...legal, weapon: { ...legal.weapon, rarity: "cursed", affix: "keen" } },
      ],
      ["cursed plain", { ...legal, weapon: { ...legal.weapon, rarity: "cursed", affix: "" } }],
      ["unknown affix", { ...legal, weapon: { ...legal.weapon, affix: "godmode" } }],
      ["numeric rarity", { ...legal, weapon: { ...legal.weapon, rarity: 4 } }],
      ["negative tier", { ...legal, weapon: { ...legal.weapon, sourceWorldTier: -1 } }],
      ["high tier", { ...legal, weapon: { ...legal.weapon, sourceWorldTier: 31 } }],
      ["fractional tier", { ...legal, weapon: { ...legal.weapon, sourceWorldTier: 1.5 } }],
      ["NaN tier", { ...legal, weapon: { ...legal.weapon, sourceWorldTier: Number.NaN } }],
    ];
    const nonCurated = petShared.WEAPON_IDS.find(
      (id) => !petShared.isWeaponAcquisitionAllowed(id, "enemy-drop") && id !== "fists",
    );
    expect(nonCurated).toBeDefined();
    if (nonCurated) {
      cases.push([
        "non-curated enemy drop",
        { ...legal, weapon: { ...legal.weapon, weaponId: nonCurated } },
      ]);
    }
    for (const [name, entry] of cases) {
      expect(petShared.sanitizeWeaponBankV1(bankWith(entry as never)), name).toMatchObject({
        ok: false,
      });
    }

    const extra = {
      ...legal,
      weapon: { ...legal.weapon, damage: 999999, price: 65535, resourceCharges: 99 },
    };
    const accepted = petShared.sanitizeWeaponBankV1(bankWith(extra as never));
    expect(accepted.ok).toBe(true);
    expect(accepted.bank.stash[0]).toEqual(legal);
    expect(
      Object.keys(
        (accepted.bank.stash[0] as import("@dd/shared").SingleWeaponEntryV1).weapon,
      ).sort(),
    ).toEqual(["affix", "instanceId", "provenance", "rarity", "sourceWorldTier", "weaponId"]);
  });

  it("rejects aliases, self/ineligible pairs, future versions, and encoded/cardinality abuse as a unit", () => {
    const duplicate = bankSingle(2);
    expect(petShared.sanitizeWeaponBankV1(bankWith(duplicate, duplicate)).ok).toBe(false);
    const self = bankWeapon(3, "rattler-sabre");
    expect(
      petShared.sanitizeWeaponBankV1(
        bankWith({
          kind: "pair",
          entryId: bankPairId(1),
          lead: self,
          offhand: self,
        }),
      ).ok,
    ).toBe(false);
    const ineligible = {
      kind: "pair" as const,
      entryId: bankPairId(2),
      lead: bankWeapon(4, "rusty-cleaver"),
      offhand: bankWeapon(5, "rusty-cleaver"),
    };
    expect(petShared.sanitizeWeaponBankV1(bankWith(ineligible)).ok).toBe(false);
    expect(petShared.sanitizeWeaponBankV1({ ...bankWith(), version: 2 }).ok).toBe(false);
    expect(
      petShared.sanitizeWeaponBankV1({ ...bankWith(), padding: "x".repeat(193 * 1024) }).errors,
    ).toContain("bank:encoded-size");
    expect(
      petShared.sanitizeWeaponBankV1({ ...bankWith(), stash: new Array(145).fill(duplicate) }).ok,
    ).toBe(false);
  });
});

describe("weapon bank B2 — carry, settlement, pair, sale, and prestige conservation", () => {
  it("moves only selected entries into exact placements and enforces pair span + source-tier promotion", () => {
    const account = petShared.createMetaAccountV4();
    const single = bankSingle(10, "rusty-cleaver", "rare", "keen", 2);
    const pairCandidates = petShared.DROP_POOL.flatMap((lead) =>
      petShared.DROP_POOL.map((offhand) => [lead, offhand] as const),
    ).find(([lead, offhand]) =>
      petShared.pairEligible(petShared.WEAPONS[lead], petShared.WEAPONS[offhand]),
    );
    expect(pairCandidates).toBeDefined();
    if (!pairCandidates) return;
    const pair: import("@dd/shared").PairedWeaponEntryV1 = {
      kind: "pair",
      entryId: bankPairId(10),
      lead: bankWeapon(11, pairCandidates[0], "legendary", "brutal", 4),
      offhand: bankWeapon(12, pairCandidates[1], "rare", "swift", 3),
    };
    const safe = bankSingle(13);
    account.weaponBank.stash.push(single, pair, safe);
    const result = ultimateProgression.commitWeaponCarry(
      account,
      {
        requestId: "carry-1",
        expectedRevision: account.revision,
        placements: [
          { entryId: pair.entryId, zone: "active", start: 0 },
          { entryId: single.entryId, zone: "pack", start: 4 },
        ],
        activeEntryId: pair.entryId,
        requestedWorldTier: 4,
      },
      "run-carry",
      12,
    );
    expect(result).toMatchObject({ ok: true, runTier: 4, movedEntries: 2, movedPhysical: 3 });
    expect(account.weaponBank.stash).toEqual([safe]);
    expect(
      account.weaponBank.expedition?.entries.map((row) => [
        row.entry.entryId,
        row.location,
        row.start,
      ]),
    ).toEqual([
      [pair.entryId, "active", 0],
      [single.entryId, "pack", 4],
    ]);
    expect(account.weaponBank.expedition?.entries[0]?.entry).toEqual(pair);

    const lowTier = petShared.createMetaAccountV4();
    lowTier.weaponBank.stash.push(bankSingle(14, "rusty-cleaver", "common", "", 5));
    expect(
      ultimateProgression.commitWeaponCarry(
        lowTier,
        {
          requestId: "carry-low",
          expectedRevision: 0,
          placements: [{ entryId: bankInstanceId(14), zone: "active", start: 0 }],
          activeEntryId: bankInstanceId(14),
          requestedWorldTier: 4,
        },
        "run-low",
        12,
      ),
    ).toMatchObject({ ok: false, error: "world-tier" });
  });

  it("settles carried+found once, excludes field stakes on victory, and deletes every origin on defeat", () => {
    const victory = petShared.createMetaAccountV4();
    const safe = bankSingle(20);
    const carried = bankSingle(21, "rusty-cleaver", "rare", "keen");
    victory.weaponBank.stash.push(safe, carried);
    expect(
      ultimateProgression.commitWeaponCarry(
        victory,
        {
          requestId: "stake-victory",
          expectedRevision: 0,
          placements: [{ entryId: carried.entryId, zone: "active", start: 0 }],
          activeEntryId: carried.entryId,
          requestedWorldTier: 0,
        },
        "run-victory",
        12,
      ).ok,
    ).toBe(true);
    const foundKept = bankSingle(22, "rusty-cleaver", "legendary", "brutal");
    const foundField = bankSingle(23, "rusty-cleaver", "ultimate", "swift");
    victory.weaponBank.expedition?.entries.push(
      { entry: foundKept, stakeOrigin: "found", location: "pack", start: 0 },
      { entry: foundField, stakeOrigin: "found", location: "field", start: 255 },
    );
    const receipt = ultimateProgression.settleWeaponExpedition(victory, "victory");
    expect(receipt).toMatchObject({
      ok: true,
      returnedEntries: 2,
      returnedPhysical: 2,
      lostEntries: 1,
      lostPhysical: 1,
    });
    expect(victory.weaponBank.stash.map((entry) => entry.entryId)).toEqual([
      safe.entryId,
      carried.entryId,
      foundKept.entryId,
    ]);
    expect(ultimateProgression.settleWeaponExpedition(victory, "victory")).toMatchObject({
      ok: false,
      error: "no-expedition",
    });

    const defeat = petShared.createMetaAccountV4();
    const safeDefeat = bankSingle(24);
    const doomed = bankSingle(25);
    defeat.weaponBank.stash.push(safeDefeat, doomed);
    ultimateProgression.commitWeaponCarry(
      defeat,
      {
        requestId: "stake-defeat",
        expectedRevision: 0,
        placements: [{ entryId: doomed.entryId, zone: "active", start: 0 }],
        activeEntryId: doomed.entryId,
        requestedWorldTier: 0,
      },
      "run-defeat",
      12,
    );
    defeat.weaponBank.expedition?.entries.push({
      entry: bankSingle(26),
      stakeOrigin: "found",
      location: "field",
      start: 255,
    });
    expect(ultimateProgression.settleWeaponExpedition(defeat, "defeat")).toMatchObject({
      ok: true,
      returnedEntries: 0,
      lostEntries: 2,
      lostPhysical: 2,
    });
    expect(defeat.weaponBank.stash).toEqual([safeDefeat]);
  });

  it("persists a pair as one stash entry, sells both components once, and never resurrects on retry", () => {
    const candidates = petShared.DROP_POOL.flatMap((lead) =>
      petShared.DROP_POOL.map((offhand) => [lead, offhand] as const),
    ).find(([lead, offhand]) =>
      petShared.pairEligible(petShared.WEAPONS[lead], petShared.WEAPONS[offhand]),
    );
    expect(candidates).toBeDefined();
    if (!candidates) return;
    const account = petShared.createMetaAccountV4();
    const pair: import("@dd/shared").PairedWeaponEntryV1 = {
      kind: "pair",
      entryId: bankPairId(20),
      lead: bankWeapon(30, candidates[0], "legendary", "brutal"),
      offhand: bankWeapon(31, candidates[1], "rare", "keen"),
    };
    account.weaponBank.stash.push(pair);
    const revision = account.revision;
    const sale = ultimateProgression.sellWeaponBankEntry(account, {
      requestId: "pair-sale",
      expectedRevision: revision,
      entryId: pair.entryId,
      from: "stash",
    });
    expect(sale).toMatchObject({ ok: true, payout: 78 });
    expect(account.weaponBank.stash).toEqual([]);
    const scrip = account.scrip;
    expect(
      ultimateProgression.sellWeaponBankEntry(account, {
        requestId: "pair-sale",
        expectedRevision: revision,
        entryId: pair.entryId,
        from: "stash",
      }).ok,
    ).toBe(false);
    expect(account.scrip).toBe(scrip);
  });

  it("prestige clears stash/intake/pairs/last-carry for zero Scrip while preserving permanent state", () => {
    const account = petShared.createMetaAccountV4();
    account.scrip = 444;
    account.weaponBank.shelfUpgrades = 3;
    const a = bankSingle(40);
    const b = bankSingle(41);
    account.weaponBank.stash.push(a);
    account.weaponBank.intake.push(b);
    account.weaponBank.lastCarry = {
      placements: [{ entryId: a.entryId, zone: "active", start: 0 }],
      activeEntryId: a.entryId,
    };
    const ownedGear = [...account.ownedGear];
    const pets = structuredClone(account.pets);
    expect(ultimateProgression.wipeWeaponBankForPrestige(account)).toMatchObject({
      ok: true,
      removedEntries: 2,
      removedPhysical: 2,
    });
    expect(account).toMatchObject({ prestige: 1, scrip: 444 });
    expect(account.weaponBank).toMatchObject({
      shelfUpgrades: 3,
      stash: [],
      intake: [],
      lastCarry: { placements: [], activeEntryId: "" },
    });
    expect(account.ownedGear).toEqual(ownedGear);
    expect(account.pets).toEqual(pets);
  });
});

describe("weapon bank B3 - account migration, carry bounds, intake, and curator inputs", () => {
  it("migrates the schema-28 gear account to V4 with an empty bank and bounded prestige", () => {
    const gear = petShared.createMetaAccountV3();
    gear.revision = 27;
    gear.scrip = 321;
    gear.ownedGear.push("neon-mirage-hat");
    gear.equippedGear.hat = "neon-mirage-hat";
    const migrated = petShared.sanitizeMetaAccountV4(gear);
    expect(migrated).toMatchObject({
      version: 4,
      revision: 27,
      scrip: 321,
      prestige: 0,
      weaponBank: petShared.createWeaponBankV1(),
    });
    expect(migrated.equippedGear.head).toBe("neon-mirage-hat");
    expect(migrated.equippedGear.hat).toBe("blank-drifter-hat");

    const forged = { ...migrated, prestige: 999 };
    expect(petShared.sanitizeMetaAccountV4(forged).prestige).toBe(30);
  });

  it("accepts exactly three Active plus thirteen Pack cells and rejects a fourteenth Pack cell", () => {
    const account = petShared.createMetaAccountV4();
    const entries = Array.from({ length: 16 }, (_, index) => bankSingle(100 + index));
    account.weaponBank.stash.push(...entries);
    const placements: import("@dd/shared").CarryPlacementV1[] = entries.map((entry, index) => ({
      entryId: entry.entryId,
      zone: index < 3 ? "active" : "pack",
      start: index < 3 ? index : index - 3,
    }));
    expect(
      ultimateProgression.commitWeaponCarry(
        account,
        {
          requestId: "copper-cap",
          expectedRevision: 0,
          placements,
          activeEntryId: entries[0]?.entryId ?? "",
          requestedWorldTier: 0,
        },
        "run-copper-cap",
        13,
      ),
    ).toMatchObject({ ok: true, movedPhysical: 16 });

    const overflow = petShared.createMetaAccountV4();
    const overflowEntries = Array.from({ length: 14 }, (_, index) => bankSingle(130 + index));
    overflow.weaponBank.stash.push(...overflowEntries);
    expect(
      ultimateProgression.commitWeaponCarry(
        overflow,
        {
          requestId: "pack-overflow",
          expectedRevision: 0,
          placements: overflowEntries.map((entry, index) => ({
            entryId: entry.entryId,
            zone: "pack" as const,
            start: index,
          })),
          activeEntryId: "",
          requestedWorldTier: 0,
        },
        "run-pack-overflow",
        13,
      ),
    ).toMatchObject({ ok: false, error: "placement-bounds" });
  });

  it("routes victory overflow to Intake without losing or duplicating an instance", () => {
    const account = petShared.createMetaAccountV4();
    const carried = bankSingle(160);
    const safe = Array.from({ length: 71 }, (_, index) => bankSingle(161 + index));
    account.weaponBank.stash.push(carried, ...safe);
    expect(
      ultimateProgression.commitWeaponCarry(
        account,
        {
          requestId: "intake-overflow",
          expectedRevision: 0,
          placements: [{ entryId: carried.entryId, zone: "active", start: 0 }],
          activeEntryId: carried.entryId,
          requestedWorldTier: 0,
        },
        "run-intake-overflow",
        12,
      ).ok,
    ).toBe(true);
    const filledDuringRun = bankSingle(240);
    account.weaponBank.stash.push(filledDuringRun);
    expect(account.weaponBank.stash).toHaveLength(72);

    expect(ultimateProgression.settleWeaponExpedition(account, "victory")).toMatchObject({
      ok: true,
      returnedEntries: 1,
      returnedPhysical: 1,
    });
    expect(account.weaponBank.stash).toHaveLength(72);
    expect(account.weaponBank.intake).toEqual([carried]);
    expect(
      new Set([
        ...account.weaponBank.stash.map((entry) => entry.entryId),
        ...account.weaponBank.intake.map((entry) => entry.entryId),
      ]).size,
    ).toBe(73);
  });

  it("builds curator copy counts from safe and at-stake holdings, including the starter floor", () => {
    const bank = petShared.createWeaponBankV1();
    bank.stash.push(bankSingle(260, "rattler-sabre"));
    bank.intake.push(bankSingle(261, "rattler-sabre"));
    bank.expedition = {
      runId: "curator-run",
      commitRevision: 0,
      status: "committed",
      entries: [
        {
          entry: bankSingle(262, "x2-gallows-splitter"),
          stakeOrigin: "found",
          location: "pack",
          start: 0,
        },
      ],
    };
    const copies = petShared.countWeaponCopies(bank);
    expect(copies.get("rattler-sabre")).toBe(2);
    expect(copies.get("x2-gallows-splitter")).toBe(1);
    expect(copies.get("rusty-cleaver")).toBe(1);
    expect([
      petShared.weaponCuratorIdentityWeight(0),
      petShared.weaponCuratorIdentityWeight(1),
      petShared.weaponCuratorIdentityWeight(2),
      petShared.weaponCuratorIdentityWeight(3),
    ]).toEqual([3, 1, 0.55, 0.25]);
  });
});

// HEAD-FIT PANEL — append-only persistence law for former full-head hats.
describe("full-head cowl slot invariant", () => {
  it("migrates every legacy cowl into head while preserving only genuine overlays in hat", () => {
    const genuineOverlay = "molten-core-hat" as const;
    for (const cowlId of Object.keys(petShared.LEGACY_FULL_HEAD_HAT_TO_HEAD) as Array<
      keyof typeof petShared.LEGACY_FULL_HEAD_HAT_TO_HEAD
    >) {
      expect(petShared.GEAR_CATALOG[cowlId].slot).toBe("head");
      const migrated = petShared.sanitizeMetaAccountV4({
        ...petShared.createMetaAccountV4(),
        ownedGear: [...petShared.STARTER_GEAR_IDS, cowlId, genuineOverlay],
        equippedGear: {
          ...petShared.STARTER_GEAR_LOADOUT,
          hat: cowlId,
        },
      });
      expect(migrated.equippedGear.head).toBe(cowlId);
      expect(migrated.equippedGear.hat).toBe("blank-drifter-hat");

      const legalPair = petShared.sanitizeMetaAccountV4({
        ...migrated,
        equippedGear: {
          ...migrated.equippedGear,
          head: cowlId,
          hat: genuineOverlay,
        },
      });
      expect(legalPair.equippedGear).toMatchObject({ head: cowlId, hat: genuineOverlay });
    }
    for (const id of petShared.GEAR_IDS) {
      if (petShared.GEAR_CATALOG[id].slot === "hat")
        expect(petShared.LEGACY_FULL_HEAD_HAT_TO_HEAD).not.toHaveProperty(id);
    }
  });
});
