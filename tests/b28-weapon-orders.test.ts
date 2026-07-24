import {
  ACTIVE_EXPANSION_WEAPON_IDS,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  createMetaAccountV5,
  DROP_POOL,
  lockedPackCandidates,
  meleeDamageEnvelopeFor,
  thrownProjectileRotationPolicy,
  WEAPON_IDS,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  BARREL_ROLL_RATE_RADIANS_PER_SECOND,
  barrelRollArtTransform,
} from "../packages/client/src/scenes/arena/projectile-facing.js";
import {
  generatedImageHeldBladeOverlayTransform,
  resolveGeneratedImageWeaponVfxRecipe,
} from "../packages/client/src/vfx/generated-image-weapon-vfx-recipes.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import { weaponPaintedSwingFor, weaponVfxSuiteFor } from "../packages/client/src/vfx/weapon-vfx-suite.js";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B28 weapon fixture: ${id}`);
  return definition;
}

describe("B28 owner weapon orders", () => {
  it("keeps exactly one authored treatment on Tempest Regent and Gatebreaker", () => {
    expect(Object.keys(WEAPON_VFX["drift-greatkatana-tempest-regent"]?.suite ?? {})).toEqual([
      "edge-trail",
    ]);
    expect(Object.keys(WEAPON_VFX["drift-nodachi-gatebreaker"]?.suite ?? {})).toEqual([
      "slash-arc",
    ]);
  });

  it("doubles Bowie Fangs visually without enlarging its collision blade", () => {
    const fangs = weapon("twin-bowie-fangs");
    expect(fangs.displayLength).toBe(62 * 2);
    expect(fangs.collisionLength).toBe(62);
  });

  it("leaves Thunderhead electric-only with no painted or fallback blue layer", () => {
    const voulge = weapon("x2-thunderhead-voulge");
    expect(voulge).toMatchObject({
      suppressVfx: true,
      chainLightning: { jumps: 4, damage: 6, falloff: 0.8 },
    });
    expect(voulge.effectRecipe).toBeUndefined();
    expect(resolveWeaponEffectRecipe(voulge)).toBeUndefined();
    expect(weaponPaintedSwingFor(voulge.id)).toBeUndefined();
    expect(WEAPON_VFX[voulge.id]).toBeUndefined();
    expect(weaponVfxSuiteFor(voulge.id, voulge.tags.element, "chop").suite).toEqual({});
  });

  it("keeps the Spontoon path-aligned while its paper transform mirror-turns", () => {
    const spontoon = weapon("x2-sidewinder-spontoon");
    expect(thrownProjectileRotationPolicy(spontoon)).toBe("barrel-roll");
    expect(barrelRollArtTransform(90, 0, 0)).toEqual({ rotation: 0, scaleY: 1 });
    const halfTurnSeconds = Math.PI / BARREL_ROLL_RATE_RADIANS_PER_SECOND;
    expect(barrelRollArtTransform(90, 0, halfTurnSeconds).rotation).toBe(0);
    expect(barrelRollArtTransform(90, 0, halfTurnSeconds).scaleY).toBeCloseTo(-1, 10);
    expect(barrelRollArtTransform(-90, 0, halfTurnSeconds / 2).rotation).toBeCloseTo(
      Math.PI,
      10,
    );
    expect(barrelRollArtTransform(-90, 0, halfTurnSeconds / 2).scaleY).toBeCloseTo(0, 10);
  });

  it("authors Venomtongue's two-times nav lunge and destination impact", () => {
    expect(weapon("x2-venomtongue-trident").performance?.lunge).toEqual({
      distancePx: 128,
      durationSeconds: 0.28,
      impactAtDestination: true,
    });
  });

  it("scales the mallet by 33% while keeping both hands on its painted handle", () => {
    const mallet = weapon("x2-squeaky-mallet");
    expect(mallet.displayLength).toBeCloseTo(116 * 1.33, 10);
    expect(mallet.collisionLength).toBe(90);
    expect(mallet.gripPoints).toEqual({
      primary: { x: 0.14, y: 0.55 },
      secondary: { x: 0.38, y: 0.55, role: "handle" },
    });
  });

  it("archives the Boomerang Boot out of active, drop, and booster-pack pools", () => {
    const id = "x2-boomerang-boot";
    expect(weapon(id).archived).toBe(true);
    expect(ARCHIVED_WEAPON_IDS).toContain(id);
    expect(ACTIVE_WEAPON_CATALOG_IDS).not.toContain(id);
    expect(ACTIVE_EXPANSION_WEAPON_IDS).not.toContain(id);
    expect(WEAPON_IDS).not.toContain(id);
    expect(DROP_POOL).not.toContain(id);
    expect(lockedPackCandidates(createMetaAccountV5(), "weapon").map((row) => row.id)).not.toContain(
      id,
    );
  });

  it("registers Dustreaper fire from blade root to tip with no reach extension", () => {
    const dustreaper = weapon("x2-dustreaper-zweihander");
    const recipe = resolveGeneratedImageWeaponVfxRecipe(dustreaper.id);
    expect(recipe).toMatchObject({
      kind: "fire-dragon-sweep",
      bladeOverlay: { lengthMultiplier: 1, widthMultiplier: 1 },
    });
    if (!recipe) throw new Error("Missing Dustreaper generated-image recipe");
    const right = generatedImageHeldBladeOverlayTransform(
      {
        x: 300,
        y: 120,
        angle: 0,
        axisX: 1,
        axisY: 0,
        normalX: 0,
        normalY: 1,
        physicalBladeLength: 180,
        bladeWidth: 28,
        depth: 10,
      },
      recipe,
    );
    const left = generatedImageHeldBladeOverlayTransform(
      {
        x: 100,
        y: 120,
        angle: Math.PI,
        axisX: -1,
        axisY: 0,
        normalX: 0,
        normalY: -1,
        physicalBladeLength: 180,
        bladeWidth: 28,
        depth: 10,
      },
      recipe,
    );
    expect(right).toMatchObject({ rootX: 120, tipX: 300, displayLength: 180, normalSign: 1 });
    expect(left).toMatchObject({ rootX: 280, tipX: 100, displayLength: 180, normalSign: 1 });
    const envelope = meleeDamageEnvelopeFor(dustreaper);
    expect(envelope.maxReach).toBe(envelope.baseReach);
    expect(envelope.maxHalfWidth).toBe(envelope.baseHalfWidth);
  });

  it("fires three Bramble arrows at unchanged aggregate shot damage", () => {
    const gun = weapon("x2-buckshot-bramble-bow").gun;
    expect(gun).toMatchObject({ pellets: 3, damage: 8, fireRate: 0.55 });
    expect((gun?.pellets ?? 0) * (gun?.damage ?? 0)).toBe(6 * 4);
    expect(((gun?.pellets ?? 0) * (gun?.damage ?? 0)) / (gun?.fireRate ?? 1)).toBeCloseTo(
      24 / 0.55,
      10,
    );
  });
});
