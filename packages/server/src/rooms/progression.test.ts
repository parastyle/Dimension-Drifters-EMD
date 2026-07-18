import {
  applyCastGradeFloor,
  ATTRS,
  augmentGateForWeapon,
  CAST_GRADE_FLOOR,
  CAST_GRADE_FLOOR_ENABLED,
  CHARACTER_LINEAGE,
  CON_HP_PER,
  defaultFlexAttr,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  PLAYABLE_CHARACTERS,
  POINTS_PER_LEVEL,
  PlayerState,
  quirkForCharacter,
  SIGNATURE_INTERVAL,
  spreadForCharacter,
  type WeaponDef,
  WEAPONS,
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
    expect(
      defaultFlexAttr({ scalingGrades: { str: "S", dex: "S" } } as WeaponDef),
    ).toBe("str");
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
    expect(applyCastGradeFloor(CAST_GRADE_FLOOR + 0.2, true)).toBeCloseTo(
      CAST_GRADE_FLOOR + 0.2,
    );
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
    expect(petShared.sanitizeMetaAccountV2({ version: 3, pets: { "brass-crab": { bondXp: 3600 } } }))
      .toEqual(petShared.createMetaAccountV2());
    expect(petShared.sanitizeMetaAccountV2(["not", "an", "account"]))
      .toEqual(petShared.createMetaAccountV2());
  });

  it("pins every lifetime threshold and derives stage/capstone goldens at levels 1, 9, and 10", () => {
    expect(petShared.PET_BOND_XP_THRESHOLDS).toEqual([
      0, 120, 300, 540, 840, 1200, 1620, 2100, 2700, 3600,
    ]);
    expect(petShared.PET_BOND_XP_THRESHOLDS.map((xp) => petShared.petLevelForXp(xp)))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(petShared.petLevelForXp(3599)).toBe(9);
    expect([1, 9, 10].map(petShared.petStageBandForLevel)).toEqual([1, 3, 3]);
    expect([1, 9, 10].map(petShared.petHasCapstone)).toEqual([false, false, true]);
  });

  it("resolves all eight approved roster formulas at levels 1/9/10", () => {
    const mods = (id: (typeof petShared.PET_IDS)[number]) =>
      [1, 9, 10].map((level) => petShared.petModsForLevel(id, level));
    expect(mods("verdant-wing").map((m) => [m.passiveRegenMultiplier, m.weaponChargeCapacityAdd]))
      .toEqual([[1.05, 0], [1.45, 0], [1.5, 1]]);
    expect(mods("hearth-newt").map((m) => [m.healingReceivedMultiplier, m.descentHealMaxHpFraction]))
      .toEqual([[1.02, 0], [1.18, 0], [1.2, 0.15]]);
    expect(mods("lodestar-moth").map((m) => [180 + m.xpMoteReachAdd, m.boundaryEchoReach]))
      .toEqual([[198, 0], [342, 0], [360, 600]]);
    expect(mods("copper-snail").map((m) => [m.earnedPickupRadius, m.bagCapacityAdd]))
      .toEqual([[50, 0], [82, 0], [86, 1]]);
    expect(mods("gilded-gecko").map((m) => [m.saleBonusRate, m.saleBonusCap]))
      .toEqual([[0.02, 2], [0.18, 18], [0.2, 30]]);
    expect(mods("brass-crab").map((m) => [m.reloadDurationMultiplier, m.stowedReloadRate]))
      .toEqual([[0.99, 1], [0.91, 1], [0.9, 1.25]]);
    expect(mods("pale-firefly").map((m) => [96 + m.reviveReachAdd, m.reviveHpFraction]))
      .toEqual([[102, 0], [150, 0], [156, 0.4]]);
    expect(mods("slate-tortoise").map((m) => [m.groundHazardDamageMultiplier, m.pitRegenMultiplier]))
      .toEqual([[0.985, 1], [0.865, 1], [0.85, 1.5]]);
  });

  it("banks only bounded XP into an owned row and discards overflow at level 10", () => {
    const account = petShared.createMetaAccountV2();
    account.pets["verdant-wing"]!.bondXp = 3500;
    const first = ultimateProgression.bankPetBondXp(account, "verdant-wing", 999999);
    expect(first).toMatchObject({ earnedBondXp: 500, awardedBondXp: 100, newBondXp: 3600, newLevel: 10 });
    const maxed = ultimateProgression.bankPetBondXp(account, "verdant-wing", 500);
    expect(maxed).toMatchObject({ awardedBondXp: 0, oldLevel: 10, newLevel: 10 });
  });
});

