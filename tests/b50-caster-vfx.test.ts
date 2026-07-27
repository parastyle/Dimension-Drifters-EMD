import { existsSync, readFileSync } from "node:fs";
import {
  ACTIVE_EXPANSION_WEAPON_IDS,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  createMetaAccountV5,
  DROP_POOL,
  lockedPackCandidates,
  STARTER_UNLOCKED_WEAPON_IDS,
  WEAPON_CATALOG_IDS,
  WEAPON_RESOURCE_PROFILES,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  chargeHoldsTomeOpen,
  tomeOpenArtFor,
  writeTomeCenterWorldPoint,
} from "../packages/client/src/sprites/tome-open-art.js";
import {
  BEAM_STRUCTURE_FAMILY_BY_WEAPON,
  resolveCasterVfxRecipe,
} from "../packages/client/src/vfx/caster-vfx-recipes.js";
import {
  VERDIGRIS_PAGE_CONE_COUNT,
  VERDIGRIS_PAGE_CONE_HALF_ANGLE_RAD,
  verdigrisPageConeLane,
} from "../packages/client/src/vfx/page-projectile-art.js";

const ORRERY_ID = "x2-hexbinder-s-iron-orrery";
const EMBERLEAF_ID = "x2-emberleaf-chapbook";
const VERDIGRIS_ID = "x2-verdigris-grand-grimoire";
const CINDERQUILL_ID = "x2-cinderquill-almanac";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B50 weapon fixture: ${id}`);
  return definition;
}

describe("B50 caster/VFX corrections", () => {
  it("converts the Orrery to the shipped purple beam pipeline within ten percent of prior DPS", () => {
    const definition = weapon(ORRERY_ID);
    const oldScatterDps = (8 * (5 + 6)) / 0.66;
    expect(definition.scatter).toBeUndefined();
    expect(definition.beam).toMatchObject({
      damagePerSecond: 130,
      tickRate: 0.1,
      range: 320,
      width: 56,
      chargeSeconds: 0.65,
      sweepLagSeconds: 0.28,
    });
    if (!definition.beam) throw new Error("B50 Orrery beam is missing");
    expect(definition.beam.damagePerSecond / oldScatterDps).toBeGreaterThanOrEqual(0.9);
    expect(definition.beam.damagePerSecond / oldScatterDps).toBeLessThanOrEqual(1.1);
    expect(definition.tags).toMatchObject({
      delivery: "beam",
      fireMode: "hold",
      element: "arcane",
    });
    expect(definition.chainLightning).toBeUndefined();
    expect(definition.performance?.aura).toBeUndefined();

    const recipe = resolveCasterVfxRecipe(definition)?.beam;
    expect(recipe).toMatchObject({
      signature: "hexbinder-purple-orrery-ray",
      widthProfile: "braided",
      edgeColor: 0x22083f,
      accentColor: 0x8d2ee8,
      coreColor: 0xf0d9ff,
      particleElement: "arcane",
      ripple: "double-helix",
      impact: { rings: 0 },
      structure: { family: "converging-strands" },
    });
    expect(BEAM_STRUCTURE_FAMILY_BY_WEAPON[ORRERY_ID]).toBe("converging-strands");
  });

  it("holds Emberleaf's painted open frame for the authoritative charge state and centers its anchor", () => {
    const definition = weapon(EMBERLEAF_ID);
    const art = tomeOpenArtFor(EMBERLEAF_ID);
    expect(definition.chargedProjectile).toBeDefined();
    expect(art).toMatchObject({
      textureKey: `tome-open:${EMBERLEAF_ID}`,
      url: `sprites/${EMBERLEAF_ID}/open.png`,
    });
    expect(existsSync(`packages/client/public/sprites/${EMBERLEAF_ID}/open.png`)).toBe(true);

    const image = {
      width: 100,
      height: 60,
      displayOriginX: 20,
      displayOriginY: 10,
    };
    const out = { x: 0, y: 0 };
    expect(chargeHoldsTomeOpen(true, definition.chargedProjectile !== undefined)).toBe(true);
    expect(writeTomeCenterWorldPoint({ a: 2, b: 0, c: 0, d: 3, tx: 10, ty: 20 }, image, out)).toBe(
      true,
    );
    expect(out).toEqual({ x: 70, y: 80 });
    expect(writeTomeCenterWorldPoint({ a: -2, b: 0, c: 0, d: 3, tx: 10, ty: 20 }, image, out)).toBe(
      true,
    );
    expect(out).toEqual({ x: -50, y: 80 });

    const arenaSource = readFileSync("packages/client/src/scenes/ArenaScene.ts", "utf8");
    expect(arenaSource).toContain("if (!rig.writeTomeCenter(muzzle))");
  });

  it("uses only the painted Verdigris open book and launches its pages in a forward cone", () => {
    const definition = weapon(VERDIGRIS_ID);
    expect(definition.chainLightning).toBeUndefined();
    expect(definition.performance?.aura).toBeUndefined();
    expect(tomeOpenArtFor(VERDIGRIS_ID)).toMatchObject({
      textureKey: `tome-open:${VERDIGRIS_ID}`,
      suppressPageTurnEffects: true,
    });

    const lanes = Array.from({ length: VERDIGRIS_PAGE_CONE_COUNT }, (_, index) =>
      verdigrisPageConeLane(index),
    );
    expect(lanes).toHaveLength(9);
    expect(lanes[0]?.angleOffsetRad).toBeCloseTo(-VERDIGRIS_PAGE_CONE_HALF_ANGLE_RAD, 10);
    expect(lanes.at(-1)?.angleOffsetRad).toBeCloseTo(VERDIGRIS_PAGE_CONE_HALF_ANGLE_RAD, 10);
    expect(lanes.map((lane) => lane.angleOffsetRad)).toEqual(
      [...lanes].map((lane) => lane.angleOffsetRad).sort((a, b) => a - b),
    );
    for (const lane of lanes) {
      expect(Math.abs(lane.angleOffsetRad)).toBeLessThanOrEqual(VERDIGRIS_PAGE_CONE_HALF_ANGLE_RAD);
      expect(Math.hypot(lane.startForward, lane.startLateral)).toBeLessThan(16);
      expect(lane.distanceScale).toBeGreaterThan(0.5);
    }
  });

  it("archives Cinderquill from every active and pack surface while retaining durable census pins", () => {
    const definition = weapon(CINDERQUILL_ID);
    const packIds = lockedPackCandidates(createMetaAccountV5(), "weapon").map((row) => row.id);
    expect(definition.archived).toBe(true);
    expect(ARCHIVED_WEAPON_IDS).toContain(CINDERQUILL_ID);
    expect(ACTIVE_WEAPON_CATALOG_IDS).not.toContain(CINDERQUILL_ID);
    expect(ACTIVE_EXPANSION_WEAPON_IDS).not.toContain(CINDERQUILL_ID);
    expect(DROP_POOL).not.toContain(CINDERQUILL_ID);
    expect(STARTER_UNLOCKED_WEAPON_IDS).not.toContain(CINDERQUILL_ID);
    expect(packIds).not.toContain(CINDERQUILL_ID);
    expect(WEAPON_RESOURCE_PROFILES[CINDERQUILL_ID]).toBeDefined();
    // Live totals derive from the catalog; the literal archive census remains the loss tripwire.
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(
      WEAPON_CATALOG_IDS.length - ARCHIVED_WEAPON_IDS.length,
    );
    expect(ACTIVE_EXPANSION_WEAPON_IDS).toHaveLength(
      ACTIVE_WEAPON_CATALOG_IDS.filter((id) => WEAPONS[id]?.expansion === true).length,
    );
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(20);
  });
});
