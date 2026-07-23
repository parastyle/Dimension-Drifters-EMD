import { readFileSync } from "node:fs";
import {
  ACTIVE_EXPANSION_WEAPON_IDS,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  DROP_POOL,
  ENEMY_KINDS,
  EXPANSION_WEAPON_IDS,
  isDropEligible,
  isWeaponAcquisitionAllowed,
  salvageArchivedWeaponBank,
  sanitizeWeaponBankV1,
  WEAPON_CATALOG_IDS,
  WEAPON_IDS,
  WEAPON_RESOURCE_IDS,
  WEAPON_RESOURCE_PROFILES,
  WEAPONS,
  type WeaponProvenance,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const PRE_B6_ARCHIVE_IDS = [
  "drift-wakizashi-hushglass",
  "drift-wakizashi-kagewake",
  "x2-dust-devil-flail",
  "x2-ferrous-serpent",
  "x2-locust-flail",
  "x2-mistral-kusarigama",
  "x2-nine-tail-razorlash",
  "x2-quicksilver-chainblade",
  "x2-snakebite-lash",
] as const;

const B6_ARCHIVE_IDS = ["x2-coffin-nail-carbine", "x2-psalter-of-the-burning-halo"] as const;

const B6_NAMES = {
  "x2-coffin-nail-carbine": "Coffin-Nail Carbine",
  "x2-psalter-of-the-burning-halo": "Psalter of the Burning Halo",
} as const;

const PROVENANCES: WeaponProvenance[] = [
  "enemy-drop",
  "boss-drop",
  "tutorial-drop",
  "migration-earned",
];

describe("B6 weapon catalog archives", () => {
  it("reports exactly the two ordered archive state changes", () => {
    const expected = [...PRE_B6_ARCHIVE_IDS, ...B6_ARCHIVE_IDS].sort();
    expect([...ARCHIVED_WEAPON_IDS].sort()).toEqual(expected);
    expect(WEAPON_CATALOG_IDS).toHaveLength(343);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(332);
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(11);
    expect(ACTIVE_EXPANSION_WEAPON_IDS).toHaveLength(303);
    expect(WEAPON_RESOURCE_IDS).toHaveLength(343);

    const concepts = JSON.parse(readFileSync("data/weapon-concepts-300.json", "utf8")) as {
      weapons: { id: string; archived?: boolean }[];
    };
    const sourceArchiveIds = concepts.weapons
      .filter((weapon) => weapon.archived === true)
      .map((weapon) => weapon.id)
      .sort();
    expect(sourceArchiveIds).toEqual(expected);
  });

  it("keeps both ids out of every new acquisition, roll, and selection surface", () => {
    const wielded = Object.values(ENEMY_KINDS)
      .map((kind) => kind.wieldsWeapon)
      .filter((id): id is string => typeof id === "string");

    for (const id of B6_ARCHIVE_IDS) {
      const definition = WEAPONS[id];
      expect(definition, id).toBeDefined();
      if (!definition) continue;
      expect(definition.archived, id).toBe(true);
      expect(EXPANSION_WEAPON_IDS, id).toContain(id);
      expect(ACTIVE_EXPANSION_WEAPON_IDS, id).not.toContain(id);
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).not.toContain(id);
      expect(WEAPON_IDS, id).not.toContain(id);
      expect(DROP_POOL, id).not.toContain(id);
      expect(isDropEligible(definition), id).toBe(false);
      expect(wielded, id).not.toContain(id);
      for (const provenance of PROVENANCES) {
        expect(isWeaponAcquisitionAllowed(id, provenance), `${id}/${provenance}`).toBe(false);
      }
    }
  });

  it("loads an existing inventory with both exact ids before the archive migration", () => {
    const fixture = JSON.parse(
      readFileSync("tests/fixtures/b6-archived-weapon-bank-v1.json", "utf8"),
    ) as unknown;
    const sanitized = sanitizeWeaponBankV1(fixture);
    expect(sanitized).toMatchObject({ ok: true, errors: [] });

    const loadedIds = sanitized.bank.stash.flatMap((entry) =>
      entry.kind === "pair"
        ? [entry.lead.weaponId, entry.offhand.weaponId]
        : [entry.weapon.weaponId],
    );
    expect(loadedIds).toEqual(B6_ARCHIVE_IDS);

    for (const id of loadedIds) {
      expect(WEAPONS[id]?.id, id).toBe(id);
      expect(WEAPONS[id]?.name, id).toBe(B6_NAMES[id as keyof typeof B6_NAMES]);
      expect(WEAPON_RESOURCE_PROFILES[id], id).toBeDefined();
    }

    const salvage = salvageArchivedWeaponBank(sanitized.bank);
    expect([...salvage.salvagedWeaponIds].sort()).toEqual([...B6_ARCHIVE_IDS].sort());
    expect(salvage).toMatchObject({
      salvagedInstances: 2,
      affectedEntries: 2,
      removedEntryIds: ["wi_b6coffinnail0000000000", "wi_b6burninghalo000000000"],
    });
    expect(salvage.payout).toBeGreaterThan(0);
    expect(sanitized.bank.stash).toEqual([]);
  });
});
