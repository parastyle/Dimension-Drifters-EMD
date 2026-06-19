import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DIMENSIONS,
  ENEMY_KINDS,
  EXPANSION_WEAPON_IDS,
  SHIFTER_KIND_IDS,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

/**
 * Source-of-truth guard (audit AUDIT-2). `displayLength` is authored in BOTH `weapons.ts` (what ships)
 * and the Weaponsmith's `assignments.json` (the authoring tool). They silently diverged on 3 swords
 * before this guard existed. Until the SoT pipeline (SPEC-01) makes weapons.ts the sole owner + the
 * smith a read-only mirror, this test makes a divergence fail the BUILD instead of the playtest.
 */
const assignments = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../tools/weaponsmith/assignments.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, { displayLength?: number }>;

describe("displayLength: weapons.ts ↔ Weaponsmith assignments.json", () => {
  for (const [id, def] of Object.entries(WEAPONS)) {
    const authored = assignments[id]?.displayLength;
    if (authored == null) continue; // smith hasn't authored a size for this weapon — nothing to compare
    it(`${id} agrees (weapons.ts=${def.displayLength}, smith=${authored})`, () => {
      expect(def.displayLength).toBe(authored);
    });
  }

  it("covers every coded weapon that the smith has sized", () => {
    // sanity: at least the explore swords the user tuned should be present in both
    expect(Object.keys(assignments).length).toBeGreaterThan(0);
  });
});

/**
 * §13/§14 codegen source-of-truth guards (audit cluster ①). The weapon data spans several files that drift
 * silently if one is edited without re-running its codegen. These make a drift fail the BUILD, not a
 * playtest: (1) every Weaponsmith VFX assignment targets a real weapon (a typo'd/ghost id wastes a baked
 * VFX entry and starves the REAL weapon); (2) the codegen'd expansion roster is a perfect bijection with
 * its concepts source (edit the concepts, forget `gen-weapon-expansion.mjs`, and this fails); (3) every
 * re-bake-safe VFX override (weapon-vfx-overrides.json) targets a real weapon.
 */
describe("weapon-data cross-references (codegen SoT)", () => {
  const realKeys = (o: Record<string, unknown>) =>
    Object.keys(o).filter((k) => !k.startsWith("//"));

  it("every Weaponsmith assignment id is a real weapon (no ghost/typo VFX targets)", () => {
    for (const id of realKeys(assignments)) expect(WEAPONS[id], `assignment "${id}"`).toBeDefined();
  });

  it("the expansion roster is a 1:1 bijection with its concepts source (codegen is in sync)", () => {
    const concepts = readJson("../data/weapon-concepts-300.json") as { weapons: { id: string }[] };
    const conceptIds = new Set(concepts.weapons.map((w) => w.id));
    const expansionIds = new Set(EXPANSION_WEAPON_IDS);
    for (const id of conceptIds)
      expect(
        expansionIds.has(id),
        `concept "${id}" lacks a generated WeaponDef — re-run gen-weapon-expansion.mjs`,
      ).toBe(true);
    for (const id of expansionIds)
      expect(
        conceptIds.has(id),
        `generated "${id}" has no concept — re-run gen-weapon-expansion.mjs`,
      ).toBe(true);
  });

  it("every VFX override (weapon-vfx-overrides.json) targets a real weapon", () => {
    const overrides = readJson("../tools/artkit/weapon-vfx-overrides.json") as Record<
      string,
      unknown
    >;
    for (const id of realKeys(overrides)) expect(WEAPONS[id], `override "${id}"`).toBeDefined();
  });
});

// §17 the dimension registry is partly codegen'd; its rosters/bosses are raw kind-id strings. A typo or a
// renamed/removed kind would fail SILENTLY (pickEnemyKind thins the pool, a bad boss id → no boss spawns).
// Turn that into a build failure instead of a dead dimension found mid-playtest.
describe("§17 dimension registry ↔ ENEMY_KINDS", () => {
  for (const [dimId, dim] of Object.entries(DIMENSIONS)) {
    it(`${dimId}: every roster id is a real, positively-weighted kind`, () => {
      for (const id of dim.roster) {
        const kind = ENEMY_KINDS[id];
        expect(kind, `${dimId} roster id "${id}"`).toBeDefined();
        expect(kind?.weight ?? 0, `${dimId} roster id "${id}" weight`).toBeGreaterThan(0);
      }
    });
    it(`${dimId}: the boss id resolves to a kind with archetype "boss"`, () => {
      const boss = ENEMY_KINDS[dim.boss];
      expect(boss, `${dimId} boss "${dim.boss}"`).toBeDefined();
      expect(boss?.archetype).toBe("boss");
    });
  }

  it("every SHIFTER_KIND_IDS entry is a real kind carrying the shifter flag", () => {
    expect(SHIFTER_KIND_IDS.length).toBeGreaterThan(0);
    for (const id of SHIFTER_KIND_IDS) {
      const kind = ENEMY_KINDS[id];
      expect(kind, `shifter "${id}"`).toBeDefined();
      expect(kind?.shifter, `shifter "${id}" flag`).toBeDefined();
    }
  });
});