describe("gear G1/G2 shared catalog, account, and allocation laws", () => {
  it("ships the 96 authored launch rows with closed slots/codes and enforces every slot budget", () => {
    expect(petShared.GEAR_SLOTS).toEqual([
      "hat", "glasses", "facialHair", "shirt", "gloves", "pants", "boots", "cloak",
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
      if (item.quirkRef) expect(item.slot).toBe("hat");
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
      const loadout: Record<
        import("@dd/shared").GearSlot,
        import("@dd/shared").GearId
      > = { ...petShared.STARTER_GEAR_LOADOUT };
      for (const slot of petShared.GEAR_SLOTS) {
        const suffix = slot === "facialHair" ? "facial-hair" : slot;
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
    expect(account.ownedGear).toEqual([
      ...petShared.STARTER_GEAR_IDS,
      "neon-mirage-hat",
    ]);
    expect(account.equippedGear).toEqual({
      ...petShared.STARTER_GEAR_LOADOUT,
      hat: "neon-mirage-hat",
    });
    expect(Object.keys(account).sort()).toEqual([
      "equippedGear", "ownedGear", "pets", "revision", "scrip", "selectedPetId",
      "slateTortoisePityMisses", "version",
    ]);
    expect(petShared.sanitizeMetaAccountV3({ version: 3, ownedGear: {} }).ownedGear)
      .toEqual([...petShared.STARTER_GEAR_IDS]);
    expect(petShared.sanitizeMetaAccountV3({ version: 99, ownedGear: ["neon-mirage-hat"] }))
      .toEqual(petShared.createMetaAccountV3());
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
        shirt: "reinforced-workshirt",
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

  it("uses the identical old quirk object/modifier seam when a hat carries that quirk", () => {
    const loadout = { ...petShared.STARTER_GEAR_LOADOUT, hat: "ash-walker-hat" } as const;
    const gear = petShared.resolveGearLoadout(loadout);
    const legacy = petShared.quirkForCharacter("cc-asha-the-ash-walker");
    expect(gear.quirk).toBe(legacy);
    expect(gear.quirk.hooks?.onParrySuccess?.({ parryHeal: 9 }))
      .toEqual(legacy.hooks?.onParrySuccess?.({ parryHeal: 9 }));
    const neon = petShared.resolveGearLoadout({
      ...petShared.STARTER_GEAR_LOADOUT,
      hat: "neon-mirage-hat",
    });
    expect(neon.mods.drawLockMult).toBe(
      petShared.runtimeModsForQuirk(
        petShared.quirkForCharacter("cc-neon-mirage"),
      ).drawLockMult,
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

  it("pins schema 28 and appends two cosmetic strings to the final schema-27 envelope", () => {
    expect(petShared.SCHEMA_VERSION).toBe(28);
    const playerSymbols = Object.getOwnPropertySymbols(petShared.PlayerState);
    const playerMetadata = (petShared.PlayerState as unknown as Record<symbol, Record<number, { name: string }>>)[playerSymbols[0]!];
    if (!playerMetadata) throw new Error("PlayerState schema metadata is required");
    expect(playerMetadata[63]?.name).toBe("dualWield");
    expect(playerMetadata[64]).toBeUndefined();
    const tailSymbols = Object.getOwnPropertySymbols(petShared.DualWieldState);
    const tailMetadata = (petShared.DualWieldState as unknown as Record<symbol, Record<number, { name: string }>>)[tailSymbols[0]!];
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
