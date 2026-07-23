import { existsSync, readFileSync } from "node:fs";
import {
  ACTIVE_EXPANSION_WEAPON_IDS,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  DROP_POOL,
  ENEMY_KINDS,
  EXPANSION_WEAPON_IDS,
  isWeaponAcquisitionAllowed,
  meleeComboSelectionFor,
  swingStyleFor,
  WEAPON_CATALOG_IDS,
  WEAPON_IDS,
  WEAPON_RESOURCE_IDS,
  WEAPON_RESOURCE_PROFILES,
  WEAPONS,
  type WeaponProvenance,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import {
  movementPostureFor,
  weaponPoseFamilyFor,
} from "../packages/client/src/sprites/pose-language.js";
import { resolveQuakeVfxRecipe } from "../packages/client/src/vfx/quake-vfx-recipes.js";

const ARCHIVE_IDS = [
  "drift-wakizashi-hushglass",
  "drift-wakizashi-kagewake",
  "x2-dust-devil-flail",
  "x2-ferrous-serpent",
  "x2-locust-flail",
  "x2-mistral-kusarigama",
  "x2-nine-tail-razorlash",
  "x2-coffin-nail-carbine",
  "x2-psalter-of-the-burning-halo",
  "x2-quicksilver-chainblade",
  "x2-snakebite-lash",
] as const;
const CURATED_ARCHIVE_IDS = new Set(["drift-wakizashi-hushglass", "drift-wakizashi-kagewake"]);

describe("W4A weapon archive contracts", () => {
  it("keeps eleven durable catalog rows while excluding them from every active acquisition census", () => {
    expect([...ARCHIVED_WEAPON_IDS].sort()).toEqual([...ARCHIVE_IDS].sort());
    expect(WEAPON_CATALOG_IDS).toHaveLength(357);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(346);
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(11);
    expect(ACTIVE_EXPANSION_WEAPON_IDS).toHaveLength(317);
    expect(WEAPON_RESOURCE_IDS).toHaveLength(357);

    const provenances: WeaponProvenance[] = [
      "enemy-drop",
      "boss-drop",
      "tutorial-drop",
      "migration-earned",
    ];
    for (const id of ARCHIVE_IDS) {
      expect(WEAPONS[id]?.archived, id).toBe(true);
      if (CURATED_ARCHIVE_IDS.has(id)) expect(EXPANSION_WEAPON_IDS, id).not.toContain(id);
      else expect(EXPANSION_WEAPON_IDS, id).toContain(id);
      expect(ACTIVE_EXPANSION_WEAPON_IDS, id).not.toContain(id);
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).not.toContain(id);
      expect(WEAPON_IDS, id).not.toContain(id);
      expect(DROP_POOL, id).not.toContain(id);
      expect(WEAPON_RESOURCE_PROFILES[id], id).toBeDefined();
      for (const provenance of provenances) {
        expect(isWeaponAcquisitionAllowed(id, provenance), `${id}/${provenance}`).toBe(false);
      }
    }
  });

  it("never assigns an archived definition to an enemy wield/drop identity", () => {
    const wielded = Object.values(ENEMY_KINDS)
      .map((kind) => kind.wieldsWeapon)
      .filter((id): id is string => !!id);
    for (const id of wielded) expect(WEAPONS[id]?.archived, id).not.toBe(true);
    for (const id of ARCHIVE_IDS) expect(wielded, id).not.toContain(id);
  });

  it("regenerates the portal and default Weaponsmith listing with 346 active rows", () => {
    const portal = readFileSync("tools/portal/index.html", "utf8");
    const smith = readFileSync("tools/weaponsmith/public/index.html", "utf8");
    const smithServer = readFileSync("tools/weaponsmith/server.mjs", "utf8");
    expect(portal).toContain('"count":346');
    expect(smith).toContain("Search 346 active weapons");
    expect(smith).toContain('aria-setsize="346"');
    expect(smithServer).toContain("definition.archived === true");
    for (const id of ARCHIVE_IDS) {
      expect(portal, id).not.toContain(`/?dev=weapon:${id}`);
    }
  });
});

describe("W4A Widowmaker rigid-maul redo", () => {
  it("preserves stats while resolving weighted rigid-maul stance and the V3X quake variant", () => {
    const weapon = WEAPONS["x2-widowmaker-wrecking-ball"];
    expect(weapon).toBeDefined();
    if (!weapon) throw new Error("Widowmaker Wrecking-Ball definition is missing");
    expect({
      damage: weapon.damage,
      range: weapon.range,
      halfArc: weapon.halfArc,
      cooldown: weapon.cooldown,
      displayLength: weapon.displayLength,
      swingArc: weapon.swingArc,
      gripFrac: weapon.gripFrac,
    }).toEqual({
      damage: 15,
      range: 175,
      halfArc: 1.1,
      cooldown: 0.88,
      displayLength: 220,
      swingArc: 3.2,
      gripFrac: 0.09,
    });
    expect(weapon.tags).toMatchObject({
      family: "maul",
      grip: "2H",
      size: "XL",
      delivery: "melee-slam",
    });
    expect(weapon.quake).toEqual({ radius: 170, damage: 9 });
    expect(swingStyleFor(weapon)).toBe("chop");
    expect(meleeComboSelectionFor(weapon)?.variant).toBe("quake-mauler");
    expect(weaponPoseFamilyFor(weapon)).toBe("two-hand-heavy");
    expect(movementPostureFor(weapon).key).toBe("weighted");
    expect(resolveQuakeVfxRecipe(weapon)).toMatchObject({
      variant: "aftershock-eruption",
      element: "physical",
      pack: "quake-burst",
    });
  });

  it("registers the re-rendered weapon sprite as one rigid part", () => {
    const manifest = SPRITES["x2-widowmaker-wrecking-ball"];
    expect(manifest.kind).toBe("weapon");
    expect(manifest.parts).toHaveLength(1);
    expect(manifest.parts[0]?.role).toBe("part-1");
    expect(
      existsSync("packages/client/public/sprites/x2-widowmaker-wrecking-ball/part-1.png"),
    ).toBe(true);
  });
});
